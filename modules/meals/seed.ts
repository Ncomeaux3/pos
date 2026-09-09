import { db } from '@/core/db'
import { register } from '@/core/entities'

// Synthetic rows for `pnpm setup --demo`. Upserts on external_id so running it
// twice does not duplicate. Nothing here is personal; this ships in the template.

type Recipe = {
  external_id: string
  name: string
  servings: number
  minutes: number
  costCents: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  tags: string[]
  favourite?: boolean
  status?: 'draft' | 'ready'
  sourceUrl?: string
  ingredients: [string, string][]
  steps: string[]
}

const RECIPES: Recipe[] = [
  {
    external_id: 'r-yogurt',
    name: 'Yogurt bowl',
    servings: 1, minutes: 5, costCents: 210,
    kcal: 420, protein: 32, carbs: 48, fat: 10,
    tags: ['breakfast', 'quick', 'high-protein'],
    favourite: true,
    ingredients: [['Greek yogurt', '250 g'], ['Blueberries', '80 g'], ['Granola', '40 g'], ['Honey', '1 tsp']],
    steps: ['Spoon yogurt into a bowl.', 'Top with berries and granola.', 'Drizzle honey.'],
  },
  {
    external_id: 'r-oats',
    name: 'Overnight oats',
    servings: 1, minutes: 5, costCents: 140,
    kcal: 460, protein: 24, carbs: 62, fat: 12,
    tags: ['breakfast', 'prep-ahead'],
    ingredients: [['Rolled oats', '80 g'], ['Milk', '200 ml'], ['Protein powder', '1 scoop'], ['Chia seeds', '1 tbsp'], ['Banana', '1']],
    steps: ['Mix everything but the banana in a jar.', 'Refrigerate overnight.', 'Slice banana on top.'],
  },
  {
    external_id: 'r-bowl',
    name: 'Chicken rice bowl',
    servings: 4, minutes: 25, costCents: 420,
    kcal: 680, protein: 52, carbs: 70, fat: 16,
    tags: ['lunch', 'dinner', 'high-protein', 'prep-ahead'],
    favourite: true,
    ingredients: [['Chicken thigh', '600 g'], ['Jasmine rice', '300 g'], ['Broccoli', '400 g'], ['Soy sauce', '3 tbsp'], ['Garlic', '3 cloves'], ['Lime', '1']],
    steps: ['Cook the rice.', 'Sear chicken in batches, five minutes a side.', 'Steam the broccoli.', 'Toss with soy, garlic and lime.'],
  },
  {
    external_id: 'r-chili',
    name: 'Turkey chili',
    servings: 6, minutes: 45, costCents: 310,
    kcal: 540, protein: 44, carbs: 46, fat: 14,
    tags: ['dinner', 'batch', 'high-protein'],
    favourite: true,
    ingredients: [['Ground turkey', '900 g'], ['Kidney beans', '2 cans'], ['Crushed tomatoes', '800 g'], ['Onion', '1'], ['Bell pepper', '2'], ['Chili powder', '2 tbsp']],
    steps: ['Brown the turkey with the onion.', 'Add pepper, spices, tomatoes and beans.', 'Simmer thirty minutes.'],
  },
  {
    external_id: 'r-lentil',
    name: 'Lentil soup',
    servings: 6, minutes: 35, costCents: 160,
    kcal: 380, protein: 22, carbs: 58, fat: 6,
    tags: ['lunch', 'dinner', 'batch', 'veg'],
    ingredients: [['Red lentils', '400 g'], ['Carrot', '2'], ['Celery', '2 stalks'], ['Onion', '1'], ['Cumin', '1 tbsp'], ['Stock', '1.5 L']],
    steps: ['Soften the vegetables.', 'Add lentils, cumin and stock.', 'Simmer until the lentils collapse.'],
  },
  {
    // Imported, so the inbox has something in it. A parser reading someone
    // else's markup is proposing, not deciding.
    external_id: 'r-draft',
    name: 'Sheet pan salmon',
    servings: 2, minutes: 30, costCents: 680,
    kcal: 620, protein: 41, carbs: 42, fat: 28,
    tags: ['dinner'],
    status: 'draft',
    sourceUrl: 'https://example.com/sheet-pan-salmon',
    ingredients: [['Salmon fillet', '2 x 180 g'], ['Baby potatoes', '400 g'], ['Spinach', '200 g'], ['Lemon', '1']],
    steps: ['Roast potatoes twenty five minutes.', 'Add salmon, roast eight more.', 'Wilt spinach with lemon.'],
  },
]

/** A week that is mostly planned, with gaps, and the past two days ticked. */
const PLAN: [dayOffset: number, slot: string, recipe: string, eaten: boolean][] = [
  [0, 'breakfast', 'r-yogurt', true],
  [0, 'lunch', 'r-bowl', true],
  [0, 'dinner', 'r-chili', false],
  [1, 'breakfast', 'r-oats', false],
  [1, 'lunch', 'r-bowl', false],
  [1, 'dinner', 'r-lentil', false],
  [2, 'breakfast', 'r-yogurt', false],
  [2, 'dinner', 'r-chili', false],
  [3, 'breakfast', 'r-oats', false],
  [3, 'dinner', 'r-lentil', false],
  [4, 'breakfast', 'r-yogurt', false],
  [5, 'dinner', 'r-chili', false],
]

export async function seed(): Promise<number> {
  const ids = new Map<string, string>()

  for (const recipe of RECIPES) {
    const { rows } = await db().query<{ id: string }>(
      `insert into meals.recipe
         (name, source_url, servings, time_minutes, cost_cents, kcal, protein_g,
          carbs_g, fat_g, tags, favourite, status, source, external_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'demo', $13)
       on conflict (source, external_id) do update
         set name = excluded.name, status = excluded.status, kcal = excluded.kcal
       returning id`,
      [
        recipe.name,
        recipe.sourceUrl ?? '',
        recipe.servings,
        recipe.minutes,
        recipe.costCents,
        recipe.kcal,
        recipe.protein,
        recipe.carbs,
        recipe.fat,
        recipe.tags,
        recipe.favourite ?? false,
        recipe.status ?? 'ready',
        recipe.external_id,
      ],
    )
    ids.set(recipe.external_id, rows[0].id)

    // Ingredients and steps are an ordered list owned by the recipe, so they
    // are cleared and rewritten rather than diffed.
    await db().query(`delete from meals.ingredient where recipe_id = $1`, [rows[0].id])
    for (const [position, [item, quantity]] of recipe.ingredients.entries()) {
      await db().query(
        `insert into meals.ingredient (recipe_id, item, quantity, position)
         values ($1, $2, $3, $4)`,
        [rows[0].id, item, quantity, position],
      )
    }

    await db().query(`delete from meals.step where recipe_id = $1`, [rows[0].id])
    for (const [position, instruction] of recipe.steps.entries()) {
      await db().query(
        `insert into meals.step (recipe_id, instruction, position) values ($1, $2, $3)`,
        [rows[0].id, instruction, position],
      )
    }

    await register({
      module: 'meals',
      entityType: 'recipe',
      entityId: rows[0].id,
      title: recipe.name,
      text: recipe.tags.join(' '),
      eventType: (recipe.status ?? 'ready') === 'draft' ? 'meal_planned' : 'recipe_added',
    })
  }

  // Cleared and rewritten rather than upserted on external_id. The week is
  // relative to today, so plan-0-breakfast wants the date plan-1-breakfast
  // already holds the moment the date rolls over, and one thing per slot per
  // day is a constraint. Nothing registers a plan entry in core.entities, so
  // there is nothing to orphan by deleting these.
  await db().query(`delete from meals.plan_entry where source = 'demo'`)

  for (const [offset, slot, recipeKey, eaten] of PLAN) {
    await db().query(
      `insert into meals.plan_entry (recipe_id, on_date, slot, servings, eaten, source, external_id)
       values ($1, core.today() + $2::int, $3, 1, $4, 'demo', $5)`,
      [ids.get(recipeKey), offset, slot, eaten, `plan-${offset}-${slot}`],
    )
  }

  return RECIPES.length + PLAN.length
}
