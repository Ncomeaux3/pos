// Money rendering. No imports: the Finance screen is a client component.
//
// Everything in this module is integer cents. Never a float: 0.1 + 0.2 is not
// 0.3, and a budget that is a cent out every month is a budget nobody trusts.
// Dollars exist only here, at the edge, on the way to the screen.
//
// Sign convention: positive is money out, income is negative. It reads
// backwards for a second and then never again, and it means a category total is
// a sum with no case analysis anywhere.

/** "$1,842", or "$1,842.40" with cents. Always the absolute value. */
export function money(cents: number, withCents = false): string {
  const dollars = Math.abs(cents) / 100
  return `$${dollars.toLocaleString('en-US', {
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  })}`
}

/** "-$640" for a fall, "+$1,200" for a rise. What a delta reads as. */
export function signedMoney(cents: number): string {
  if (cents === 0) return 'flat'
  return `${cents > 0 ? '+' : '-'}${money(cents)}`
}

/**
 * A balance, where negative means owed.
 *
 * Distinct from signedMoney on purpose: a credit card balance of -231000 is
 * "-$2,310" and means debt, while a 30 day change of -64000 is "-$640" and
 * means it fell. Same glyph, different fact, so they get different functions
 * and neither is used for the other's job.
 */
export function balance(cents: number): string {
  return cents < 0 ? `-${money(cents)}` : money(cents)
}

/** "$31.2k". For an axis, where the digits do not fit and do not matter. */
export function compactMoney(cents: number): string {
  const dollars = cents / 100
  if (Math.abs(dollars) < 1000) return money(cents)
  return `${dollars < 0 ? '-' : ''}$${(Math.abs(dollars) / 1000).toFixed(1)}k`
}

/**
 * How a transaction amount reads in a list.
 *
 * Income is negative in the data and has to read as money arriving, so the sign
 * is flipped here rather than in every caller. This is the only place that
 * knows the convention is backwards from what a person expects.
 */
export function transactionAmount(cents: number): { text: string; incoming: boolean } {
  const incoming = cents < 0
  return { text: `${incoming ? '+' : '-'}${money(cents, true)}`, incoming }
}

/** Whole percent, and never past 999: a budget at 40x its limit is a data problem, not a bar. */
export function percent(spent: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(999, Math.round((spent / limit) * 100))
}

/**
 * How far through the month we are, 0 to 1.
 *
 * This is the pace mark on a budget bar: being at 60 percent of a limit on the
 * 20th of a 30 day month is on pace, and the tick is what says so without any
 * arithmetic by the reader.
 */
export function monthPace(todayIso: string): number {
  const [year, month, day] = todayIso.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day / daysInMonth
}
