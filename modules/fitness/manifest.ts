import { z } from 'zod'
import { db } from '@/core/db'
import { register } from '@/core/entities'
import { defineModule, defineTool } from '@/core/module-contract'
import { toReadings } from '@/integrations/apple_shortcuts/client'
import { BODY_METRIC_KINDS, toBodyMetrics, toWorkouts } from '@/integrations/health_auto_export/client'
import { writeReadings } from './inbound'
import { coachReview } from './jobs/coach'
import { syncStrava } from './jobs/sync-strava'
import { nightlyDigest } from './jobs/nightly-digest'
import { thisWeek } from './data'
import { load } from './units'
import FitnessPage from './ui/FitnessPage'
import { FitnessTile } from './ui/Tile'

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
        'Record a body measurement. Weight in grams, sleep in minutes, heart rate in beats, distance in metres, percentages and VO2 max in tenths.',
      input: z.object({
        kind: z.enum(BODY_METRIC_KINDS),
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
    write_plan: defineTool({
      description:
        'Create or change the training plan. The coach reaches a plan only through this, and only as a proposal.',
      input: z.object({
        id: z.uuid().optional(),
        name: z.string().min(1).max(200).optional(),
        goal: z.string().max(500).optional(),
        days_per_week: z.number().int().min(1).max(7).optional(),
        notes: z.string().max(4000).optional(),
        status: z.enum(['active', 'archived']).optional(),
        started_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        items: z
          .array(
            z.object({
              day_label: z.string().max(60).default(''),
              exercise: z.string().min(1).max(200),
              sets: z.number().int().min(1).max(20).default(3),
              /** '5', '8-12', 'AMRAP'. A number column would reject two of three. */
              reps: z.string().max(40).default(''),
              target_weight_g: z.number().int().min(0).nullable().optional(),
              notes: z.string().max(500).default(''),
            }),
          )
          .max(60)
          .optional(),
      }),
      run: async (input) => {
        const { id, items, ...rest } = input

        // Every key is a literal from the zod schema above, a closed set.
        const fields = Object.entries(rest).filter(([, value]) => value !== undefined)

        let planId = id
        if (planId) {
          if (fields.length > 0) {
            const set = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ')
            await db().query(`update fitness.plan set ${set} where id = $1`, [
              planId,
              ...fields.map(([, value]) => value),
            ])
          }
        } else {
          if (!input.name) throw new Error('A new plan needs a name')

          // One plan is in force at a time. Archiving the old one is part of
          // writing the new one, or two plans both claim to be the plan.
          await db().query(`update fitness.plan set status = 'archived' where status = 'active'`)

          const columns = fields.map(([key]) => key).join(', ')
          const params = fields.map((unused, i) => `$${i + 1}`).join(', ')
          const { rows } = await db().query<{ id: string }>(
            `insert into fitness.plan (${columns}) values (${params}) returning id`,
            fields.map(([, value]) => value),
          )
          planId = rows[0].id
        }

        // Items are an ordered list owned by the plan, so they are cleared and
        // rewritten rather than diffed. Passing none leaves them alone.
        if (items) {
          await db().query(`delete from fitness.plan_item where plan_id = $1`, [planId])
          for (const [position, item] of items.entries()) {
            await db().query(
              `insert into fitness.plan_item
                 (plan_id, day_label, exercise, sets, reps, target_weight_g, notes, position)
               values ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                planId,
                item.day_label,
                item.exercise,
                item.sets,
                item.reps,
                item.target_weight_g ?? null,
                item.notes,
                position,
              ],
            )
          }
        }

        const { rows: named } = await db().query<{ name: string }>(
          `select name from fitness.plan where id = $1`,
          [planId],
        )
        await register({
          module: 'fitness',
          entityType: 'plan',
          entityId: planId!,
          title: named[0].name,
          text: input.goal ?? '',
          eventType: 'plan_written',
        })

        return { id: planId }
      },
    }),

    coach_review: defineTool({
      description:
        'Run the weekly coach over the training log. It returns what it would suggest; proposing is the only thing that writes.',
      input: z.object({}),
      run: () => coachReview(),
    }),
  },

  /**
   * Only the plan is guarded.
   *
   * A workout is a record of something that already happened and a body
   * measurement is a reading: neither is a decision an approval would catch,
   * and a nightly Strava import behind the Review inbox would fill it with two
   * hundred rows nobody would read.
   *
   * A plan is the opposite. It is the thing the owner agreed to do, and SPEC is
   * explicit that the coach proposes rather than decides, so the coach has no
   * unguarded path to one.
   */
  guarded: ['write_plan'],
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

  // Training is the one part of the week that is a win by simply having
  // happened, so this is the only thing Fitness puts in the review.
  review: {
    wins: async () => {
      // Bucketed in SQL against core.today(), so "this week" is the owner's
      // week rather than the server's.
      const { rows } = await db().query<{
        weeks_ago: number
        n: string
        secs: string
        metres: string
      }>(
        `select ((date_trunc('week', core.today())::date
                  - date_trunc('week', started_at)::date) / 7)::int as weeks_ago,
                count(*)::text as n,
                coalesce(sum(duration_s), 0)::text as secs,
                coalesce(sum(distance_m), 0)::text as metres
           from fitness.workout
          where started_at >= core.today() - interval '56 days'
          group by 1`,
      )

      const current = rows.find((r) => r.weeks_ago === 0)
      if (!current || Number(current.n) === 0) return []

      // Weeks trained back to back, this one included. A week off ends it,
      // which is the only reading of a streak worth putting on a screen.
      const trained = new Set(rows.filter((r) => Number(r.n) > 0).map((r) => r.weeks_ago))
      let streak = 0
      while (trained.has(streak)) streak++

      const count = Number(current.n)
      const minutes = Math.round(Number(current.secs) / 60)
      const miles = Number(current.metres) / 1609.344
      const parts = [
        minutes < 60 ? `${minutes}m` : minutes % 60 === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
      ]
      if (miles >= 0.1) parts.push(`${miles.toFixed(2)} mi`)

      return [
        {
          id: 'fitness-week',
          title: `${count} workout${count === 1 ? '' : 's'}`,
          meta: `Fitness · ${parts.join(' · ')}`,
          tag: streak > 1 ? `streak ${streak}w` : undefined,
        },
      ]
    },
  },

  /** See ModuleManifest.tile: the module says how its own numbers read. */
  tile: FitnessTile,

  jobs: [
    // Sync first: the digest and the coach both read what it wrote.
    { name: 'sync_strava', run: syncStrava },
    { name: 'nightly_digest', run: nightlyDigest },
    // Runs with the others and proposes at most once a fortnight per
    // suggestion, so a nightly cron does not become a nightly nag.
    { name: 'coach_review', run: coachReview },
  ],

  inbound: {
    // Apple Health readings pushed by the phone, from either app. The
    // integration translates, inbound.ts writes. Not in `requires`: the module
    // is usable without them.
    health_auto_export: async (payload) =>
      writeReadings('health_auto_export', toBodyMetrics(payload), toWorkouts(payload)),
    apple_shortcuts: async (payload) => {
      const { metrics, workouts } = toReadings(payload)
      await writeReadings('apple_shortcuts', metrics, workouts)
    },
  },
  entityTypes: ['workout', 'plan'],
})
