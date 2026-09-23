'use client'

import { useState } from 'react'
import { MonthGrid, isoDay } from '@/components/pos/MonthGrid'
import type { Task } from '../shape'

// Tasks' month view: the shared grid, with a task's priority and review state
// as the item's tone and a tap opening its drawer.

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

  /** YYYY-MM-DD of a task's due day, from its offset in days. */
  const dueIso = (t: Task) => {
    if (t.dueInDays === null) return null
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + t.dueInDays)
    return isoDay(d.getFullYear(), d.getMonth(), d.getDate())
  }

  const shown = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const monthKey = isoDay(shown.getFullYear(), shown.getMonth(), 1).slice(0, 7)
  const inMonth = tasks.filter((t) => dueIso(t)?.startsWith(monthKey))

  return (
    <MonthGrid
      today={today}
      offset={offset}
      onOffset={setOffset}
      meta={`${inMonth.length} open · ${inMonth.filter((t) => t.remindMinutes !== null).length} with reminders`}
      itemsOn={(iso) =>
        tasks
          .filter((t) => dueIso(t) === iso)
          .sort((a, b) => (a.dueAt ?? '99:99').localeCompare(b.dueAt ?? '99:99'))
          .map((t) => ({
            id: t.id,
            title: t.title,
            time: t.dueAt,
            tone: t.priority === 'P1' ? 'bad' : t.status === 'review' ? 'warn' : 'default',
            onOpen: () => onOpen(t),
          }))
      }
    />
  )
}
