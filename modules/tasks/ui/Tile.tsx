'use client'

import { useState, useTransition } from 'react'
import { useToast } from '@/components/pos'
import { cn } from '@/lib/utils'
import type { TasksDigest } from '../jobs/nightly-digest'
import { completeTask } from './actions'

// The Tasks dashboard tile. What is due, not how many are due: a count tells
// you there is work and nothing about what it is.
//
// The boxes tick, as the artboard's do. Completing here is the same write the
// board makes, so a task ticked on the dashboard earns the same XP.

export function TasksTile({ payload }: { payload: Record<string, unknown> }) {
  const d = payload as Partial<TasksDigest>
  const upcoming = d.upcoming ?? []
  const done = d.completedToday ?? 0
  const due = d.dueToday ?? 0
  const overdue = d.overdue ?? 0

  const [ticked, setTicked] = useState<string[]>([])
  const [pending, start] = useTransition()
  const toast = useToast()

  if (upcoming.length === 0 && due === 0 && overdue === 0) {
    return <p className="t-caption text-ink-3">Nothing due today.</p>
  }

  const tick = (id: string) => {
    setTicked((t) => [...t, id])
    start(async () => {
      const result = await completeTask(id)
      if (!result.ok) {
        setTicked((t) => t.filter((x) => x !== id))
        toast(result.error)
      }
    })
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="num text-[11px] text-ink-3">
        {done} of {due + done} done
        {overdue > 0 ? ` · ${overdue} overdue` : ''}
        {d.awaitingReview ? ` · ${d.awaitingReview} awaiting review` : ''}
      </p>

      <div className="mt-2 flex flex-col">
        {upcoming.slice(0, 4).map((t) => {
          const on = ticked.includes(t.id)
          return (
            <button
              key={t.id}
              type="button"
              disabled={on || pending}
              onClick={() => tick(t.id)}
              aria-label={`Complete ${t.title}`}
              className="grid grid-cols-[16px_1fr_auto] items-center gap-2.5 border-b border-rule py-2 text-left"
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-4 place-items-center border',
                  on ? 'border-brand bg-brand' : 'border-ink-3',
                )}
              >
                {on && <span className="size-1.5 bg-bg" />}
              </span>
              <span
                className={cn(
                  'truncate text-[14px]',
                  on ? 'text-ink-3 line-through' : 'text-ink',
                )}
              >
                {t.title}
              </span>
              <span className="num shrink-0 text-[10px] tracking-[0.06em] text-ink-3">
                {t.priority}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
