import { Eyebrow, PageHeader } from '@/components/pos'
import { ownerToday } from '@/core/today'
import { getSkillNames } from '@/core/modules'
import {
  listGoals,
  listProjects,
  listSkillLinks,
  listTasks,
  reminderChannels,
  type SkillLinkRow,
  type TaskRow,
} from '../data'
import type { Task } from '../shape'
import { Board, BoardCrumb, NewTaskButton } from './Board'

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

function toTask(
  row: TaskRow,
  today: Date,
  links: SkillLinkRow[],
  names: Record<string, string>,
): Task {
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
    ownGoalRef: row.own_goal_ref,
    projectGoalRef: row.project_goal_ref,
    estimateMinutes: row.estimated_minutes,
    remindMinutes: row.remind_minutes,
    source: row.source,
    skills: links
      .filter((l) => l.task_id === row.id)
      .map((l) => ({
        name: names[l.skill_id] ?? l.skill_id,
        confidence: Number(l.confidence),
        by: l.is_manual ? 'manual' : l.classified_by === 'rule' ? 'rule' : 'model',
      })),
    doneDaysAgo: row.done_days_ago === null ? null : Number(row.done_days_ago),
  }
}

export default async function TasksPage() {
  const [rows, projects, goals, links, names, channels, todayIso] = await Promise.all([
    listTasks(),
    listProjects(),
    listGoals(),
    listSkillLinks(),
    getSkillNames(),
    reminderChannels(),
    // The owner's day, from the database, not this server's. Between 19:00 in
    // Chicago and midnight in UTC the two are different dates, and a board that
    // disagreed with its own queries put today's work in tomorrow's column.
    ownerToday(),
  ])

  const [y, m, d] = todayIso.split('-').map(Number)
  const today = new Date(y, m - 1, d)
  const tasks = rows.map((r) => toTask(r, today, links, names))

  const open = tasks.filter((t) => t.status === 'open').length
  const doneToday = tasks.filter((t) => t.status === 'done' && t.doneDaysAgo === 0).length

  return (
    <div className="space-y-[18px]">
      {/* The artboard has no title block: the band, then the line you type a
        * task on. The eyebrow's view label is the board's, so it lives there. */}
      <PageHeader
        eyebrow={<BoardCrumb />}
        title="Tasks"
        hideTitle
        phoneAction={<NewTaskButton />}
        status={
          <Eyebrow dot="brand" className="whitespace-nowrap">
            {open} open · {doneToday} done today
          </Eyebrow>
        }
      />

      <Board
        tasks={tasks}
        projects={projects.map((p) => ({ id: p.id, name: p.name, goalRef: p.goal_ref }))}
        goals={goals}
        reminderChannels={channels}
        // Passed in rather than read in the browser, so the server and the
        // client agree about what day it is and the first paint does not
        // flicker onto a different one.
        todayIso={todayIso}
      />
    </div>
  )
}
