import { z } from 'zod'
import { db } from '@/core/db'
import { register } from '@/core/entities'
import { defineModule, defineTool } from '@/core/module-contract'
import { nightlyDigest } from './jobs/nightly-digest'
import MealsPage from './ui/MealsPage'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const slot = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])

export default defineModule({
  id: 'meals',
  nav: { label: 'Meals', icon: 'utensils', order: 70 },
  pages: { '': MealsPage },

  tools: {
    get_digest: defineTool({
      description: 'What is planned, what was eaten, and how the week reads against its targets.',
      input: z.object({}),
      run: () => nightlyDigest(),
    }),

    write_recipe: defineTool({
      description:
        'Create or update a recipe. An imported one lands as a draft until the owner accepts it.',
      input: z.object({
        id: z.uuid().optional(),
        name: z.string().min(1).max(200).optional(),
        source_url: z.string().max(2000).optional(),
        notes: z.string().max(5000).optional(),
        servings: z.number().int().min(1).max(100).optional(),
        time_minutes: z.number().int().min(0).max(10_000).optional(),
        cost_cents: z.number().int().min(0).optional(),
        // Per serving, whole numbers. A tenth of a gram of fat is a precision
        // no recipe has.
        kcal: z.number().int().min(0).max(10_000).optional(),
        protein_g: z.number().int().min(0).max(1000).optional(),
        carbs_g: z.number().int().min(0).max(1000).optional(),
        fat_g: z.number().int().min(0).max(1000).optional(),
        tags: z.array(z.string().max(40)).max(20).optional(),
        favourite: z.boolean().optional(),
        ingredients: z
          .array(z.object({ item: z.string().min(1).max(200), quantity: z.string().max(80) }))
          .max(100)
          .optional(),
        steps: z.array(z.string().min(1).max(2000)).max(60).optional(),
      }),
      run: async (input, ctx) => {
        const { id, ingredients, steps, ...columns } = input

        if (id) {
          const fields = Object.entries(columns)
          if (fields.length > 0) {
            // Every key is a literal from the zod schema above, a closed set.
            const set = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ')
            await db().query(`update meals.recipe set ${set} where id = $1`, [
              id,
              ...fields.map(([, value]) => value),
            ])
          }
          await writeParts(id, ingredients, steps)
          return { id }
        }

        if (!input.name) throw new Error('A recipe needs a name')

        // A parser reading someone's markup is proposing, not deciding. Same
        // shape as the Second Brain draft and the Travel booking inbox.
        const status = ctx.source === 'agent' ? 'draft' : 'ready'

        const { rows } = await db().query<{ id: string }>(
          `insert into meals.recipe
             (name, source_url, notes, servings, time_minutes, cost_cents,
              kcal, protein_g, carbs_g, fat_g, tags, favourite, status, source)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           returning id`,
          [
            input.name,
            input.source_url ?? '',
            input.notes ?? '',
            input.servings ?? 1,
            input.time_minutes ?? 0,
            input.cost_cents ?? 0,
            input.kcal ?? 0,
            input.protein_g ?? 0,
            input.carbs_g ?? 0,
            input.fat_g ?? 0,
            input.tags ?? [],
            input.favourite ?? false,
            status,
            ctx.source === 'agent' ? 'agent' : 'manual',
          ],
        )

        await writeParts(rows[0].id, ingredients, steps)

        await register({
          module: 'meals',
          entityType: 'recipe',
          entityId: rows[0].id,
          title: input.name,
          text: (input.tags ?? []).join(' '),
          // A draft is a proposal about a recipe, not a recipe, and earns
          // nothing until it is accepted.
          eventType: status === 'draft' ? 'meal_planned' : 'recipe_added',
        })

        return { id: rows[0].id, status }
      },
    }),

    accept_recipe: defineTool({
      description: 'Accept an imported recipe into the library, or discard it.',
      input: z.object({ id: z.uuid(), accept: z.boolean().default(true) }),
      run: async ({ id, accept }) => {
        if (!accept) {
          await db().query(`delete from meals.recipe where id = $1 and status = 'draft'`, [id])
          return { id, status: 'discarded' }
        }

        const { rows } = await db().query<{ name: string }>(
          `update meals.recipe set status = 'ready' where id = $1 returning name`,
          [id],
        )
        if (rows.length === 0) throw new Error(`No recipe ${id}`)

        await register({
          module: 'meals',
          entityType: 'recipe',
          entityId: id,
          title: rows[0].name,
          eventType: 'recipe_added',
        })

        return { id, status: 'ready' }
      },
    }),

    plan: defineTool({
      description: 'Put something in a slot on a day, or clear the slot by passing no recipe.',
      input: z.object({
        on_date: date,
        slot,
        recipe_id: z.uuid().nullable().optional(),
        label: z.string().max(200).optional(),
        servings: z.number().min(0.25).max(20).default(1),
      }),
      run: async (input) => {
        if (!input.recipe_id && !input.label) {
          await db().query(`delete from meals.plan_entry where on_date = $1 and slot = $2`, [
            input.on_date,
            input.slot,
          ])
          return { cleared: true }
        }

        const { rows } = await db().query<{ id: string }>(
          `insert into meals.plan_entry (recipe_id, label, on_date, slot, servings)
           values ($1, $2, $3, $4, $5)
           on conflict (on_date, slot) do update
             set recipe_id = excluded.recipe_id, label = excluded.label,
                 servings = excluded.servings
           returning id`,
          [
            input.recipe_id ?? null,
            input.label ?? '',
            input.on_date,
            input.slot,
            input.servings,
          ],
        )
        return { id: rows[0].id }
      },
    }),

    mark_eaten: defineTool({
      description: 'Tick a planned meal as eaten. A plan is not a log until this happens.',
      input: z.object({ id: z.uuid(), eaten: z.boolean().default(true) }),
      run: async ({ id, eaten }) => {
        const { rows } = await db().query<{ recipe_id: string | null; label: string }>(
          `update meals.plan_entry set eaten = $2 where id = $1
           returning recipe_id, label`,
          [id, eaten],
        )
        if (rows.length === 0) throw new Error(`No planned meal ${id}`)

        // Cooking is the work. Planning it is not, which is why only this
        // emits an event.
        if (eaten && rows[0].recipe_id) {
          await register({
            module: 'meals',
            entityType: 'recipe',
            entityId: rows[0].recipe_id,
            title: rows[0].label || 'A meal',
            eventType: 'meal_cooked',
          })
        }

        return { id, eaten }
      },
    }),
  },

  /**
   * Nothing is guarded.
   *
   * An imported recipe already lands as a draft, which is this module's own
   * version of the gate, and planning a meal is reversible by planning a
   * different one. Nothing here spends money or changes a commitment.
   */
  guarded: [],
  requires: [],

  metrics: {
    meals_cooked_this_week: {
      label: 'Meals cooked this week',
      unit: 'meals',
      get: async () => {
        const { rows } = await db().query<{ n: string }>(
          `select count(*)::text as n from meals.plan_entry
            where eaten and on_date >= core.today() - 7`,
        )
        return Number(rows[0].n)
      },
    },
  },

  jobs: [{ name: 'nightly_digest', run: nightlyDigest }],
  entityTypes: ['recipe'],
})

/**
 * Ingredients and steps are cleared and rewritten rather than diffed.
 *
 * They are an ordered list owned entirely by the recipe, nothing outside points
 * at a row, and a diff would be more code for the same result.
 */
async function writeParts(
  recipeId: string,
  ingredients?: { item: string; quantity: string }[],
  steps?: string[],
): Promise<void> {
  if (ingredients) {
    await db().query(`delete from meals.ingredient where recipe_id = $1`, [recipeId])
    for (const [position, ingredient] of ingredients.entries()) {
      await db().query(
        `insert into meals.ingredient (recipe_id, item, quantity, position)
         values ($1, $2, $3, $4)`,
        [recipeId, ingredient.item, ingredient.quantity, position],
      )
    }
  }

  if (steps) {
    await db().query(`delete from meals.step where recipe_id = $1`, [recipeId])
    for (const [position, instruction] of steps.entries()) {
      await db().query(
        `insert into meals.step (recipe_id, instruction, position) values ($1, $2, $3)`,
        [recipeId, instruction, position],
      )
    }
  }
}
