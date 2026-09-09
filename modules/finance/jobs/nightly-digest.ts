import { db } from '@/core/db'
import { categorise, learnFrom, type Rule } from '../categorise'
import { detectRecurring, isStale, type Charge } from '../recurring'
import { categorySpend, listAccounts, loadRules, netWorthSeries, upcomingCharges } from '../data'
import { percent } from '../money'

export type FinanceDigest = {
  netWorthCents: number
  changeCents: number
  assetsCents: number
  debtCents: number
  /** Due in the next fortnight. */
  upcomingCents: number
  upcomingCount: number
  /** Categories past the alert threshold. */
  overBudget: { name: string; percent: number }[]
  unusual: { descriptor: string; amountCents: number; occurredOn: string }[]
}

/** SPEC's threshold: a category past this share of its limit is worth saying. */
const BUDGET_ALERT = 80

/** A single charge above this is worth a line in the digest whatever it was. */
const LARGE_CHARGE_CENTS = 50_000

export async function nightlyDigest(): Promise<FinanceDigest> {
  const [accounts, series, spend, upcoming] = await Promise.all([
    listAccounts(),
    netWorthSeries(30),
    categorySpend(),
    upcomingCharges(14),
  ])

  const netWorth = accounts.reduce((sum, a) => sum + Number(a.balance_cents), 0)
  const assets = accounts
    .filter((a) => Number(a.balance_cents) > 0)
    .reduce((sum, a) => sum + Number(a.balance_cents), 0)

  // The change comes from the series, not from summing per account deltas: an
  // account opened inside the window has no thirty day balance and would
  // otherwise count its whole balance as growth.
  const change = series.length > 1 ? netWorth - series[0].cents : 0

  const { rows: unusual } = await db().query<{
    descriptor: string
    amount_cents: string
    occurred_on: string
  }>(
    `select descriptor, amount_cents::text, occurred_on::text
       from finance.transaction
      where amount_cents > $1
        and occurred_on >= core.today() - 7
      order by amount_cents desc
      limit 5`,
    [LARGE_CHARGE_CENTS],
  )

  return {
    netWorthCents: netWorth,
    changeCents: change,
    assetsCents: assets,
    debtCents: assets - netWorth,
    upcomingCents: upcoming.reduce((sum, c) => sum + Number(c.amount_cents), 0),
    upcomingCount: upcoming.length,
    overBudget: spend
      .filter((c) => !c.is_fixed && c.limit_cents)
      .map((c) => ({
        name: c.name,
        percent: percent(Number(c.spent_cents), Number(c.limit_cents)),
      }))
      .filter((c) => c.percent >= BUDGET_ALERT),
    unusual: unusual.map((u) => ({
      descriptor: u.descriptor,
      amountCents: Number(u.amount_cents),
      occurredOn: u.occurred_on,
    })),
  }
}

/**
 * Snapshot every account's balance for today.
 *
 * Idempotent by primary key, so running the job twice in a day corrects the
 * snapshot rather than doubling it. This is the only thing that makes the net
 * worth chart possible: a balance not recorded on the day is gone.
 */
export async function snapshotBalances(): Promise<{ accounts: number }> {
  const { rowCount } = await db().query(
    `insert into finance.balance_daily (account_id, on_date, balance_cents)
     select id, core.today(), balance_cents from finance.account where archived = false
     on conflict (account_id, on_date) do update set balance_cents = excluded.balance_cents`,
  )
  return { accounts: rowCount ?? 0 }
}

/**
 * Categorise everything that has no category, rules first.
 *
 * A row the owner touched is never reconsidered: `is_manual` is the system's
 * one inviolable flag, and this job is the most frequent thing that would
 * otherwise trample it.
 *
 * Anything the rules miss is left uncategorised rather than sent to a model
 * from here. The model arm belongs behind the guard with a confidence and a
 * proposal, and burning a call per unmatched row on a nightly sweep is exactly
 * the cost the rules-first design exists to avoid.
 */
export async function categoriseNew(): Promise<{ matched: number; unmatched: number }> {
  const rules = await loadRules()
  const byName = new Map(rules.map((r) => [r.category, r.categoryId]))
  const shaped: Rule[] = rules.map((r) => ({
    category: r.category,
    pattern: r.pattern,
    isManual: r.isManual,
  }))

  const { rows } = await db().query<{ id: string; descriptor: string }>(
    `select id, descriptor from finance.transaction
      where category_id is null and is_manual = false
      limit 500`,
  )

  let matched = 0

  for (const row of rows) {
    const hit = categorise(row.descriptor, shaped)
    if (!hit) continue

    const categoryId = byName.get(hit.category)
    if (!categoryId) continue

    await db().query(
      `update finance.transaction
          set category_id = $2, classified_by = 'rule', confidence = 1
        where id = $1 and is_manual = false`,
      [row.id, categoryId],
    )
    matched++
  }

  return { matched, unmatched: rows.length - matched }
}

/**
 * Learn a rule from a correction the owner made by hand.
 *
 * Called when a transaction is recategorised in the UI. The next charge from
 * the same merchant is then a rule hit rather than a question, which is the
 * whole compounding value of the module.
 */
export async function learnRule(descriptor: string, categoryId: string): Promise<boolean> {
  const { rows } = await db().query<{ name: string }>(
    `select name from finance.category where id = $1`,
    [categoryId],
  )
  if (rows.length === 0) return false

  const rule = learnFrom(descriptor, rows[0].name)
  if (!rule) return false

  await db().query(
    `insert into finance.category_rule (category_id, pattern, is_manual)
     values ($1, $2, true)
     on conflict (pattern, category_id) do update set is_manual = true`,
    [categoryId, rule.pattern],
  )
  return true
}

/**
 * Re-run recurring detection over the last year and refresh the table.
 *
 * The detection is rewritten wholesale because it is derived: nothing the owner
 * edits lives in finance.recurring, and a subscription they curate is its own
 * row pointing back at it.
 */
export async function detectSubscriptions(): Promise<{ found: number; stale: number }> {
  const { rows } = await db().query<{ merchant: string; amount_cents: string; occurred_on: string }>(
    `select coalesce(nullif(merchant, ''), descriptor) as merchant,
            amount_cents::text, occurred_on::text
       from finance.transaction
      where occurred_on >= core.today() - 400`,
  )

  const charges: Charge[] = rows.map((r) => ({
    merchant: r.merchant,
    amountCents: Number(r.amount_cents),
    occurredOn: r.occurred_on,
  }))

  const found = detectRecurring(charges)

  for (const r of found) {
    await db().query(
      `insert into finance.recurring
         (merchant, amount_cents, cadence, occurrences, last_charge_on, next_charge_on)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (merchant) do update
         set amount_cents = excluded.amount_cents,
             cadence = excluded.cadence,
             occurrences = excluded.occurrences,
             last_charge_on = excluded.last_charge_on,
             next_charge_on = excluded.next_charge_on`,
      [r.merchant, r.amountCents, r.cadence, r.occurrences, r.lastChargeOn, r.nextChargeOn],
    )
  }

  // SPEC: a subscription with no matching charge in two cycles gets flagged.
  const { rows: subs } = await db().query<{
    id: string
    cadence: string
    last_charge_on: string | null
  }>(
    `select s.id, s.cadence, r.last_charge_on::text
       from finance.subscription s
       left join finance.recurring r on r.id = s.recurring_id
      where s.status = 'active'`,
  )

  const { rows: todayRows } = await db().query<{ today: string }>(
    `select core.today()::text as today`,
  )
  const today = todayRows[0].today

  let stale = 0
  for (const sub of subs) {
    if (!sub.last_charge_on) continue
    if (!isStale({ cadence: sub.cadence as 'monthly', lastChargeOn: sub.last_charge_on }, today)) {
      continue
    }
    // Flagged, not cancelled. The charge stopping might mean the card was
    // reissued, and this module does not get to decide you cancelled something.
    await db().query(`update finance.subscription set status = 'paused' where id = $1`, [sub.id])
    stale++
  }

  return { found: found.length, stale }
}
