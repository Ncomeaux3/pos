'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Fragment, useEffect, useState, useTransition, type ReactNode } from 'react'
import {
  ActionButton,
  BandSearch,
  Eyebrow,
  PillGroup,
  SearchButton,
  StatusDot,
  TabBar,
  useToast,
} from '@/components/pos'
import { cn } from '@/lib/utils'
import { standing, total, type Macros } from '../macros'
import { scaleQuantity, servingFactor } from '../scale'
import { decideRecipe, fillWeek, importRecipe, logAdhoc, markEaten, setFavourite, type ActionResult } from './actions'
import { GroceryDrawer, PickDrawer, RecipeDrawer } from './Drawers'

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

export type Recipe = MealsData['recipes'][number]
export type Entry = MealsData['plan'][number]
export type Slot = (typeof SLOTS)[number]

export const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// The artboard's filter order: how a recipe cooks, then when it is eaten.
const TAG_ORDER = ['quick', 'high-protein', 'batch', 'prep-ahead', 'veg', 'breakfast', 'lunch', 'dinner', 'snack']

export const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const dateOf = (iso: string) => new Date(`${iso}T12:00:00`)
/** "Sep 7" */
const shortDate = (iso: string) => `${MONTHS[dateOf(iso).getMonth()]} ${dateOf(iso).getDate()}`
export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** The whole recipe's cost is stored; a serving of it is what a slot costs. */
export const costOf = (recipe: Recipe | undefined, servings: number) =>
  recipe ? Math.round((recipe.costCents / recipe.servings) * servings) : 0

// The artboard's three button sizes: the ghost, its accent twin, and the mini.
export const GHOST =
  'shrink-0 whitespace-nowrap border border-rule-2 px-3 py-2 text-[12px] text-ink-3 transition-colors duration-150 hover:border-ink hover:text-ink'
export const GHOST_ACCENT =
  'shrink-0 whitespace-nowrap border border-brand px-3 py-2 text-[12px] text-ink transition-colors duration-150 hover:bg-brand hover:text-bg'
export const MINI =
  'shrink-0 whitespace-nowrap border border-rule-2 px-[9px] py-1 text-[11px] text-ink-3 transition-colors duration-150 hover:border-ink hover:text-ink'

export function Meals({ data }: { data: MealsData }) {
  const router = useRouter()
  const params = useSearchParams()
  const tab = params.get('tab') === 'recipes' ? 'recipes' : 'week'

  const setParams = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
    const query = search.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }

  const [pending, start] = useTransition()
  const toast = useToast()

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  const byId = (id: string | null) => data.recipes.find((r) => r.id === id)

  // Which week is on screen, as an offset from this one. In the URL, so a
  // week you paged to survives a refresh and can be linked to.
  const offset = Number(params.get('week') ?? 0) || 0
  const todayIdx = (dateOf(data.todayIso).getDay() + 6) % 7
  const monday = addDays(data.todayIso, -todayIdx + offset * 7)
  const week = Array.from({ length: 7 }, (unused, i) => addDays(monday, i))
  const thisWeek = offset === 0

  const ready = data.recipes.filter((r) => r.status === 'ready')
  const drafts = data.recipes.filter((r) => r.status === 'draft')
  const inWeek = data.plan.filter((m) => m.onDate >= week[0] && m.onDate <= week[6])
  const entryAt = (iso: string, slot: string) => inWeek.find((p) => p.onDate === iso && p.slot === slot)

  const dayTotal = (iso: string) => {
    const entries = inWeek.filter((p) => p.onDate === iso)
    const t = total(entries)
    return {
      ...t,
      n: entries.length,
      cost: entries.reduce((sum, e) => sum + costOf(byId(e.recipeId), e.servings), 0),
      time: entries.reduce((sum, e) => sum + (byId(e.recipeId)?.timeMinutes ?? 0), 0),
    }
  }
  const days = week.map(dayTotal)
  const plannedDays = days.filter((d) => d.n > 0)
  const avg = (key: 'kcal' | 'protein') =>
    plannedDays.length ? Math.round(plannedDays.reduce((a, d) => a + d[key], 0) / plannedDays.length) : 0
  const weekCost = days.reduce((a, d) => a + d.cost, 0)
  const cooked = inWeek.filter((e) => e.eaten && e.recipeId).length
  const target = data.kcalTarget
  const kcalStanding = target === null ? 'none' : standing(avg('kcal'), target)

  // Today: the slots, what was eaten, and the one target the app has.
  const todayEntries = SLOTS.map((s) => entryAt(data.todayIso, s))
  const eatenToday = total(todayEntries.filter((e): e is Entry => e !== undefined), true)
  const firstEmptyToday = SLOTS.find((s, i) => !todayEntries[i])
  const [adhoc, setAdhoc] = useState('')
  const [ingestUrl, setIngestUrl] = useState('')
  const [ingesting, setIngesting] = useState(false)

  const cooking = byId(params.get('cook'))
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

  const tag = params.get('tag') ?? 'All'
  const tags = [...new Set(ready.flatMap((r) => r.tags))].sort(
    (a, b) => (TAG_ORDER.indexOf(a) + 1 || 99) - (TAG_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b),
  )
  const shown = [...drafts, ...ready].filter(
    (r) => tag === 'All' || (tag === 'favorites' ? r.favourite : r.tags.includes(tag)),
  )
  const usage = (id: string) => inWeek.filter((e) => e.recipeId === id).length
  const groceryCount = new Set(inWeek.map((e) => e.recipeId).filter(Boolean)).size

  const weekLabel =
    (offset === 0 ? 'This week · ' : offset === -1 ? 'Last week · ' : offset === 1 ? 'Next week · ' : '') +
    `${shortDate(week[0])} – ${shortDate(week[6])}`

  return (
    <>
      <header className="-mx-[18px] -mt-[18px] flex min-h-14 flex-wrap items-center justify-between gap-4 border-b border-rule px-[18px] py-2 md:-mx-7 md:-mt-7 md:h-14 md:flex-nowrap md:px-7 md:py-0">
        <span className="eyebrow shrink-0 whitespace-nowrap text-ink-3">
          Meals <span className="text-ink-4">/</span> {tab === 'week' ? 'Week' : 'Recipes'}
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
          <SearchButton className="md:hidden" />
          <BandSearch className="hidden min-w-[160px] max-w-[320px] flex-1 md:flex" placeholder="Search meals" />
          <span className="eyebrow hidden shrink-0 whitespace-nowrap text-ink-3 md:inline-flex">
            <StatusDot tone={kcalStanding === 'none' ? 'brand' : kcalStanding === 'on' ? 'ok' : 'warn'} />
            {inWeek.length} / 28 planned · {avg('protein')}g protein avg
          </span>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1 basis-[420px]">
          <h1 className="text-[28px] font-normal leading-none tracking-[-0.03em] text-ink">Meals</h1>
          <p className="mt-2 hidden text-[13px] text-ink-3 md:block">
            Plan the week, log what you ate, and see calories against the Fitness estimate. Cooking a
            planned meal earns XP on the skills the recipe is linked to.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setParams({ drawer: 'grocery' })} className={GHOST}>
            Grocery list <span className="num ml-1.5 text-[10px] text-ink-4">{groceryCount}</span>
          </button>
          <ActionButton
            variant="solid"
            size="xl"
            disabled={pending}
            className="h-11 gap-2 px-3.5 text-[13px] md:h-[51px] md:px-[22px] md:text-[15px]"
            onClick={() => run(() => fillWeek(thisWeek ? data.todayIso : week[0], week[6]), 'Week filled from the library')}
          >
            {pending ? 'Suggesting…' : 'Suggest week'} <span aria-hidden="true">&rarr;</span>
          </ActionButton>
        </div>
      </div>

      <div className="mt-[18px] flex flex-wrap items-end justify-between gap-2 border-b border-rule">
        <TabBar
          label="Meals views"
          value={tab}
          className="border-b-0"
          tabClassName="px-3.5"
          onChange={(next) => setParams({ tab: next === 'week' ? null : next, recipe: null, slot: null, tag: null })}
          tabs={[
            { value: 'week', label: 'Week', count: inWeek.length },
            { value: 'recipes', label: 'Recipes', count: ready.length },
          ]}
        />
        {tab === 'week' && (
          <div className="flex items-center gap-1 pb-2">
            <button type="button" aria-label="Previous week" className={MINI} onClick={() => setParams({ week: offset - 1 === 0 ? null : String(offset - 1) })}>
              ←
            </button>
            <span className="num min-w-[150px] text-center text-[11px] text-ink-3">{weekLabel}</span>
            <button type="button" aria-label="Next week" className={MINI} onClick={() => setParams({ week: offset + 1 === 0 ? null : String(offset + 1) })}>
              →
            </button>
          </div>
        )}
      </div>

      {tab === 'week' && (
        <div className="mt-[18px] space-y-[18px]">
          {thisWeek && (
            <section className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-3 border border-brand px-4 py-3">
              <Eyebrow className="text-brand">
                Today · {DAYS[todayIdx].toUpperCase()} {shortDate(data.todayIso).toUpperCase()}
              </Eyebrow>
              <div className="flex flex-wrap items-center gap-2">
                {SLOTS.map((s, i) => {
                  const entry = todayEntries[i]
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={!entry}
                      onClick={() => entry && run(() => markEaten(entry.id, !entry.eaten))}
                      className={cn(
                        'inline-flex items-center gap-2 border px-2.5 py-[5px] text-[12px] transition-colors duration-150',
                        entry?.eaten ? 'border-brand' : 'border-rule-2',
                        entry ? 'text-ink hover:border-ink' : 'text-ink-4',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'size-3 shrink-0 border text-center text-[9px] leading-[10px] text-bg',
                          entry?.eaten ? 'border-brand bg-brand' : 'border-ink-3',
                        )}
                      >
                        {entry?.eaten ? '✓' : ''}
                      </span>
                      {cap(s)} · {entry ? entry.label || 'Something' : 'nothing planned'}
                    </button>
                  )
                })}
                {firstEmptyToday && (
                  <form
                    className="flex min-w-0 max-w-full gap-1"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const label = adhoc.trim()
                      if (!label) return
                      run(() => logAdhoc(data.todayIso, firstEmptyToday, label), `Logged as ${firstEmptyToday}`)
                      setAdhoc('')
                    }}
                  >
                    <input
                      value={adhoc}
                      onChange={(e) => setAdhoc(e.target.value)}
                      placeholder="Ate something else? e.g. burrito"
                      className="w-[280px] min-w-0 max-w-full border border-rule-2 bg-bg px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-brand"
                    />
                    <button type="submit" className={MINI}>
                      Log
                    </button>
                  </form>
                )}
              </div>
              <Eyebrow>Eaten so far</Eyebrow>
              <div className="flex flex-wrap items-center gap-[18px]">
                {(
                  [
                    ['Calories', eatenToday.kcal, target, ''],
                    ['Protein', eatenToday.protein, null, 'g'],
                    ['Carbs', eatenToday.carbs, null, 'g'],
                    ['Fat', eatenToday.fat, null, 'g'],
                  ] as const
                ).map(([label, value, t, unit]) => (
                  <div key={label} className="min-w-[150px]">
                    <div className="flex justify-between gap-2 whitespace-nowrap text-[11px] text-ink-3">
                      <span>{label}</span>
                      <span className="num text-ink-2">
                        {value.toLocaleString('en-US')}
                        {unit}
                        {t !== null && <span className="text-ink-4"> / {t.toLocaleString('en-US')}</span>}
                      </span>
                    </div>
                    {t !== null && (
                      <div className="mt-1 h-[3px] bg-rule-2">
                        <div
                          className={cn('h-full', value > t * 1.1 ? 'bg-warn' : 'bg-brand')}
                          style={{ width: `${Math.min(100, (value / t) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {eatenToday.unknown > 0 && (
                  <span className="text-[11px] text-ink-3">{eatenToday.unknown} without a recipe, not counted</span>
                )}
              </div>
            </section>
          )}

          <div className="overflow-x-auto">
            <div className="grid min-w-[920px] grid-cols-[72px_repeat(7,minmax(120px,1fr))] gap-px border border-rule bg-rule">
              <div className="bg-bg px-2 py-2.5" />
              {week.map((iso, i) => {
                const isToday = iso === data.todayIso
                return (
                  <div key={iso} className={cn('flex flex-col border-t-2 bg-bg px-2 py-2.5', isToday ? 'border-brand' : 'border-transparent')}>
                    <span className={cn('num text-[9px] uppercase tracking-[0.08em]', isToday ? 'text-brand' : 'text-ink-2')}>{DAYS[i].toUpperCase()}</span>
                    <span className={cn('mt-0.5 text-[14px]', isToday ? 'text-brand' : 'text-ink-2')}>{dateOf(iso).getDate()}</span>
                  </div>
                )
              })}

              {SLOTS.map((slot) => (
                <Fragment key={slot}>
                  <div className="flex items-center bg-bg px-2 py-2.5">
                    <Eyebrow>{slot.toUpperCase()}</Eyebrow>
                  </div>
                  {week.map((iso) => {
                    const entry = entryAt(iso, slot)
                    const recipe = entry ? byId(entry.recipeId) : undefined
                    const isToday = iso === data.todayIso
                    const past = iso < data.todayIso
                    return (
                      <div key={iso} className={cn('min-h-[76px] p-1.5', isToday ? 'bg-brand-soft' : 'bg-bg')}>
                        {entry ? (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setParams({ recipe: entry.recipeId, slot: entry.id, tab: null })}
                            onKeyDown={(e) => e.key === 'Enter' && setParams({ recipe: entry.recipeId, slot: entry.id, tab: null })}
                            className={cn(
                              'h-full cursor-grab border bg-bg-elev px-[9px] py-2 transition-colors duration-150 hover:border-rule-2',
                              entry.eaten ? 'border-brand' : 'border-rule',
                              past && !entry.eaten && 'opacity-55',
                            )}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <span className="min-w-0 text-[12.5px] leading-[1.3] tracking-[-0.01em] [overflow-wrap:anywhere]">
                                {entry.label || 'Something'}
                              </span>
                              <button
                                type="button"
                                title="Mark eaten"
                                aria-label="Mark eaten"
                                aria-pressed={entry.eaten}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  run(() => markEaten(entry.id, !entry.eaten))
                                }}
                                className={cn(
                                  'size-4 shrink-0 border text-[10px] leading-[14px] text-bg transition-colors hover:border-ink',
                                  entry.eaten ? 'border-brand bg-brand' : 'border-rule-2',
                                )}
                              >
                                {entry.eaten ? '✓' : ''}
                              </button>
                            </div>
                            <div className="num mt-1.5 flex flex-wrap gap-1.5 text-[9.5px] text-ink-3">
                              <span>{entry.macros ? Math.round(entry.macros.kcal * entry.servings) : 0} kcal</span>
                              <span className="text-brand">{entry.macros ? Math.round(entry.macros.protein * entry.servings) : 0}p</span>
                              <span>{recipe?.timeMinutes ?? 0}m</span>
                              <span>{money(costOf(recipe, entry.servings))}</span>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            aria-label="Plan a meal"
                            onClick={() => setParams({ pick: `${iso}:${slot}` })}
                            className="h-full min-h-16 w-full border border-dashed border-rule text-[16px] text-ink-4 transition-colors duration-150 hover:border-brand hover:text-brand"
                          >
                            +
                          </button>
                        )}
                      </div>
                    )
                  })}
                </Fragment>
              ))}

              <div className="flex items-center bg-bg px-2 py-2.5">
                <Eyebrow>TOTAL</Eyebrow>
              </div>
              {days.map((d, i) => (
                <div key={week[i]} className="flex flex-col gap-[5px] bg-bg px-2 py-2.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-ink-3">kcal</span>
                    <span className={cn('num', d.n === 0 ? 'text-ink-4' : target !== null && d.kcal > target * 1.1 ? 'text-warn' : 'text-ink-2')}>{d.kcal.toLocaleString('en-US')}</span>
                  </div>
                  {target !== null && (
                    <div className="h-0.5 bg-rule-2">
                      <div className={cn('h-full', d.kcal > target * 1.1 ? 'bg-warn' : 'bg-brand')} style={{ width: `${Math.min(100, (d.kcal / target) * 100)}%` }} />
                    </div>
                  )}
                  <div className="flex justify-between text-[10px]">
                    <span className="text-ink-3">protein</span>
                    <span className={cn('num', d.n === 0 ? 'text-ink-4' : 'text-ink-2')}>{d.protein}g</span>
                  </div>
                  <span className="num mt-0.5 text-[9.5px] text-ink-4">
                    {money(d.cost)} · {d.time}m
                  </span>
                </div>
              ))}
            </div>
          </div>

          <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-px border border-rule bg-rule">
            <WeekCell
              label="Week · kcal / day"
              value={avg('kcal').toLocaleString('en-US')}
              suffix={target === null ? undefined : ` / ${target.toLocaleString('en-US')}`}
              note={
                target === null ? (
                  'No estimate: Fitness has no body weight'
                ) : (
                  <>
                    {kcalStanding === 'over' ? 'Over the estimate on average' : kcalStanding === 'under' ? 'Under the estimate · plan more' : 'Within 10% of the estimate'}
                    {' · '}
                    <Link href="/fitness" className="hover:text-ink">15 kcal a pound, from Fitness</Link>
                  </>
                )
              }
            />
            <WeekCell label="Week · protein / day" value={`${avg('protein')}g`} note="per planned day" />
            <WeekCell label="Week · cost" value={money(weekCost)} note={`${money(Math.round(weekCost / 7))} per day`} />
            <WeekCell label="Cooked" value={String(cooked)} suffix=" meals" note={`${inWeek.length} planned`} />
          </section>
        </div>
      )}

      {tab === 'recipes' && (
        <div className="mt-[18px] space-y-3.5">
          <div className="flex flex-wrap items-center gap-2">
            {['All', 'favorites', ...tags].map((t) => {
              const on = tag === t
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setParams({ tag: t === 'All' ? null : t })}
                  className={cn(
                    'label rounded-full border px-[9px] py-[3px] text-[11px] uppercase tracking-[0.08em] transition-colors duration-150',
                    on ? 'border-ink bg-ink text-bg' : 'border-rule-2 text-ink-3 hover:text-ink',
                  )}
                >
                  {t === 'favorites' ? '★ favorites' : t}
                </button>
              )
            })}
            <form
              className="ml-auto flex min-w-0 max-w-full gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                const url = ingestUrl.trim()
                if (!url || ingesting) return
                setIngesting(true)
                start(async () => {
                  const result = await importRecipe(url)
                  setIngesting(false)
                  if (!result.ok) toast(result.error)
                  else {
                    setIngestUrl('')
                    setParams({ recipe: result.id, slot: null })
                  }
                })
              }}
            >
              <input
                value={ingestUrl}
                onChange={(e) => setIngestUrl(e.target.value)}
                placeholder="Paste a recipe URL to ingest"
                className="w-[260px] min-w-0 max-w-full border border-rule-2 bg-bg-elev px-2.5 py-[7px] text-[12px] text-ink outline-none focus:border-brand"
              />
              <button
                type="submit"
                disabled={ingesting}
                className={cn(MINI, 'border-brand text-ink hover:bg-brand hover:text-bg disabled:text-ink-4')}
              >
                {ingesting ? 'Ingesting…' : 'Ingest'}
              </button>
            </form>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-3">
            {shown.map((r) => (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => setParams({ recipe: r.id, slot: null })}
                onKeyDown={(e) => e.key === 'Enter' && setParams({ recipe: r.id, slot: null })}
                className="min-w-0 cursor-pointer border border-rule bg-bg-elev px-4 py-3.5 text-left transition-colors duration-200 hover:border-rule-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-[14.5px] leading-[1.3] tracking-[-0.01em]">{r.name}</span>
                  <button
                    type="button"
                    title="Favorite"
                    aria-label={r.favourite ? 'Remove favorite' : 'Add favorite'}
                    onClick={(e) => {
                      e.stopPropagation()
                      run(() => setFavourite(r.id, !r.favourite))
                    }}
                    className={cn('num shrink-0 text-[12px]', r.favourite ? 'text-brand' : 'text-ink-4')}
                  >
                    {r.favourite ? '★' : '☆'}
                  </button>
                </div>
                <div className="num mt-2 flex flex-wrap gap-2 text-[10px] text-ink-3">
                  <span>{r.macros.kcal} kcal</span>
                  <span className="text-brand">{r.macros.protein}g protein</span>
                  <span>{r.timeMinutes} min</span>
                  <span>{money(costOf(r, 1))}/serving</span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {r.status === 'draft' && <span className="num border border-warn/60 px-[5px] py-px text-[9.5px] text-warn">draft</span>}
                  {r.tags.map((t) => (
                    <span key={t} className="num border border-rule px-[5px] py-px text-[9.5px] text-ink-3">
                      {t}
                    </span>
                  ))}
                </div>
                {r.status === 'draft' ? (
                  <DraftActions id={r.id} run={run} className="mt-2.5" />
                ) : (
                  <div className="mt-2.5 text-[10.5px] text-ink-4">
                    {usage(r.id) ? `${usage(r.id)}× this week` : 'not planned this week'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <PickDrawer
        pick={params.get('pick')}
        recipes={ready}
        onClose={() => setParams({ pick: null })}
        run={run}
      />
      <GroceryDrawer
        open={params.get('drawer') === 'grocery'}
        entries={inWeek}
        recipes={data.recipes}
        weekCost={weekCost}
        onClose={() => setParams({ drawer: null })}
      />
      <RecipeDrawer
        recipe={byId(params.get('recipe'))}
        entry={inWeek.find((e) => e.id === params.get('slot')) ?? data.plan.find((e) => e.id === params.get('slot'))}
        fromDate={thisWeek ? data.todayIso : week[0]}
        plan={data.plan}
        run={run}
        setParams={setParams}
      />
    </>
  )
}

function WeekCell({ label, value, suffix, note }: { label: string; value: string; suffix?: string; note: ReactNode }) {
  return (
    <div className="bg-bg px-[18px] py-3.5">
      <Eyebrow>{label}</Eyebrow>
      <div className="num mt-2 text-[22px] font-light leading-none text-ink">
        {value}
        {suffix && <span className="text-[11px] text-ink-3">{suffix}</span>}
      </div>
      <div className="mt-1 text-[11px] text-ink-3">{note}</div>
    </div>
  )
}

/** Accept or discard an imported recipe: on its card and in its drawer. */
export function DraftActions({
  id,
  run,
  className,
}: {
  id: string
  run: (action: () => Promise<ActionResult>, ok?: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex gap-1.5', className)} onClick={(e) => e.stopPropagation()}>
      <button type="button" className={cn(MINI, 'border-brand text-ink')} onClick={() => run(() => decideRecipe(id, true), 'Added to the library')}>
        Accept
      </button>
      <button type="button" className={MINI} onClick={() => run(() => decideRecipe(id, false), 'Discarded')}>
        Discard
      </button>
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
