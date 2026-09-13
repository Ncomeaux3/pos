import { describe, expect, it } from 'vitest'
import { toReadings } from './client'

describe('toReadings', () => {
  it('maps every metric key onto its kind and stored unit, dated by day', () => {
    const { metrics } = toReadings({
      day: '2026-09-13',
      metrics: {
        weight_lb: 185.2,
        resting_hr: 52,
        hrv_ms: 61.4,
        body_fat_pct: 18.4,
        sleep_hours: 7.5,
        steps: 9412.4,
        active_kcal: 612.7,
        exercise_min: 42,
        stand_hours: 11,
        vo2_max: 41.3,
        spo2_pct: 97.6,
        resp_rate: 14.5,
        flights: 12,
        walk_mi: 4.2,
        walking_hr: 98,
        hr_avg: 71.4,
      },
    })
    expect(metrics).toEqual([
      { kind: 'weight', measuredOn: '2026-09-13', value: 84005 },
      { kind: 'resting_hr', measuredOn: '2026-09-13', value: 52 },
      { kind: 'hrv', measuredOn: '2026-09-13', value: 61 },
      { kind: 'body_fat', measuredOn: '2026-09-13', value: 184 },
      { kind: 'sleep_minutes', measuredOn: '2026-09-13', value: 450 },
      { kind: 'steps', measuredOn: '2026-09-13', value: 9412 },
      { kind: 'active_energy', measuredOn: '2026-09-13', value: 613 },
      { kind: 'exercise_minutes', measuredOn: '2026-09-13', value: 42 },
      { kind: 'stand_hours', measuredOn: '2026-09-13', value: 11 },
      { kind: 'vo2_max', measuredOn: '2026-09-13', value: 413 },
      { kind: 'blood_oxygen', measuredOn: '2026-09-13', value: 976 },
      { kind: 'respiratory_rate', measuredOn: '2026-09-13', value: 145 },
      { kind: 'flights_climbed', measuredOn: '2026-09-13', value: 12 },
      { kind: 'walking_distance', measuredOn: '2026-09-13', value: 6759 },
      { kind: 'walking_hr_avg', measuredOn: '2026-09-13', value: 98 },
      { kind: 'heart_rate_avg', measuredOn: '2026-09-13', value: 71 },
    ])
  })

  // Shortcuts hands numbers over as text more often than not, and a metric the
  // Shortcut has no sample for arrives as an empty string or is left out.
  it('reads numeric strings, takes kg and km, and skips blanks and unknown keys', () => {
    const { metrics } = toReadings({
      day: '2026-09-13',
      metrics: { weight_kg: '84.5', walk_km: '6.5', steps: '', resting_hr: 'n/a', made_up: 3 },
    })
    expect(metrics).toEqual([
      { kind: 'weight', measuredOn: '2026-09-13', value: 84500 },
      { kind: 'walking_distance', measuredOn: '2026-09-13', value: 6500 },
    ])
  })

  it('writes nothing without a readable day', () => {
    expect(toReadings({ day: '13/09/2026', metrics: { steps: 100 } })).toEqual({ metrics: [], workouts: [] })
    expect(toReadings({ metrics: { steps: 100 } })).toEqual({ metrics: [], workouts: [] })
  })

  it('reads workouts, keyed by their start, with the same kind rules as the other sources', () => {
    const { workouts } = toReadings({
      day: '2026-09-13',
      workouts: [
        { name: 'Running', start: '2026-09-13T06:00:00-05:00', minutes: 30.4, miles: 3.5, kcal: 350.2, avg_hr: '150' },
        { name: 'Traditional Strength Training', start: '2026-09-13T18:00:00-05:00', minutes: '45', km: 0 },
        { name: 'No start', minutes: 10 },
        { name: 'No minutes', start: '2026-09-13T07:00:00-05:00' },
      ],
    })
    expect(workouts).toEqual([
      {
        externalId: '2026-09-13T06:00:00-05:00',
        name: 'Running',
        kind: 'run',
        startedAt: '2026-09-13T06:00:00-05:00',
        durationS: 1824,
        distanceM: 5633,
        avgHr: 150,
        detail: '350 kcal',
      },
      {
        externalId: '2026-09-13T18:00:00-05:00',
        name: 'Traditional Strength Training',
        kind: 'strength',
        startedAt: '2026-09-13T18:00:00-05:00',
        durationS: 2700,
        distanceM: 0,
        avgHr: null,
        detail: '',
      },
    ])
  })
})
