'use client'

import Link from 'next/link'
import {
  Card,
  CardHead,
  DataRow,
  DataTable,
  EmptyState,
  Eyebrow,
  Row,
  RowList,
  TabBar,
} from '@/components/pos'
import { useSearchState } from '@/components/pos/searchState'
import { distance, duration, mass, pace, sourcesLabel } from '../units'

// Two views over one list, plus the exercise index. The view is in the URL, so
// it survives a refresh and can be linked to.

export type FitnessData = {
  workouts: {
    id: string
    name: string
    detail: string
    kind: string
    source: string
    /** Skill names from the classifier's links, most confident first. The row shows the first. */
    skills: string[]
    startedAt: string
    durationS: number
    distanceM: number
    avgHr: number | null
    setCount: number
    best: { exercise: string; weightG: number; reps: number } | null
  }[]
  weekWorkouts: number
  weekMinutes: number
  weekLoad: number
  metrics: { kind: string; value: number; measuredOn: string }[]
  exercises: { id: string; name: string; sets: number }[]
  plan: {
    id: string
    name: string
    goal: string
    daysPerWeek: number
    notes: string
    startedOn: string | null
    items: {
      id: string
      dayLabel: string
      exercise: string
      sets: number
      reps: string
      targetWeightG: number | null
      notes: string
    }[]
  } | null
  /** Coach suggestions waiting in the Review inbox, by headline. */
  waiting: string[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const right = (label: string) => (
  <span key={label} className="block text-right">
    {label}
  </span>
)

/**
 * What sits after the name: the notes, then the best set for a lift or the
 * distance and pace for anything measured in metres. Pace is a ratio of two
 * stored numbers rather than a stored one, so it can never disagree with them.
 */
function detailOf(w: FitnessData['workouts'][number]): string {
  return [
    w.detail,
    w.best ? `${w.best.exercise} ${mass(w.best.weightG)} × ${w.best.reps}` : '',
    w.distanceM > 0 ? `${distance(w.distanceM)} at ${pace(w.distanceM, w.durationS)}` : '',
    w.avgHr ? `${w.avgHr} bpm` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const shortDate = (iso: string) => {
  const d = new Date(iso)
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

/** How a body metric reads. Each kind is stored in its own unit, so each reads differently. */
function metricValue(kind: string, value: number): string {
  if (kind === 'weight') return mass(value)
  if (kind === 'sleep_minutes') return duration(value * 60)
  if (kind === 'exercise_minutes') return duration(value * 60)
  if (kind === 'walking_distance') return distance(value)
  if (kind === 'body_fat' || kind === 'blood_oxygen') return `${(value / 10).toFixed(1)}%`
  if (kind === 'vo2_max') return (value / 10).toFixed(1)
  if (kind === 'respiratory_rate') return `${(value / 10).toFixed(1)} /min`
  if (kind === 'hrv') return `${Math.round(value)} ms`
  if (kind === 'active_energy') return `${Math.round(value)} kcal`
  if (kind === 'stand_hours') return `${Math.round(value)} h`
  if (kind === 'steps' || kind === 'flights_climbed') return Math.round(value).toLocaleString('en-US')
  return `${Math.round(value)} bpm`
}

const METRIC_LABELS: Record<string, string> = {
  weight: 'Weight',
  resting_hr: 'Resting heart rate',
  hrv: 'Heart rate variability',
  sleep_minutes: 'Sleep',
  body_fat: 'Body fat',
  steps: 'Steps',
  active_energy: 'Active energy',
  exercise_minutes: 'Exercise',
  stand_hours: 'Stand hours',
  vo2_max: 'VO2 max',
  blood_oxygen: 'Blood oxygen',
  respiratory_rate: 'Respiratory rate',
  flights_climbed: 'Flights climbed',
  walking_distance: 'Walking distance',
  walking_hr_avg: 'Walking heart rate',
  heart_rate_avg: 'Average heart rate',
}

/** The labels' order, body first and the daily totals after, not the alphabet's. */
const order = (kind: string) => {
  const i = Object.keys(METRIC_LABELS).indexOf(kind)
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}

export function Fitness({ data }: { data: FitnessData }) {
  const { params, set: setParams } = useSearchState()
  const tab = params.get('tab') ?? 'workouts'

  const setTab = (next: string) => setParams({ tab: next === 'workouts' ? null : next })

  return (
    <div className="space-y-5">
      <TabBar
        label="Fitness views"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'workouts', label: 'Workouts', count: data.workouts.length },
          { value: 'exercises', label: 'Exercises', count: data.exercises.length },
          { value: 'body', label: 'Body', count: data.metrics.length },
          { value: 'plan', label: 'Plan', count: data.plan?.items.length ?? 0 },
        ]}
      />

      {tab === 'workouts' &&
        (data.workouts.length === 0 ? (
          <EmptyState headline="Nothing logged">
            Connect Strava at Settings and the nightly job pulls your history, or log one by hand.
            Every workout links to a Health skill and earns XP on the Skill Tree.
          </EmptyState>
        ) : (
          <Card className="py-3.5">
            <CardHead label="Recent workouts" meta={sourcesLabel(data.workouts)} className="mb-1" />
            <DataTable
              head={['Date', 'Workout', right('Time'), right('Skill')]}
              cols="72px minmax(0,1fr) auto auto"
            >
              {data.workouts.map((w) => (
                <DataRow key={w.id} className="py-[9px] text-[13px]">
                  <span className="num text-[12px] text-ink-3">{shortDate(w.startedAt)}</span>
                  <span className="min-w-0 text-ink">
                    {w.name} <span className="text-[12px] text-ink-3">{detailOf(w)}</span>
                  </span>
                  <span className="num text-right text-ink">{duration(w.durationS)}</span>
                  <span className="text-right text-[12px] text-ink-2">
                    {w.skills[0] ?? <span className="text-ink-4">unlinked</span>}
                  </span>
                </DataRow>
              ))}
            </DataTable>
          </Card>
        ))}

      {tab === 'exercises' &&
        (data.exercises.length === 0 ? (
          <EmptyState headline="No exercises yet">
            An exercise appears here the first time a set is logged against it.
          </EmptyState>
        ) : (
          <RowList>
            {data.exercises.map((e) => (
              <Row
                key={e.id}
                title={e.name}
                meta={`${e.sets} set${e.sets === 1 ? '' : 's'} logged`}
              />
            ))}
          </RowList>
        ))}

      {tab === 'body' &&
        (data.metrics.length === 0 ? (
          <EmptyState headline="No readings">
            Body metrics arrive from Apple Health, through the Health Auto Export webhook or the
            Shortcut you build once, or you can enter them by hand. One reading per metric per
            day; a second is a correction.
          </EmptyState>
        ) : (
          <RowList>
            {[...data.metrics].sort((a, b) => order(a.kind) - order(b.kind)).map((m) => (
              <Row
                key={m.kind}
                title={METRIC_LABELS[m.kind] ?? m.kind}
                meta={`measured ${m.measuredOn}`}
                right={<span className="num text-[14px] text-ink">{metricValue(m.kind, m.value)}</span>}
              />
            ))}
          </RowList>
        ))}

      {tab === 'plan' &&
        (data.plan === null ? (
          <EmptyState headline="No plan">
            A plan is what the coach measures a week against. Without one it says nothing about
            missed sessions, because there is no target to have missed.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <Card className="space-y-2.5">
              <CardHead
                label={data.plan.name}
                meta={`${data.plan.daysPerWeek} days a week`}
              />
              {data.plan.goal && <p className="t-caption text-ink-2">{data.plan.goal}</p>}
              {data.plan.startedOn && (
                <p className="t-caption text-ink-3">Started {data.plan.startedOn}</p>
              )}
              {data.plan.notes && (
                <p className="t-caption whitespace-pre-line border-t border-rule pt-2 text-ink-2">
                  {data.plan.notes}
                </p>
              )}
            </Card>

            {DAYS_OF(data.plan.items).map(([day, items]) => (
              <Card key={day} className="space-y-2.5">
                <CardHead label={day || 'Any day'} meta={`${items.length}`} />
                <RowList>
                  {items.map((i) => (
                    <Row
                      key={i.id}
                      title={i.exercise}
                      meta={i.notes}
                      right={
                        <span className="num text-[12px] text-ink-2">
                          {i.sets} x {i.reps || 'as written'}
                          {i.targetWeightG === null ? '' : ` at ${mass(i.targetWeightG)}`}
                        </span>
                      }
                    />
                  ))}
                </RowList>
              </Card>
            ))}

            <Card className="space-y-2">
              <CardHead label="The coach" meta="weekly" />
              <p className="t-caption text-ink-2">
                Deterministic rules over the training log, not a model: a layoff, a volume spike, a
                lift with no personal best in three sessions, a week that fell short of the plan.
                Most weeks it has nothing to say, which is the point.
              </p>
              <p className="t-caption text-ink-3">
                It cannot change this plan. Every suggestion lands in the Review inbox as a
                proposal and stays there until you approve it.
              </p>
              {data.waiting.length > 0 && (
                <div className="space-y-1.5 border-t border-rule pt-2">
                  <Eyebrow>Waiting in Review</Eyebrow>
                  {data.waiting.map((w) => (
                    <p key={w} className="t-caption text-ink-2">
                      {w}
                    </p>
                  ))}
                  <Link className="t-caption text-brand" href="/review">
                    Open the Review inbox
                  </Link>
                </div>
              )}
            </Card>
          </div>
        ))}
    </div>
  )
}

/** Plan items grouped by their day label, in the order the plan lists them. */
function DAYS_OF(
  items: NonNullable<FitnessData['plan']>['items'],
): [string, NonNullable<FitnessData['plan']>['items']][] {
  const days: [string, NonNullable<FitnessData['plan']>['items']][] = []
  for (const item of items) {
    const found = days.find(([label]) => label === item.dayLabel)
    if (found) found[1].push(item)
    else days.push([item.dayLabel, [item]])
  }
  return days
}
