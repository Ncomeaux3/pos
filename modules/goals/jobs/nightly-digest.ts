import { readMetric } from '@/core/metrics'
import { checkIn, historyByGoal, listGoals } from '../data'
import { progress, type Status } from '../progress'

export type GoalsDigest = {
  onTrack: number
  atRisk: number
  stalled: number
  done: number
  /** The ones worth a sentence in the morning, worst first. */
  attention: { id: string; title: string; status: Status; rule: string }[]
}

/**
 * Ask every module that owns a metric for today's number, and record it as a
 * check-in.
 *
 * The cross-module read is the registry, never SQL: this job has no idea what
 * `tasks.completed_this_week` means or which table it comes from, and deleting
 * the module that provides it makes the metric stop resolving rather than
 * breaking the job.
 *
 * `is_manual = false`, so a reading the owner typed by hand is never overwritten.
 */
export async function pullMetrics(): Promise<{ pulled: number; missing: number }> {
  const goals = (await listGoals(false)).filter((g) => g.metric_source)

  let pulled = 0
  let missing = 0

  for (const goal of goals) {
    const value = await readMetric(goal.metric_source!)
    if (value === null) {
      missing++
      continue
    }
    await checkIn({ goalId: goal.id, value, isManual: false, note: 'Computed nightly.' })
    pulled++
  }

  return { pulled, missing }
}

/**
 * Written to core.digests nightly. Everything outside this module reads these
 * numbers from there, the Dashboard tile included.
 */
export async function nightlyDigest(): Promise<GoalsDigest> {
  const [goals, history] = await Promise.all([listGoals(false), historyByGoal()])
  const { rule } = await import('../progress')

  const counts: Record<Status, number> = { on_track: 0, at_risk: 0, stalled: 0, done: 0 }
  const attention: GoalsDigest['attention'] = []

  const today = new Date()

  for (const row of goals) {
    const shape = {
      kind: row.kind,
      startValue: Number(row.start_value),
      targetValue: Number(row.target_value),
      deadlineInDays: Math.round(
        (new Date(`${row.deadline}T12:00:00`).getTime() - today.getTime()) / 86_400_000,
      ),
      ageInDays: Math.round((today.getTime() - new Date(row.created_at).getTime()) / 86_400_000),
      history: history.get(row.id) ?? [],
    }

    const p = progress(shape)
    counts[p.status]++

    if (p.status === 'at_risk' || p.status === 'stalled') {
      attention.push({ id: row.id, title: row.title, status: p.status, rule: rule(shape, p, row.unit) })
    }
  }

  return {
    onTrack: counts.on_track,
    atRisk: counts.at_risk,
    stalled: counts.stalled,
    done: counts.done,
    // Stalled before at risk: a goal that has stopped moving is the worse news.
    attention: attention.sort((a, b) => (a.status === 'stalled' ? -1 : 1)).slice(0, 5),
  }
}
