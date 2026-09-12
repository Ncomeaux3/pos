// A recipe out of a page's schema.org JSON-LD. No imports, no network: the
// caller hands in the page source, this reads it or says there is no recipe.
//
// JSON-LD only. The Python scrapers that read the other formats cannot run in
// the Vercel Node runtime, and a page with no Recipe block says so rather than
// producing a recipe nobody wrote.

export type ParsedRecipe = {
  name: string
  servings: number
  time_minutes: number
  /** Per serving, as schema.org NutritionInformation is defined. 0 when absent. */
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  ingredients: { item: string; quantity: string }[]
  steps: string[]
}

export class NoRecipe extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NoRecipe'
  }
}

type Node = Record<string, unknown>

const SCRIPT = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

/** Every JSON-LD node on the page, flattened through arrays and @graph. */
function nodes(html: string): Node[] {
  const out: Node[] = []
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') {
      out.push(value as Node)
      walk((value as Node)['@graph'])
    }
  }
  for (const match of html.matchAll(SCRIPT)) {
    try {
      walk(JSON.parse(match[1]))
    } catch {
      // A broken block is not the recipe.
    }
  }
  return out
}

const isRecipe = (node: Node) => {
  const type = node['@type']
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))
}

const text = (value: unknown) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** "540 calories", "44 g", 14.4: the leading number, rounded. 0 when there is none. */
const leading = (value: unknown) => {
  const n = parseFloat(String(value ?? '').trim())
  return Number.isFinite(n) ? Math.round(n) : 0
}

/** ISO 8601 duration to minutes: PT1H30M is 90. */
function minutes(value: unknown): number {
  const m = String(value ?? '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i)
  if (!m) return 0
  return Number(m[1] ?? 0) * 24 * 60 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

/** Strings, HowToSteps, and HowToSections holding either, in order. */
function steps(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(steps)
  if (value && typeof value === 'object') {
    const node = value as Node
    if (node.itemListElement) return steps(node.itemListElement)
    return node.text ? [text(node.text)] : []
  }
  const line = text(value)
  return line ? [line] : []
}

const UNITS =
  /^(x|g|kg|mg|ml|l|oz|lb|lbs|tsp|tbsp|cup|cups|can|cans|clove|cloves|slice|slices|scoop|scoops|stalk|stalks|pinch|tbsps?\.?|tsps?\.?)$/i
const COUNT = /^(\d+([./]\d+)?|[¼½¾⅓⅔⅛]|\d+[¼½¾⅓⅔⅛])$/

/**
 * "600 g chicken thigh" is a quantity and the thing you buy. The split is the
 * first word that is neither a number nor a unit; a line with no leading
 * number is all item, as written, which is how the grocery list wants it.
 */
export function splitIngredient(line: string): { item: string; quantity: string } {
  const words = text(line).split(' ')
  let i = 0
  while (i < words.length && (COUNT.test(words[i]) || (i > 0 && UNITS.test(words[i])))) i++
  if (i === 0 || i === words.length) return { item: words.join(' '), quantity: '' }
  return { quantity: words.slice(0, i).join(' '), item: words.slice(i).join(' ') }
}

export function parseRecipe(html: string): ParsedRecipe {
  const recipe = nodes(html).find(isRecipe)
  if (!recipe) throw new NoRecipe('That page has no schema.org Recipe in it.')

  const name = text(recipe.name)
  if (!name) throw new NoRecipe('That page has a Recipe with no name.')

  const nutrition = (recipe.nutrition ?? {}) as Node
  const total = minutes(recipe.totalTime)
  const ingredientLines = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : []
  const servings = leading(Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield)

  return {
    name,
    servings: servings > 0 ? servings : 1,
    time_minutes: total || minutes(recipe.prepTime) + minutes(recipe.cookTime),
    kcal: leading(nutrition.calories),
    protein_g: leading(nutrition.proteinContent),
    carbs_g: leading(nutrition.carbohydrateContent),
    fat_g: leading(nutrition.fatContent),
    ingredients: ingredientLines.map((l) => splitIngredient(String(l))).filter((i) => i.item),
    steps: steps(recipe.recipeInstructions),
  }
}
