'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Chip,
  EmptyState,
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
    </div>
  )
}
