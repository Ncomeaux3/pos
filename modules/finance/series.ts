// The net worth chart draws a date axis, not a list of rows.
//
// netWorthSeries returns one row per day that has a balance, which on a fresh
// install is two rows. Drawn evenly spaced those two rows became a line across
// the full width of a chart captioned "30 days", which says the account has a
// month of history behind it. spine() puts each reading on the day it belongs
// to and leaves the rest of the axis honest.

export type Reading = { on_date: string; cents: number }

/**
 * One day of the axis.
 *
 * `cents` is null before the first reading and carried forward after it, so
 * the line breaks at the start of history and holds across a missed sync.
 * `observed` is true only where a balance was actually recorded, which is what
 * High, Low and Avg count: carrying 200 across three days is one measurement
 * repeated, and averaging it three times would drag the number toward whatever
 * the sync happened to miss.
 */
export type Day = { date: string; cents: number | null; observed: boolean }

/** "2026-09-15" plus or minus whole days, in UTC. */
function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  // UTC throughout: `iso` is already the owner's date, from core.today(), and
  // reading it back through the server's timezone would move it by a day.
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/**
 * `days` entries ending on `todayIso`, oldest first.
 *
 * Readings outside the window are dropped rather than clamped onto the edge:
 * the query bounds this already, and a stray row must not redraw day one as
 * something it never was.
 */
export function spine(readings: Reading[], days: number, todayIso: string): Day[] {
  const byDate = new Map(readings.map((r) => [r.on_date, r.cents]))

  let carried: number | null = null

  return Array.from({ length: days }, (_, i) => {
    const date = shift(todayIso, i - (days - 1))
    const reading = byDate.get(date)

    if (reading !== undefined) {
      carried = reading
      return { date, cents: reading, observed: true }
    }
    return { date, cents: carried, observed: false }
  })
}
