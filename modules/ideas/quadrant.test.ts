import { describe, expect, it } from 'vitest'
import { boardOrder, quadrant, type Level } from './quadrant'

describe('quadrant', () => {
  it('names the four corners', () => {
    expect(quadrant(1, 3)).toBe('quick-win')
    expect(quadrant(3, 3)).toBe('big-bet')
    expect(quadrant(1, 1)).toBe('filler')
    expect(quadrant(3, 1)).toBe('money-pit')
  })

  it('rounds the middle towards doing it', () => {
    // A middling idea is worth a look before it is worth dismissing, so medium
    // effort counts as cheap and medium impact counts as worthwhile.
    expect(quadrant(2, 2)).toBe('quick-win')
  })

  it('treats high effort as expensive whatever the impact', () => {
    expect(quadrant(3, 2)).toBe('big-bet')
    expect(quadrant(3, 1)).toBe('money-pit')
  })
})

describe('boardOrder', () => {
  const idea = (name: string, effort: Level, impact: Level) => ({ name, effort, impact })

  it('puts quick wins first and money pits last', () => {
    const sorted = boardOrder([
      idea('pit', 3, 1),
      idea('filler', 1, 1),
      idea('bet', 3, 3),
      idea('win', 1, 3),
    ])
    expect(sorted.map((i) => i.name)).toEqual(['win', 'bet', 'filler', 'pit'])
  })

  it('breaks a tie on impact, then on effort', () => {
    const sorted = boardOrder([
      idea('cheap-medium', 1, 2),
      idea('cheap-high', 1, 3),
      idea('medium-high', 2, 3),
    ])
    expect(sorted.map((i) => i.name)).toEqual(['cheap-high', 'medium-high', 'cheap-medium'])
  })

  it('does not mutate what it was given', () => {
    const input = [idea('pit', 3, 1), idea('win', 1, 3)]
    boardOrder(input)
    expect(input[0].name).toBe('pit')
  })
})
