import { db } from '@/core/db'

// Reads for the screen and the digest. The units and the derived numbers live
// in ./units.ts, which has no imports and can be pulled into a client.

export type WorkoutRow = {
  id: string
  name: string
  detail: string
  kind: string
  started_at: Date
  duration_s: number
  distance_m: number
  avg_hr: number | null
  set_count: string
  best_weight_g: string | null
  best_reps: number | null
  best_exercise: string | null
}

/**
 * Workouts, newest first, each with its heaviest set.
 *
 * The best set is picked in SQL with distinct on rather than by loading every
 * set into memory: a year of lifting is thousands of rows and the list only
 * ever shows one line per workout.
 */
export async function listWorkouts(limit = 40): Promise<WorkoutRow[]> {
  const { rows } = await db().query<WorkoutRow>(
    `select w.id, w.name, w.detail, w.kind, w.started_at, w.duration_s,
            w.distance_m, w.avg_hr,
            (select count(*)::text from fitness.set_entry s where s.workout_id = w.id)
              as set_count,
            b.weight_g::text as best_weight_g, b.reps as best_reps, b.name as best_exercise
       from fitness.workout w
       left join lateral (
         select s.weight_g, s.reps, e.name
           from fitness.set_entry s
           join fitness.exercise e on e.id = s.exercise_id
          where s.workout_id = w.id
          order by s.weight_g desc, s.reps desc
          limit 1
       ) b on true
      order by w.started_at desc
      limit $1`,
    [limit],
  )
  return rows
}

/** Every set of one exercise, heaviest first. The personal best list. */
export async function bestSets(
  exerciseName: string,
  limit = 5,
): Promise<{ weight_g: string; reps: number; started_at: Date }[]> {
  const { rows } = await db().query<{ weight_g: string; reps: number; started_at: Date }>(
    `select s.weight_g::text, s.reps, w.started_at
       from fitness.set_entry s
       join fitness.exercise e on e.id = s.exercise_id
       join fitness.workout w on w.id = s.workout_id
      where e.name = $1
      order by s.weight_g desc, s.reps desc
      limit $2`,
    [exerciseName, limit],
  )
  return rows
}

export async function listExercises(): Promise<{ id: string; name: string; sets: string }[]> {
  const { rows } = await db().query<{ id: string; name: string; sets: string }>(
    `select e.id, e.name, count(s.id)::text as sets
       from fitness.exercise e
       left join fitness.set_entry s on s.exercise_id = e.id
      group by e.id, e.name
      order by count(s.id) desc, e.name`,
  )
  return rows
}

export async function latestMetrics(): Promise<
  { kind: string; value: string; measured_on: string }[]
> {
  const { rows } = await db().query<{ kind: string; value: string; measured_on: string }>(
    `select distinct on (kind) kind, value::text, measured_on::text
       from fitness.body_metric
      order by kind, measured_on desc`,
  )
  return rows
}

/** Workouts in the last seven days, for the load and XP figures. */
export async function thisWeek(): Promise<{ kind: string; duration_s: number }[]> {
  const { rows } = await db().query<{ kind: string; duration_s: number }>(
    `select kind, duration_s from fitness.workout
      where started_at >= core.today() - 7`,
  )
  return rows
}
