'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Task } from '../shape'
import { mini } from './Board'

// The month grid. Hand-rolled: a month is six rows of seven cells and a date
// arithmetic problem, which is less code than any calendar library's config.

const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function Calendar({
  tasks,
  today,
  onOpen,
}: {
  tasks: Task[]
  today: Date
  onOpen: (task: Task) => void
}) {
  const [offset, setOffset] = useState(0)

  const shown = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const year = shown.getFullYear()
  const month = shown.getMonth()

  const leading = shown.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (unused, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  /** Days from today for a date in the shown month. */
  const offsetOf = (day: number) =>
    Math.round(
      (new Date(year, month, day).getTime() -
        new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
        86_400_000,
    )

  const inMonth = tasks.filter((t) => {
    if (t.dueInDays === null) return false
    const d = new Date(today)
    d.setDate(d.getDate() + t.dueInDays)
    return d.getFullYear() === year && d.getMonth() === month
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button type="button" aria-label="Previous month" onClick={() => setOffset(offset - 1)} className={mini}>
            ‹
          </button>
          <span className="min-w-[150px] text-center text-[18px] tracking-[-0.02em] text-ink">
            {MONTHS[month]} {year}
          </span>
          <button type="button" aria-label="Next month" onClick={() => setOffset(offset + 1)} className={mini}>
            ›
          </button>
          <button type="button" onClick={() => setOffset(0)} className={cn(mini, offset === 0 && 'border-ink text-ink')}>
            Today
          </button>
        </div>
        <span className="num whitespace-nowrap text-[11px] text-ink-3">
          {inMonth.length} open · {inMonth.filter((t) => t.remindMinutes !== null).length} with
          reminders
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px] border border-rule">
          <div className="grid grid-cols-7 gap-px bg-rule">
            {DOWS.map((d) => (
              <span key={d} className="num bg-bg-elev px-2.5 py-2 text-[10px] tracking-[0.08em] text-ink-3">
                {d.toUpperCase()}
              </span>
            ))}
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`pad-${i}`} className="min-h-24 bg-bg-deep" />
              }

              const days = offsetOf(day)
              const isToday = days === 0
              const past = days < 0
              const items = tasks
                .filter((t) => t.dueInDays === days)
                .sort((a, b) => (a.dueAt ?? '99:99').localeCompare(b.dueAt ?? '99:99'))

              return (
                <div
                  key={day}
                  className={cn(
                    'min-w-0 min-h-24 px-2.5 py-2',
                    isToday ? 'bg-brand-soft' : 'bg-bg',
                    // A past day is de-emphasised by ink, never by opacity: the
                    // design's rule is that a greyed row stays readable.
                    past && 'bg-bg-deep',
                  )}
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      className={cn(
                        'num text-[11px]',
                        isToday ? 'text-ok' : past ? 'text-ink-4' : 'text-ink-3',
                      )}
                    >
                      {String(day).padStart(2, '0')}
                    </span>
                    {items.length > 3 && (
                      <span className="num text-[9px] text-ink-4">+{items.length - 3}</span>
                    )}
                  </div>

                  <div className="mt-1.5 flex min-w-0 flex-col gap-[3px]">
                    {items.slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onOpen(t)}
                        title={t.title}
                        className={cn(
                          'block w-full truncate border bg-bg px-1.5 py-[3px] text-left text-[11px] leading-[1.3] text-ink hover:border-ink',
                          t.priority === 'P1'
                            ? 'border-bad'
                            : t.status === 'review'
                              ? 'border-warn'
                              : 'border-rule-2',
                        )}
                      >
                        {t.dueAt && <span className="num mr-[5px] text-ink-3">{t.dueAt}</span>}
                        {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
