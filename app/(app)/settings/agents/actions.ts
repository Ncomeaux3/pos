'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/core/auth'
import { setSetting } from '@/core/settings'
import { AUTONOMY_LEVELS, type Autonomy } from '@/core/autonomy'

export async function setAutonomy(level: Autonomy): Promise<void> {
  await requireOwner()
  // Validated rather than trusted: this decides whether an agent may write to
  // the owner's data without asking.
  if (!AUTONOMY_LEVELS.includes(level)) throw new Error(`Not an autonomy level: ${level}`)

  await setSetting('agent_autonomy', level)
  revalidatePath('/settings/agents')
}

/**
 * The token, only when the owner asks for it. The page renders a mask, so the
 * secret is not sitting in the HTML of a screen left open on a second monitor.
 */
export async function revealMcpToken(): Promise<string> {
  await requireOwner()
  return process.env.MCP_TOKEN ?? ''
}
