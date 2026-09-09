// When the next service falls, and what the next twelve months hold. No
// imports: the Home screen is a client component and anything reaching
// core/db.ts drags pg into the browser bundle.
//
// Maintenance is an interval plus the date it was last done. Everything the
// calendar shows is derived here, so the schedule and the history can never
// disagree.

export type Service = {
  intervalMonths: number
  lastDoneOn: string | null
  /** A one-off date, or an override for the next one only. Wins over the interval. */
  dueOn: string | null
  snoozeUntil: string | null
}

export type DueStatus = 'overdue' | 'due' | 'soon' | 'later' | 'snoozed' | 'unscheduled'

/** Inside this many days and a job is worth putting on the front page. */
const SOON_DAYS = 45

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000

/**
 * Add whole months, clamping to the end of the target month.
 *
 * Six months after 31 August is 28 or 29 February, not 2 or 3 March. Letting
 * Date roll over would walk a job one day later every time it ran, and after a
 * few years a thing scheduled for the end of the month happens at the start of
 * the next one.
 */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

/**
 * The date a service is next due, or null when nothing is scheduled.
 *
 * An explicit date wins over the interval: it is what the owner or the shop
 * actually said, and the interval is only a guess at the same thing.
 */
export function nextDue(service: Service): string | null {
  if (service.dueOn) return service.dueOn
  if (!service.lastDoneOn || service.intervalMonths <= 0) return null
  return addMonths(service.lastDoneOn, service.intervalMonths)
}

/**
 * Where a service stands.
 *
 * `unscheduled` is its own state. A job with no interval and no date is not
 * overdue, it was simply never put on the calendar, and showing it as late
 * would invent a commitment nobody made.
 */
export function dueStatus(service: Service, todayIso: string): DueStatus {
  const today = day(todayIso)
  if (service.snoozeUntil && day(service.snoozeUntil) > today) return 'snoozed'

  const due = nextDue(service)
  if (!due) return 'unscheduled'

  const days = day(due) - today
  if (days < 0) return 'overdue'
  // Same calendar month reads as due now, which is how the calendar buckets it.
  if (monthKey(due) === monthKey(todayIso)) return 'due'
  return days <= SOON_DAYS ? 'soon' : 'later'
}

/** "3 weeks overdue", "due this month", "due in 5 months". */
export function dueLabel(service: Service, todayIso: string): string {
  const status = dueStatus(service, todayIso)
  if (status === 'unscheduled') return 'nothing scheduled'
  if (status === 'snoozed') return `snoozed until ${service.snoozeUntil}`

  const days = day(nextDue(service)!) - day(todayIso)
  if (days < 0) {
    const late = Math.abs(days)
    if (late < 14) return `${late} days overdue`
    return late < 60 ? `${Math.round(late / 7)} weeks overdue` : `${Math.round(late / 30)} months overdue`
  }
  if (status === 'due') return days === 0 ? 'due today' : 'due this month'
  if (days <= 60) return `due in ${Math.round(days / 7)} weeks`
  return `due in ${Math.round(days / 30)} months`
}

/** 'YYYY-MM'. The calendar's bucket. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

/** 'OCT 26', the mono label the design prints on each month. */
export function monthLabel(key: string): string {
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`
}

export type Job = { dueOn: string; costEstimateCents: number }

export type Month = {
  key: string
  label: string
  count: number
  costCents: number
  isCurrent: boolean
}

/**
 * Twelve buckets starting with this month.
 *
 * Fixed at twelve rather than "every month that has something in it", because
 * an empty March is information: it is the month with nothing booked, and a
 * calendar that hid it would make the year look busier than it is.
 */
export function next12Months(jobs: Job[], todayIso: string): Month[] {
  const start = `${monthKey(todayIso)}-01`

  return Array.from({ length: 12 }, (unused, i) => {
    const key = monthKey(addMonths(start, i))
    const here = jobs.filter((j) => monthKey(j.dueOn) === key)
    return {
      key,
      label: monthLabel(key),
      count: here.length,
      costCents: here.reduce((sum, j) => sum + j.costEstimateCents, 0),
      isCurrent: i === 0,
    }
  })
}
