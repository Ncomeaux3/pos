// Macro arithmetic and the grocery list. No imports: the Meals screen is a
// client component and anything reaching core/db.ts drags pg into the browser
// bundle.

export type Macros = { kcal: number; protein: number; carbs: number; fat: number }

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

export type PlannedMeal = {
  servings: number
  eaten: boolean
  /** Per serving. Null for something eaten with no recipe behind it. */
  macros: Macros | null
}

/**
 * Sum a day or a week.
 *
 * `eatenOnly` is the whole reason this takes a flag rather than being two
 * functions: planned and eaten are different questions asked of the same rows,
 * and the screen shows both side by side. A plan is an intention; a log is what
 * happened, and conflating them makes both useless.
 *
 * A meal with no recipe contributes nothing rather than being guessed at. The
 * screen says how many of those there were, so a low total is visibly
 * incomplete rather than quietly wrong.
 */
export function total(meals: PlannedMeal[], eatenOnly = false): Macros & { unknown: number } {
  let unknown = 0

  const sum = meals.reduce((acc, meal) => {
    if (eatenOnly && !meal.eaten) return acc
    if (!meal.macros) {
      unknown++
      return acc
    }
    return {
      kcal: acc.kcal + meal.macros.kcal * meal.servings,
      protein: acc.protein + meal.macros.protein * meal.servings,
      carbs: acc.carbs + meal.macros.carbs * meal.servings,
      fat: acc.fat + meal.macros.fat * meal.servings,
    }
  }, ZERO)

  return {
    kcal: Math.round(sum.kcal),
    protein: Math.round(sum.protein),
    carbs: Math.round(sum.carbs),
    fat: Math.round(sum.fat),
    unknown,
  }
}

/**
 * How a total reads against a target.
 *
 * Under, on, or over, with a tolerance either side, because hitting a calorie
 * target to the calorie is not a thing that happens and a screen that demanded
 * it would be red every day.
 */
export type Standing = 'under' | 'on' | 'over' | 'none'

const TOLERANCE = 0.1

export function standing(actual: number, target: number): Standing {
  if (target <= 0) return 'none'
  const ratio = actual / target
  if (ratio < 1 - TOLERANCE) return 'under'
  if (ratio > 1 + TOLERANCE) return 'over'
  return 'on'
}

export type GroceryLine = { item: string; quantities: string[]; recipes: string[] }

/**
 * The shopping list for a set of planned meals.
 *
 * Quantities are kept as written and listed rather than added up. "600 g" and
 * "2 cloves" and "a splash" do not sum, and a list that tried would either
 * refuse the recipe or invent a number. Two lines of "chicken thigh, 600 g" and
 * "chicken thigh, 400 g" is a thing a person can shop from; "1000" alone,
 * having silently dropped a unit, is not.
 */
export function groceryList(
  recipes: { name: string; ingredients: { item: string; quantity: string }[] }[],
): GroceryLine[] {
  const byItem = new Map<string, GroceryLine>()

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const key = ingredient.item.trim().toLowerCase()
      if (!key) continue

      const line = byItem.get(key) ?? { item: ingredient.item.trim(), quantities: [], recipes: [] }
      if (ingredient.quantity.trim()) line.quantities.push(ingredient.quantity.trim())
      if (!line.recipes.includes(recipe.name)) line.recipes.push(recipe.name)
      byItem.set(key, line)
    }
  }

  return [...byItem.values()].sort((a, b) => a.item.localeCompare(b.item))
}
