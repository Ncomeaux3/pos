import { db } from '@/core/db'
import { ownerToday } from '@/core/today'
import { BUILTIN_RULES, categorise, learnFrom, matchRefund, type Rule } from '../categorise'
import { detectRecurring, isStale, type Charge } from '../recurring'
import {
  cashFlowByMonth,
  categorySpend,
  dueSoon,
  getAlertThreshold,
  listAccounts,
  loadRules,
  netWorthSeries,
} from '../data'
import { percent } from '../money'
import { spine } from '@/core/series'

export type FinanceDigest = {
  netWorthCents: number
  changeCents: number
  assetsCents: number
  debtCents: number
  /** Due in the next fortnight, and the first of them by name. */
  upcomingCents: number
  upcomingCount: number
  nextCharge: { name: string; inDays: number } | null
  /**
   * Net worth over the last 30 days, in dollars, for the tile's sparkline.
   * One entry per day; null before the first balance was ever recorded, so the
   * tile draws the days it has rather than stretching them over the month.
   */
  netWorthSeries: (number | null)[]
  /** Categories past the alert threshold, and the threshold they were judged by. */
  overBudget: { name: string; percent: number }[]
  alertThreshold: number
  /**
   * This month so far: what arrived less what left, transfers excluded. The
   * tile head's one line, because a net worth that moved says nothing about
   * whether the month is being lived within its means.
   */
  netThisMonthCents: number
  /** Month to date, summed over the categories that have a budget this month. */
  spendCents: number
  budgetCents: number
  unusual: { descriptor: string; amountCents: number; occurredOn: string }[]
}

/** A single charge above this is worth a line in the digest whatever it was. */
const LARGE_CHARGE_CENTS = 50_000

export async function nightlyDigest(): Promise<FinanceDigest> {
  const [accounts, series, spend, upcoming, flow, today, alertThreshold] = await Promise.all([
    listAccounts(),
    netWorthSeries(30),
    categorySpend(),
    // The same read the screen's Upcoming card makes, so the dashboard tile
    // and the screen it links to cannot disagree about what is due.
    dueSoon(14),
    // One month, because the tile needs this month and nothing else.
    cashFlowByMonth(1),
    ownerToday(),
    // SPEC's 80 by default; the owner's own number once the slider has moved.
    getAlertThreshold(),
  ])

  const netWorth = accounts.reduce((sum, a) => sum + Number(a.balance_cents), 0)
  // Spend against budget is only meaningful where a budget exists; a category
  // with no limit this month is neither under nor over anything.
  const budgeted = spend.filter((c) => c.limit_cents)
  const assets = accounts
    .filter((a) => Number(a.balance_cents) > 0)
    .reduce((sum, a) => sum + Number(a.balance_cents), 0)

  // The change comes from the series, not from summing per account deltas: an
  // account opened inside the window has no thirty day balance and would
  // otherwise count its whole balance as growth.
  const days = spine(series, 30, today)
  const firstKnown = days.find((d) => d.observed)?.cents ?? null
  const change = firstKnown === null ? 0 : netWorth - firstKnown

  const { rows: unusual } = await db().query<{
    descriptor: string
    amount_cents: string
    occurred_on: string
  }>(
    `select t.descriptor, t.amount_cents::text, t.occurred_on::text
       from finance.transaction t
       left join finance.category c on c.id = t.category_id
      where t.amount_cents > $1
        and t.occurred_on >= core.today() - 7
        -- Paying a card off is large every month and unusual never.
        and coalesce(c.kind, 'expense') <> 'transfer'
      order by t.amount_cents desc
      limit 5`,
    [LARGE_CHARGE_CENTS],
  )

  return {
    netWorthCents: netWorth,
    changeCents: change,
    assetsCents: assets,
    debtCents: assets - netWorth,
    // Dollars, not cents: the line is a shape, and the numbers beside it are
    // where the precision belongs.
    netWorthSeries: days.map((d) => (d.cents === null ? null : Math.round(d.cents / 100))),
    upcomingCents: upcoming.charges.reduce((sum, c) => sum + c.amountCents, 0),
    upcomingCount: upcoming.charges.length,
    nextCharge: upcoming.charges[0]
      ? {
          name: upcoming.charges[0].name,
          inDays: Math.round(
            (Date.parse(`${upcoming.charges[0].nextChargeOn}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
              86_400_000,
          ),
        }
      : null,
    netThisMonthCents: Number(flow[0]?.income_cents ?? 0) - Number(flow[0]?.expense_cents ?? 0),
    spendCents: budgeted.reduce((sum, c) => sum + Number(c.spent_cents), 0),
    budgetCents: budgeted.reduce((sum, c) => sum + Number(c.limit_cents), 0),
    overBudget: spend
      .filter((c) => !c.is_fixed && c.limit_cents)
      .map((c) => ({
        name: c.name,
        percent: percent(Number(c.spent_cents), Number(c.limit_cents)),
      }))
      .filter((c) => c.percent >= alertThreshold),
    alertThreshold,
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
  const { rows: categoryRows } = await db().query<{ id: string; name: string }>(
    `select id, name from finance.category`,
  )
  const byName = new Map(categoryRows.map((c) => [c.name, c.id]))
  // Learned rules first, then the built-ins: the sort inside categorise puts a
  // manual rule ahead of both, so the owner's correction still wins.
  const shaped: Rule[] = [
    ...rules.map((r) => ({ category: r.category, pattern: r.pattern, isManual: r.isManual })),
    ...BUILTIN_RULES,
  ]

  // The owner's card institutions, so "CAPITAL ONE ONLINE PMT" is a payment.
  const { rows: institutionRows } = await db().query<{ institution: string }>(
    `select distinct institution from finance.account
      where kind = 'credit' and archived = false and institution <> ''`,
  )
  const institutions = institutionRows.map((r) => r.institution)

  // Recent charges on the cards, for refunds: money back from a merchant seen
  // in the last 90 days nets against that charge's category.
  const { rows: chargeRows } = await db().query<{
    merchant: string
    amount_cents: string
    category: string | null
  }>(
    `select t.merchant, t.amount_cents::text, c.name as category
       from finance.transaction t
       join finance.account a on a.id = t.account_id
       left join finance.category c on c.id = t.category_id
      where a.kind = 'credit' and t.amount_cents > 0
        and t.occurred_on >= core.today() - 90
      order by t.occurred_on desc`,
  )
  const charges = chargeRows.map((r) => ({
    merchant: r.merchant,
    amountCents: Number(r.amount_cents),
    category: r.category,
  }))

  const { rows } = await db().query<{
    id: string
    descriptor: string
    merchant: string
    amount_cents: string
    account_kind: string
  }>(
    `select t.id, t.descriptor, t.merchant, t.amount_cents::text, a.kind as account_kind
       from finance.transaction t
       join finance.account a on a.id = t.account_id
      where t.category_id is null and t.is_manual = false
      limit 500`,
  )

  let matched = 0

  for (const row of rows) {
    const category =
      categorise(row.descriptor, shaped, institutions)?.category ??
      matchRefund(
        { merchant: row.merchant, amountCents: Number(row.amount_cents), accountKind: row.account_kind },
        charges,
      )
    if (!category) continue

    const categoryId = byName.get(category)
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
    `select coalesce(nullif(t.merchant, ''), t.descriptor) as merchant,
            t.amount_cents::text, t.occurred_on::text
       from finance.transaction t
       left join finance.category c on c.id = t.category_id
      where t.occurred_on >= core.today() - 400
        -- A card paid off on the same day each month has every mark of a
        -- subscription and is not one.
        and coalesce(c.kind, 'expense') <> 'transfer'`,
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
