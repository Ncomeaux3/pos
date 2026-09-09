import { describe, expect, it } from 'vitest'
import { weekOf } from './reviews'
import { EMPTY_ANSWERS, outstanding, renderNote, type ReviewAnswers } from './reviews-shape'

describe('weekOf', () => {
  it('returns the Monday that starts the week', () => {
    // 2026-09-08 is a Tuesday.
    expect(weekOf('2026-09-08')).toBe('2026-09-07')
    expect(weekOf('2026-09-07')).toBe('2026-09-07')
    expect(weekOf('2026-09-11')).toBe('2026-09-07')
  })

  it('puts Sunday in the week that already started', () => {
    // 2026-09-13 is a Sunday, and it belongs to the week beginning the 7th,
    // not to the one beginning tomorrow.
    expect(weekOf('2026-09-13')).toBe('2026-09-07')
    expect(weekOf('2026-09-14')).toBe('2026-09-14')
  })

  it('crosses a month and a year boundary', () => {
    expect(weekOf('2026-10-01')).toBe('2026-09-28')
    expect(weekOf('2027-01-01')).toBe('2026-12-28')
  })
})

describe('outstanding', () => {
  const answers: ReviewAnswers = {
    ...EMPTY_ANSWERS,
    missActions: { a: 'carry' },
    checkins: { g1: 11 },
  }

  it('counts the decisions still owed on the step that owes them', () => {
    expect(outstanding('misses', answers, { misses: 4, manualGoals: 2 })).toBe(3)
    expect(outstanding('goals', answers, { misses: 4, manualGoals: 2 })).toBe(1)
  })

  it('owes nothing on a step that only reads', () => {
    expect(outstanding('glance', answers, { misses: 4, manualGoals: 2 })).toBe(0)
    expect(outstanding('close', answers, { misses: 4, manualGoals: 2 })).toBe(0)
  })
})

describe('renderNote', () => {
  const context = {
    weekLabel: '7 Sep 2026',
    winTitles: { w1: 'Shipped the drill-ins' },
    missTitles: { m1: 'Rebalance the allocation', m2: 'Call the carrier' },
    goalLines: ['Net worth, 44 percent'],
    pickTitles: { t1: 'Run the time trial' },
  }

  it('writes every section, with the reason when there is one', () => {
    const note = renderNote(
      {
        ...EMPTY_ANSWERS,
        wins: ['w1'],
        ownWins: ['Slept properly'],
        missActions: { m1: 'carry', m2: 'drop' },
        reasons: { m2: 'not worth it any more' },
        picks: ['t1'],
        intent: 'One thing at a time',
      },
      context,
    )

    expect(note).toContain('# Week of 7 Sep 2026')
    expect(note).toContain('- Shipped the drill-ins')
    expect(note).toContain('- Slept properly')
    expect(note).toContain('- Rebalance the allocation, carried to next week')
    expect(note).toContain('- Call the carrier, dropped (not worth it any more)')
    expect(note).toContain('1. Run the time trial')
    expect(note).toContain('Intent: One thing at a time')
  })

  it('says a section was empty rather than leaving a bare heading', () => {
    const note = renderNote(EMPTY_ANSWERS, { ...context, goalLines: [] })
    expect(note).toContain('- Nothing ticked.')
    expect(note).toContain('- Nothing slipped.')
    expect(note).toContain('- No goals yet.')
    expect(note).toContain('- Nothing picked.')
  })
})
