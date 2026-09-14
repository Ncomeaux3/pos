import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const fileByRules = vi.fn()
vi.mock('./hubs', async () => {
  const actual = await vi.importActual<typeof import('./hubs')>('./hubs')
  return { ...actual, fileByRules: (...args: unknown[]) => fileByRules(...args) }
})

const embedChanged = vi.fn()
vi.mock('@/core/search', async () => {
  const actual = await vi.importActual<typeof import('@/core/search')>('@/core/search')
  return { ...actual, embedChanged: (...args: unknown[]) => embedChanged(...args) }
})

const { db } = await import('@/core/db')
const { captureText } = await import('./capture')

async function saved(id: string) {
  const { rows } = await db().query<{ title: string; body: string; kind: string; status: string; source: string }>(
    `select title, body, kind, status, source from brain.note where id = $1`,
    [id],
  )
  return rows[0]
}

beforeEach(() => {
  fileByRules.mockReset()
  embedChanged.mockReset()
  embedChanged.mockResolvedValue({ scanned: 0, indexed: 0, embedded: 0 })
})
afterEach(async () => {
  await db().query('delete from brain.link')
  await db().query('delete from brain.note')
  await db().query('delete from core.events')
  await db().query('delete from core.entities')
})
afterAll(async () => {
  await db().end()
})

describe('captureText', () => {
  it('splits the first line into the title and the rest into the body', async () => {
    const { id } = await captureText({ text: '  Postgres planner  \nhow it picks a join\nand why', worked: false })

    expect(await saved(id)).toEqual({
      title: 'Postgres planner',
      body: 'how it picks a join\nand why',
      kind: 'note',
      status: 'published',
      source: 'manual',
    })
  })

  it('keeps one line of text as both title and body', async () => {
    const { id } = await captureText({ text: 'Read DDIA chapter 5', worked: false })

    const row = await saved(id)
    expect(row.title).toBe('Read DDIA chapter 5')
    expect(row.body).toBe('Read DDIA chapter 5')
  })

  it('caps the title at 120 characters', async () => {
    const { id } = await captureText({ text: 'x'.repeat(200), worked: false })
    expect((await saved(id)).title).toHaveLength(120)
  })

  it('files a worked on entry as daily', async () => {
    const { id } = await captureText({ text: 'Shipped the hubs migration', worked: true })
    expect((await saved(id)).kind).toBe('daily')
  })

  it('files by rules and embeds so the note is related-able now', async () => {
    const { id } = await captureText({ text: 'Postgres planner\nbody', worked: false })

    expect(fileByRules).toHaveBeenCalledWith(id, 'Postgres planner', 'body')
    expect(embedChanged).toHaveBeenCalledTimes(1)
  })

  it('drafts for an agent', async () => {
    const { id, status } = await captureText({ text: 'From an agent', worked: false }, 'agent')
    expect(status).toBe('draft')
    expect((await saved(id)).source).toBe('agent')
  })
})
