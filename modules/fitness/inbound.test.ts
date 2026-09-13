import { afterAll, afterEach, expect, it } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const { db } = await import('@/core/db')
const { default: fitness } = await import('./manifest')

const inbound = fitness.inbound!.health_auto_export

afterEach(async () => {
  await db().query('delete from fitness.body_metric')
})
afterAll(async () => {
  await db().end()
})

const metric = (name: string, units: string, data: Record<string, unknown>[]) => ({
  name,
  units,
  data,
})
const at = (day: string) => `${day} 07:30:00 -0500`

async function rows() {
  const { rows } = await db().query<{ kind: string; measured_on: string; value: string; source: string }>(
    `select kind, to_char(measured_on, 'YYYY-MM-DD') as measured_on, value, source
     from fitness.body_metric order by kind`,
  )
  return rows.map((r) => ({ ...r, value: Number(r.value) }))
}

it('translates each metric into the units the table stores', async () => {
  await inbound({
    data: {
      metrics: [
        metric('weight_body_mass', 'lb', [{ qty: 185.2, date: at('2026-09-11') }]),
        metric('resting_heart_rate', 'bpm', [{ qty: 52, date: at('2026-09-11') }]),
        metric('heart_rate_variability', 'ms', [{ qty: 61, date: at('2026-09-11') }]),
        metric('body_fat_percentage', '%', [{ qty: 18.4, date: at('2026-09-11') }]),
        metric('sleep_analysis', 'hr', [
          { totalSleep: 7.5, asleep: 7.2, sleepStart: at('2026-09-10'), sleepEnd: at('2026-09-11') },
        ]),
      ],
    },
  })

  expect(await rows()).toEqual([
    { kind: 'body_fat', measured_on: '2026-09-11', value: 184, source: 'health_auto_export' },
    { kind: 'hrv', measured_on: '2026-09-11', value: 61, source: 'health_auto_export' },
    { kind: 'resting_hr', measured_on: '2026-09-11', value: 52, source: 'health_auto_export' },
    { kind: 'sleep_minutes', measured_on: '2026-09-11', value: 450, source: 'health_auto_export' },
    { kind: 'weight', measured_on: '2026-09-11', value: 84005, source: 'health_auto_export' },
  ])
})

// The manual guard on this table is the source column: log_metric stamps
// 'manual', and a push from the phone must never replace what the owner typed.
it('keeps a manual row and corrects an earlier export on the same day', async () => {
  await db().query(
    `insert into fitness.body_metric (kind, value, measured_on, source) values
       ('weight', 80000, '2026-09-11', 'manual'),
       ('resting_hr', 60, '2026-09-11', 'health_auto_export')`,
  )

  await inbound({
    data: {
      metrics: [
        metric('weight_body_mass', 'kg', [{ qty: 84.5, date: at('2026-09-11') }]),
        metric('resting_heart_rate', 'bpm', [{ qty: 52, date: at('2026-09-11') }]),
      ],
    },
  })

  expect(await rows()).toEqual([
    { kind: 'resting_hr', measured_on: '2026-09-11', value: 52, source: 'health_auto_export' },
    { kind: 'weight', measured_on: '2026-09-11', value: 80000, source: 'manual' },
  ])
})

it('writes nothing for metrics the table has no kind for, unknown weight units, or workouts', async () => {
  await inbound({
    data: {
      metrics: [
        metric('step_count', 'count', [{ qty: 9000, date: at('2026-09-11') }]),
        metric('something_new', 'x', [{ qty: 1, date: at('2026-09-11') }]),
        // A weight in units the translation cannot convert is not guessed at.
        metric('weight_body_mass', 'st', [{ qty: 13.2, date: at('2026-09-11') }]),
      ],
      workouts: [{ name: 'Run', start: at('2026-09-11') }],
    },
  })

  expect(await rows()).toEqual([])
})

it('skips a record with an unreadable date and lands the one beside it', async () => {
  await inbound({
    data: {
      metrics: [
        metric('weight_body_mass', 'kg', [
          { qty: 84, date: '11/09/2026' },
          { qty: 85, date: at('2026-09-12') },
        ]),
      ],
    },
  })

  expect(await rows()).toEqual([
    { kind: 'weight', measured_on: '2026-09-12', value: 85000, source: 'health_auto_export' },
  ])
})
