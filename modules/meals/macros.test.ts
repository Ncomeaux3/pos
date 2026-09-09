import { describe, expect, it } from 'vitest'
import { groceryList, standing, total, type PlannedMeal } from './macros'

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

describe('groceryList', () => {
  const recipes = [
    {
      name: 'Chicken bowl',
      ingredients: [
        { item: 'Chicken thigh', quantity: '600 g' },
        { item: 'Rice', quantity: '300 g' },
        { item: 'Garlic', quantity: '3 cloves' },
      ],
    },
    {
      name: 'Stir fry',
      ingredients: [
        { item: 'chicken thigh', quantity: '400 g' },
        { item: 'Garlic', quantity: 'a splash of oil worth' },
      ],
    },
  ]

  it('groups the same item across recipes, case insensitively', () => {
    const list = groceryList(recipes)
    const chicken = list.find((l) => l.item.toLowerCase() === 'chicken thigh')!
    expect(chicken.recipes).toEqual(['Chicken bowl', 'Stir fry'])
  })

  it('lists quantities rather than adding them', () => {
    // "600 g" and "3 cloves" and "a splash" do not sum. A list that tried
    // would either refuse the recipe or invent a number, and two lines a person
    // can shop from beats one that silently dropped a unit.
    const chicken = groceryList(recipes).find((l) => l.item.toLowerCase() === 'chicken thigh')!
    expect(chicken.quantities).toEqual(['600 g', '400 g'])

    const garlic = groceryList(recipes).find((l) => l.item === 'Garlic')!
    expect(garlic.quantities).toEqual(['3 cloves', 'a splash of oil worth'])
  })

  it('sorts so the list reads the same every time', () => {
    expect(groceryList(recipes).map((l) => l.item)).toEqual(['Chicken thigh', 'Garlic', 'Rice'])
  })

  it('skips an ingredient with no name', () => {
    const list = groceryList([{ name: 'x', ingredients: [{ item: '  ', quantity: '1' }] }])
    expect(list).toEqual([])
  })
})
