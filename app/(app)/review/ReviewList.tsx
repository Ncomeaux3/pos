'use client'

import { useState } from 'react'
import { Card } from '@/components/pos'
import type { DiffEntry, ProposalStatus } from '@/core/proposals'
import { cn } from '@/lib/utils'
import { ProposalPanel } from './ProposalPanel'

export type ReviewItem = {
  id: string
  module: string
  moduleLabel: string
  tool: string
  title: string
  agent: string
  reason: string
  confidence: number | null
  evidence: string | null
  affects: string | null
  guarded: boolean
  diff: (DiffEntry & { editable: boolean })[]
  status: ProposalStatus
  when: string
}

/** Grades the number the way the design does, and never colour alone. */
export function confidenceClass(c: number): string {
  if (c >= 0.8) return 'text-ok'
  if (c >= 0.7) return 'text-ink'
  return 'text-warn'
}

/** The state word: amber while it waits, green once it ran, quiet once it went. */
export const STATE_CLASS: Record<ProposalStatus, string> = {
  pending: 'text-warn',
  approved: 'text-ok',
  dismissed: 'text-ink-4',
  rejected: 'text-ink-4',
}

export function ReviewList({
  items,
  status,
  sel,
  nightly,
}: {
  items: ReviewItem[]
  status: ProposalStatus
  /** The `?sel=` id, so the selection survives a reload. */
  sel: string | null
  /** The nightly run on the owner's clock, "04:00". */
  nightly: string
}) {
  const [selectedId, setSelectedId] = useState<string | null>(sel)
  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null

  function select(id: string) {
    setSelectedId(id)
    // replaceState rather than a route push: nothing on the server changes
    // with the selection, so there is nothing to refetch.
    window.history.replaceState(null, '', `/review?tab=${status}&sel=${id}`)
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center p-10 text-center">
        <div>
          <p className="num text-[34px] font-light text-ink-3">
            {status === 'pending' ? 'inbox clear' : `nothing ${status}`}
          </p>
          <p className="mt-2.5 text-[13px] text-ink-3">
            {status === 'pending'
              ? `Next proposals arrive after the nightly run at ${nightly}.`
              : `Nothing has been ${status} yet.`}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-[18px] grid items-start gap-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const on = item.id === selected?.id
          const decided = item.status !== 'pending'
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => select(item.id)}
              className="group block w-full text-left"
            >
              <Card
                selected={on}
                className={cn(
                  'px-4 py-3.5 transition-colors duration-150',
                  !on && 'border-rule group-hover:border-rule-2',
                )}
              >
                <div className="flex items-baseline justify-between gap-2.5">
                  <span className="text-[11px] text-ink-3">
                    {item.agent} <span className="text-ink-4">·</span> {item.when}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {item.guarded && (
                      <span className="num text-[10px] uppercase tracking-[0.08em] text-warn">
                        GUARDED
                      </span>
                    )}
                    <span
                      className={cn(
                        'num text-[10px] uppercase tracking-[0.08em]',
                        STATE_CLASS[item.status],
                      )}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </span>
                </div>
                {/* Decided cards read quieter in ink, where the artboard fades
                  * the whole card to 75%. */}
                <p className={cn('mt-1.5 text-[14px] leading-[1.4]', decided ? 'text-ink-2' : 'text-ink')}>
                  {item.title}
                </p>
                <div className={cn('mt-2 flex flex-wrap gap-3 text-[11px]', decided ? 'text-ink-4' : 'text-ink-3')}>
                  <span>{item.moduleLabel}</span>
                  <span className="num">
                    {item.module}.{item.tool}
                  </span>
                  {item.confidence !== null && (
                    <span className={cn('num', !decided && confidenceClass(item.confidence))}>
                      {Math.round(item.confidence * 100)}% confident
                    </span>
                  )}
                </div>
              </Card>
            </button>
          )
        })}
      </div>

      {/* Keyed by id so the panel's edit state starts clean on every card. */}
      {selected && <ProposalPanel key={selected.id} item={selected} />}
    </div>
  )
}
