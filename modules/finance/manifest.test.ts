import { afterAll, afterEach, describe, expect, it } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { db } = await import('@/core/db')
const { default: manifest } = await import('./manifest')

// v1.2 phase 5c. Editing a rule is an insert and a delete, because
// (pattern, category_id) is unique. The order of those two is the whole of
// what these tests hold: the old rule outlives a failed insert, and it is gone
// before the back-file runs, or it can win its own replacement.

const writeRule = (input: { id?: string; pattern: string; category_id: string }) =>
  manifest.tools.write_rule.run(input, { source: 'ui' }) as Promise<{
    pattern: string
    moved: number
  }>

async function account(): Promise<string> {
  const { rows } = await db().query<{ id: string }>(
    `insert into finance.account (name, kind, source, external_id)
     values ('Card', 'credit', 'demo', 'manifest-card')
     on conflict (source, external_id) do update set name = excluded.name
     returning id`,
  )
  return rows[0].id
}

async function category(name: string): Promise<string> {
  const { rows } = await db().query<{ id: string }>(
    `select id from finance.category where name = $1`,
    [name],
  )
  return rows[0].id
}

async function add(descriptor: string): Promise<string> {
  const { rows } = await db().query<{ id: string }>(
    `insert into finance.transaction
       (account_id, descriptor, merchant, amount_cents, occurred_on, source)
     values ($1, $2, lower($2), 1000, core.today(), 'demo')
     returning id`,
    [await account(), descriptor],
  )
  return rows[0].id
}

async function filedAs(id: string): Promise<string | null> {
  const { rows } = await db().query<{ name: string | null }>(
    `select c.name from finance.transaction t
       left join finance.category c on c.id = t.category_id
      where t.id = $1`,
    [id],
  )
  return rows[0].name
}

afterEach(async () => {
  await db().query(`delete from finance.transaction where source = 'demo'`)
  await db().query(`delete from finance.account where source = 'demo'`)
  await db().query(`delete from finance.category_rule where is_manual = true`)
})
afterAll(async () => {
  await db().end()
})

describe('finance.write_rule', () => {
  it('writes a rule and back-files the rows it matches', async () => {
    const one = await add('PUBLIX #1234')
    const two = await add('PUBLIX #0087')

    const result = await writeRule({ pattern: 'PUBLIX', category_id: await category('Groceries') })
    expect(result).toMatchObject({ pattern: 'publix', moved: 2 })
    expect(await filedAs(one)).toBe('Groceries')
    expect(await filedAs(two)).toBe('Groceries')
  })

  it('moves the rows when the rule moves to another category, leaving one rule', async () => {
    const row = await add('PUBLIX #1234')
    await writeRule({ pattern: 'publix', category_id: await category('Groceries') })

    const { rows } = await db().query<{ id: string }>(
      `select id from finance.category_rule where pattern = 'publix'`,
    )
    // The old rule has to be gone before the back-file: two rules of the same
    // pattern are the same length, so the one being replaced could win.
    await writeRule({ id: rows[0].id, pattern: 'publix', category_id: await category('Dining') })
    expect(await filedAs(row)).toBe('Dining')

    const { rows: after } = await db().query(
      `select 1 from finance.category_rule where pattern = 'publix'`,
    )
    expect(after).toHaveLength(1)
  })

  it('keeps the rule when nothing about it changed', async () => {
    await add('PUBLIX #1234')
    const groceries = await category('Groceries')
    await writeRule({ pattern: 'publix', category_id: groceries })
    const { rows } = await db().query<{ id: string }>(
      `select id from finance.category_rule where pattern = 'publix'`,
    )

    // Same pattern, same category: the insert lands on that very row, and
    // deleting by id afterwards would remove the rule the owner just saved.
    await writeRule({ id: rows[0].id, pattern: 'publix', category_id: groceries })
    const { rows: after } = await db().query(
      `select 1 from finance.category_rule where pattern = 'publix'`,
    )
    expect(after).toHaveLength(1)
  })

  it('refuses a pattern too short to be safe', async () => {
    // Two characters would match half the ledger, and a bad rule mis-files
    // quietly, which is the failure worth spending code to avoid.
    await expect(writeRule({ pattern: 'ab', category_id: await category('Dining') })).rejects.toThrow(
      /at least 4 letters/,
    )
    await expect(writeRule({ pattern: '12345', category_id: await category('Dining') })).rejects.toThrow()
  })
})

describe('finance.delete_rule', () => {
  it('hands the rows to whatever matches next', async () => {
    const row = await add('AMAZON PRIME 2H4KL')
    await writeRule({ pattern: 'amazon', category_id: await category('Shopping') })
    await writeRule({ pattern: 'amazon prime', category_id: await category('Subscriptions') })
    expect(await filedAs(row)).toBe('Subscriptions')

    const { rows } = await db().query<{ id: string }>(
      `select id from finance.category_rule where pattern = 'amazon prime'`,
    )
    const result = (await manifest.tools.delete_rule.run({ id: rows[0].id }, { source: 'ui' })) as {
      moved: number
    }
    expect(result.moved).toBe(1)
    expect(await filedAs(row)).toBe('Shopping')
  })
})
