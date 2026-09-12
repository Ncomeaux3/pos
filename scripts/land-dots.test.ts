import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pointInRings, type Ring } from './land-dots-lib'

// The committed list is what the globe draws. The test pins its shape rather
// than regenerating it: regenerating needs the atlas.
describe('modules/travel/land.json', () => {
  const dots = JSON.parse(readFileSync('modules/travel/land.json', 'utf8')) as [number, number][]

  it('is a few thousand points inside the world, none in Antarctica', () => {
    expect(dots.length).toBeGreaterThan(3000)
    expect(dots.length).toBeLessThan(8000)
    for (const [lat, lon] of dots) {
      expect(lat).toBeGreaterThanOrEqual(-60)
      expect(lat).toBeLessThanOrEqual(84)
      expect(lon).toBeGreaterThanOrEqual(-180)
      expect(lon).toBeLessThan(180)
    }
  })

  it('has land near Denver and Tokyo and none in the middle of the Pacific', () => {
    const near = (lat: number, lon: number, within: number) =>
      dots.some(([a, o]) => Math.abs(a - lat) <= within && Math.abs(o - lon) <= within)
    expect(near(39.7, -105, 1.5)).toBe(true)
    expect(near(35.7, 139.7, 1.5)).toBe(true)
    expect(near(0, -140, 4)).toBe(false)
  })
})

describe('pointInRings', () => {
  const square: Ring = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ]
  const hole: Ring = [
    [4, 4],
    [6, 4],
    [6, 6],
    [4, 6],
    [4, 4],
  ]
  it('is even-odd: inside the square, outside its lake', () => {
    expect(pointInRings(2, 2, [square, hole])).toBe(true)
    expect(pointInRings(5, 5, [square, hole])).toBe(false)
    expect(pointInRings(12, 5, [square, hole])).toBe(false)
  })
})
