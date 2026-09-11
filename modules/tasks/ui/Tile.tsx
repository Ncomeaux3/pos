'use client'

import { useState, useTransition } from 'react'
import { useToast } from '@/components/pos'
import { cn } from '@/lib/utils'
import type { TasksDigest } from '../jobs/nightly-digest'
import { completeTask } from './actions'

// The Tasks dashboard tile, as POS Dashboard.dc.html draws it: four rows of
// a 14px box, the title and one mark on the right. What is due, not how many
// are due; the count is the head's "0 of 4 done".
//
// The boxes tick, as the artboard's do. Completing here is the same write the
// board makes, so a task ticked on the dashboard earns the same XP.

export function TasksTile({ payload }: { payload: Record<string, unknown> }) {
  const d = payload as Partial<TasksDigest>
  const upcoming = d.upcoming ?? []
  const due = d.dueToday ?? 0
  const overdue = d.overdue ?? 0
  // The digest is written nightly, so its rows are dated against that day;
  // the earliest row is today unless nothing was due.
  const today = upcoming[0]?.dueOn ?? ''

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
    <div className="mt-2 flex flex-col">
      {upcoming.slice(0, 4).map((t) => {
        const on = ticked.includes(t.id)
        const tag = tagFor(t, today)
        return (
          <button
            key={t.id}
            type="button"
            disabled={on || pending}
            onClick={() => tick(t.id)}
            aria-label={`Complete ${t.title}`}
            className="grid grid-cols-[16px_1fr_auto] items-center gap-2.5 border-b border-rule py-[9px] text-left"
          >
            <span
              aria-hidden
              className={cn(
                'grid size-3.5 place-items-center border',
                on ? 'border-brand bg-brand' : 'border-ink-3',
              )}
            >
              {on && <span className="size-1.5 bg-bg" />}
            </span>
            <span className={cn('truncate text-[13px]', on ? 'text-ink-3 line-through' : 'text-ink')}>
              {t.title}
            </span>
            <span
              className={cn(
                'label shrink-0 text-[10px] tracking-[0.06em]',
                tag.accent ? 'text-brand' : 'text-ink-3',
              )}
            >
              {tag.text}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The one mark on the right of a row, as the artboard picks it: an agent's
 * task says so, a task due later says when, a task with a project says which
 * at what priority, an estimate says how long, and the rest say the priority.
 */
function tagFor(
  t: { priority: string; dueOn: string; project?: string | null; estimateMinutes?: number | null; status?: string },
  today: string,
): { text: string; accent: boolean } {
  if (t.status === 'review') return { text: 'Agent · review', accent: true }
  if (t.dueOn > today) {
    const d = new Date(`${t.dueOn}T12:00:00`)
    return { text: `${MONTHS[d.getMonth()]} ${d.getDate()}`, accent: false }
  }
  if (t.project) return { text: `${t.priority} · ${t.project}`, accent: false }
  if (t.estimateMinutes) return { text: `${t.estimateMinutes} min`, accent: false }
  return { text: t.priority, accent: false }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
