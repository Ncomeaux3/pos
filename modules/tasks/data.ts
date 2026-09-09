import { db } from '@/core/db'
import type { Priority } from './quickadd'

// Reads for the six views, and the two writes behind the tools. Everything the
// screen needs in one place; the shape it renders lives in ./shape.ts, which a
// client component can import.

export type TaskStatus = 'open' | 'review' | 'done'

export type TaskRow = {
  id: string
  title: string
  notes: string
  due_on: string | null
  due_at: string | null
  priority: Priority
  status: TaskStatus
  project_id: string | null
  project_name: string | null
  goal_ref: string | null
  goal_title: string | null
  estimated_minutes: number | null
  remind_minutes: number | null
  source: string
  completed_at: Date | null
}

const SELECT = `
  select t.id, t.title, t.notes, t.due_on::text, t.due_at::text, t.priority, t.status,
         t.project_id, p.name as project_name,
         t.goal_ref, g.title as goal_title,
         t.estimated_minutes, t.remind_minutes, t.source, t.completed_at
    from tasks.task t
    left join tasks.project p on p.id = t.project_id
    -- The goal's title comes from the core registry, so this join works before
    -- the goals module exists and needs no change when it lands.
    left join core.entities g on g.id = t.goal_ref`

/**
 * Everything open or in review, plus what was completed in the last week. The
 * Done view only ever shows a week, so there is no reason to read further back
 * and every reason not to.
 */
export async function listTasks(): Promise<TaskRow[]> {
  const { rows } = await db().query<TaskRow>(
    `${SELECT}
      where t.status <> 'done' or t.completed_at >= now() - interval '7 days'
      order by t.due_on nulls last, t.due_at nulls last, t.priority, t.created_at`,
  )
  return rows
}

export async function getTask(id: string): Promise<TaskRow | null> {
  const { rows } = await db().query<TaskRow>(`${SELECT} where t.id = $1`, [id])
  return rows[0] ?? null
}

export type Project = { id: string; name: string; position: number }

export async function listProjects(): Promise<Project[]> {
  const { rows } = await db().query<Project>(
    `select id, name, position from tasks.project
      where archived = false order by position, name`,
  )
  return rows
}

/** Goals as the core registry knows them. Empty until the goals module ships. */
export async function listGoals(): Promise<{ id: string; title: string }[]> {
  const { rows } = await db().query<{ id: string; title: string }>(
    `select id, title from core.entities
      where module = 'goals' and entity_type = 'goal'
      order by title`,
  )
  return rows
}

export async function findOrCreateProject(name: string): Promise<string> {
  const { rows } = await db().query<{ id: string }>(
    `insert into tasks.project (name) values ($1)
     on conflict (name) do update set name = excluded.name
     returning id`,
    [name],
  )
  return rows[0].id
}

/**
 * The columns a patch is allowed to name.
 *
 * Not the type restated: patchTask builds its SET clause by interpolating
 * column names, and it is reached from a server action, which is a public POST
 * endpoint that accepts whatever it is sent. The signature is erased at
 * runtime, so this list is the only thing standing between a caller and any
 * column on the table.
 */
const PATCHABLE = [
  'title',
  'notes',
  'due_on',
  'due_at',
  'priority',
  'status',
  'project_id',
  'goal_ref',
  'estimated_minutes',
  'remind_minutes',
] as const

export type TaskPatch = Partial<Record<(typeof PATCHABLE)[number], unknown>>

export async function patchTask(id: string, patch: TaskPatch): Promise<void> {
  const fields = PATCHABLE.filter((f) => f in patch)
  if (fields.length === 0) return

  const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  await db().query(`update tasks.task set ${set} where id = $1`, [
    id,
    ...fields.map((f) => patch[f]),
  ])
}
