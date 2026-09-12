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
  /** Days since it was completed, on the owner's calendar. Null while open. */
  done_days_ago: number | null
}

const SELECT = `
  select t.id, t.title, t.notes, t.due_on::text, t.due_at::text, t.priority, t.status,
         t.project_id, p.name as project_name,
         t.goal_ref, g.title as goal_title,
         t.estimated_minutes, t.remind_minutes, t.source, t.completed_at,
         -- On the owner's calendar, in the database, because a completion at
         -- 20:00 in Chicago is tomorrow in UTC and was showing as yesterday's.
         case when t.completed_at is null then null
              else core.today() - (t.completed_at at time zone coalesce(
                     (select value #>> '{}' from core.settings where key = 'timezone'), 'UTC'))::date
         end as done_days_ago
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

export type SkillLinkRow = {
  task_id: string
  skill_id: string
  confidence: string
  classified_by: string
  is_manual: boolean
}

/**
 * The skills each task is linked to, through the core registry. Read only
 * here: the links are the classifier's, and the Skill Tree is where they are
 * corrected.
 */
export async function listSkillLinks(): Promise<SkillLinkRow[]> {
  const { rows } = await db().query<SkillLinkRow>(
    `select en.entity_id as task_id, sl.skill_id, sl.confidence::text,
            sl.classified_by, sl.is_manual
       from core.skill_links sl
       join core.entities en on en.id = sl.entity_ref
      where en.module = 'tasks' and en.entity_type = 'task'
        and sl.classified_by <> 'unclassified'
      order by sl.confidence desc, sl.skill_id`,
  )
  return rows
}

/** The channels the task reminder rule fires on, or null when it is off. */
export async function reminderChannels(): Promise<string[] | null> {
  const { rows } = await db().query<{ channels: string[]; muted: boolean }>(
    `select channels, muted from core.notification_rules
      where module = 'tasks' and key = 'task_reminder' limit 1`,
  )
  const rule = rows[0]
  return rule && !rule.muted ? rule.channels : null
}

export async function deleteTask(id: string): Promise<void> {
  // The registry row goes with it and its skill links cascade, so the XP a
  // completed task earned goes too. Its events stay, unlinked, with their own
  // title snapshot: the log is append only.
  await db().query(
    `delete from core.entities where module = 'tasks' and entity_type = 'task' and entity_id = $1`,
    [id],
  )
  await db().query(`delete from tasks.task where id = $1`, [id])
}
