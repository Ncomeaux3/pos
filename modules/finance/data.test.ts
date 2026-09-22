import { afterAll, afterEach, describe, expect, it } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { db } = await import('@/core/db')
const { categorySpend, setCountPending } = await import('./data')

// v1.2 phase 5a. The budget arithmetic against the real schema: only the
// expense kind is a budget, a credit filed there is a negative row and nets,
// and a pending row waits until it posts unless the setting says otherwise.

async function category(name: string): Promise<string> {
  const { rows } = await db().query<{ id: string }>(`select id from finance.category where name = $1`, [name])
  return rows[0].id
}

async function add(categoryName: string, cents: number, pending = false): Promise<void> {
  const { rows } = await db().query<{ id: string }>(
    `insert into finance.account (name, kind, source, external_id) values ('Card', 'credit', 'demo', 'test-card')
     on conflict (source, external_id) do update set name = excluded.name returning id`,
  )
  await db().query(
    `insert into finance.transaction (account_id, descriptor, amount_cents, occurred_on, category_id, pending, source)
     values ($1, $2, $3, core.today(), $4, $5, 'demo')`,
    [rows[0].id, categoryName, cents, await category(categoryName), pending],
  )
}

afterEach(async () => {
  await db().query(`delete from finance.transaction where source = 'demo'`)
  await db().query(`delete from finance.account where source = 'demo'`)
  await setCountPending(false)
})
afterAll(async () => {
  await db().end()
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
