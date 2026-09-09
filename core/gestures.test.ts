import { describe, expect, it } from 'vitest'
import { atTop, swipeOf } from './gestures'

describe('swipeOf', () => {
  it('needs to travel before it is a swipe', () => {
    // Anything shorter is a tap with a shaky thumb.
    expect(swipeOf(20, 0)).toBeNull()
    expect(swipeOf(-20, 0)).toBeNull()
    expect(swipeOf(80, 0)).toBe('right')
    expect(swipeOf(-80, 0)).toBe('left')
  })

  it('lets the dominant axis decide', () => {
    // A scroll is mostly vertical. Firing a horizontal swipe during one is how
    // a gesture gets removed rather than fixed.
    expect(swipeOf(70, 200)).toBeNull()
    expect(swipeOf(200, 70)).toBe('right')
  })

  it('ignores a downward pull unless the caller asked for one', () => {
    expect(swipeOf(0, 120)).toBeNull()
    expect(swipeOf(0, 120, { allowDown: true })).toBe('down')
    expect(swipeOf(0, 20, { allowDown: true })).toBeNull()
  })

  it('takes the threshold a caller gives it', () => {
    expect(swipeOf(30, 0, { minDistance: 20 })).toBe('right')
  })

  it('is null for a drag that went nowhere', () => {
    expect(swipeOf(0, 0)).toBeNull()
    expect(swipeOf(0, 0, { allowDown: true })).toBeNull()
  })
})

describe('atTop', () => {
  it('is only true at the very top', () => {
    // Anywhere else a downward drag is a scroll back up, and hijacking it makes
    // the page feel broken.
    expect(atTop(0)).toBe(true)
    expect(atTop(4)).toBe(true)
    expect(atTop(60)).toBe(false)
  })
})
