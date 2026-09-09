import { describe, expect, it } from 'vitest'
import {
  annualCents,
  daysUntil,
  expiryLabel,
  maskNumber,
  nextTermEnd,
  policyStatus,
  remindersDueToday,
} from './premium'

describe('annualCents', () => {
  it('multiplies by how often the cadence bills', () => {
    expect(annualCents(1_349, 'monthly')).toBe(16_188)
    expect(annualCents(61_200, 'semiannual')).toBe(122_400)
    expect(annualCents(50_000, 'annual')).toBe(50_000)
  })
})

describe('policyStatus', () => {
  const today = '2026-09-08'

  it('separates no date on file from expired', () => {
    // Nobody has written the date down. Calling that active would be a claim
    // the screen has no evidence for.
    expect(policyStatus(null, today)).toBe('undated')
    expect(policyStatus('2026-09-07', today)).toBe('expired')
  })

  it('escalates as the date comes closer', () => {
    expect(policyStatus('2026-12-01', today)).toBe('active')
    expect(policyStatus('2026-11-01', today)).toBe('expiring')
    expect(policyStatus('2026-09-30', today)).toBe('renew-now')
    expect(policyStatus('2026-09-08', today)).toBe('renew-now')
  })
})

describe('maskNumber', () => {
  it('masks the same way however the number is punctuated', () => {
    expect(maskNumber('918-44-2210-8')).toBe('**** 2108')
    expect(maskNumber('918442210 8')).toBe('**** 2108')
  })

  it('says so rather than masking nothing', () => {
    expect(maskNumber('')).toBe('not on file')
  })
})

describe('nextTermEnd', () => {
  it('renews a six month policy to six months on and everything else to a year', () => {
    expect(nextTermEnd('2026-11-14', 'semiannual')).toBe('2027-05-14')
    expect(nextTermEnd('2026-11-14', 'monthly')).toBe('2027-11-14')
  })

  it('clamps to the end of a shorter month', () => {
    expect(nextTermEnd('2026-08-31', 'semiannual')).toBe('2027-02-28')
  })
})

describe('daysUntil and expiryLabel', () => {
  it('counts whole days either side of today', () => {
    expect(daysUntil('2026-10-14', '2026-09-08')).toBe(36)
    expect(daysUntil('2026-09-01', '2026-09-08')).toBe(-7)
    expect(expiryLabel('2026-10-14', '2026-09-08')).toBe('in 36 days')
    expect(expiryLabel('2026-09-01', '2026-09-08')).toBe('7 days ago')
    expect(expiryLabel(null, '2026-09-08')).toBe('no date on file')
  })
})

describe('remindersDueToday', () => {
  it('fires a lead only on the day it lands', () => {
    expect(remindersDueToday('2026-11-07', [60, 30, 7], '2026-09-08')).toEqual([60])
    expect(remindersDueToday('2026-11-07', [60, 30, 7], '2026-09-09')).toEqual([])
  })

  it('says nothing about a policy that has already expired', () => {
    // The reminder is for a renewal that has not happened. Once the date has
    // passed, the row on the screen is the message.
    expect(remindersDueToday('2026-09-01', [60, 30, 7], '2026-09-08')).toEqual([])
  })
})
