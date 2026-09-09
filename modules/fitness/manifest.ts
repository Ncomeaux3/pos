import { z } from 'zod'
import { db } from '@/core/db'
import { register } from '@/core/entities'
import { defineModule, defineTool } from '@/core/module-contract'
import { nightlyDigest } from './jobs/nightly-digest'
import { thisWeek } from './data'
import { load } from './units'
import FitnessPage from './ui/FitnessPage'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

export default defineModule({
  id: 'fitness',
  nav: { label: 'Fitness', icon: 'activity', order: 50 },
  pages: { '': FitnessPage },

  tools: {
    get_digest: defineTool({
      description: 'Workouts and training load this week against last, and the latest body metrics.',
      input: z.object({}),
      run: () => nightlyDigest(),
    }),

    log_workout: defineTool({
      description: 'Record a workout, with its sets if it was a lifting session.',
      input: z.object({
        name: z.string().min(1).max(200),
        detail: z.string().max(500).optional(),
        kind: z.enum(['strength', 'run', 'ride', 'swim', 'walk', 'other']).default('other'),
        started_at: z.string(),
        duration_s: z.number().int().min(0).max(86_400),
        distance_m: z.number().int().min(0).max(1_000_000).default(0),
        avg_hr: z.number().int().min(20).max(260).nullable().optional(),
        sets: z
          .array(
            z.object({
              exercise: z.string().min(1).max(120),
              reps: z.number().int().min(1).max(1000),
              // Grams. Unit free at rest: pounds and kilograms are both a
              // rendering decision, and storing either makes the other lossy.
              weight_g: z.number().int().min(0).max(1_000_000).default(0),
            }),
          )
          .max(200)
          .optional(),
      }),
      run: async (input, ctx) => {
        const { rows } = await db().query<{ id: string }>(
          `insert into fitness.workout
             (name, detail, kind, started_at, duration_s, distance_m, avg_hr, source)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           returning id`,
          [
            input.name,
            input.detail ?? '',
            input.kind,
            input.started_at,
            input.duration_s,
            input.distance_m,
            input.avg_hr ?? null,
            ctx.source === 'agent' ? 'agent' : 'manual',
          ],
        )

        for (const [i, set] of (input.sets ?? []).entries()) {
          const { rows: exercise } = await db().query<{ id: string }>(
            `insert into fitness.exercise (name) values ($1)
             on conflict (name) do update set name = excluded.name
             returning id`,
            [set.exercise],
          )
          await db().query(
            `insert into fitness.set_entry (workout_id, exercise_id, reps, weight_g, position)
             values ($1, $2, $3, $4, $5)`,
            [rows[0].id, exercise[0].id, set.reps, set.weight_g, i],
          )
        }

        // A workout is a thing that happened and can happen again, so the event
        // is explicit rather than the creation event register() would default
        // to. This is what earns the Health XP.
        await register({
          module: 'fitness',
          entityType: 'workout',
          entityId: rows[0].id,
          title: input.name,
          text: input.detail,
          eventType: 'workout_logged',
          occurredAt: new Date(input.started_at),
        })

        return { id: rows[0].id }
      },
    }),

    log_metric: defineTool({
      description:
        'Record a body measurement. Weight in grams, sleep in minutes, heart rate in beats.',
      input: z.object({
        kind: z.enum(['weight', 'resting_hr', 'hrv', 'sleep_minutes', 'body_fat']),
        value: z.number(),
        measured_on: date.optional(),
      }),
      run: async (input, ctx) => {
        await db().query(
          `insert into fitness.body_metric (kind, value, measured_on, source)
           values ($1, $2, coalesce($3::date, core.today()), $4)
           on conflict (kind, measured_on) do update set value = excluded.value`,
          [
            input.kind,
            input.value,
            input.measured_on ?? null,
            ctx.source === 'agent' ? 'agent' : 'manual',
          ],
        )
        // No register(): a measurement is not work, and the XP weight for it is
        // zero anyway. Registering it would only fill search with numbers.
        return { kind: input.kind, value: input.value }
      },
    }),
  },

  /**
   * Nothing is guarded.
   *
   * A workout is a record of something that already happened, and a body
   * measurement is a reading. Neither is a decision an agent could get wrong in
   * a way an approval would catch, and a nightly Strava import behind the
   * Review inbox would fill it with two hundred rows nobody would read.
   */
  guarded: [],
  requires: ['strava'],

  metrics: {
    workouts_this_week: {
      label: 'Workouts this week',
      unit: 'workouts',
      get: async () => (await thisWeek()).length,
    },
    load_this_week: {
      label: 'Training load this week',
      unit: 'load',
      get: async () => {
        const week = await thisWeek()
        return load(week.map((w) => ({ kind: w.kind, durationS: w.duration_s })))
      },
    },
    body_weight: {
      label: 'Body weight',
      unit: 'lb',
      get: async () => {
        const { rows } = await db().query<{ value: string }>(
          `select value::text from fitness.body_metric
            where kind = 'weight' order by measured_on desc limit 1`,
        )
        // Pounds, because that is what a goal target is typed in. Grams would
        // read as a four hundred thousandfold overshoot on the Goals screen.
        return rows[0] ? Number(rows[0].value) / 453.59237 : 0
      },
    },
  },

  jobs: [{ name: 'nightly_digest', run: nightlyDigest }],
  entityTypes: ['workout'],
})
