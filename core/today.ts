import { db } from './db'

/**
 * The owner's date, as the database computes it.
 *
 * Not `new Date()` in Node and not `current_date` in SQL: the first is the
 * server's timezone, the second is the database's, and neither is necessarily
 * the owner's. core.today() reads core.settings.timezone, so every module and
 * every screen agree about what day it is even when the three clocks do not.
 */
export async function ownerToday(): Promise<string> {
  const { rows } = await db().query<{ today: string }>(`select core.today()::text as today`)
  return rows[0].today
}

/**
 * The wall clock in a timezone, as parts.
 *
 * `new Date().getHours()` is the *server's* timezone, which on Vercel is UTC
 * and is never the owner's. That is not a rounding error: at 19:34 in Chicago
 * the server says 00:34 the next day, so a screen renders tomorrow's date and
 * a quiet hours window is checked against the wrong six hours.
 *
 * Intl does the conversion, so there is no date library and no offset table to
 * go stale when daylight saving moves.
 */
function partsIn(at: Date, timeZone: string): { day: number; month: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at)

  const find = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  // Intl renders midnight as 24 under hour12: false in some runtimes.
  const hour = find('hour') % 24
  return { day: find('day'), month: find('month'), minutes: hour * 60 + find('minute') }
}

/** "19:34" in the owner's timezone. */
export function clockIn(at: Date, timeZone: string): string {
  const { minutes } = partsIn(at, timeZone)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// "7 SEP", not the locale's "7 Sept". Three letters, so the column stays the
// same width whichever month it is.
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "9 SEP" in the owner's timezone. */
export function dayIn(at: Date, timeZone: string): string {
  const { day, month } = partsIn(at, timeZone)
  return `${day} ${MONTHS[month - 1]}`
}

/** Minutes since midnight in the owner's timezone. What quiet hours compares. */
export function minutesIn(at: Date, timeZone: string): number {
  return partsIn(at, timeZone).minutes
}

/**
 * The hour the nightly cron fires, in UTC.
 *
 * Kept here as a constant rather than read from vercel.json at runtime: the
 * value is needed in a React render and reading a file there is the wrong
 * shape. today.test.ts asserts the two agree, so drift fails a test rather
 * than quietly telling the owner the wrong time.
 */
export const NIGHTLY_UTC_HOUR = 9

/**
 * When the nightly run actually happens, in the owner's timezone.
 *
 * Built from a real date rather than an offset, so daylight saving is handled:
 * 09:00 UTC is 03:00 in Chicago in January and 04:00 in July, and this returns
 * whichever is true today.
 */
export function nightlyRunAt(timeZone: string, on: Date = new Date()): string {
  const utc = new Date(
    Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate(), NIGHTLY_UTC_HOUR, 0, 0),
  )
  return clockIn(utc, timeZone)
}
