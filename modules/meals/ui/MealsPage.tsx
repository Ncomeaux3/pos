import { PageHeader } from '@/components/pos'
import { readMetric } from '@/core/metrics'
import { ownerToday } from '@/core/today'
import { listPlan, listRecipes, recipeDetail } from '../data'
import { Meals, type MealsData } from './Meals'

export default async function MealsPage() {
  const todayIso = await ownerToday()

  const [recipes, plan, bodyWeight] = await Promise.all([
    listRecipes(),
    listPlan(todayIso, 7),
    // A calorie target is a Fitness concern. Read through the registry so
    // there is one source of truth, and absent rather than invented when that
    // module is not installed.
    readMetric('fitness.body_weight'),
  ])

  const detail = await recipeDetail(recipes.map((r) => r.id))

  const data: MealsData = {
    todayIso,
    // Fifteen calories a pound, the crude maintenance rule of thumb. Labelled
    // an estimate wherever it is shown, because that is what it is.
    kcalTarget: bodyWeight === null || bodyWeight <= 0 ? null : Math.round(bodyWeight * 15),
    recipes: recipes.map((r) => ({
      id: r.id,
      name: r.name,
      sourceUrl: r.source_url,
      notes: r.notes,
      servings: r.servings,
      timeMinutes: r.time_minutes,
      costCents: r.cost_cents,
      macros: { kcal: r.kcal, protein: r.protein_g, carbs: r.carbs_g, fat: r.fat_g },
      tags: r.tags,
      favourite: r.favourite,
      status: r.status,
      ingredients: detail.get(r.id)?.ingredients ?? [],
      steps: detail.get(r.id)?.steps ?? [],
    })),
    plan: plan.map((p) => ({
      id: p.id,
      recipeId: p.recipe_id,
      label: p.recipe_name ?? p.label,
      onDate: p.on_date,
      slot: p.slot,
      servings: Number(p.servings),
      eaten: p.eaten,
      macros:
        p.kcal === null
          ? null
          : {
              kcal: p.kcal,
              protein: p.protein_g ?? 0,
              carbs: p.carbs_g ?? 0,
              fat: p.fat_g ?? 0,
            },
    })),
  }

  const drafts = data.recipes.filter((r) => r.status === 'draft').length

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`Meals / ${data.plan.length} planned / ${drafts} to review`}
        dot={drafts > 0 ? 'warn' : 'brand'}
        title="Meals"
        lede="A week of slots, what each one comes to, and the list to shop from. A plan is not a log: a meal counts only once you tick it."
        actions={
          <span className="num text-[11px] text-ink-3">
            {data.recipes.filter((r) => r.status === 'ready').length} recipes
          </span>
        }
      />
      <Meals data={data} />
    </div>
  )
}
