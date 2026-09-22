'use client'

import { useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  EmptyState,
  Eyebrow,
  Overlay,
  StatusChip,
  fieldClass,
} from '@/components/pos'
import { cn } from '@/lib/utils'
import { BUILTIN_RULES, MIN_PATTERN_LENGTH, normalise } from '../categorise'
import { balance } from '../money'
import type { ActionResult } from './actions'

// v1.2 phase 5c. Rules were written by `learn_rule`, read by the nightly job,
// and shown nowhere: a wrong one (apple icloud to Dining, from an e2e run) was
// unreachable. This is the screen for them, and the screen for what they could
// not file.

export type RuleItem = {
  id: string
  pattern: string
  categoryId: string
  categoryName: string
  classifiedBy: string
  confidence: number | null
}

export type UnfiledItem = {
  pattern: string
  label: string
  count: number
  totalCents: number
}

// The last column is a fixed width and not `auto`: the header, a rules row and
// a built-in row put different things in it (nothing, a Delete button, a chip),
// each row is its own grid, and on `auto` every one of them sized its columns
// differently, so the "Files as" label sat 54px off the select it names.
const headRow = 'grid grid-cols-[minmax(0,1fr)_140px_80px] items-center gap-x-3'

/**
 * The drawer's selects.
 *
 * fieldClass with no size overrides, so the text is 16px below md and Safari
 * does not zoom on focus, plus an explicit h-11: the contract asks for 44px
 * controls on the phone and fieldClass's padding alone lands at 42. The cursor
 * is here because app/globals.css gives `pointer` to buttons only, and this
 * drawer is a screen made almost entirely of selects.
 */
const selectClass = `${fieldClass} h-11 cursor-pointer md:h-auto`

/**
 * Whether a rule can be written on this pattern at all.
 *
 * The same test `write_rule` applies. A descriptor with nothing learnable in it
 * (all digits, or too short to be safe) is still listed, because it is money
 * and hiding it would be the bug this list fixes, but offering a control that
 * can only fail is not honest. Filing one of these is a job for the row itself
 * on the Transactions tab, which files the row and not the merchant.
 */
function canFile(pattern: string): boolean {
  const normalised = normalise(pattern)
  return normalised.length >= MIN_PATTERN_LENGTH && /[a-z]/.test(normalised)
}

export function RulesDrawer({
  rules,
  unfiled,
  categories,
  onClose,
  onSave,
  onDelete,
  toast,
}: {
  rules: RuleItem[]
  unfiled: UnfiledItem[]
  categories: { id: string; name: string }[]
  onClose: () => void
  onSave: (
    pattern: string,
    categoryId: string,
    id?: string,
  ) => Promise<ActionResult & { moved?: number }>
  onDelete: (id: string) => Promise<ActionResult & { moved?: number }>
  toast: (message: string) => void
}) {
  const [pending, start] = useTransition()
  // Written the moment a select changes rather than held until a Done, unlike
  // the limits drawer: each change re-files history, so batching them would
  // make one confirmation stand for several different sets of moved rows.
  const [busy, setBusy] = useState<string | null>(null)

  const run = (key: string, action: () => Promise<ActionResult & { moved?: number }>, what: string) => {
    setBusy(key)
    start(async () => {
      const result = await action()
      setBusy(null)
      if (!result.ok) {
        toast(result.error)
        return
      }
      const moved = result.moved ?? 0
      // How many rows moved, every time. A back-file changes past budgets and
      // saying nothing about it is the surprise this drawer exists to avoid.
      toast(
        moved === 0
          ? `${what}, no past rows matched`
          : `${what}, ${moved} transaction${moved === 1 ? '' : 's'} re-filed`,
      )
    })
  }

  return (
    <Overlay
      open
      onClose={onClose}
      eyebrow="Finance / Transactions / Rules"
      title="Rules"
      lede="A rule files every transaction whose description contains its pattern. Changing one re-files the history it matches straight away, so past budgets move with it. A row you filed by hand is never touched."
      footer={
        <>
          <span className="label text-[11px] text-ink-3">
            {rules.length} of yours · {BUILTIN_RULES.length} built in · {unfiled.length} unfiled
          </span>
          <ActionButton variant="solid" onClick={onClose} disabled={pending}>
            Done <span aria-hidden="true">&rarr;</span>
          </ActionButton>
        </>
      }
    >
      <Eyebrow>Your rules</Eyebrow>
      {rules.length === 0 ? (
        <EmptyState headline="No rules yet" className="mt-2 border-0">
          File a merchant below, or press Always on a transaction you have just filed.
        </EmptyState>
      ) : (
        <>
          <div className={cn(headRow, 'mt-2 border-b border-rule-2 py-[7px]')}>
            <span className="label text-[11px] text-ink-3">Pattern</span>
            <span className="label text-[11px] text-ink-3">Files as</span>
            <span className="label text-[11px] text-ink-3">&nbsp;</span>
          </div>
          {rules.map((r) => (
            <div key={r.id} className={cn(headRow, 'border-b border-rule py-2.5 text-[13px]')}>
              <span className="min-w-0">
                <span className="block truncate text-ink">{r.pattern}</span>
                <span className="mt-0.5 block text-[11px] text-ink-3">
                  <StatusChip tone={r.classifiedBy === 'model' ? 'brand' : 'quiet'}>
                    {r.classifiedBy === 'model'
                      ? r.confidence === null
                        ? 'Model'
                        : `Model ${r.confidence.toFixed(2)}`
                      : 'Yours'}
                  </StatusChip>
                </span>
              </span>
              <select
                value={r.categoryId}
                aria-label={`Category for ${r.pattern}`}
                disabled={pending}
                onChange={(e) =>
                  run(r.id, () => onSave(r.pattern, e.target.value, r.id), `Rule ${r.pattern} moved`)
                }
                className={selectClass}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ActionButton
                variant="outline"
                size="sm"
                className="justify-self-end"
                disabled={pending}
                onClick={() => run(r.id, () => onDelete(r.id), `Rule ${r.pattern} deleted`)}
              >
                {busy === r.id ? '…' : 'Delete'}
              </ActionButton>
            </div>
          ))}
        </>
      )}

      <Card className="mt-3.5 flex flex-col gap-2.5">
        <Eyebrow>Unfiled merchants</Eyebrow>
        {unfiled.length === 0 ? (
          <p className="text-[12px] leading-[1.5] text-ink-3">
            Every transaction has a category. Nothing to file.
          </p>
        ) : (
          <>
            <p className="text-[12px] leading-[1.5] text-ink-3">
              What no rule matched, biggest first. Filing one writes a rule and moves every row it
              matches at once.
            </p>
            {unfiled.map((u) => (
              <div
                key={u.pattern}
                className={cn(headRow, 'border-b border-rule py-2 text-[13px] last:border-0')}
              >
                <span className="min-w-0">
                  <span className="block truncate text-ink">{u.label}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-3">
                    {/* balance(), not money(): money() is absolute by design and a
                      * group where refunds outran charges is a real negative. */}
                    {u.pattern} · {u.count} {u.count === 1 ? 'row' : 'rows'} · {balance(u.totalCents)}
                  </span>
                </span>
                {canFile(u.pattern) ? (
                  <select
                    // Nothing is chosen yet, so the control names the act rather
                    // than pre-selecting a category the owner did not pick.
                    value=""
                    aria-label={`File ${u.label}`}
                    disabled={pending}
                    onChange={(e) =>
                      run(u.pattern, () => onSave(u.pattern, e.target.value), `${u.pattern} filed`)
                    }
                    className={selectClass}
                  >
                    <option value="" disabled>
                      File as…
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[12px] text-ink-3">No pattern to learn</span>
                )}
                <span className="label justify-self-end text-[11px] text-ink-3">
                  {busy === u.pattern ? '…' : ''}
                </span>
              </div>
            ))}
          </>
        )}
      </Card>

      <Card className="mt-3.5 flex flex-col gap-2.5">
        <Eyebrow>Built in</Eyebrow>
        <p className="text-[12px] leading-[1.5] text-ink-3">
          These ship with the app and are not editable. A rule you write beats one of these, so
          overriding one is writing your own with the same pattern.
        </p>
        <div className={cn(headRow, 'border-b border-rule-2 py-[7px]')}>
          <span className="label text-[11px] text-ink-3">Pattern</span>
          <span className="label text-[11px] text-ink-3">Files as</span>
          <span className="label text-[11px] text-ink-3">&nbsp;</span>
        </div>
        {BUILTIN_RULES.map((r) => (
          <div
            key={`${r.pattern}-${r.category}`}
            className={cn(headRow, 'border-b border-rule py-2 text-[13px] last:border-0')}
          >
            <span className="min-w-0 truncate text-ink-2">{r.pattern}</span>
            <span className="truncate text-[13px] text-ink-3">{r.category}</span>
            <StatusChip tone="quiet" className="justify-self-end">Built in</StatusChip>
          </div>
        ))}
      </Card>
    </Overlay>
  )
}
