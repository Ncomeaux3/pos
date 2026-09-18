// The split behind scripts/hae-backfill.mts, kept pure so a test can pin it.

type Point = Record<string, unknown>
type Metric = { name: string; units?: string; data?: Point[] }
type Payload = { data: { metrics?: Metric[]; workouts?: Point[] } }

const WORKOUTS_PER_REQUEST = 20

/**
 * One request per calendar month carrying that month's points of every
 * metric, then the workouts twenty at a time. A month is well under the
 * function's body and time limits at daily aggregation, and a day's points
 * never straddle two requests, so a total summed across a day is summed once.
 * The month is the first seven characters of the app's `yyyy-MM-dd ...` date;
 * a point without one is bucketed under '?' so nothing is silently dropped.
 */
export function chunk(payload: Payload): Payload[] {
  const byMonth = new Map<string, Metric[]>()
  for (const metric of payload.data.metrics ?? []) {
    const groups = new Map<string, Point[]>()
    for (const point of metric.data ?? []) {
      const month = typeof point.date === 'string' ? point.date.slice(0, 7) : '?'
      groups.set(month, [...(groups.get(month) ?? []), point])
    }
    for (const [month, data] of groups) {
      byMonth.set(month, [...(byMonth.get(month) ?? []), { ...metric, data }])
    }
  }
  const out: Payload[] = [...byMonth.keys()].sort().map((month) => ({ data: { metrics: byMonth.get(month) } }))

  // A workout from the app carries its route and per-minute series, megabytes
  // the module never reads; only the scalars go, so a request stays small.
  const workouts = (payload.data.workouts ?? []).map((w) =>
    Object.fromEntries(Object.entries(w).filter(([, v]) => !Array.isArray(v))),
  )
  for (let i = 0; i < workouts.length; i += WORKOUTS_PER_REQUEST) {
    out.push({ data: { workouts: workouts.slice(i, i + WORKOUTS_PER_REQUEST) } })
  }
  return out
}
