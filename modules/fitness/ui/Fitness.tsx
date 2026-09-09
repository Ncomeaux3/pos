'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  Row,
  RowList,
  TabBar,
} from '@/components/pos'
import { distance, duration, mass, pace } from '../units'

// Two views over one list, plus the exercise index. The view is in the URL, so
// it survives a refresh and can be linked to.

export type FitnessData = {
  workouts: {
    id: string
    name: string
    detail: string
    kind: string
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

const shortDate = (iso: string) => {
  const d = new Date(iso)
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

/** How a body metric reads. Each kind is stored in its own unit, so each reads differently. */
function metricValue(kind: string, value: number): string {
  if (kind === 'weight') return mass(value)
  if (kind === 'sleep_minutes') return duration(value * 60)
  if (kind === 'body_fat') return `${(value / 10).toFixed(1)}%`
  return `${Math.round(value)} bpm`
}

const METRIC_LABELS: Record<string, string> = {
  weight: 'Weight',
  resting_hr: 'Resting heart rate',
  hrv: 'Heart rate variability',
  sleep_minutes: 'Sleep',
  body_fat: 'Body fat',
}

export function Fitness({ data }: { data: FitnessData }) {
  const router = useRouter()
  const params = useSearchParams()
  const tab = params.get('tab') ?? 'workouts'

  const setTab = (next: string) => {
    const search = new URLSearchParams(params.toString())
    if (next === 'workouts') search.delete('tab')
    else search.set('tab', next)
    const query = search.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }

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
          <RowList>
            {data.workouts.map((w) => (
              <Row
                key={w.id}
                title={w.name}
                meta={[
                  shortDate(w.startedAt),
                  w.detail,
                  // Pace is a ratio of two stored numbers rather than a stored
                  // one, so it can never disagree with them.
                  w.distanceM > 0 ? `${distance(w.distanceM)} at ${pace(w.distanceM, w.durationS)}` : '',
                  w.avgHr ? `${w.avgHr} bpm` : '',
                ]
                  .filter(Boolean)
                  .join(' / ')}
                right={
                  <>
                    {w.best && (
                      <Chip tone="brand">
                        {w.best.exercise} {mass(w.best.weightG)} × {w.best.reps}
                      </Chip>
                    )}
                    <span className="label text-[10px] text-ink-3">{duration(w.durationS)}</span>
                  </>
                }
              />
            ))}
          </RowList>
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
            Body metrics arrive from Apple Health through the Health Auto Export webhook, or you
            can enter them by hand. One reading per metric per day; a second is a correction.
          </EmptyState>
        ) : (
          <RowList>
            {data.metrics.map((m) => (
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
