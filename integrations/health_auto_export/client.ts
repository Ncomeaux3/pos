// The translation from a Health Auto Export payload to the rows the Fitness
// module stores. Pure and import free, so the module can call it and a test
// can feed it a payload without a database.
//
// The shape, from the app's export-format page (help.healthyapps.dev, checked
// 2026-09-12): data.metrics[] { name, units, data[] }, each point { qty, date },
// dates `yyyy-MM-dd HH:mm:ss Z`. Confirmed there: `resting_heart_rate`,
// `sleep_analysis`, and the snake_case naming rule. Verify against one real
// export (owner step 14): `weight_body_mass`, `heart_rate_variability`,
// `body_fat_percentage`, and the sleep field `totalSleep` (`asleep`, `inBed`,
// `sleepStart`, `sleepEnd` are used by an unofficial client and are likelier).

export type BodyMetricKind = 'weight' | 'resting_hr' | 'hrv' | 'sleep_minutes' | 'body_fat'

export type BodyMetric = {
  kind: BodyMetricKind
  /** YYYY-MM-DD, the phone's local day. */
  measuredOn: string
  /** Grams, beats, milliseconds, minutes, tenths of a percent by kind. */
  value: number
}

const GRAMS_PER_LB = 453.59237

// yyyy-MM-dd HH:mm:ss Z, as the app writes it. The day is the first ten
// characters, taken as the phone's local day rather than converted to UTC:
// a 23:30 reading in Central is still that evening's reading.
const DATE = /^(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2} [+-]\d{4}$/

function day(value: unknown): string | null {
  const m = typeof value === 'string' ? DATE.exec(value) : null
  return m ? m[1] : null
}

function qty(point: Record<string, unknown>, key = 'qty'): number | null {
  const v = point[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

type Point = Record<string, unknown>
type Translate = (point: Point, units: string) => BodyMetric | null

/**
 * One reading per point: the day from `date`, the number from `qty`. A scale
 * that returns null says the units are not ones it can convert, and the point
 * is skipped rather than stored under a guessed unit.
 */
const simple =
  (kind: BodyMetricKind, scale: (qty: number, units: string) => number | null): Translate =>
  (point, units) => {
    const measuredOn = day(point.date)
    const q = qty(point)
    if (!measuredOn || q === null) return null
    const value = scale(q, units)
    return value === null ? null : { kind, measuredOn, value: Math.round(value) }
  }

const byName: Record<string, Translate> = {
  // Only the two units the app documents for body mass. Anything else, a
  // missing units string included, is skipped: 185 stored as kilograms is a
  // wrong row the owner would have to notice by eye.
  weight_body_mass: simple('weight', (q, units) => {
    const u = units.toLowerCase()
    return u.startsWith('lb') ? q * GRAMS_PER_LB : u.startsWith('kg') ? q * 1000 : null
  }),
  resting_heart_rate: simple('resting_hr', (q) => q),
  heart_rate_variability: simple('hrv', (q) => q),
  body_fat_percentage: simple('body_fat', (q) => q * 10),
  // Hours asleep, dated by the morning it ended so a night belongs to the day
  // you woke up. `totalSleep` is the app's newer field; `asleep` the older.
  sleep_analysis: (point) => {
    const measuredOn = day(point.sleepEnd) ?? day(point.date)
    const hours = qty(point, 'totalSleep') ?? qty(point, 'asleep')
    if (!measuredOn || hours === null) return null
    return { kind: 'sleep_minutes', measuredOn, value: Math.round(hours * 60) }
  },
}

/**
 * Every reading the payload carries that the body_metric table has a kind
 * for. Unknown metrics, workouts and any point whose date or number does not
 * read are skipped, never thrown: one odd record must not lose the rest.
 */
export function toBodyMetrics(payload: unknown): BodyMetric[] {
  const data = (payload as { data?: { metrics?: unknown } } | null)?.data
  const metrics = Array.isArray(data?.metrics) ? data.metrics : []
  const out: BodyMetric[] = []

  for (const metric of metrics as { name?: unknown; units?: unknown; data?: unknown }[]) {
    const translate = typeof metric.name === 'string' ? byName[metric.name] : undefined
    if (!translate || !Array.isArray(metric.data)) continue
    const units = typeof metric.units === 'string' ? metric.units : ''
    for (const point of metric.data as Point[]) {
      const row = translate(point, units)
      if (row) out.push(row)
    }
  }
  return out
}
