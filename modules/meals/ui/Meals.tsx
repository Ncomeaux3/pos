'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useTransition } from 'react'
import {
  ActionButton,
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  MetricTile,
  PillGroup,
  Row,
  RowList,
  StatusChip,
  Switch,
  TabBar,
  useToast,
} from '@/components/pos'
import { cn } from '@/lib/utils'
import { groceryList, standing, total, type Macros } from '../macros'
import { scaleQuantity, servingFactor } from '../scale'
import { decideRecipe, markEaten, planMeal, type ActionResult } from './actions'

export type MealsData = {
  todayIso: string
  /** From the Fitness module through the registry, or null when it is absent. */
  kcalTarget: number | null
  recipes: {
    id: string
    name: string
    sourceUrl: string
    notes: string
    servings: number
    timeMinutes: number
    costCents: number
    macros: Macros
    tags: string[]
    favourite: boolean
    status: string
    ingredients: { item: string; quantity: string }[]
    steps: string[]
  }[]
  plan: {
    id: string
    recipeId: string | null
    label: string
    onDate: string
    slot: string
    servings: number
    eaten: boolean
    macros: Macros | null
  }[]
}

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "12 Sep", for the week the stepper is on. */
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function Meals({ data }: { data: MealsData }) {
  const router = useRouter()
  const params = useSearchParams()
  const tab = params.get('tab') ?? 'week'
  const openRecipe = data.recipes.find((r) => r.id === params.get('recipe')) ?? null
  const cooking = data.recipes.find((r) => r.id === params.get('cook')) ?? null

  const setParams = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
    const query = search.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }

  const [, start] = useTransition()
  const toast = useToast()

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  // Which week is on screen, as an offset from today. In the URL, so a week
  // you paged to survives a refresh and can be linked to.
  const offset = Number(params.get('week') ?? 0) || 0
  const weekStart = addDays(data.todayIso, offset * 7)
  const week = Array.from({ length: 7 }, (unused, i) => addDays(weekStart, i))
  const drafts = data.recipes.filter((r) => r.status === 'draft')
  const ready = data.recipes.filter((r) => r.status === 'ready')

  // The week on screen, not every row the server sent: paging to next week
  // and reading this week's calories would be worse than showing nothing.
  const inWeek = data.plan.filter((m) => m.onDate >= week[0] && m.onDate <= week[6])
  const planned = total(inWeek)
  const eaten = total(inWeek, true)
  const weekTarget = data.kcalTarget === null ? null : data.kcalTarget * 7

  const plannedRecipes = data.plan
    .map((p) => data.recipes.find((r) => r.id === p.recipeId))
    .filter((r): r is MealsData['recipes'][number] => r !== undefined)

  // Cooking takes the whole screen. Standing at a hob with wet hands is not the
  // moment for a tab bar, four metric tiles and a week grid.
  if (cooking) {
    return (
      <CookMode
        recipe={cooking}
        step={Math.max(0, Number(params.get('step') ?? 0))}
        servings={Number(params.get('servings') ?? cooking.servings) || cooking.servings}
        onChange={setParams}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* The artboard puts the week stepper on the right of the tab row, so
        * paging a week is where the week is rather than above it. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <TabBar
          label="Meals views"
          value={tab}
          onChange={(next) => setParams({ tab: next === 'week' ? null : next, recipe: null })}
          tabs={[
            { value: 'week', label: 'Week', count: data.plan.length },
            { value: 'recipes', label: 'Recipes', count: ready.length },
            { value: 'grocery', label: 'Grocery' },
            { value: 'inbox', label: 'Inbox', count: drafts.length },
          ]}
        />

        {tab === 'week' && (
          <div className="flex shrink-0 items-center gap-1.5 pb-2">
            <ActionButton
              aria-label="Previous week"
              onClick={() => setParams({ week: offset - 1 === 0 ? null : String(offset - 1) })}
            >
              ←
            </ActionButton>
            <span className="num min-w-[132px] text-center text-[11px] text-ink-3">
              {offset === 0 ? 'This week' : `${dayLabel(week[0])} to ${dayLabel(week[6])}`}
            </span>
            <ActionButton
              aria-label="Next week"
              onClick={() => setParams({ week: offset + 1 === 0 ? null : String(offset + 1) })}
            >
              →
            </ActionButton>
            {offset !== 0 && (
              <ActionButton onClick={() => setParams({ week: null })}>Today</ActionButton>
            )}
          </div>
        )}
      </div>

      {tab === 'week' && (
        <div className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))]">
            <MetricTile
              label="Planned"
              value={planned.kcal.toLocaleString()}
              delta={
                weekTarget === null
                  ? 'no target'
                  : `${standing(planned.kcal, weekTarget)} against ${weekTarget.toLocaleString()}`
              }
              deltaTone={
                weekTarget === null
                  ? 'quiet'
                  : standing(planned.kcal, weekTarget) === 'on'
                    ? 'ok'
                    : 'warn'
              }
            />
            <MetricTile label="Eaten" value={eaten.kcal.toLocaleString()} delta="ticked only" />
            <MetricTile label="Protein" value={`${planned.protein} g`} delta="planned" />
            <MetricTile
              label="Unknown"
              value={planned.unknown}
              delta={planned.unknown > 0 ? 'meals with no recipe' : 'every meal counted'}
              deltaTone={planned.unknown > 0 ? 'warn' : 'quiet'}
            />
          </div>

          {data.kcalTarget !== null && (
            <p className="t-caption text-ink-3">
              The target is an estimate: fifteen calories a pound of body weight, read from Fitness.
              It is a rule of thumb, not a prescription, and nothing here is a nutritional opinion.
            </p>
          )}

          <div className="overflow-x-auto">
            <div className="min-w-[640px] space-y-px">
              <div className="label grid grid-cols-[80px_repeat(4,1fr)] gap-px text-[10px] tracking-[0.12em] text-ink-3">
                <span className="px-2 py-1.5">Day</span>
                {SLOTS.map((s) => (
                  <span key={s} className="px-2 py-1.5">
                    {s}
                  </span>
                ))}
              </div>

              {week.map((iso) => {
                const dow = new Date(`${iso}T12:00:00`).getDay()
                return (
                  <div key={iso} className="grid grid-cols-[80px_repeat(4,1fr)] gap-px bg-rule">
                    <div
                      className={cn(
                        'space-y-0.5 px-2 py-2.5',
                        // Today, not the first row: on a week you paged to,
                        // no row is today.
                        iso === data.todayIso ? 'bg-brand-soft' : 'bg-bg-elev',
                      )}
                    >
                      <p className="label text-[10px] text-ink-3">{DAYS[(dow + 6) % 7]}</p>
                      <p className="num text-[11px] text-ink-2">{iso.slice(8)}</p>
                    </div>

                    {SLOTS.map((s) => {
                      const entry = data.plan.find((p) => p.onDate === iso && p.slot === s)
                      return (
                        <div key={s} className="min-h-16 space-y-1.5 bg-bg-elev px-2 py-2">
                          {entry ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  entry.recipeId && setParams({ tab: 'recipes', recipe: entry.recipeId })
                                }
                                className={cn(
                                  't-caption block text-left',
                                  entry.eaten ? 'text-ink-3' : 'text-ink',
                                )}
                              >
                                {entry.label || 'Something'}
                              </button>
                              <div className="flex items-center gap-1.5">
                                <Switch
                                  label={`Eaten, ${entry.label || s}`}
                                  checked={entry.eaten}
                                  onChange={(next) => run(() => markEaten(entry.id, next))}
                                />
                                {entry.macros && (
                                  <span className="label text-[10px] text-ink-3">
                                    {Math.round(entry.macros.kcal * entry.servings)}
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <p className="t-caption text-ink-4">empty</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'recipes' && (
        <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
          <div className="min-w-0 flex-[1_1_360px]">
            {ready.length === 0 ? (
              <EmptyState headline="No recipes">
                Add one by hand, or paste a URL and accept what the parser drafts.
              </EmptyState>
            ) : (
              <RowList>
                {ready.map((r) => (
                  <Row
                    key={r.id}
                    title={r.name}
                    meta={`${r.macros.kcal} kcal / ${r.macros.protein} g protein / ${r.timeMinutes} min / serves ${r.servings}`}
                    selected={openRecipe?.id === r.id}
                    onClick={() => setParams({ recipe: r.id })}
                    right={
                      <>
                        {r.favourite && <Chip tone="brand">favourite</Chip>}
                        {r.tags.slice(0, 2).map((t) => (
                          <Chip key={t} tone="quiet">
                            {t}
                          </Chip>
                        ))}
                      </>
                    }
                  />
                ))}
              </RowList>
            )}
          </div>

          {openRecipe && (
            <aside className="min-w-0 flex-[1_1_320px] space-y-4 md:max-w-[420px]">
              <Card className="space-y-3">
                <CardHead
                  label={`Serves ${openRecipe.servings}`}
                  meta={`${openRecipe.timeMinutes} min`}
                />
                <h2 className="t-title text-ink">{openRecipe.name}</h2>

                <div className="grid grid-cols-4 gap-2">
                  {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
                    <div key={k} className="space-y-1 rounded-md border border-rule-2 p-2">
                      <Eyebrow className="text-[10px]">{k}</Eyebrow>
                      <p className="num text-[13px] text-ink">
                        {openRecipe.macros[k]}
                        {k === 'kcal' ? '' : ' g'}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="t-caption text-ink-3">Per serving.</p>

                {openRecipe.ingredients.length > 0 && (
                  <div className="space-y-1.5">
                    <Eyebrow>Ingredients</Eyebrow>
                    {openRecipe.ingredients.map((i) => (
                      <p key={i.item} className="t-caption text-ink-2">
                        {i.quantity ? `${i.quantity} ` : ''}
                        {i.item}
                      </p>
                    ))}
                  </div>
                )}

                {openRecipe.steps.length > 0 && (
                  <div className="space-y-1.5">
                    <Eyebrow>Method</Eyebrow>
                    {openRecipe.steps.map((s, i) => (
                      <p key={s} className="t-caption text-ink-2">
                        {i + 1}. {s}
                      </p>
                    ))}
                  </div>
                )}

                {openRecipe.steps.length > 0 && (
                  <ActionButton
                    variant="brand"
                    onClick={() => setParams({ cook: openRecipe.id, step: '0' })}
                  >
                    Cook this
                  </ActionButton>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SLOTS.map((s) => (
                    <ActionButton
                      key={s}
                      onClick={() =>
                        run(
                          () => planMeal(data.todayIso, s, openRecipe.id),
                          `Planned for ${s} today`,
                        )
                      }
                    >
                      Today, {s}
                    </ActionButton>
                  ))}
                </div>
              </Card>
            </aside>
          )}
        </div>
      )}

      {tab === 'grocery' && (
        <Card className="space-y-3">
          <CardHead label="Grocery list" meta="from what is planned" />
          {plannedRecipes.length === 0 ? (
            <EmptyState headline="Nothing to buy" className="border-0">
              Plan a meal and its ingredients appear here.
            </EmptyState>
          ) : (
            <>
              <RowList>
                {groceryList(plannedRecipes).map((line) => (
                  <Row
                    key={line.item}
                    title={line.item}
                    meta={line.recipes.join(', ')}
                    right={
                      <span className="t-caption text-ink-2">{line.quantities.join(' + ')}</span>
                    }
                  />
                ))}
              </RowList>
              <p className="t-caption text-ink-3">
                Quantities are listed, not added up. Grams and cloves and splashes do not sum, and a
                list that pretended otherwise would have to invent a number or refuse the recipe.
              </p>
            </>
          )}
        </Card>
      )}

      {tab === 'inbox' &&
        (drafts.length === 0 ? (
          <EmptyState headline="Inbox zero">
            An imported recipe waits here. A parser reading someone else&apos;s markup is proposing,
            not deciding, so nothing joins the library until you accept it.
          </EmptyState>
        ) : (
          <RowList>
            {drafts.map((r) => (
              <Row
                key={r.id}
                title={r.name}
                meta={`${r.macros.kcal} kcal / ${r.ingredients.length} ingredients / ${r.sourceUrl || 'no source'}`}
                right={
                  <>
                    <StatusChip tone="warn">Draft</StatusChip>
                    <ActionButton
                      variant="brand"
                      onClick={() => run(() => decideRecipe(r.id, true), 'Added to the library')}
                    >
                      Accept
                    </ActionButton>
                    <ActionButton onClick={() => run(() => decideRecipe(r.id, false), 'Discarded')}>
                      Discard
                    </ActionButton>
                  </>
                }
              />
            ))}
          </RowList>
        ))}
    </div>
  )
}

/**
 * One step at a time, in type you can read from arm's length.
 *
 * The step and the servings live in the URL like every other piece of view
 * state in this app, so a reload in a kitchen does not lose your place and a
 * screenshot is honest about which step it was on.
 */
function CookMode({
  recipe,
  step,
  servings,
  onChange,
}: {
  recipe: MealsData['recipes'][number]
  step: number
  servings: number
  onChange: (next: Record<string, string | null>) => void
}) {
  // Keep the screen awake while cooking. A phone that sleeps between step four
  // and step five is the whole reason a paper recipe still beats a screen.
  // Best effort: it is refused in some browsers and absent in others, and
  // neither is a failure worth telling anyone about.
  useEffect(() => {
    let held: { release: () => Promise<void> } | null = null
    let cancelled = false

    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
    }).wakeLock

    wakeLock
      ?.request('screen')
      .then((lock) => {
        if (cancelled) void lock.release()
        else held = lock
      })
      .catch(() => {})

    return () => {
      cancelled = true
      void held?.release().catch(() => {})
    }
  }, [])

  const last = recipe.steps.length - 1
  const current = Math.min(step, last)
  const factor = servingFactor(recipe.servings, servings)
  const scaled = recipe.ingredients.map((i) => ({ ...i, ...scaleQuantity(i.quantity, factor) }))
  const unscalable = scaled.filter((i) => i.quantity !== '' && !i.scaled)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>
            Cooking / step {current + 1} of {recipe.steps.length}
          </Eyebrow>
          <h2 className="t-title text-ink">{recipe.name}</h2>
        </div>
        <ActionButton onClick={() => onChange({ cook: null, step: null, servings: null })}>
          Close
        </ActionButton>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>Servings</Eyebrow>
        <PillGroup
          label="Servings to cook"
          value={String(servings)}
          options={[1, 2, 4, 6, 8, 12].map((n) => ({ value: String(n), label: String(n) }))}
          onChange={(next) => onChange({ servings: next })}
        />
        <span className="t-caption text-ink-3">recipe makes {recipe.servings}</span>
      </div>

      <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
        <div className="min-w-0 flex-[2_1_420px] space-y-4">
          <p className="text-[26px] leading-[1.35] text-ink sm:text-[30px]">
            {recipe.steps[current]}
          </p>

          <div className="flex flex-wrap gap-2">
            <ActionButton
              disabled={current === 0}
              onClick={() => onChange({ step: String(current - 1) })}
            >
              Back
            </ActionButton>
            <ActionButton
              variant="brand"
              disabled={current === last}
              onClick={() => onChange({ step: String(current + 1) })}
            >
              Next step
            </ActionButton>
            {current === last && (
              <ActionButton onClick={() => onChange({ cook: null, step: null, servings: null })}>
                Done
              </ActionButton>
            )}
          </div>

          <div className="flex gap-1" aria-hidden>
            {recipe.steps.map((s, i) => (
              <span
                key={s}
                className={cn('h-0.5 flex-1', i <= current ? 'bg-brand' : 'bg-rule-2')}
              />
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-[1_1_240px] space-y-2.5">
          <Eyebrow>Ingredients</Eyebrow>
          {scaled.map((i) => (
            <p key={i.item} className="text-[15px] leading-snug text-ink-2">
              <span className={cn('num', i.scaled && factor !== 1 && 'text-brand')}>{i.text}</span>
              {i.text ? ' ' : ''}
              {i.item}
            </p>
          ))}

          {factor !== 1 && unscalable.length > 0 && (
            <p className="t-caption border-t border-rule pt-2 text-ink-3">
              {unscalable.map((i) => i.item).join(', ')}{' '}
              {unscalable.length === 1 ? 'is' : 'are'} written as words rather than a number, so{' '}
              {unscalable.length === 1 ? 'it is' : 'they are'} unchanged. Half a splash is not a
              measurement.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
