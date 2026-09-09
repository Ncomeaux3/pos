import { PageHeader } from '@/components/pos'
import { listMetrics } from '@/core/metrics'
import { ownerToday } from '@/core/today'
import { historyByGoal, listGoals } from '../data'
import { progress, rule, type Goal as Shape, type Status } from '../progress'
import { GoalList, type GoalCard } from './GoalList'

const days = (fromIso: string, toIso: string) =>
  Math.round(
    (new Date(`${toIso}T12:00:00`).getTime() - new Date(`${fromIso}T12:00:00`).getTime()) /
      86_400_000,
  )

export default async function GoalsPage() {
  const [rows, history, todayIso] = await Promise.all([
    listGoals(),
    historyByGoal(),
    ownerToday(),
  ])

  const cards: GoalCard[] = rows.map((row) => {
    const shape: Shape = {
      kind: row.kind,
      startValue: Number(row.start_value),
      targetValue: Number(row.target_value),
      deadlineInDays: days(todayIso, row.deadline),
      ageInDays: Math.max(
        1,
        days(new Date(row.created_at).toISOString().slice(0, 10), todayIso),
      ),
      history: history.get(row.id) ?? [],
    }
    const p = progress(shape)

    return {
      id: row.id,
      title: row.title,
      notes: row.notes,
      area: row.area,
      kind: row.kind,
      unit: row.unit,
      startValue: shape.startValue,
      targetValue: shape.targetValue,
      deadline: row.deadline,
      metricSource: row.metric_source,
      archived: row.archived,
      history: shape.history,
      progress: p,
      rule: rule(shape, p, row.unit),
    }
  })

  const live = cards.filter((c) => !c.archived)
  const count = (s: Status) => live.filter((c) => c.progress.status === s).length

  const atRisk = count('at_risk')
  const stalled = count('stalled')

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`Goals / ${count('on_track')} on track / ${atRisk} at risk / ${stalled} stalled`}
        dot={stalled > 0 ? 'bad' : atRisk > 0 ? 'warn' : 'ok'}
        title="Goals"
        lede="Progress against a deadline, grouped by life area. A goal with a metric source computes itself nightly; the rest you check in on. Every status says the rule behind it rather than only showing a colour."
        actions={
          <span className="num text-[11px] text-ink-3">
            {live.length} active · {cards.length - live.length} archived
          </span>
        }
      />

      <GoalList
        goals={cards}
        // Enumerated from the manifests, so the picker offers exactly what some
        // module will actually compute and nothing else.
        metrics={listMetrics()}
        todayIso={todayIso}
      />
    </div>
  )
}
