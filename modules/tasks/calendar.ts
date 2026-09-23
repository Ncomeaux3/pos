import { db } from '@/core/db'
import type { CalendarItem } from '@/core/module-contract'

// What Tasks puts on the Calendar. Open, review and done tasks with a due
// date; a done task shows muted rather than dropping off the day it closed.

export type TaskRow = {
  id: string
  title: string
  due_on: string
  /** 'HH:MM', or null for a task with no time of day. */
  due_at: string | null
  status: string
}

export function toCalendarItems(rows: TaskRow[], range: { from: string; to: string }): CalendarItem[] {
  return rows
    .filter((r) => r.due_on >= range.from && r.due_on <= range.to)
    .map((r) => ({
      id: r.id,
      module: 'tasks',
      title: r.title,
      startsAt: r.due_at ? `${r.due_on}T${r.due_at}` : r.due_on,
      allDay: r.due_at === null,
      href: `/tasks?task=${r.id}`,
      kind: 'task',
      done: r.status === 'done',
    }))
}

export async function calendarFor(range: { from: string; to: string }): Promise<CalendarItem[]> {
  const { rows } = await db().query<TaskRow>(
    `select id, title, due_on::text, to_char(due_at, 'HH24:MI') as due_at, status
       from tasks.task
      where due_on between $1 and $2
        and status in ('open', 'review', 'done')`,
    [range.from, range.to],
  )
  return toCalendarItems(rows, range)
}
