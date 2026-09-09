// Premiums, expiry and masking. No imports: the Insurance screen is a client
// component and anything reaching core/db.ts drags pg into the browser bundle.
//
// Nothing here judges a policy. Per SPEC section 8 as amended on 2026-09-07,
// this module records what the declarations page says and computes dates and
// totals from it. No gap analysis, no adequacy scoring, no opinion about
// whether cover is enough.

export type Cadence = 'monthly' | 'quarterly' | 'semiannual' | 'annual'

export type PolicyStatus = 'expired' | 'renew-now' | 'expiring' | 'active' | 'undated'

/** How many times a year each cadence bills. */
const PER_YEAR: Record<Cadence, number> = {
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
}

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000

/** What a year of this policy costs, in cents. */
export function annualCents(premiumCents: number, cadence: Cadence): number {
  return premiumCents * PER_YEAR[cadence]
}

export const CADENCE_LABELS: Record<Cadence, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Every 6 months',
  annual: 'Annually',
}

/** Whole days until expiry. Negative once it has passed. */
export function daysUntil(expiresOn: string | null, todayIso: string): number | null {
  if (!expiresOn) return null
  return day(expiresOn) - day(todayIso)
}

/**
 * Where a policy stands.
 *
 * `undated` is its own state. A policy with no expiry on file is not active
 * and not expired: nobody has written the date down yet, and calling it active
 * would be the screen making a claim on no evidence.
 */
export function policyStatus(expiresOn: string | null, todayIso: string): PolicyStatus {
  const days = daysUntil(expiresOn, todayIso)
  if (days === null) return 'undated'
  if (days < 0) return 'expired'
  if (days <= 30) return 'renew-now'
  if (days <= 60) return 'expiring'
  return 'active'
}

export const STATUS_LABELS: Record<PolicyStatus, string> = {
  expired: 'Expired',
  'renew-now': 'Renew now',
  expiring: 'Expiring',
  active: 'Active',
  undated: 'No date on file',
}

/**
 * The last four characters, letters and digits only.
 *
 * Punctuation is dropped first so that a number written 918-44-2210-8 and the
 * same number written 918442210-8 mask the same way. Anything shorter than
 * four characters is not masked at all: there would be nothing left to show.
 */
export function maskNumber(policyNumber: string): string {
  const clean = policyNumber.replace(/[^A-Za-z0-9]/g, '')
  if (clean.length === 0) return 'not on file'
  return `**** ${clean.slice(-4)}`
}

/**
 * The date the next term would end, if the policy renews as it stands.
 *
 * A six month policy renews to six months on, everything else to a year. This
 * is what the Mark renewed button offers, and it is only ever an offer: the
 * owner types the real date when the carrier says something different.
 */
export function nextTermEnd(expiresOn: string, cadence: Cadence): string {
  const months = cadence === 'semiannual' ? 6 : 12
  const [y, m, d] = expiresOn.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

/** "in 36 days", "8 days ago", "no date on file". */
export function expiryLabel(expiresOn: string | null, todayIso: string): string {
  const days = daysUntil(expiresOn, todayIso)
  if (days === null) return 'no date on file'
  if (days === 0) return 'today'
  if (days < 0) return `${Math.abs(days)} days ago`
  return `in ${days} days`
}

/**
 * Which reminder leads fall on today, for a policy expiring on this date.
 *
 * Returned rather than queued here so the nightly job stays the only thing
 * that writes notifications, and so this can be tested without a database.
 */
export function remindersDueToday(
  expiresOn: string | null,
  leads: number[],
  todayIso: string,
): number[] {
  const days = daysUntil(expiresOn, todayIso)
  if (days === null || days < 0) return []
  return leads.filter((lead) => lead === days)
}
