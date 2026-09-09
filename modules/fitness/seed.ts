import { db } from '@/core/db'
import { register } from '@/core/entities'
import { toGrams } from './units'

// Synthetic rows for `pnpm setup --demo`. Upserts on external_id so running it
// twice does not duplicate. Nothing here is personal; this ships in the template.
//
// Three weeks of a plausible split, so the load figure has a previous week to
// compare against and the exercise index has repeat sets to find a best in.

type Set = [exercise: string, reps: number, lb: number]

const SESSIONS: {
  daysAgo: number
  name: string
  detail: string
  kind: 'strength' | 'run' | 'walk'
  minutes: number
  metres?: number
  hr?: number
  sets?: Set[]
}[] = [
  { daysAgo: 1, name: 'Lower', detail: 'squat, RDL, leg press', kind: 'strength', minutes: 58,
    sets: [['Squat', 5, 315], ['Squat', 5, 315], ['Romanian deadlift', 8, 225], ['Leg press', 10, 360]] },
  { daysAgo: 3, name: 'Upper', detail: 'bench, rows, pull-ups', kind: 'strength', minutes: 52,
    sets: [['Bench press', 5, 225], ['Bench press', 3, 235], ['Barbell row', 8, 185]] },
  { daysAgo: 4, name: 'Easy run', detail: 'zone 2', kind: 'run', minutes: 51, metres: 5100, hr: 142 },
  { daysAgo: 6, name: 'Lower', detail: 'deadlift day', kind: 'strength', minutes: 61,
    sets: [['Deadlift', 3, 340], ['Deadlift', 1, 355], ['Front squat', 5, 185]] },

  { daysAgo: 8, name: 'Tempo run', detail: 'threshold', kind: 'run', minutes: 50, metres: 6400, hr: 168 },
  { daysAgo: 10, name: 'Upper', detail: 'press, chins', kind: 'strength', minutes: 47,
    sets: [['Overhead press', 5, 135], ['Bench press', 5, 220]] },
  { daysAgo: 11, name: 'Long walk', detail: 'recovery', kind: 'walk', minutes: 62, metres: 5600 },
  { daysAgo: 13, name: 'Lower', detail: 'squat volume', kind: 'strength', minutes: 55,
    sets: [['Squat', 8, 275], ['Romanian deadlift', 8, 205]] },

  { daysAgo: 16, name: 'Easy run', detail: 'zone 2', kind: 'run', minutes: 44, metres: 4400, hr: 138 },
  { daysAgo: 18, name: 'Upper', detail: 'bench focus', kind: 'strength', minutes: 50,
    sets: [['Bench press', 5, 215], ['Barbell row', 8, 175]] },
]

/** A gentle downward drift, because a flat line is the one shape a scale never draws. */
const WEIGHT_LB = [182.4, 182.0, 181.6, 181.9, 181.2, 180.8, 181.0, 180.4]

export async function seed(): Promise<number> {
  for (const [i, session] of SESSIONS.entries()) {
    const { rows } = await db().query<{ id: string }>(
      `insert into fitness.workout
         (name, detail, kind, started_at, duration_s, distance_m, avg_hr, source, external_id)
       values ($1, $2, $3, (core.today() - $4::int)::timestamptz + interval '18 hours',
               $5, $6, $7, 'demo', $8)
       on conflict (source, external_id) do update
         set started_at = excluded.started_at, duration_s = excluded.duration_s
       returning id`,
      [
        session.name,
        session.detail,
        session.kind,
        session.daysAgo,
        session.minutes * 60,
        session.metres ?? 0,
        session.hr ?? null,
        `session-${i}`,
      ],
    )
    const workoutId = rows[0].id

    // Sets have no external id, so they are cleared and rewritten. Nothing
    // outside the workout points at one.
    await db().query(`delete from fitness.set_entry where workout_id = $1`, [workoutId])

    for (const [position, [exercise, reps, lb]] of (session.sets ?? []).entries()) {
      const { rows: ex } = await db().query<{ id: string }>(
        `insert into fitness.exercise (name) values ($1)
         on conflict (name) do update set name = excluded.name
         returning id`,
        [exercise],
      )
      await db().query(
        `insert into fitness.set_entry (workout_id, exercise_id, reps, weight_g, position)
         values ($1, $2, $3, $4, $5)`,
        [workoutId, ex[0].id, reps, toGrams(lb, 'lb'), position],
      )
    }

    // Same path as a real write, so the demo data earns real Health XP rather
    // than sitting inert on the Skill Tree.
    await register({
      module: 'fitness',
      entityType: 'workout',
      entityId: workoutId,
      title: session.name,
      text: session.detail,
      eventType: 'workout_logged',
      occurredAt: new Date(Date.now() - session.daysAgo * 86_400_000),
    })
  }

  for (const [i, lb] of WEIGHT_LB.entries()) {
    await db().query(
      `insert into fitness.body_metric (kind, value, measured_on, source)
       values ('weight', $1, core.today() - $2::int, 'demo')
       on conflict (kind, measured_on) do update set value = excluded.value`,
      [toGrams(lb, 'lb'), i * 3],
    )
  }

  await db().query(
    `insert into fitness.body_metric (kind, value, measured_on, source)
     values ('resting_hr', 54, core.today() - 1, 'demo'),
            ('sleep_minutes', 428, core.today() - 1, 'demo')
     on conflict (kind, measured_on) do update set value = excluded.value`,
  )

  return SESSIONS.length
}
