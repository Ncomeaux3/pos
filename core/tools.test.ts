import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { callTool, shouldGuard } from './tools'

// The whole access rule for agent writes, kept pure so the matrix is readable.
// The wiring that calls it is covered in proposals.test.ts against a database.

describe('shouldGuard', () => {
  const guarded = ['write', 'revalue']

  it('never guards a write the owner made in the UI', () => {
    for (const autonomy of ['observe', 'propose', 'act'] as const) {
      expect(shouldGuard({ source: 'ui', autonomy, guarded, tool: 'write' })).toBe(false)
    }
  })

  describe('observe', () => {
    it('guards everything, including tools no manifest listed', () => {
      expect(shouldGuard({ source: 'agent', autonomy: 'observe', guarded, tool: 'write' })).toBe(true)
      expect(shouldGuard({ source: 'agent', autonomy: 'observe', guarded, tool: 'get_digest' })).toBe(
        true,
      )
    })
  })

  describe('propose', () => {
    it('guards what the manifest listed', () => {
      expect(shouldGuard({ source: 'agent', autonomy: 'propose', guarded, tool: 'write' })).toBe(true)
      expect(shouldGuard({ source: 'agent', autonomy: 'propose', guarded, tool: 'revalue' })).toBe(
        true,
      )
    })

    it('lets an unguarded tool through', () => {
      expect(shouldGuard({ source: 'agent', autonomy: 'propose', guarded, tool: 'sync' })).toBe(false)
    })
  })

  describe('act', () => {
    it('guards nothing, because undo is what makes it safe', () => {
      expect(shouldGuard({ source: 'agent', autonomy: 'act', guarded, tool: 'write' })).toBe(false)
    })
  })

  it('treats a module with no guarded list as guarding nothing at propose level', () => {
    expect(shouldGuard({ source: 'agent', autonomy: 'propose', guarded: [], tool: 'write' })).toBe(
      false,
    )
  })
})

// Freshness: a write tool recomputes its module's digest so the dashboard
// tile reads this minute's numbers, and the one read tool a manifest names
// does not, or reading would write.
describe('callTool and the digest', () => {
  beforeEach(async () => {
    await db().query(`delete from core.digests where module = 'ideas'`)
    await db().query('delete from core.settings')
  })

  async function newestIdeasDigest(): Promise<Date | null> {
    const { rows } = await db().query<{ run_at: Date }>(
      `select run_at from core.digests where module = 'ideas' order by run_at desc limit 1`,
    )
    return rows[0]?.run_at ?? null
  }

  it('leaves a newer core.digests row after a write tool', async () => {
    expect(await newestIdeasDigest()).toBeNull()

    await callTool('ideas', 'write', { title: 'Digest follows the write' }, { source: 'ui' })

    expect(await newestIdeasDigest()).not.toBeNull()
  })

  it('does not write a digest for get_digest', async () => {
    await callTool('ideas', 'get_digest', {}, { source: 'ui' })

    expect(await newestIdeasDigest()).toBeNull()
  })
})
