import { describe, expect, it } from 'vitest'
import { balance, compactMoney, monthPace, percent, signedMoney, transactionAmount } from './money'

describe('money rendering', () => {
  it('separates a debt from a fall, because the same glyph means two things', () => {
    // A credit card balance: negative means owed.
    expect(balance(-231_000)).toBe('-$2,310')
    // A thirty day change: negative means it went down.
    expect(signedMoney(-64_000)).toBe('-$640')
    // And a change of nothing is not "$0", it is flat.
    expect(signedMoney(0)).toBe('flat')
  })

  it('flips the sign for income, which is negative in the data', () => {
    expect(transactionAmount(-386_000)).toEqual({ text: '+$3,860.00', incoming: true })
    expect(transactionAmount(8412)).toEqual({ text: '-$84.12', incoming: false })
  })

  it('compacts only once the digits stop mattering', () => {
    expect(compactMoney(84_200)).toBe('$842')
    expect(compactMoney(3_120_000)).toBe('$31.2k')
    expect(compactMoney(-231_000)).toBe('-$2.3k')
  })
})

describe('percent', () => {
  it('rounds to a whole percent', () => {
    expect(percent(37_200, 60_000)).toBe(62)
    expect(percent(26_400, 30_000)).toBe(88)
  })

  it('survives a zero limit rather than returning Infinity', () => {
    expect(percent(1000, 0)).toBe(0)
  })

  it('caps, because a bar cannot be four thousand percent long', () => {
    expect(percent(4_000_000, 1000)).toBe(999)
  })
})

describe('monthPace', () => {
  it('is the fraction of the month gone', () => {
    // The 15th of a 30 day month.
    expect(monthPace('2026-09-15')).toBeCloseTo(0.5, 2)
    // The last day of a 31 day month.
    expect(monthPace('2026-10-31')).toBe(1)
  })

  it('knows how long February is', () => {
    expect(monthPace('2026-02-14')).toBeCloseTo(14 / 28, 3)
    // 2028 is a leap year.
    expect(monthPace('2028-02-14')).toBeCloseTo(14 / 29, 3)
  })
})
