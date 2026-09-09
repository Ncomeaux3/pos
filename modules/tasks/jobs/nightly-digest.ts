import { db } from '@/core/db'

export type TasksDigest = {
  /** Open and dated for today or earlier. */
  dueToday: number
  overdue: number
  /** Minutes of estimated work in today's column. */
  plannedMinutes: number
  completedToday: number
  completedThisWeek: number
  /** Agent-proposed, waiting for approval. */
  awaitingReview: number
  /** The next five, so the dashboard timeline has something to union. */
  upcoming: { id: string; title: string; dueOn: string; priority: string }[]
}

type Counts = {
  due_today: string
  overdue: string
  planned_minutes: string
  completed_today: string
  completed_week: string
  awaiting_review: string
}

/**
 * Written to core.digests nightly. Everything outside this module reads these
 * numbers from there, the Dashboard tile included: no other screen reaches into
 * the tasks schema.
 */
export async function nightlyDigest(): Promise<TasksDigest> {
  const { rows } = await db().query<Counts>(
    `select
       count(*) filter (where status = 'open' and due_on = core.today())::text as due_today,
       count(*) filter (where status = 'open' and due_on < core.today())::text as overdue,
       coalesce(sum(estimated_minutes) filter (
         where status = 'open' and due_on <= core.today()), 0)::text as planned_minutes,
       count(*) filter (where status = 'done'
         and completed_at >= core.today())::text as completed_today,
       count(*) filter (where status = 'done'
         and completed_at >= core.today() - 7)::text as completed_week,
       count(*) filter (where status = 'review')::text as awaiting_review
     from tasks.task`,
  )
  const counts = rows[0]

  const { rows: upcoming } = await db().query<{
    id: string
    title: string
    dueOn: string
    priority: string
  }>(
    `select id, title, due_on::text as "dueOn", priority
       from tasks.task
      where status = 'open' and due_on is not null and due_on >= core.today()
      order by due_on, priority
      limit 5`,
  )

  return {
    dueToday: Number(counts.due_today),
    overdue: Number(counts.overdue),
    plannedMinutes: Number(counts.planned_minutes),
    completedToday: Number(counts.completed_today),
    completedThisWeek: Number(counts.completed_week),
    awaitingReview: Number(counts.awaiting_review),
    upcoming,
  }
}

/**
 * Anything still open past its due date moves to today, once, overnight.
 *
 * Only work that was never started and has no time of day: a task pinned to
 * 17:30 on Thursday meant that Thursday, and silently moving it would erase
 * the fact that it was missed. Every roll is logged, so the Agent Log can show
 * what moved and put it back.
 */
export async function rollForward(): Promise<{ rolled: number }> {
  const { ownerToday } = await import('@/core/today')
  const today = await ownerToday()

  const { rows } = await db().query<{ id: string; title: string; due_on: string }>(
    `select id, title, due_on::text
       from tasks.task
      where status = 'open' and due_on < core.today() and due_at is null`,
  )
  if (rows.length === 0) return { rolled: 0 }

  const { logWrite } = await import('@/core/writelog')

  for (const task of rows) {
    await db().query(`update tasks.task set due_on = core.today() where id = $1`, [task.id])
    await logWrite({
      module: 'tasks',
      tool: 'write',
      kind: 'rescheduled',
      title: `Rolled "${task.title}" to today`,
      reason: 'It was open past its due date, unstarted, and had no time of day.',
      diff: [{ field: 'due_on', before: task.due_on, after: today }],
      revertPayload: { id: task.id, due_on: task.due_on },
      applyPayload: { id: task.id, due_on: today },
    })
  }

  return { rolled: rows.length }
}
