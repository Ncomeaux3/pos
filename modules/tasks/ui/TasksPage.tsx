import { PageHeader } from '@/components/pos'
import { ownerToday } from '@/core/today'
import { listGoals, listProjects, listTasks, type TaskRow } from '../data'
import { bucket, type Task } from '../shape'
import { Board } from './Board'

/**
 * Days from today, at day granularity. Both sides are floored to local
 * midnight first, so "tomorrow at 01:00" is one day away rather than zero.
 */
function daysFrom(today: Date, iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const then = new Date(y, m - 1, d)
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((then.getTime() - from.getTime()) / 86_400_000)
}

function toTask(row: TaskRow, today: Date): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueInDays: row.due_on === null ? null : daysFrom(today, row.due_on),
    // The column is HH:MM:SS; nothing in the design shows seconds.
    dueAt: row.due_at === null ? null : row.due_at.slice(0, 5),
    priority: row.priority,
    status: row.status,
    projectId: row.project_id,
    projectName: row.project_name,
    goalRef: row.goal_ref,
    goalTitle: row.goal_title,
    estimateMinutes: row.estimated_minutes,
    remindMinutes: row.remind_minutes,
    source: row.source,
    doneDaysAgo:
      row.completed_at === null
        ? null
        : -daysFrom(today, new Date(row.completed_at).toISOString().slice(0, 10)),
  }
}

export default async function TasksPage() {
  const [rows, projects, goals, todayIso] = await Promise.all([
    listTasks(),
    listProjects(),
    listGoals(),
    // The owner's day, from the database, not this server's. Between 19:00 in
    // Chicago and midnight in UTC the two are different dates, and a board that
    // disagreed with its own queries put today's work in tomorrow's column.
    ownerToday(),
  ])

  const [y, m, d] = todayIso.split('-').map(Number)
  const today = new Date(y, m - 1, d)
  const tasks = rows.map((r) => toTask(r, today))

  const open = tasks.filter((t) => t.status === 'open')
  const overdue = open.filter((t) => bucket(t.dueInDays) === 'overdue').length
  const dueToday = open.filter((t) => bucket(t.dueInDays) === 'today').length
  const waiting = tasks.filter((t) => t.status === 'review').length

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`Tasks / ${open.length} open / ${waiting} waiting on you`}
        dot={overdue > 0 ? 'bad' : dueToday > 0 ? 'brand' : 'ok'}
        title="Tasks"
        lede="Six views over one list. Drag a card between columns to change what it belongs to, and type a whole task on one line: the parser shows you what it understood before anything is saved."
        actions={
          <span className="num text-[11px] text-ink-3">
            {overdue > 0 ? `${overdue} overdue · ` : ''}
            {dueToday} due today
          </span>
        }
      />

      <Board
        tasks={tasks}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        goals={goals}
        // Passed in rather than read in the browser, so the server and the
        // client agree about what day it is and the first paint does not
        // flicker onto a different one.
        todayIso={todayIso}
      />
    </div>
  )
}
