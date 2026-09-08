import { describe, expect, it } from 'vitest'
import { shouldGuard } from './tools'

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
