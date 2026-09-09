import { describe, expect, it } from 'vitest'

import { writeHeadline } from './orchestrator'
import type { Summary } from './orchestrator'

// The sentence at the top of the dashboard. It used to be written by Haiku and
// is a template now, so what it says is testable rather than sampled.

function summary(over: Partial<Summary> = {}): Summary {
  return {
    alerts: [],
    failedJobs: [],
    pendingProposals: 0,
    unreadNotifications: 0,
    spendCents: 0,
    capCents: 1000,
    modules: [],
    ...over,
  }
}

const alert = (tone: 'bad' | 'warn') => ({ tone, title: 'x', detail: '' }) as Summary['alerts'][0]

describe('writeHeadline', () => {
  // Silence is the correct output. A dashboard that says "all good" every
  // morning trains you to stop reading it.
  it('says nothing when there is nothing to say', () => {
    expect(writeHeadline(summary())).toBeNull()
  })

  it('counts the bad ones separately from the warnings', () => {
    const text = writeHeadline(
      summary({ alerts: [alert('bad'), alert('bad'), alert('warn')] }),
    )
    expect(text).toBe('2 things needing attention and 1 warning.')
  })

  it('reads as a sentence with three clauses', () => {
    const text = writeHeadline(
      summary({
        alerts: [alert('warn')],
        failedJobs: [{ module: 'finance', name: 'sync' }],
        pendingProposals: 2,
      }),
    )
    expect(text).toBe('1 warning, 1 failed job and 2 proposals waiting.')
  })

  it('singularises', () => {
    expect(writeHeadline(summary({ pendingProposals: 1 }))).toBe('1 proposal waiting.')
  })

  // The cap is the one number worth naming unprompted: it is the only thing
  // on the dashboard that stops working when it is reached.
  it('names the cap once research has stopped', () => {
    const text = writeHeadline(
      summary({ pendingProposals: 1, spendCents: 1000, capCents: 1000 }),
    )
    expect(text).toContain('reached the 10.00 cap')
  })

  it('stays quiet about the cap while there is room left', () => {
    const text = writeHeadline(summary({ pendingProposals: 1, spendCents: 400, capCents: 1000 }))
    expect(text).toBe('1 proposal waiting.')
  })

  // It cannot reach a model, so it cannot invent one. That is the whole reason
  // this is a template.
  it('never contains a number the summary did not carry', () => {
    const text = writeHeadline(summary({ alerts: [alert('bad')], pendingProposals: 3 })) ?? ''
    const digits = text.match(/\d+/g) ?? []
    expect(digits).toEqual(['1', '3'])
  })
})
