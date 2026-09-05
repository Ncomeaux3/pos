import Anthropic from '@anthropic-ai/sdk'
import { db } from './db'
import { getCredentials } from './integrations'
import { getSetting } from './settings'

/**
 * Cents per million tokens. Verified 2026-06-24 against Anthropic's pricing
 * table. Re-check this date before trusting the month to date figure, and
 * whenever a model is added.
 */
const PRICES = {
  'claude-haiku-4-5': { input: 100, output: 500 },
  'claude-sonnet-5': { input: 200, output: 1000 },
  'claude-opus-5': { input: 500, output: 2500 },
} as const

export type Model = keyof typeof PRICES

/**
 * Haiku classifies and writes headlines, Sonnet researches. The split is what
 * keeps the whole system inside a $10 a month cap.
 */
export type Purpose = 'classification' | 'headline' | 'research'

/** Only research is optional enough to stop. Classification keeps the system working. */
const CAPPED_PURPOSES: Purpose[] = ['research']

/** Distinct from a call that failed: the provider was never connected. */
export class NotConnected extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotConnected'
  }
}

export class SoftCapExceeded extends Error {
  constructor(spentCents: number, capCents: number) {
    super(
      `Model spend this month is ${(spentCents / 100).toFixed(2)} against a cap of ${(capCents / 100).toFixed(2)}. Raise llm_soft_cap_cents in Settings to continue research.`,
    )
    this.name = 'SoftCapExceeded'
  }
}

export function estimateCostCents(model: Model, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model]
  // Logging a zero cost for an unknown model would quietly break the cap.
  if (!price) throw new Error(`No price entry for model ${model}. Add it to PRICES in core/llm.ts.`)
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

export async function monthToDateCents(): Promise<number> {
  const { rows } = await db().query<{ total: string | null }>(
    `select sum(cost_cents) as total from core.llm_calls
     where occurred_at >= date_trunc('month', now())`,
  )
  return Number(rows[0]?.total ?? 0)
}

type CompleteArgs = {
  model: Model
  purpose: Purpose
  module?: string
  system?: string
  messages: Anthropic.MessageParam[]
  maxTokens?: number
}

/**
 * The only way anything in this system calls a model. Every call lands in
 * core.llm_calls so month to date spend is a query rather than a guess.
 */
export async function complete({
  model,
  purpose,
  module,
  system,
  messages,
  maxTokens = 4096,
}: CompleteArgs): Promise<string> {
  if (CAPPED_PURPOSES.includes(purpose)) {
    const [spent, cap] = await Promise.all([monthToDateCents(), getSetting('llm_soft_cap_cents')])
    if (spent >= cap) throw new SoftCapExceeded(spent, cap)
  }

  const client = new Anthropic({ apiKey: await apiKey() })
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages,
  })

  const inputTokens = response.usage?.input_tokens ?? 0
  const outputTokens = response.usage?.output_tokens ?? 0
  await db().query(
    `insert into core.llm_calls (model, purpose, module, input_tokens, output_tokens, cost_cents)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      model,
      purpose,
      module ?? null,
      inputTokens,
      outputTokens,
      estimateCostCents(model, inputTokens, outputTokens),
    ],
  )

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

/**
 * The key lives encrypted in core.connections, entered on Settings >
 * Connections. Nothing reads a provider key from .env.
 */
async function apiKey(): Promise<string> {
  const key = (await getCredentials('anthropic'))?.api_key
  if (!key) {
    throw new NotConnected('Anthropic is not connected. Connect it on Settings > Connections.')
  }
  return key
}
