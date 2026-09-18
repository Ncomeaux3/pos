import { describe, expect, it } from 'vitest'
import { chunk } from './hae-backfill-lib'

const point = (date: string, qty = 1) => ({ date: `${date} 08:00:00 -0500`, qty })

describe('chunk', () => {
  it('sends one request per month with every metric of that month, and workouts in twenties', () => {
    const payload = {
      data: {
        metrics: [
          { name: 'step_count', units: 'count', data: [point('2026-01-03'), point('2026-01-04'), point('2026-02-01')] },
          { name: 'weight_body_mass', units: 'lb', data: [point('2026-02-10', 190)] },
        ],
        workouts: Array.from({ length: 45 }, (_, i) => ({ id: String(i), start: `2026-03-0${(i % 9) + 1} 07:00:00 -0500` })),
      },
    }
    const out = chunk(payload)
    expect(out.map((c) => Object.keys(c.data))).toEqual([['metrics'], ['metrics'], ['workouts'], ['workouts'], ['workouts']])
    expect(out[0].data.metrics).toEqual([{ name: 'step_count', units: 'count', data: [point('2026-01-03'), point('2026-01-04')] }])
    expect(out[1].data.metrics).toEqual([
      { name: 'step_count', units: 'count', data: [point('2026-02-01')] },
      { name: 'weight_body_mass', units: 'lb', data: [point('2026-02-10', 190)] },
    ])
    expect(out.slice(2).map((c) => c.data.workouts?.length)).toEqual([20, 20, 5])
  })

  it('drops the series arrays a workout carries and keeps its scalar fields', () => {
    const w = { id: 'a', name: 'Outdoor Run', start: '2026-09-16 17:26:05 -0500', duration: 1662, route: [{ lat: 1 }], heartRateData: [1, 2], heartRate: { avg: { qty: 152, units: 'bpm' } } }
    const out = chunk({ data: { workouts: [w] } })
    expect(out[0].data.workouts).toEqual([{ id: 'a', name: 'Outdoor Run', start: '2026-09-16 17:26:05 -0500', duration: 1662, heartRate: { avg: { qty: 152, units: 'bpm' } } }])
  })

  it('keeps a point whose date does not read, under its own bucket, rather than dropping it', () => {
    const out = chunk({ data: { metrics: [{ name: 'step_count', data: [{ qty: 1 }] }] } })
    expect(out).toHaveLength(1)
    expect(out[0].data.metrics?.[0].data).toEqual([{ qty: 1 }])
  })
})
