import { describe, expect, it } from 'vitest'
import {
  bestSet,
  distance,
  duration,
  hoursLabel,
  load,
  mass,
  pace,
  screenState,
  shortDate,
  sourcesLabel,
  toGrams,
  whenLabel,
} from './units'

describe('mass', () => {
  it('renders the number that was actually loaded on the bar', () => {
    expect(mass(toGrams(315, 'lb'))).toBe('315 lb')
    expect(mass(toGrams(45, 'lb'))).toBe('45 lb')
  })

  it('round trips through either unit', () => {
    expect(mass(toGrams(100, 'kg'), 'kg')).toBe('100 kg')
    expect(mass(toGrams(225, 'lb'), 'lb')).toBe('225 lb')
  })

  it('rounds kilograms to the half, because plates come in 1.25s', () => {
    expect(mass(102_300, 'kg')).toBe('102.5 kg')
  })
})

describe('shortDate', () => {
  it('dates a row in the owner\'s zone, not the renderer\'s', () => {
    // 20:30 on Sep 12 in Chicago is 01:30 on Sep 13 in UTC, where the server runs.
    expect(shortDate('2026-09-13T01:30:00.000Z', 'America/Chicago')).toBe('Sep 12')
    expect(shortDate('2026-09-13T01:30:00.000Z', 'UTC')).toBe('Sep 13')
  })
})

describe('distance', () => {
  it('reads in miles, because the owner reads imperial', () => {
    // 5,100 m is the 5 km run Health Auto Export sent as 3.17 mi.
    expect(distance(5100)).toBe('3.17 mi')
    expect(distance(1609.344)).toBe('1.00 mi')
  })

  it('switches to feet under a tenth of a mile', () => {
    expect(distance(100)).toBe('328 ft')
  })

  it('still renders metric when asked for it', () => {
    expect(distance(820, 'km')).toBe('820 m')
    expect(distance(5100, 'km')).toBe('5.1 km')
  })

  it('reads a pool swim in yards', () => {
    // 700 yd, as the pool measures it and Apple Health sent it.
    expect(distance(640.08, 'yd')).toBe('700 yd')
  })

  it('says nothing for a workout that covered no ground', () => {
    expect(distance(0)).toBe('')
  })
})

describe('duration', () => {
  it('reads minutes under an hour and hours over one', () => {
    expect(duration(3480)).toBe('58m')
    expect(duration(3720)).toBe('1h 02m')
  })
})

describe('pace', () => {
  it('is minutes and seconds per mile', () => {
    // 5,100 m is 3.17 mi, and 51 minutes over it is 16:06/mi.
    expect(pace(5100, 3060)).toBe('16:06/mi')
    // 6,400 m is 3.98 mi, and 50 minutes over it is 12:34/mi.
    expect(pace(6400, 3000)).toBe('12:34/mi')
  })

  it('still renders metric when asked for it', () => {
    // 5.1 km in 51 minutes is 10:00/km.
    expect(pace(5100, 3060, 'km')).toBe('10:00/km')
  })

  it('paces a swim per hundred yards', () => {
    // 700 yd in 20:25 is 2:55 per 100 yd.
    expect(pace(640.08, 1225, 'yd')).toBe('2:55/100yd')
  })

  it('never produces a time ending in sixty seconds', () => {
    // Naive rounding of 479.6 seconds per mile gives 7:60, which is not a time.
    expect(pace(1609.344, 479.6)).toBe('8:00/mi')
    expect(pace(1000, 479.6, 'km')).toBe('8:00/km')
  })

  it('says nothing when there is no distance to divide by', () => {
    expect(pace(0, 3000)).toBe('')
    expect(pace(50, 3000)).toBe('')
  })
})

describe('bestSet', () => {
  const set = (weightLb: number, reps: number) => ({ weightG: toGrams(weightLb, 'lb'), reps })

  it('takes the heaviest', () => {
    expect(bestSet([set(275, 10), set(315, 3)])).toEqual(set(315, 3))
  })

  it('breaks a tie on reps, because five beats three at the same weight', () => {
    expect(bestSet([set(315, 3), set(315, 5), set(315, 1)])).toEqual(set(315, 5))
  })

  it('has nothing to say about an empty workout', () => {
    expect(bestSet([])).toBeNull()
  })
})

describe('load', () => {
  it('weights a run above a ride of the same length', () => {
    const run = load([{ kind: 'run', durationS: 3600 }])
    const ride = load([{ kind: 'ride', durationS: 3600 }])
    expect(run).toBeGreaterThan(ride)
  })

  it('counts a walk as barely training', () => {
    expect(load([{ kind: 'walk', durationS: 3600 }])).toBe(30)
  })

  it('sums a week', () => {
    expect(
      load([
        { kind: 'strength', durationS: 3600 },
        { kind: 'run', durationS: 1800 },
      ]),
    ).toBe(72 + 42)
  })

  it('treats a kind it has never heard of as ordinary rather than free', () => {
    expect(load([{ kind: 'kitesurfing', durationS: 3600 }])).toBe(60)
  })
})

describe('the overview labels', () => {
  it('names when a set happened', () => {
    expect(whenLabel('2026-09-12T18:00:00.000Z', '2026-09-12')).toBe('Today')
    expect(whenLabel('2026-09-11T18:00:00.000Z', '2026-09-12')).toBe('Yesterday')
    expect(whenLabel('2026-09-04T18:00:00.000Z', '2026-09-12')).toBe('Sep 04')
  })

  it('prints the week in hours and minutes', () => {
    expect(hoursLabel(222)).toBe('3h 42m')
    expect(hoursLabel(51)).toBe('51m')
    expect(hoursLabel(120)).toBe('2h 00m')
  })

  it('counts where the rows came from and drops zeros', () => {
    expect(sourcesLabel([{ source: 'strava' }, { source: 'demo' }, { source: 'manual' }])).toBe('1 Strava · 2 by hand')
    expect(
      sourcesLabel([{ source: 'health_auto_export' }, { source: 'apple_shortcuts' }, { source: 'manual' }]),
    ).toBe('2 Apple Health · 1 by hand')
    expect(sourcesLabel([{ source: 'demo' }])).toBe('1 by hand')
    expect(sourcesLabel([])).toBe('')
  })

  it('draws the setup card only when there is nothing at all', () => {
    expect(screenState({ workouts: 0, metrics: 0, connected: false })).toBe('setup')
    expect(screenState({ workouts: 0, metrics: 0, connected: true })).toBe('setup-connected')
    expect(screenState({ workouts: 3, metrics: 0, connected: false })).toBe('live')
    // Readings with no workouts: what a phone that cannot send workouts leaves.
    expect(screenState({ workouts: 0, metrics: 4, connected: false })).toBe('live')
  })
})
