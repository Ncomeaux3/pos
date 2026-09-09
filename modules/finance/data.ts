import { db } from '@/core/db'
import type { Cadence } from './recurring'

// Reads for the screen and the jobs. The shapes it renders and the arithmetic
// over them live in ./money.ts, ./recurring.ts and ./categorise.ts, which have
// no imports and can be pulled into a client component.

export type AccountRow = {
  id: string
  name: string
  institution: string
  kind: string
  balance_cents: string
  mask: string
  archived: boolean
  /** Balance thirty days ago, for the change column. Null when it was not tracked yet. */
  balance_30d_cents: string | null
  tx_count: string
}

/**
 * Accounts with their 30 day change.
 *
 * The comparison balance comes from finance.balance_daily, not from summing
 * transactions back: a brokerage moves on market change with no transaction at
 * all, and a balance derived from the ledger would say it never moved.
 */
export async function listAccounts(): Promise<AccountRow[]> {
  const { rows } = await db().query<AccountRow>(
    `select a.id, a.name, a.institution, a.kind, a.balance_cents::text, a.mask, a.archived,
            (select b.balance_cents::text from finance.balance_daily b
              where b.account_id = a.id and b.on_date <= core.today() - 30
              order by b.on_date desc limit 1) as balance_30d_cents,
            (select count(*)::text from finance.transaction t where t.account_id = a.id) as tx_count
       from finance.account a
      where a.archived = false
      order by a.balance_cents desc`,
  )
  return rows
}

/** One point per day for the chart, oldest first. */
export async function netWorthSeries(days = 30): Promise<{ on_date: string; cents: number }[]> {
  const { rows } = await db().query<{ on_date: string; cents: string }>(
    `select b.on_date::text, sum(b.balance_cents)::text as cents
       from finance.balance_daily b
      where b.on_date > core.today() - $1::int
      group by b.on_date
      order by b.on_date`,
    [days + 1],
  )
  return rows.map((r) => ({ on_date: r.on_date, cents: Number(r.cents) }))
}

export type CategorySpend = {
  id: string
  name: string
  description: string
  is_fixed: boolean
  limit_cents: string | null
  spent_cents: string
  tx_count: string
}

/**
 * This month's spending per category, against its limit.
 *
 * Income and transfers are excluded from spend: moving money between your own
 * accounts is not an expense, and counting it would make every month look twice
 * as expensive as it was.
 */
export async function categorySpend(): Promise<CategorySpend[]> {
  const { rows } = await db().query<CategorySpend>(
    `select c.id, c.name, c.description, c.is_fixed,
            b.limit_cents::text,
            coalesce(sum(t.amount_cents) filter (
              where t.occurred_on >= date_trunc('month', core.today())::date
            ), 0)::text as spent_cents,
            count(t.id)::text as tx_count
       from finance.category c
       left join finance.budget b
         on b.category_id = c.id and b.month = date_trunc('month', core.today())::date
       left join finance.transaction t on t.category_id = c.id
      where c.name not in ('Income', 'Transfer', 'Investing')
      group by c.id, c.name, c.description, c.is_fixed, b.limit_cents, c.position
      order by c.position`,
  )
  return rows
}

export type TransactionRow = {
  id: string
  descriptor: string
  merchant: string
  amount_cents: string
  occurred_on: string
  account_name: string
  category_name: string | null
  classified_by: string | null
  confidence: string | null
  is_manual: boolean
}

export async function listTransactions(filter: {
  accountId?: string
  categoryId?: string
  limit?: number
}): Promise<TransactionRow[]> {
  const { rows } = await db().query<TransactionRow>(
    `select t.id, t.descriptor, t.merchant, t.amount_cents::text, t.occurred_on::text,
            a.name as account_name, c.name as category_name,
            t.classified_by, t.confidence::text, t.is_manual
       from finance.transaction t
       join finance.account a on a.id = t.account_id
       left join finance.category c on c.id = t.category_id
      where ($1::uuid is null or t.account_id = $1)
        and ($2::uuid is null or t.category_id = $2)
      order by t.occurred_on desc, t.created_at desc
      limit $3`,
    [filter.accountId ?? null, filter.categoryId ?? null, filter.limit ?? 100],
  )
  return rows
}

export type UpcomingCharge = {
  id: string
  name: string
  vendor: string
  amount_cents: string
  next_charge_on: string
  cadence: Cadence
}

/** What is due in the next fortnight, which is the window the design shows. */
export async function upcomingCharges(days = 14): Promise<UpcomingCharge[]> {
  const { rows } = await db().query<UpcomingCharge>(
    `select id, name, vendor, amount_cents::text, next_charge_on::text, cadence
       from finance.subscription
      where status = 'active'
        and next_charge_on between core.today() and core.today() + $1::int
      order by next_charge_on`,
    [days],
  )
  return rows
}

/** Every rule, in the shape modules/finance/categorise.ts takes. */
export async function loadRules(): Promise<
  { category: string; categoryId: string; pattern: string; isManual: boolean }[]
> {
  const { rows } = await db().query<{
    category: string
    categoryId: string
    pattern: string
    isManual: boolean
  }>(
    `select c.name as category, c.id as "categoryId", r.pattern, r.is_manual as "isManual"
       from finance.category_rule r
       join finance.category c on c.id = r.category_id`,
  )
  return rows
}

/**
 * Set a budget limit for the current month.
 *
 * Per month rather than a standing limit, so raising a limit in March does not
 * quietly rewrite what February was measured against.
 */
export async function setBudget(categoryId: string, limitCents: number): Promise<void> {
  await db().query(
    `insert into finance.budget (category_id, month, limit_cents)
     values ($1, date_trunc('month', core.today())::date, $2)
     on conflict (category_id, month) do update set limit_cents = excluded.limit_cents`,
    [categoryId, limitCents],
  )
}
