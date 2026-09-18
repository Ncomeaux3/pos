import { describe, expect, it } from 'vitest'
import { toBodyMetrics, toWorkouts } from './client'

const at = (day: string, time = '07:30:00') => `${day} ${time} -0500`
const metric = (name: string, units: string, data: Record<string, unknown>[]) => ({ name, units, data })

describe('toBodyMetrics', () => {
  it('maps the daily totals and levels onto their kinds and units', () => {
    const rows = toBodyMetrics({
      data: {
        metrics: [
          metric('step_count', 'count', [{ qty: 9412.4, date: at('2026-09-11') }]),
          metric('active_energy', 'kcal', [{ qty: 612.7, date: at('2026-09-11') }]),
          metric('apple_exercise_time', 'min', [{ qty: 42, date: at('2026-09-11') }]),
          metric('apple_stand_hour', 'count', [{ qty: 11, date: at('2026-09-11') }]),
          // Minutes stood, a different metric; it must not add to the hours.
          metric('apple_stand_time', 'min', [{ qty: 99, date: at('2026-09-11') }]),
          metric('vo2_max', 'mL/min·kg', [{ qty: 41.3, date: at('2026-09-11') }]),
          metric('blood_oxygen_saturation', '%', [{ qty: 97.6, date: at('2026-09-11') }]),
          metric('respiratory_rate', 'count/min', [{ qty: 14.5, date: at('2026-09-11') }]),
          metric('flights_climbed', 'count', [{ qty: 12, date: at('2026-09-11') }]),
          metric('walking_running_distance', 'mi', [{ qty: 4.2, date: at('2026-09-11') }]),
          metric('walking_heart_rate_average', 'bpm', [{ qty: 98, date: at('2026-09-11') }]),
          metric('heart_rate', 'bpm', [{ Min: 48, Avg: 71.4, Max: 156, date: at('2026-09-11') }]),
          // The docs spell weight with an ampersand; the older spelling stays.
          metric('weight_&_body_mass', 'lb', [{ qty: 185.2, date: at('2026-09-11') }]),
        ],
      },
    })
    expect(rows).toEqual([
      { kind: 'steps', measuredOn: '2026-09-11', value: 9412 },
      { kind: 'active_energy', measuredOn: '2026-09-11', value: 613 },
      { kind: 'exercise_minutes', measuredOn: '2026-09-11', value: 42 },
      { kind: 'stand_hours', measuredOn: '2026-09-11', value: 11 },
      { kind: 'vo2_max', measuredOn: '2026-09-11', value: 413 },
      { kind: 'blood_oxygen', measuredOn: '2026-09-11', value: 976 },
      { kind: 'respiratory_rate', measuredOn: '2026-09-11', value: 145 },
      { kind: 'flights_climbed', measuredOn: '2026-09-11', value: 12 },
      { kind: 'walking_distance', measuredOn: '2026-09-11', value: 6759 },
      { kind: 'walking_hr_avg', measuredOn: '2026-09-11', value: 98 },
      { kind: 'heart_rate_avg', measuredOn: '2026-09-11', value: 71 },
      { kind: 'weight', measuredOn: '2026-09-11', value: 84005 },
    ])
  })

  // The app can be set to send hourly buckets. A total is the sum of its day's
  // buckets; a level is whatever was read last. Neither is the last bucket alone.
  it('sums a total across one day and keeps the last reading of a level', () => {
    const rows = toBodyMetrics({
      data: {
        metrics: [
          metric('step_count', 'count', [
            { qty: 1200, date: at('2026-09-11', '08:00:00') },
            { qty: 3400, date: at('2026-09-11', '12:00:00') },
            { qty: 800, date: at('2026-09-12', '08:00:00') },
          ]),
          metric('blood_oxygen_saturation', '%', [
            { qty: 96, date: at('2026-09-11', '08:00:00') },
            { qty: 98, date: at('2026-09-11', '22:00:00') },
          ]),
        ],
      },
    })
    expect(rows).toEqual([
      { kind: 'steps', measuredOn: '2026-09-11', value: 4600 },
      { kind: 'steps', measuredOn: '2026-09-12', value: 800 },
      { kind: 'blood_oxygen', measuredOn: '2026-09-11', value: 980 },
    ])
  })

  // From a real export (2026-09-18): Eight Sleep's overlapping records make
  // the app's summed hours two to three times the night. The span between
  // sleepStart and sleepEnd is the night, dated by the morning it ended.
  it('reads sleep as the span from sleepStart to sleepEnd, not the summed hours', () => {
    const rows = toBodyMetrics({
      data: {
        metrics: [
          metric('sleep_analysis', 'hr', [
            {
              date: '2026-06-22 00:00:00 -0500',
              sleepStart: '2026-06-22 00:37:00 -0500',
              sleepEnd: '2026-06-22 10:09:00 -0500',
              totalSleep: 26.766666666666666,
              inBed: 27.400000000000006,
              asleep: 0,
            },
            // The older shape without a span still reads its hours.
            { date: '2026-06-23 00:00:00 -0500', asleep: 7.5 },
          ]),
        ],
      },
    })
    expect(rows).toEqual([
      { kind: 'sleep_minutes', measuredOn: '2026-06-22', value: 572 },
      { kind: 'sleep_minutes', measuredOn: '2026-06-23', value: 450 },
    ])
  })
})

describe('toWorkouts', () => {
  const run = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Running',
    start: '2026-09-11 07:00:00 -0500',
    end: '2026-09-11 07:30:00 -0500',
    duration: 1800.4,
    activeEnergyBurned: { qty: 350.2, units: 'kcal' },
    distance: { qty: 3.5, units: 'mi' },
    heartRate: { min: { qty: 120, units: 'bpm' }, avg: { qty: 150.6, units: 'bpm' }, max: { qty: 175, units: 'bpm' } },
  }

  it('reads a v2 workout into the columns fitness.workout has', () => {
    expect(toWorkouts({ data: { workouts: [run] } })).toEqual([
      {
        externalId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Running',
        kind: 'run',
        startedAt: '2026-09-11 07:00:00 -0500',
        durationS: 1800,
        distanceM: 5633,
        avgHr: 151,
        detail: '350 kcal',
      },
    ])
  })

  it('names the kind from the workout name the way the Strava sync does', () => {
    const kinds = (names: string[]) =>
      toWorkouts({ data: { workouts: names.map((name, i) => ({ ...run, id: String(i), name })) } }).map(
        (w) => w.kind,
      )
    expect(
      kinds([
        'Traditional Strength Training',
        'Functional Strength Training',
        'High Intensity Interval Training',
        'Outdoor Run',
        'Cycling',
        'Pool Swim',
        'Hiking',
        'Walking',
        'Yoga',
      ]),
    ).toEqual(['strength', 'strength', 'strength', 'run', 'ride', 'swim', 'walk', 'walk', 'other'])
  })

  it('converts km, tolerates missing optionals, and skips what has no id, start or duration', () => {
    const rows = toWorkouts({
      data: {
        workouts: [
          { id: 'a', name: 'Cycling', start: run.start, end: run.end, duration: 3600, distance: { qty: 20, units: 'km' } },
          { name: 'Legacy v1', start: run.start, end: run.end, totalEnergy: { qty: 1 } },
          { id: 'c', name: 'No start', duration: 60 },
          { id: 'd', name: 'Bad date', start: '11/09/2026', duration: 60 },
        ],
      },
    })
    expect(rows).toEqual([
      {
        externalId: 'a',
        name: 'Cycling',
        kind: 'ride',
        startedAt: run.start,
        durationS: 3600,
        distanceM: 20000,
        avgHr: null,
        detail: '',
      },
    ])
  })
})
