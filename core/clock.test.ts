import { describe, expect, it } from 'vitest'
import { syncClock } from './clock'

describe('syncClock', () => {
  const now = new Date('2026-09-19T17:06:00Z') // 12:06 in Chicago

  it('prints the time alone when the run was today in the owner\'s zone', () => {
    expect(syncClock('2026-09-19T16:44:00Z', 'America/Chicago', now)).toBe('11:44')
  })

  it('adds the day once the run is older than today', () => {
    // 22:10 on Sep 18 in Chicago is already Sep 19 in UTC: yesterday for the
    // owner, today for the server. The day is the owner's.
    expect(syncClock('2026-09-19T03:10:00Z', 'America/Chicago', now)).toBe('18 SEP 22:10')
    expect(syncClock('2026-09-19T03:10:00Z', 'UTC', now)).toBe('03:10')
    expect(syncClock('2026-09-18T15:10:00Z', 'America/Chicago', now)).toBe('18 SEP 10:10')
  })
})
