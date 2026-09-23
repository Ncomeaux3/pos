import { describe, expect, it } from 'vitest'
import { toCalendarItems } from './calendar'

const range = { from: '2026-09-01', to: '2026-12-31' }

const service = (over: Partial<Parameters<typeof toCalendarItems>[0][number]> = {}) => ({
  id: 's1',
  asset_id: 'a1',
  title: 'Gutter clean',
  intervalMonths: 6,
  lastDoneOn: null,
  dueOn: null,
  snoozeUntil: null,
  ...over,
})

describe('toCalendarItems', () => {
  it('is nothing scheduled when there is no due date', () => {
    expect(toCalendarItems([service()], range)).toHaveLength(0)
  })

  it('walks forward by the interval as far as the range', () => {
    const items = toCalendarItems(
      [service({ intervalMonths: 3, lastDoneOn: '2026-09-01', dueOn: null })],
      range,
    )
    // Due 2026-12-01, then walked forward past the range's end.
    expect(items.map((i) => i.startsAt)).toEqual(['2026-12-01'])
    expect(items[0].projected).toBe(false)
  })

  it('marks the first occurrence real and the rest projected', () => {
    const items = toCalendarItems(
      [service({ intervalMonths: 1, lastDoneOn: '2026-08-15', dueOn: null })],
      range,
    )
    expect(items.length).toBeGreaterThan(1)
    expect(items[0].projected).toBe(false)
    expect(items.slice(1).every((i) => i.projected)).toBe(true)
  })

  it('shows only the one occurrence for a zero interval', () => {
    const items = toCalendarItems(
      [service({ intervalMonths: 0, dueOn: '2026-09-20' })],
      range,
    )
    expect(items).toHaveLength(1)
    expect(items[0].projected).toBe(false)
  })

  it('links to the asset', () => {
    const [item] = toCalendarItems([service({ intervalMonths: 0, dueOn: '2026-09-20' })], range)
    expect(item.href).toBe('/home?asset=a1')
    expect(item.kind).toBe('service')
  })
})
