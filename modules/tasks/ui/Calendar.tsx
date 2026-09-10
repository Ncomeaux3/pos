'use client'

import { useState } from 'react'
import { ActionButton, Eyebrow } from '@/components/pos'
import { cn } from '@/lib/utils'
import type { Task } from '../shape'

// The month grid. Hand-rolled: a month is six rows of seven cells and a date
// arithmetic problem, which is less code than any calendar library's config.

const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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
        <div className="flex items-baseline gap-3">
          <Eyebrow>
            {MONTHS[month]} {year}
          </Eyebrow>
          <span className="t-caption text-ink-3">
            {inMonth.length} open, {inMonth.filter((t) => t.remindMinutes !== null).length} with
            reminders
          </span>
        </div>
        <div className="flex gap-1.5">
          <ActionButton aria-label="Previous month" onClick={() => setOffset(offset - 1)}>
            Prev
          </ActionButton>
          <ActionButton variant={offset === 0 ? 'brand' : 'outline'} onClick={() => setOffset(0)}>
            Today
          </ActionButton>
          <ActionButton aria-label="Next month" onClick={() => setOffset(offset + 1)}>
            Next
          </ActionButton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="label grid grid-cols-7 gap-px text-[10px] tracking-[0.12em] text-ink-3">
            {DOWS.map((d) => (
              <span key={d} className="px-2 py-1.5">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-rule">
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
                    'min-h-24 space-y-1 p-2',
                    isToday ? 'bg-brand-soft' : 'bg-bg',
                    // A past day is de-emphasised by ink, never by opacity: the
                    // design's rule is that a greyed row stays readable.
                    past && 'bg-bg-deep',
                  )}
                >
                  <span
                    className={cn(
                      'num block text-[11px]',
                      isToday ? 'text-ok' : past ? 'text-ink-4' : 'text-ink-3',
                    )}
                  >
                    {String(day).padStart(2, '0')}
                  </span>

                  {items.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onOpen(t)}
                      title={t.title}
                      className={cn(
                        'block w-full truncate rounded-[3px] border bg-bg px-1.5 py-0.5 text-left text-[11px] leading-snug',
                        t.priority === 'P1'
                          ? 'border-bad/60 text-ink'
                          : t.status === 'review'
                            ? 'border-warn/60 text-ink'
                            : 'border-rule-2 text-ink-2',
                      )}
                    >
                      {t.dueAt ? `${t.dueAt} ` : ''}
                      {t.title}
                    </button>
                  ))}

                  {items.length > 3 && (
                    <span className="label block text-[10px] text-ink-3">
                      +{items.length - 3} more
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
