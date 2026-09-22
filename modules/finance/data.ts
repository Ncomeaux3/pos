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
 * Only the expense kind is a budget: income is not spending, a transfer is
 * money moving between your own accounts, and a credit kind (a refund with no
 * charge to net against, a statement credit) is money back. A credit filed
 * into an expense category is a negative row there, so the signed sum is
 * already expense minus credit.
 *
 * Pending rows wait until they post unless `count_pending` is on: the amount
 * and the date both move when a charge settles.
 */
export async function categorySpend(): Promise<CategorySpend[]> {
  const { rows } = await db().query<CategorySpend>(
    `select c.id, c.name, c.description, c.is_fixed,
            b.limit_cents::text,
            coalesce(sum(t.amount_cents) filter (
              where t.occurred_on >= date_trunc('month', core.today())::date
                and (not t.pending or (select count_pending from finance.settings))
            ), 0)::text as spent_cents,
            count(t.id)::text as tx_count
       from finance.category c
       left join finance.budget b
         on b.category_id = c.id and b.month = date_trunc('month', core.today())::date
       left join finance.transaction t on t.category_id = c.id
      where c.kind = 'expense'
      group by c.id, c.name, c.description, c.is_fixed, b.limit_cents, c.position
      order by c.position`,
  )
  return rows
}

export type CategoryKind = 'expense' | 'income' | 'transfer' | 'credit'

/** Every category, for filing: a transaction can go anywhere, not only into a budget. */
export async function listCategories(): Promise<{ id: string; name: string; kind: CategoryKind }[]> {
  const { rows } = await db().query<{ id: string; name: string; kind: CategoryKind }>(
    `select id, name, kind from finance.category order by position`,
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
  pending: boolean
}

export async function listTransactions(filter: {
  accountId?: string
  categoryId?: string
  /** This calendar month only, in the owner's zone. What a budget's Spent covers. */
  thisMonth?: boolean
  /** Nothing filed it yet: what the Uncategorised chip lists. */
  uncategorised?: boolean
  limit?: number
}): Promise<TransactionRow[]> {
  const { rows } = await db().query<TransactionRow>(
    `select t.id, t.descriptor, t.merchant, t.amount_cents::text, t.occurred_on::text,
            a.name as account_name, c.name as category_name,
            t.classified_by, t.confidence::text, t.is_manual, t.pending
       from finance.transaction t
       join finance.account a on a.id = t.account_id
       left join finance.category c on c.id = t.category_id
      where ($1::uuid is null or t.account_id = $1)
        and ($2::uuid is null or t.category_id = $2)
        and (not $4::boolean or t.occurred_on >= date_trunc('month', core.today())::date)
        and (not $5::boolean or t.category_id is null)
      order by t.occurred_on desc, t.created_at desc
      limit $3`,
    [
      filter.accountId ?? null,
      filter.categoryId ?? null,
      filter.limit ?? 100,
      filter.thisMonth ?? false,
      filter.uncategorised ?? false,
    ],
  )
  return rows
}

export type RuleRow = {
  id: string
  pattern: string
  category_id: string
  category_name: string
  is_manual: boolean
  classified_by: string
  confidence: string | null
}

/**
 * Every stored rule, for the Rules drawer.
 *
 * The eleven built-ins are not here: they live in categorise.ts, are listed
 * read-only beside these, and a rule the owner writes already beats one in the
 * sort, so overriding a built-in is writing a rule. What categorise() needs at
 * match time is loadRuleSet() in ./rules.ts, which shapes both sets together.
 */
export async function listRules(): Promise<RuleRow[]> {
  const { rows } = await db().query<RuleRow>(
    `select r.id, r.pattern, r.category_id, c.name as category_name,
            r.is_manual, r.classified_by, r.confidence::text
       from finance.category_rule r
       join finance.category c on c.id = r.category_id
      order by r.pattern`,
  )
  return rows
}

/**
 * What the filter chips count.
 *
 * Counted rather than measured off the loaded rows: the tab loads the newest
 * few hundred and the whole point of the Uncategorised chip is that there were
 * 607 of them behind a window of 60.
 */
export async function transactionCounts(): Promise<{
  all: number
  uncategorised: number
  pending: number
}> {
  const { rows } = await db().query<{ all: string; uncategorised: string; pending: string }>(
    `select count(*)::text as all,
            count(*) filter (where category_id is null)::text as uncategorised,
            count(*) filter (where pending)::text as pending
       from finance.transaction`,
  )
  return {
    all: Number(rows[0].all),
    uncategorised: Number(rows[0].uncategorised),
    pending: Number(rows[0].pending),
  }
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

/**
 * The budget alert threshold, a Finance setting with one row. Categories past
 * this share of their limit are flagged on the screen, in the digest and in
 * the dashboard headline. 80 until the owner moves the slider.
 */
export async function getAlertThreshold(): Promise<number> {
  const { rows } = await db().query<{ alert_threshold: number }>(
    `select alert_threshold from finance.settings where id`,
  )
  return rows[0]?.alert_threshold ?? 80
}

export async function setAlertThreshold(percent: number): Promise<void> {
  await db().query(
    `insert into finance.settings (id, alert_threshold) values (true, $1)
     on conflict (id) do update set alert_threshold = excluded.alert_threshold`,
    [percent],
  )
}

/** Whether pending charges count toward a budget before they post. Off by default. */
export async function getCountPending(): Promise<boolean> {
  const { rows } = await db().query<{ count_pending: boolean }>(
    `select count_pending from finance.settings where id`,
  )
  return rows[0]?.count_pending ?? false
}

export async function setCountPending(on: boolean): Promise<void> {
  await db().query(
    `insert into finance.settings (id, count_pending) values (true, $1)
     on conflict (id) do update set count_pending = excluded.count_pending`,
    [on],
  )
}

/**
 * What the last bank pull said, per account, for the band. Read from the
 * job's own log row, so the band and the Agent log never disagree.
 */
export async function lastPullDetail(): Promise<string | null> {
  const { rows } = await db().query<{ detail: string | null }>(
    `select log->'output'->>'detail' as detail from core.jobs
      where module = 'finance' and name = 'sync_simplefin' and last_status = 'ok'
        -- A run the provider refused is recorded as ok and skipped; its
        -- detail is the refusal, which is the band's status dot, not a count.
        and log->'output'->>'skipped' = 'false'`,
  )
  return rows[0]?.detail ?? null
}

export type MonthFlow = {
  /** First of the month, "2026-04-01". */
  month: string
  /** Positive: money that arrived. */
  income_cents: string
  /** Positive: money that left, credits already netted off. */
  expense_cents: string
}

/**
 * Income against spending, one row per month, oldest first.
 *
 * The kinds decide the sides, as v1.2 phase 5a set them up: income is the
 * income kind with its sign flipped (money in is negative in this schema),
 * spending is the expense kind plus the credit kind, and because a credit is a
 * negative row that sum is already expense minus credit. A transfer is the
 * owner's money moving between the owner's own accounts and is on neither side.
 *
 * A row with no category yet is read by its sign, which is the whole point of
 * the sign convention: out is spending, in is income. Dropping it instead
 * would make a freshly pulled month look emptier than it was.
 *
 * Every month of the window comes back, zero or not: a gap drawn as a missing
 * bar and a gap drawn as no bar are different claims about the month.
 */
export async function cashFlowByMonth(months = 6): Promise<MonthFlow[]> {
  const { rows } = await db().query<MonthFlow>(
    `with spine as (
       select generate_series(
         date_trunc('month', core.today()) - make_interval(months => $1::int - 1),
         date_trunc('month', core.today()),
         interval '1 month'
       )::date as month
     ),
     tx as (
       select date_trunc('month', t.occurred_on)::date as month,
              t.amount_cents,
              coalesce(c.kind, case when t.amount_cents < 0 then 'income' else 'expense' end) as kind
         from finance.transaction t
         left join finance.category c on c.id = t.category_id
        where (not t.pending or (select count_pending from finance.settings))
     )
     select to_char(s.month, 'YYYY-MM-DD') as month,
            coalesce(sum(-t.amount_cents) filter (where t.kind = 'income'), 0)::text as income_cents,
            coalesce(sum(t.amount_cents) filter (where t.kind in ('expense', 'credit')), 0)::text as expense_cents
       from spine s
       left join tx t on t.month = s.month
      group by s.month
      order by s.month`,
    [months],
  )
  return rows
}

export type DueCharge = {
  id: string
  name: string
  vendor: string
  cadence: Cadence
  nextChargeOn: string
  amountCents: number
  /** A subscription the owner curates can be cancelled; a raw detection cannot. */
  isSubscription: boolean
}

/**
 * What leaves the account in the next fortnight, and what is left after each.
 *
 * Both sources, because they are not the same set. finance.subscription holds
 * what the owner curated; finance.recurring holds what the nightly detector
 * found, and nothing promotes one into the other. Reading only subscriptions
 * left this list empty on a real install while the detector had a dozen rows.
 * A detection the owner has already promoted is not listed twice.
 *
 * `checkingCents` is the largest checking account, which is where bills are
 * paid from, and null when there is no checking account at all: the screen
 * then drops the column rather than projecting every row down from zero and
 * claiming the money has run out. What is left after each charge is
 * runningBalance() over it, which has to re-run when a charge is cancelled, so
 * it is not a column here.
 */
export async function dueSoon(
  days = 14,
): Promise<{ charges: DueCharge[]; checkingCents: number | null }> {
  const [{ rows }, { rows: checking }] = await Promise.all([
    db().query<{
      id: string
      name: string
      vendor: string
      amount_cents: string
      next_charge_on: string
      cadence: Cadence
      is_subscription: boolean
    }>(
      `select * from (
         select s.id, s.name, s.vendor, s.amount_cents::text, s.next_charge_on::text,
                s.cadence, true as is_subscription
           from finance.subscription s
          where s.status = 'active'
            and s.next_charge_on between core.today() and core.today() + $1::int
         union all
         select r.id, r.merchant as name, '' as vendor, r.amount_cents::text, r.next_charge_on::text,
                r.cadence, false as is_subscription
           from finance.recurring r
          where r.next_charge_on between core.today() and core.today() + $1::int
            -- Active because it is already listed above, cancelled because
            -- Cancel means stop showing me this and the detection would
            -- otherwise come back on the next load with no Cancel on it.
            -- Paused is neither: it is the detector saying the charges stopped
            -- arriving, so if it now says one is due, that is worth showing.
            and not exists (
              select 1 from finance.subscription s
               where s.status in ('active', 'cancelled')
                 and (s.recurring_id = r.id or lower(s.name) = lower(r.merchant))
            )
       ) due
       order by next_charge_on, name`,
      [days],
    ),
    db().query<{ balance_cents: string }>(
      `select balance_cents::text from finance.account
        where kind = 'checking' and archived = false
        order by balance_cents desc limit 1`,
    ),
  ])

  return {
    checkingCents: checking[0] ? Number(checking[0].balance_cents) : null,
    charges: rows.map((r) => ({
      id: r.id,
      name: r.name,
      vendor: r.vendor,
      cadence: r.cadence,
      nextChargeOn: r.next_charge_on,
      amountCents: Number(r.amount_cents),
      isSubscription: r.is_subscription,
    })),
  }
}

export type CategorySeries = { id: string; name: string; months: number[] }

/**
 * Every expense category's spending, one number per month, oldest first.
 *
 * Every category in one read rather than one per selection: twenty categories
 * over a year is two hundred numbers, and a round trip per change of a select
 * would cost more than sending them all once.
 *
 * Categories with nothing in the whole window are dropped: a select holding
 * fourteen empty years is a worse control than one holding six real ones.
 */
export async function categorySeries(
  months = 12,
): Promise<{ months: string[]; categories: CategorySeries[] }> {
  const { rows } = await db().query<{ id: string; name: string; month: string; cents: string }>(
    `with spine as (
       select generate_series(
         date_trunc('month', core.today()) - make_interval(months => $1::int - 1),
         date_trunc('month', core.today()),
         interval '1 month'
       )::date as month
     )
     select c.id, c.name, to_char(s.month, 'YYYY-MM-DD') as month,
            coalesce(sum(t.amount_cents), 0)::text as cents
       from finance.category c
       cross join spine s
       left join finance.transaction t
         on t.category_id = c.id
        and date_trunc('month', t.occurred_on)::date = s.month
        and (not t.pending or (select count_pending from finance.settings))
      where c.kind = 'expense'
      group by c.id, c.name, c.position, s.month
      -- c.id in the sort because position is not unique: two categories
      -- sharing one would interleave their rows and the axis below, read off
      -- the first category's run, would cover half the window.
      order by c.position, c.id, s.month`,
  [months],
  )

  const byCategory = new Map<string, CategorySeries>()
  for (const row of rows) {
    const series = byCategory.get(row.id) ?? { id: row.id, name: row.name, months: [] }
    series.months.push(Number(row.cents))
    byCategory.set(row.id, series)
  }

  return {
    // The first category's own rows rather than the axis generated again in
    // TypeScript: the axis and the numbers on it then cannot disagree.
    months: rows.filter((r) => r.id === rows[0]?.id).map((r) => r.month),
    categories: [...byCategory.values()].filter((c) => c.months.some((m) => m !== 0)),
  }
}
