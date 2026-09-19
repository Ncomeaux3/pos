'use client'

import { useState, type ReactNode } from 'react'
import { Eyebrow, Overlay, SkillPicker } from '@/components/pos'
import { cn } from '@/lib/utils'
import { markEaten, planMeal, setFavourite, type ActionResult } from './actions'
import {
  cap,
  costOf,
  DraftActions,
  GHOST,
  GHOST_ACCENT,
  MINI,
  money,
  SLOTS,
  type Entry,
  type Recipe,
  type Slot,
} from './Meals'

type Run = (action: () => Promise<ActionResult>, ok?: string) => void

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/**
 * Pick a recipe for an empty slot: favourites, then what is tagged for the
 * slot, then the rest, each by protein. `pick` is "YYYY-MM-DD:slot".
 */
export function PickDrawer({
  pick,
  recipes,
  onClose,
  run,
}: {
  pick: string | null
  recipes: Recipe[]
  onClose: () => void
  run: Run
}) {
  if (!pick) return null
  const [onDate, slot] = pick.split(':') as [string, Slot]
  const rank = (r: Recipe) => (r.favourite ? 0 : r.tags.includes(slot) ? 1 : 2)
  const list = [...recipes].sort((a, b) => rank(a) - rank(b) || b.macros.protein - a.macros.protein)

  return (
    <Overlay open onClose={onClose} eyebrow="Meals / Pick">
      <div className="space-y-[18px]">
        <div>
          <h2 className="text-[20px] font-normal tracking-[-0.03em] text-ink">Pick a recipe</h2>
          <p className="mt-1.5 text-[12px] text-ink-3">
            {DOW[new Date(`${onDate}T12:00:00`).getDay()]} · {cap(slot)} · favorites first, then by protein
          </p>
        </div>
        <div className="flex flex-col">
          {list.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                run(() => planMeal(onDate, slot, r.id))
                onClose()
              }}
              className="grid grid-cols-[1fr_auto] gap-2.5 border-b border-rule py-2.5 text-left text-ink transition-colors hover:text-brand"
            >
              <span className="min-w-0 text-[13px]">
                {r.favourite ? '★' : '·'} {r.name}
              </span>
              <span className="num whitespace-nowrap text-[10px] text-ink-3">
                {r.macros.kcal} kcal · {r.macros.protein}p · {r.timeMinutes}m
              </span>
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  )
}

/**
 * The shopping list for the week on screen, grouped by recipe with the
 * quantities as written. Ticks are for the aisle and do not outlive the page.
 */
export function GroceryDrawer({
  open,
  entries,
  recipes,
  weekCost,
  onClose,
}: {
  open: boolean
  entries: Entry[]
  recipes: Recipe[]
  weekCost: number
  onClose: () => void
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  if (!open) return null

  const groups = recipes
    .map((r) => ({ recipe: r, n: entries.filter((e) => e.recipeId === r.id).length }))
    .filter((g) => g.n > 0)
  const items = groups.reduce((a, g) => a + g.recipe.ingredients.length, 0)
  const done = Object.values(checked).filter(Boolean).length

  return (
    <Overlay open onClose={onClose} eyebrow="Meals / Grocery list">
      <div className="space-y-[18px]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-normal tracking-[-0.03em] text-ink">Grocery list</h2>
            <p className="mt-1.5 text-[12px] text-ink-3">
              {items} items · {done} checked · est. {money(weekCost)}
            </p>
          </div>
          <button type="button" className={MINI} onClick={() => setChecked({})}>
            Uncheck all
          </button>
        </div>

        {groups.length === 0 && (
          <div className="border border-dashed border-rule-2 p-[30px] text-center rounded-[18px]">
            <p className="num text-[22px] font-light text-ink">Nothing planned</p>
            <p className="mt-1.5 text-[12px] text-ink-3">Plan a meal and its ingredients appear here.</p>
          </div>
        )}

        {groups.map(({ recipe, n }) => (
          <div key={recipe.id}>
            <div className="flex items-baseline justify-between border-b border-rule-2 pb-1.5">
              <span className="text-[13px] text-ink">{recipe.name}</span>
              <span className="num text-[10px] text-ink-3">
                {n}× · serves {recipe.servings}
              </span>
            </div>
            <div className="flex flex-col">
              {recipe.ingredients.map((ing, i) => {
                const key = `${recipe.id}:${i}`
                const on = !!checked[key]
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setChecked((c) => ({ ...c, [key]: !c[key] }))}
                    className="flex items-center justify-between gap-2.5 border-b border-rule py-[7px] text-left"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden className={cn('size-3 shrink-0 border rounded-full', on ? 'border-brand bg-brand' : 'border-ink-3')} />
                      <span className={cn('text-[13px]', on ? 'text-ink-3 line-through' : 'text-ink')}>{ing.item}</span>
                    </span>
                    <span className="num shrink-0 text-[10px] text-ink-3">
                      {ing.quantity}
                      {n > 1 && recipe.servings === 1 && ing.quantity ? ` × ${n}` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <p className="text-[11px] text-ink-4">
          Built from the planned meals this week. Quantities are as written and are not added up.
        </p>
      </div>
    </Overlay>
  )
}

/**
 * A recipe, and what to do with it: in slot mode (opened from a planned cell)
 * the footer ticks, swaps or removes it; from the library it can be planned
 * into the next open slot; a draft is accepted or discarded.
 */
export function RecipeDrawer({
  recipe,
  entry,
  fromDate,
  plan,
  skills,
  run,
  setParams,
}: {
  recipe: Recipe | undefined
  entry: Entry | undefined
  /** The first day "Next open" looks at: today this week, Monday on a week paged to. */
  fromDate: string
  plan: Entry[]
  skills: [string, string][]
  run: Run
  setParams: (next: Record<string, string | null>) => void
}) {
  if (!recipe) return null
  const onClose = () => setParams({ recipe: null, slot: null })
  const draft = recipe.status === 'draft'
  const slots = SLOTS.filter((s) => recipe.tags.includes(s) || (s === 'lunch' && recipe.tags.includes('dinner')))
  const addTo = slots.length ? slots : [...SLOTS]

  const nextOpen = (slot: Slot) => {
    for (let i = 0; i < 7; i++) {
      const iso = new Date(Date.parse(`${fromDate}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10)
      if (!plan.some((e) => e.onDate === iso && e.slot === slot)) {
        run(() => planMeal(iso, slot, recipe.id), `Planned for ${slot}`)
        setParams({ recipe: null, slot: null, tab: null })
        return
      }
    }
    run(async () => ({ ok: false, error: `Every ${slot} this week is planned` }))
  }

  const source = recipe.sourceUrl.replace(/^https?:\/\/(www\.)?/, '')

  return (
    <Overlay
      open
      onClose={onClose}
      eyebrow={`Meals / ${recipe.name}`}
      footer={
        draft ? (
          <DraftActions id={recipe.id} run={run} />
        ) : entry ? (
          <>
            <div className="flex gap-2">
              <button type="button" className={GHOST_ACCENT} onClick={() => run(() => markEaten(entry.id, !entry.eaten))}>
                {entry.eaten ? 'Eaten ✓ · undo' : 'Mark eaten'}
              </button>
              <button type="button" className={GHOST} onClick={() => setParams({ recipe: null, slot: null, pick: `${entry.onDate}:${entry.slot}` })}>
                Swap
              </button>
              <button type="button" className={GHOST} onClick={() => setParams({ cook: recipe.id, step: '0', recipe: null, slot: null })}>
                Cook
              </button>
            </div>
            <button
              type="button"
              className="text-[13px] text-ink-3 transition-colors hover:text-bad"
              onClick={() => {
                run(() => planMeal(entry.onDate, entry.slot as Slot, null))
                onClose()
              }}
            >
              Remove from plan
            </button>
          </>
        ) : (
          <>
            <button type="button" className={GHOST} onClick={() => setParams({ cook: recipe.id, step: '0', recipe: null, slot: null })}>
              Cook
            </button>
            <span className="text-[11px] text-ink-4">Use &quot;Add to&quot; above to plan it this week.</span>
          </>
        )
      }
    >
      <div className="space-y-[18px]">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[22px] font-normal leading-[1.2] tracking-[-0.03em] text-ink">{recipe.name}</h2>
            <button
              type="button"
              onClick={() => run(() => setFavourite(recipe.id, !recipe.favourite))}
              className={cn('num shrink-0 border border-rule-2 px-2 py-1 text-[12px] transition-colors hover:border-ink rounded-full', recipe.favourite ? 'text-brand' : 'text-ink-3')}
            >
              {recipe.favourite ? '★ Favorite' : '☆ Add favorite'}
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {draft && <span className="num border border-warn/60 px-1.5 py-0.5 text-[10px] text-warn rounded-full">draft</span>}
            {recipe.tags.map((t) => (
              <span key={t} className="num border border-rule px-1.5 py-0.5 text-[10px] text-ink-3 rounded-full">
                {t}
              </span>
            ))}
          </div>
          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener"
              className="mt-2 block truncate text-[11px] text-ink-3 hover:text-ink"
            >
              {source} ↗
            </a>
          )}
        </div>

        <div className="grid grid-cols-4 gap-px border border-rule bg-rule rounded-[18px]">
          <Cell label="kcal">{recipe.macros.kcal}</Cell>
          <Cell label="Protein" className="text-brand">
            {recipe.macros.protein}g
          </Cell>
          <Cell label="Carbs · fat">
            {recipe.macros.carbs}
            <Unit>g</Unit> · {recipe.macros.fat}
            <Unit>g</Unit>
          </Cell>
          <Cell label="Time · cost">
            {recipe.timeMinutes}
            <Unit>m</Unit> · {money(costOf(recipe, 1))}
          </Cell>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="text-[12px] text-ink-3">Serves {recipe.servings} · per-serving values</span>
          {!draft && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Eyebrow>Add to</Eyebrow>
              {addTo.map((s) => (
                <button key={s} type="button" className={MINI} onClick={() => nextOpen(s)}>
                  Next open {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Eyebrow>Ingredients</Eyebrow>
          <div className="mt-1.5 flex flex-col">
            {recipe.ingredients.map((ing, i) => (
              <div key={`${ing.item}-${i}`} className="flex justify-between gap-2.5 border-b border-rule py-[7px] text-[13px] text-ink">
                <span>{ing.item}</span>
                <span className="num text-[11px] text-ink-3">{ing.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Eyebrow>Steps</Eyebrow>
          <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-[13px] leading-[1.55] text-ink-2">
            {recipe.steps.map((s, i) => (
              <li key={`${i}-${s}`}>{s}</li>
            ))}
          </ol>
        </div>

        <div>
          <Eyebrow>Linked skills</Eyebrow>
          {recipe.entityRef ? (
            <SkillPicker entityRef={recipe.entityRef} links={recipe.skills} skills={skills} className="mt-2" />
          ) : (
            <p className="mt-2 text-[12px] text-ink-4">Nothing matched yet.</p>
          )}
        </div>

        {recipe.notes && (
          <div>
            <Eyebrow>Notes</Eyebrow>
            <p className="mt-1.5 text-[13px] text-ink">{recipe.notes}</p>
          </div>
        )}
      </div>
    </Overlay>
  )
}

function Cell({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className="bg-bg px-3 py-2.5">
      <Eyebrow>{label}</Eyebrow>
      <div className={cn('num mt-1.5 text-[18px] font-light leading-none text-ink', className)}>{children}</div>
    </div>
  )
}

function Unit({ children }: { children: string }) {
  return <span className="text-[11px] text-ink-3">{children}</span>
}
