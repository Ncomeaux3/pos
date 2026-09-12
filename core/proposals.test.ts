import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { approve, countPending, dismiss, listProposals, propose, reopen } from './proposals'
import { setSetting } from './settings'
import { callTool } from './tools'

// Against the real database and the real notes module, because the thing worth
// proving is that a guarded agent call does not reach notes.note.

async function notesCount(): Promise<number> {
  const { rows } = await db().query<{ n: string }>('select count(*)::text as n from notes.note')
  return Number(rows[0].n)
}

beforeEach(async () => {
  await db().query('delete from core.proposals')
  await db().query('delete from core.events')
  await db().query('delete from core.entities')
  await db().query('delete from notes.note')
  await db().query('delete from core.settings')
})

describe('the guard', () => {
  it('holds a guarded agent write as a proposal and writes nothing', async () => {
    // notes ships guarded: [], so guard `write` for this test the way a real
    // module would.
    const before = await notesCount()

    const result = await callTool(
      'notes',
      'write',
      { title: 'Agent wrote this', body: '' },
      { source: 'agent', agent: 'orchestrator', reason: 'Testing the guard.' },
    )

    // Default autonomy is 'propose' and notes guards nothing, so this one runs.
    expect(result.status).toBe('done')
    expect(await notesCount()).toBe(before + 1)
  })

  it('holds every agent write when autonomy is observe', async () => {
    await setSetting('agent_autonomy', 'observe')
    const before = await notesCount()

    const result = await callTool(
      'notes',
      'write',
      { title: 'Held back', body: 'nothing should be written' },
      { source: 'agent', agent: 'orchestrator', reason: 'Observe mode.' },
    )

    expect(result.status).toBe('proposed')
    expect(await notesCount()).toBe(before)
    expect(await countPending()).toBe(1)
  })

  it('lets the owner write through the UI even in observe mode', async () => {
    await setSetting('agent_autonomy', 'observe')
    const before = await notesCount()

    const result = await callTool('notes', 'write', { title: 'Mine', body: '' }, { source: 'ui' })

    expect(result.status).toBe('done')
    expect(await notesCount()).toBe(before + 1)
    expect(await countPending()).toBe(0)
  })

  it('rejects a payload the tool would not accept, before storing it', async () => {
    await setSetting('agent_autonomy', 'observe')

    await expect(
      callTool('notes', 'write', { body: 'no title' }, { source: 'agent' }),
    ).rejects.toThrow()

    // Nothing stored, so the owner is never shown a proposal that cannot be
    // approved.
    expect(await countPending()).toBe(0)
  })
})

describe('deciding', () => {
  async function pending() {
    return propose({
      module: 'notes',
      tool: 'write',
      payload: { title: 'Proposed note', body: 'from an agent' },
      agent: 'orchestrator',
      reason: 'Because the test said so.',
      guarded: true,
    })
  }

  it('approve runs the tool and marks the row', async () => {
    const id = await pending()
    const before = await notesCount()

    await approve(id)

    expect(await notesCount()).toBe(before + 1)
    expect(await countPending()).toBe(0)
    expect((await listProposals('approved')).map((p) => p.id)).toEqual([id])
  })

  it('approve applies an edit from the Review panel', async () => {
    const id = await pending()
    await approve(id, { title: 'Edited before approving' })

    const { rows } = await db().query<{ title: string }>('select title from notes.note')
    expect(rows[0].title).toBe('Edited before approving')
  })

  it('approve refuses an edit the tool would reject, and writes nothing', async () => {
    const id = await pending()
    const before = await notesCount()

    await expect(approve(id, { title: '' })).rejects.toThrow()

    expect(await notesCount()).toBe(before)
    // Still pending, so a failed approval is visible rather than swallowed.
    expect(await countPending()).toBe(1)
  })

  it('refuses to approve the same proposal twice', async () => {
    const id = await pending()
    await approve(id)
    await expect(approve(id)).rejects.toThrow(/already approved/)
  })

  it('dismiss takes it out of the inbox without writing anything', async () => {
    const id = await pending()
    const before = await notesCount()

    await dismiss(id)

    expect(await notesCount()).toBe(before)
    expect(await countPending()).toBe(0)
    expect((await listProposals('dismissed')).map((p) => p.id)).toEqual([id])
  })

  it('a dismissed proposal is not re-proposed inside its window', async () => {
    const id = await pending()
    await dismiss(id)

    const again = await pending()

    expect(again).toBe(id)
    expect(await countPending()).toBe(0)
    expect((await listProposals('dismissed')).map((p) => p.id)).toEqual([id])
  })

  it('reopen puts a decided proposal back', async () => {
    const id = await pending()
    await dismiss(id)
    await reopen(id)

    expect(await countPending()).toBe(1)
  })
})

describe('the core query tool', () => {
  it('is available on a module that never defined one', async () => {
    const result = await callTool(
      'notes',
      'query',
      { sql: 'select count(*)::int as n from notes.note' },
      { source: 'agent' },
    )

    expect(result.status).toBe('done')
    expect(result).toMatchObject({ result: [{ n: 0 }] })
  })

  it('is never guarded, because there is nothing to approve about a select', async () => {
    await setSetting('agent_autonomy', 'observe')

    const result = await callTool('notes', 'query', { sql: 'select 1 as n' }, { source: 'agent' })

    expect(result.status).toBe('done')
    expect(await countPending()).toBe(0)
  })

  it('refuses a write dressed as a query', async () => {
    await expect(
      callTool('notes', 'query', { sql: 'delete from notes.note' }, { source: 'agent' }),
    ).rejects.toThrow(/delete/i)
  })
})
