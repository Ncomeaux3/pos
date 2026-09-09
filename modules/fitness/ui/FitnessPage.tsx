import { MetricTile, PageHeader } from '@/components/pos'
import { listProposals } from '@/core/proposals'
import { activePlan, latestMetrics, listExercises, listPlanItems, listWorkouts, thisWeek } from '../data'
import { load, mass } from '../units'
import { Fitness, type FitnessData } from './Fitness'

export default async function FitnessPage() {
  const [workouts, week, metrics, exercises, plan, pending] = await Promise.all([
    listWorkouts(),
    thisWeek(),
    latestMetrics(),
    listExercises(),
    activePlan(),
    listProposals('pending'),
  ])

  const items = plan ? await listPlanItems(plan.id) : []

  const data: FitnessData = {
    workouts: workouts.map((w) => ({
      id: w.id,
      name: w.name,
      detail: w.detail,
      kind: w.kind,
      startedAt: new Date(w.started_at).toISOString(),
      durationS: w.duration_s,
      distanceM: w.distance_m,
      avgHr: w.avg_hr,
      setCount: Number(w.set_count),
      best:
        w.best_weight_g === null || w.best_reps === null
          ? null
          : {
              exercise: w.best_exercise ?? '',
              weightG: Number(w.best_weight_g),
              reps: w.best_reps,
            },
    })),
    weekWorkouts: week.length,
    weekMinutes: Math.round(week.reduce((sum, w) => sum + w.duration_s, 0) / 60),
    weekLoad: load(week.map((w) => ({ kind: w.kind, durationS: w.duration_s }))),
    metrics: metrics.map((m) => ({
      kind: m.kind,
      value: Number(m.value),
      measuredOn: m.measured_on,
    })),
    exercises: exercises.map((e) => ({ id: e.id, name: e.name, sets: Number(e.sets) })),
    plan:
      plan === null
        ? null
        : {
            id: plan.id,
            name: plan.name,
            goal: plan.goal,
            daysPerWeek: plan.days_per_week,
            notes: plan.notes,
            startedOn: plan.started_on,
            items: items.map((i) => ({
              id: i.id,
              dayLabel: i.day_label,
              exercise: i.exercise,
              sets: i.sets,
              reps: i.reps,
              targetWeightG: i.target_weight_g === null ? null : Number(i.target_weight_g),
              notes: i.notes,
            })),
          },
    // Read through core rather than this module's own tables: a proposal
    // belongs to the Review inbox, and this screen only says one is waiting.
    waiting: pending
      .filter((p) => p.module === 'fitness')
      .map((p) => p.title ?? 'A suggestion is waiting'),
  }

  // The heaviest thing lifted, whatever it was. A KPI worth having only when
  // there is something to put in it.
  const heaviest = data.workouts
    .map((w) => w.best)
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => b.weightG - a.weightG)[0]

  const weight = data.metrics.find((m) => m.kind === 'weight')

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`Fitness / ${data.weekWorkouts} this week / ${data.workouts.length} logged`}
        dot={data.weekWorkouts > 0 ? 'brand' : 'idle'}
        title="Fitness"
        lede="Workouts, what they came to, and the body metrics behind them. Training load is duration weighted by kind, which is a crude measure and says so."
      />

      <div className="grid gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))]">
        <MetricTile
          label="This week"
          value={data.weekWorkouts}
          delta={`${data.weekMinutes} minutes`}
        />
        <MetricTile
          label="Load"
          value={data.weekLoad}
          delta="duration by kind"
          deltaTone="quiet"
        />
        <MetricTile
          label="Heaviest set"
          value={heaviest ? mass(heaviest.weightG) : '--'}
          delta={heaviest ? `${heaviest.exercise} for ${heaviest.reps}` : 'nothing lifted yet'}
        />
        <MetricTile
          label="Body weight"
          value={weight ? mass(weight.value) : '--'}
          delta={weight ? `measured ${weight.measuredOn}` : 'no reading'}
          deltaTone="quiet"
        />
      </div>

      <Fitness data={data} />
    </div>
  )
}
