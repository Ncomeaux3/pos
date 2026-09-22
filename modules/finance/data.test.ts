import { afterAll, afterEach, describe, expect, it } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { db } = await import('@/core/db')
const { cashFlowByMonth, categorySeries, categorySpend, dueSoon, listTransactions, setCountPending } =
  await import('./data')
const { runningBalance } = await import('./money')
const { nightlyDigest } = await import('./jobs/nightly-digest')

// v1.2 phase 5a. The budget arithmetic against the real schema: only the
// expense kind is a budget, a credit filed there is a negative row and nets,
// and a pending row waits until it posts unless the setting says otherwise.

async function category(name: string): Promise<string> {
  const { rows } = await db().query<{ id: string }>(`select id from finance.category where name = $1`, [name])
  return rows[0].id
}

async function add(categoryName: string, cents: number, pending = false, daysAgo = 0): Promise<void> {
  const { rows } = await db().query<{ id: string }>(
    `insert into finance.account (name, kind, source, external_id) values ('Card', 'credit', 'demo', 'test-card')
     on conflict (source, external_id) do update set name = excluded.name returning id`,
  )
  await db().query(
    `insert into finance.transaction (account_id, descriptor, amount_cents, occurred_on, category_id, pending, source)
     values ($1, $2, $3, core.today() - $6::int, $4, $5, 'demo')`,
    [rows[0].id, categoryName, cents, await category(categoryName), pending, daysAgo],
  )
}

/** A row filed into `categoryName` in the month `monthsBack` months ago. */
async function addIn(categoryName: string, cents: number, monthsBack: number): Promise<void> {
  const { rows } = await db().query<{ id: string }>(
    `insert into finance.account (name, kind, source, external_id) values ('Card', 'credit', 'demo', 'test-card')
     on conflict (source, external_id) do update set name = excluded.name returning id`,
  )
  await db().query(
    // The sixth of the month, so the row lands in that month whatever today is.
    `insert into finance.transaction (account_id, descriptor, amount_cents, occurred_on, category_id, source)
     values ($1, $2, $3,
             (date_trunc('month', core.today()) - make_interval(months => $4::int))::date + 5,
             $5, 'demo')`,
    [rows[0].id, categoryName, cents, monthsBack, await category(categoryName)],
  )
}

afterEach(async () => {
  await db().query(`delete from finance.transaction where source = 'demo'`)
  await db().query(`delete from finance.subscription where source = 'demo'`)
  await db().query(`delete from finance.recurring where merchant like 'Test %'`)
  await db().query(`delete from finance.account where source = 'demo'`)
  await setCountPending(false)
})
afterAll(async () => {
  await db().end()
})

describe('listTransactions', () => {
  it('scopes to this month, so the rows under a budget are the rows behind its Spent', async () => {
    // The drawer used to filter the 60 most recent rows by category, so a
    // charge with newer rows in front of it vanished while its Spent figure
    // stayed. The list and the figure now read the same set.
    await add('Rent', 145_000)
    // Dated before this month began, whatever today is.
    await add('Rent', 99_000, false, new Date().getDate() + 1)

    const id = await category('Rent')
    const month = await listTransactions({ categoryId: id, thisMonth: true, limit: 1000 })
    expect(month.map((t) => Number(t.amount_cents))).toEqual([145_000])

    const spent = Number((await categorySpend()).find((c) => c.name === 'Rent')?.spent_cents)
    expect(spent).toBe(month.reduce((sum, t) => sum + Number(t.amount_cents), 0))

    // Without the scope the category's whole history comes back.
    expect(await listTransactions({ categoryId: id, limit: 1000 })).toHaveLength(2)
  })
})

describe('categorySpend', () => {
  it('lists expense categories only, so a card payment is in no budget', async () => {
    await add('Credit card payment', 231_000)
    const names = (await categorySpend()).map((c) => c.name)
    expect(names).toContain('Dining')
    expect(names).not.toContain('Credit card payment')
    expect(names).not.toContain('Income')
    expect(names).not.toContain('Refund')
  })

  it('nets a credit against its category and leaves a pending charge out until it posts', async () => {
    await add('Dining', 1000)
    await add('Dining', -300)
    await add('Dining', 500, true)
    const dining = async () => Number((await categorySpend()).find((c) => c.name === 'Dining')?.spent_cents)
    expect(await dining()).toBe(700)
    await setCountPending(true)
    expect(await dining()).toBe(1200)
  })
})

// v1.2 phase 5b. The three reads behind the new cards.

describe('cashFlowByMonth', () => {
  it('puts income and spending on their own sides and leaves a transfer off both', async () => {
    await addIn('Income', -400_000, 1)
    await addIn('Groceries', 30_000, 1)
    // Paying the card off is the owner's money moving between the owner's own
    // accounts. It is not a month's spending and not a month's income.
    await addIn('Credit card payment', 231_000, 1)
    await addIn('Statement credit', -5_000, 1)

    const flow = await cashFlowByMonth(6)
    expect(flow).toHaveLength(6)
    const last = flow[flow.length - 2]
    expect(Number(last.income_cents)).toBe(400_000)
    expect(Number(last.expense_cents)).toBe(25_000)
  })

  it('reads an uncategorised row by its sign, so a fresh pull is not an empty month', async () => {
    const { rows } = await db().query<{ id: string }>(
      `insert into finance.account (name, kind, source, external_id) values ('Card', 'credit', 'demo', 'test-card')
       on conflict (source, external_id) do update set name = excluded.name returning id`,
    )
    await db().query(
      `insert into finance.transaction (account_id, descriptor, amount_cents, occurred_on, source)
       values ($1, 'Unfiled charge', 4_200, core.today(), 'demo'),
              ($1, 'Unfiled deposit', -9_000, core.today(), 'demo')`,
      [rows[0].id],
    )

    const now = (await cashFlowByMonth(6)).at(-1)
    expect(Number(now?.expense_cents)).toBe(4_200)
    expect(Number(now?.income_cents)).toBe(9_000)
  })

  it('returns every month of the window, so a quiet month draws as zero rather than vanishing', async () => {
    const flow = await cashFlowByMonth(3)
    expect(flow.map((m) => m.month.slice(8))).toEqual(['01', '01', '01'])
    expect(flow.every((m) => Number(m.income_cents) === 0 && Number(m.expense_cents) === 0)).toBe(true)
  })
})

describe('dueSoon', () => {
  it('runs the checking balance down through the charges and lists a promoted detection once', async () => {
    const { rows } = await db().query<{ id: string }>(
      `insert into finance.account (name, kind, balance_cents, source, external_id)
       values ('Checking', 'checking', 500_000, 'demo', 'test-checking')
       on conflict (source, external_id) do update set balance_cents = excluded.balance_cents returning id`,
    )
    expect(rows).toHaveLength(1)

    await db().query(
      `insert into finance.recurring (merchant, amount_cents, cadence, last_charge_on, next_charge_on)
       values ('Test gym', 4_500, 'monthly', core.today() - 30, core.today() + 2),
              ('Test rent', 145_000, 'monthly', core.today() - 30, core.today() + 5)`,
    )
    // The owner promoted the rent to a curated subscription; it is one charge,
    // not two, however many tables know about it.
    await db().query(
      `insert into finance.subscription (name, amount_cents, cadence, next_charge_on, source, external_id)
       values ('Test rent', 145_000, 'monthly', core.today() + 5, 'demo', 'test-rent')`,
    )

    // A paused subscription is one whose charges stopped arriving. It is not
    // listed above, so it must not suppress the detection either.
    await db().query(
      `insert into finance.subscription (name, amount_cents, cadence, next_charge_on, status, source, external_id)
       values ('Test gym', 4_500, 'monthly', core.today() + 2, 'paused', 'demo', 'test-gym')`,
    )

    const { charges, checkingCents } = await dueSoon(14)
    expect(checkingCents).toBe(500_000)
    expect(charges.map((c) => [c.name, c.amountCents, c.isSubscription])).toEqual([
      ['Test gym', 4_500, false],
      ['Test rent', 145_000, true],
    ])
    // The column the card draws: the checking balance run down through them.
    expect(runningBalance(checkingCents ?? 0, charges.map((c) => c.amountCents))).toEqual([
      495_500, 350_500,
    ])
  })

  it('keeps a cancelled subscription out, and says so when there is no checking account', async () => {
    await db().query(
      `insert into finance.recurring (merchant, amount_cents, cadence, last_charge_on, next_charge_on)
       values ('Test streaming', 1_500, 'monthly', core.today() - 30, core.today() + 3)`,
    )
    // Cancel means stop showing me this. The detection is still in the table
    // and the nightly job will rewrite it, so only this read can honour it.
    await db().query(
      `insert into finance.subscription (name, amount_cents, cadence, next_charge_on, status, source, external_id)
       values ('Test streaming', 1_500, 'monthly', core.today() + 3, 'cancelled', 'demo', 'test-streaming')`,
    )

    const { charges, checkingCents } = await dueSoon(14)
    expect(charges).toHaveLength(0)
    // No checking account is not a balance of zero: the column goes rather
    // than counting every row down into a red number that says the money ran
    // out. The demo account above is a credit card.
    expect(checkingCents).toBeNull()
  })
})

describe('categorySeries', () => {
  it('buckets by month and drops a category with nothing in the window', async () => {
    await addIn('Dining', 1_000, 0)
    await addIn('Dining', 2_500, 2)

    const { months, categories } = await categorySeries(3)
    expect(months).toHaveLength(3)
    expect(months.every((m) => m.endsWith('-01'))).toBe(true)
    expect(categories.find((c) => c.name === 'Dining')?.months).toEqual([2_500, 0, 1_000])
    expect(categories.map((c) => c.name)).toEqual(['Dining'])
  })
})

describe('nightlyDigest', () => {
  it('nets this month for the tile head, transfers and all', async () => {
    await addIn('Income', -400_000, 0)
    await addIn('Groceries', 30_000, 0)
    // The tile leads with this number, so a card payment must not read as a
    // month that spent an extra $2,310.
    await addIn('Credit card payment', 231_000, 0)

    const digest = await nightlyDigest()
    expect(digest.netThisMonthCents).toBe(370_000)
  })
})
