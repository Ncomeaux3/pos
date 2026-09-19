'use client'

import { Check } from 'lucide-react'
import { useState, useTransition } from 'react'
import { RowList, useToast } from '@/components/pos'
import { cn } from '@/lib/utils'
import type { TasksDigest } from '../jobs/nightly-digest'
import { hoursLabel } from '../shape'
import { completeTask } from './actions'

// Today's work on the Today page: the next tasks from the digest as rows, a
// check circle in front of each, the project under the title and one mark on
// the right. What is due, not how many are due; the count is the section's
// heading.
//
// The circles tick. Completing here is the same write the board makes, so a
// task ticked on Today earns the same XP.

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
    return <p className="t-caption px-1 text-ink-3">Nothing due today.</p>
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
    <RowList>
      {upcoming.slice(0, 5).map((t) => {
        const on = ticked.includes(t.id)
        const tag = tagFor(t, today)
        return (
          <div
            key={t.id}
            className="relative flex items-start gap-3 px-4 py-2.5 before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-rule first:before:hidden"
          >
            <button
              type="button"
              disabled={on || pending}
              onClick={() => tick(t.id)}
              aria-label={`Complete ${t.title}`}
              className={cn(
                'mt-px grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150',
                on ? 'border-action bg-action text-action-fg' : 'border-rule-2 hover:border-action',
              )}
            >
              {on && <Check size={12} strokeWidth={3} aria-hidden />}
            </button>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block truncate text-[14.5px] font-medium leading-[1.35]',
                  on ? 'text-ink-3 line-through' : 'text-ink',
                )}
              >
                {t.title}
              </span>
              <span className="t-caption mt-0.5 block truncate text-ink-3">
                {t.project ?? 'No project'}
              </span>
            </span>
            <span
              className={cn(
                'num shrink-0 pt-0.5 text-[12.5px]',
                tag.accent ? 'font-medium text-action' : 'text-ink-3',
              )}
            >
              {tag.text}
            </span>
          </div>
        )
      })}
    </RowList>
  )
}

/**
 * The one mark on the right of a row: an agent's task says so, a task due
 * later says when, a task with an estimate says how long, and the rest say
 * the priority.
 */
function tagFor(
  t: { priority: string; dueOn: string; estimateMinutes?: number | null; status?: string },
  today: string,
): { text: string; accent: boolean } {
  if (t.status === 'review') return { text: 'Review', accent: true }
  if (t.dueOn > today) {
    const d = new Date(`${t.dueOn}T12:00:00`)
    return { text: `${MONTHS[d.getMonth()]} ${d.getDate()}`, accent: false }
  }
  if (t.estimateMinutes) return { text: hoursLabel(t.estimateMinutes), accent: false }
  return { text: t.priority, accent: false }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
