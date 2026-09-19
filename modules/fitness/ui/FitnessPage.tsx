import type { ReactNode } from 'react'
import { MetricStrip, MetricTile, PageHeader, SyncBand } from '@/components/pos'
import { getConnectionStatuses } from '@/core/integrations'
import { getSkillNames } from '@/core/modules'
import { listProposals } from '@/core/proposals'
import { syncState } from '@/core/sync'
import { spine } from '@/core/series'
import { ownerToday } from '@/core/today'
import {
  activePlan,
  fitnessGoal,
  lastArrived,
  latestMetrics,
  listExercises,
  listPlanItems,
  metricSeries,
  screenWorkouts,
  thisWeek,
  workoutSpan,
} from '../data'
import { hoursLabel, load, mass, monthDay, screenState, whenLabel } from '../units'
import { Fitness, type FitnessData } from './Fitness'
import { SetupCard } from './SetupCard'
import { syncFitness } from './sync'

const GOAL_TONE: Record<string, string> = {
  stalled: 'text-bad',
  at_risk: 'text-warn',
  on_track: 'text-ok',
  done: 'text-ok',
}

const GOAL_LABEL: Record<string, string> = {
  stalled: 'Stalled',
  at_risk: 'At risk',
  on_track: 'On track',
  done: 'Done',
}

/**
 * A tile's number and its unit on one 34px line box, as the artboard draws
 * them. (MetricTile's own leading-none was once lost to tailwind-merge; Card
 * fixed that on 2026-09-12, the wrapper stays for the unit and the 2px nudge.)
 */
const Num = ({ children }: { children: ReactNode }) => (
  <span className="mt-0.5 block leading-none">{children}</span>
)

/** The 14px grey unit beside a tile's 34px number. */
const Unit = ({ children }: { children: string }) => (
  <span className="text-[14px] text-ink-3">{children}</span>
)

/** The mono 11px line under a tile's number. */
const Sub = ({ children }: { children: string }) => (
  <span className="num mt-2 block text-[11px] font-normal tracking-normal text-ink-3">{children}</span>
)

export default async function FitnessPage() {
  const [workouts, week, metrics, exercises, plan, pending, sync, span, goal, todayIso, connections, names, arrived, weightSeries] =
    await Promise.all([
      screenWorkouts(),
      thisWeek(),
      latestMetrics(),
      listExercises(),
      activePlan(),
      listProposals('pending'),
      syncState('fitness'),
      workoutSpan(),
      fitnessGoal(),
      ownerToday(),
      getConnectionStatuses(),
      getSkillNames(),
      lastArrived(),
      // Weight is the Trends tab's default and the one metric worth a round
      // trip before its kind is known; another first kind costs one more below.
      metricSeries('weight', 30),
    ])

  const items = plan ? await listPlanItems(plan.id) : []

  const trendKind = metrics.some((m) => m.kind === 'weight') ? 'weight' : (metrics[0]?.kind ?? null)
  const trend =
    trendKind === null
      ? null
      : { kind: trendKind, days: spine(trendKind === 'weight' ? weightSeries : await metricSeries(trendKind, 30), 30, todayIso) }

  const data: FitnessData = {
    workouts,
    total: span.count,
    weekWorkouts: week.length,
    weekMinutes: Math.round(week.reduce((sum, w) => sum + w.duration_s, 0) / 60),
    weekLoad: load(week.map((w) => ({ kind: w.kind, durationS: w.duration_s }))),
    metrics: metrics.map((m) => ({
      kind: m.kind,
      value: Number(m.value),
      measuredOn: m.measured_on,
    })),
    trend,
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
    skills: Object.entries(names),
  }

  // The heaviest set on file, by weight then reps, with the workout it was in.
  const heaviest = data.workouts
    .filter((w) => w.best !== null)
    .sort((a, b) => b.best!.weightG - a.best!.weightG || b.best!.reps - a.best!.reps)[0]

  const weight = data.metrics.find((m) => m.kind === 'weight')
  const state = screenState({ workouts: span.count, metrics: data.metrics.length, connected: sync.connected })

  return (
    <div className="flex min-h-full flex-col space-y-7">
      <PageHeader
        eyebrow={`Fitness / ${state === 'live' ? 'Overview' : 'Setup'}`}
        // The artboard names the source and when it last pulled, with the
        // button that pulls now, in the first band.
        status={
          <SyncBand
            provider={sync.provider}
            at={sync.at}
            status={sync.status}
            connected={sync.connected}
            arrived={arrived}
            onSync={syncFitness}
          />
        }
        // The same band as the phone's one action: the pull is the thing to
        // do from a phone after a run.
        phoneAction={
          <SyncBand
            provider={sync.provider}
            at={sync.at}
            status={sync.status}
            connected={sync.connected}
            onSync={syncFitness}
          />
        }
        // The setup state is the card alone: its own h1 is inside it.
        hideTitle={state !== 'live'}
        title="Fitness"
        lede="Workouts, what they came to, and the body metrics behind them. The coach reads the week and proposes plan changes into Review; nothing here changes the plan itself."
        actions={
          // Only once there is a span to state. A live page reached on
          // readings alone has no first year, and "0 workouts · → today" is
          // not a fact about anything.
          state === 'live' &&
          span.count > 0 && (
            <span className="num text-[11px] text-ink-3">
              {span.count} workouts · {span.firstYear} → today
            </span>
          )
        }
      />

      {state !== 'live' ? (
        <SetupCard
          connected={sync.connected}
          detail={connections.strava?.lastTestDetail ?? null}
        />
      ) : (
        <>
          <MetricStrip className="border-rule bg-rule">
            <MetricTile
              size="lg"
              className="bg-bg px-5 py-4"
              label="This week"
              value={
                <>
                  <Num>
                    {data.weekWorkouts} <Unit>workouts</Unit>
                  </Num>
                  <Sub>{`${hoursLabel(data.weekMinutes)} · load ${data.weekLoad}`}</Sub>
                </>
              }
            />
            <MetricTile
              size="lg"
              className="bg-bg px-5 py-4"
              label={heaviest ? `${heaviest.best!.exercise} · best set` : 'Best set'}
              value={
                heaviest ? (
                  <>
                    <Num>
                      {mass(heaviest.best!.weightG).replace(' lb', '')}{' '}
                      <Unit>{`×${heaviest.best!.reps}`}</Unit>
                    </Num>
                    <Sub>{`${whenLabel(heaviest.startedAt, todayIso)} · ${heaviest.name}`}</Sub>
                  </>
                ) : (
                  <>
                    <Num>
                      <span className="text-ink-3">--</span>
                    </Num>
                    <Sub>Nothing lifted yet</Sub>
                  </>
                )
              }
            />
            <MetricTile
              size="lg"
              className="bg-bg px-5 py-4"
              label={goal ? goal.title : 'Fitness goal'}
              value={
                goal ? (
                  <>
                    <Num>
                      <span className={GOAL_TONE[goal.status] ?? ''}>{goal.current}</span>{' '}
                      <Unit>{`/ ${goal.target}`}</Unit>
                    </Num>
                    <Sub>{`${GOAL_LABEL[goal.status] ?? goal.status} · ${goal.percent}%`}</Sub>
                  </>
                ) : (
                  <>
                    <Num>
                      <span className="text-ink-3">--</span>
                    </Num>
                    <Sub>No fitness goal</Sub>
                  </>
                )
              }
            />
            <MetricTile
              size="lg"
              className="bg-bg px-5 py-4"
              label="Body metrics"
              value={
                weight ? (
                  <>
                    <Num>
                      {mass(weight.value).replace(' lb', '')} <Unit>lb</Unit>
                    </Num>
                    <Sub>{`Measured ${monthDay(weight.measuredOn)}`}</Sub>
                  </>
                ) : (
                  <>
                    <Num>
                      <span className="text-ink-3">--</span>
                    </Num>
                    <Sub>No readings yet</Sub>
                  </>
                )
              }
            />
          </MetricStrip>

          <Fitness data={data} />
        </>
      )}
    </div>
  )
}
