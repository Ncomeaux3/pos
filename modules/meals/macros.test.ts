import { describe, expect, it } from 'vitest'
import { standing, total, type PlannedMeal } from './macros'

const meal = (kcal: number, servings = 1, eaten = false): PlannedMeal => ({
  servings,
  eaten,
  macros: { kcal, protein: kcal / 10, carbs: kcal / 8, fat: kcal / 30 },
})

describe('total', () => {
  it('scales by servings rather than counting a recipe once', () => {
    // Half a batch of a 680 kcal recipe is 340, not 680.
    expect(total([meal(680, 0.5)]).kcal).toBe(340)
    expect(total([meal(680, 2)]).kcal).toBe(1360)
  })

  it('answers planned and eaten separately', () => {
    const meals = [meal(500, 1, true), meal(700, 1, false)]
    expect(total(meals).kcal).toBe(1200)
    expect(total(meals, true).kcal).toBe(500)
  })

  it('counts what it could not know rather than guessing at it', () => {
    // A meal with no recipe behind it contributes nothing, and the count is
    // what makes a low total visibly incomplete rather than quietly wrong.
    const meals: PlannedMeal[] = [meal(500), { servings: 1, eaten: false, macros: null }]
    const sum = total(meals)
    expect(sum.kcal).toBe(500)
    expect(sum.unknown).toBe(1)
  })

  it('is zero, not undefined, for an empty day', () => {
    expect(total([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0, unknown: 0 })
  })
})

describe('standing', () => {
  it('allows ten percent either side, because nobody hits a target exactly', () => {
    expect(standing(2400, 2400)).toBe('on')
    expect(standing(2300, 2400)).toBe('on')
    expect(standing(2600, 2400)).toBe('on')
  })

  it('calls it under or over past that', () => {
    expect(standing(2000, 2400)).toBe('under')
    expect(standing(2800, 2400)).toBe('over')
  })

  it('says nothing when there is no target to compare with', () => {
    expect(standing(2400, 0)).toBe('none')
  })
})
