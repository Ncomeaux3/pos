import { db } from '@/core/db'
import { latestMetrics, thisWeek } from '../data'
import { load } from '../units'

export type FitnessDigest = {
  workoutsThisWeek: number
  minutesThisWeek: number
  /** The crude, honest load figure. See units.ts. */
  loadThisWeek: number
  loadLastWeek: number
  /** Days since the last workout of any kind. Null when there has never been one. */
  daysSinceLast: number | null
  latest: { kind: string; value: number; measuredOn: string }[]
}

export async function nightlyDigest(): Promise<FitnessDigest> {
  const [week, metrics] = await Promise.all([thisWeek(), latestMetrics()])

  const { rows: previous } = await db().query<{ kind: string; duration_s: number }>(
    `select kind, duration_s from fitness.workout
      where started_at >= core.today() - 14 and started_at < core.today() - 7`,
  )

  const { rows: last } = await db().query<{ days: number | null }>(
    `select (core.today() - max(started_at)::date)::int as days from fitness.workout`,
  )

  return {
    workoutsThisWeek: week.length,
    minutesThisWeek: Math.round(week.reduce((sum, w) => sum + w.duration_s, 0) / 60),
    loadThisWeek: load(week.map((w) => ({ kind: w.kind, durationS: w.duration_s }))),
    loadLastWeek: load(previous.map((w) => ({ kind: w.kind, durationS: w.duration_s }))),
    daysSinceLast: last[0]?.days ?? null,
    latest: metrics.map((m) => ({
      kind: m.kind,
      value: Number(m.value),
      measuredOn: m.measured_on,
    })),
  }
}
