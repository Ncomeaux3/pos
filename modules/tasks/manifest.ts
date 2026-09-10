import { z } from 'zod'
import { db } from '@/core/db'
import { register } from '@/core/entities'
import { defineModule, defineTool } from '@/core/module-contract'
import { findOrCreateProject, patchTask } from './data'
import { nightlyDigest, rollForward } from './jobs/nightly-digest'
import TasksPage from './ui/TasksPage'
import { TasksTile } from './ui/Tile'

const priority = z.enum(['P1', 'P2', 'P3'])

// A date, not a datetime. "Due Thursday" is a day, and a timestamp makes it
// wrong for anyone who crosses a timezone.
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const time = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM')

export default defineModule({
  id: 'tasks',
  nav: { label: 'Tasks', icon: 'check', order: 20 },
  pages: { '': TasksPage },

  tools: {
    get_digest: defineTool({
      description: 'Open counts, planned minutes, what was completed, and the next five due.',
      input: z.object({}),
      run: () => nightlyDigest(),
    }),

    write: defineTool({
      description:
        'Create a task, or update one by passing its id. An agent-created task lands in review.',
      input: z.object({
        id: z.uuid().optional(),
        title: z.string().min(1).max(300).optional(),
        notes: z.string().max(10_000).optional(),
        due_on: date.nullable().optional(),
        due_at: time.nullable().optional(),
        priority: priority.optional(),
        project: z.string().max(80).nullable().optional(),
        goal_ref: z.uuid().nullable().optional(),
        estimated_minutes: z.number().int().min(0).max(10_000).nullable().optional(),
        remind_minutes: z.number().int().min(0).max(20_160).nullable().optional(),
      }),
      run: async (input, ctx) => {
        const projectId =
          input.project === undefined
            ? undefined
            : input.project === null
              ? null
              : await findOrCreateProject(input.project)

        if (input.id) {
          await patchTask(input.id, {
            ...(input.title !== undefined && { title: input.title }),
            ...(input.notes !== undefined && { notes: input.notes }),
            ...(input.due_on !== undefined && { due_on: input.due_on }),
            ...(input.due_at !== undefined && { due_at: input.due_at }),
            ...(input.priority !== undefined && { priority: input.priority }),
            ...(projectId !== undefined && { project_id: projectId }),
            ...(input.goal_ref !== undefined && { goal_ref: input.goal_ref }),
            ...(input.estimated_minutes !== undefined && {
              estimated_minutes: input.estimated_minutes,
            }),
            ...(input.remind_minutes !== undefined && { remind_minutes: input.remind_minutes }),
          })

          // No register() on an update. It emits the creation event, and a task
          // edited twice would award its XP twice.
          return { id: input.id }
        }

        if (!input.title) throw new Error('A new task needs a title')

        // An agent-created task is a real row that does not count as work until
        // the owner approves it. That is what the Review view is.
        const status = ctx.source === 'agent' ? 'review' : 'open'

        const { rows } = await db().query<{ id: string }>(
          `insert into tasks.task
             (title, notes, due_on, due_at, priority, project_id, goal_ref,
              estimated_minutes, remind_minutes, source, status)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           returning id`,
          [
            input.title,
            input.notes ?? '',
            input.due_on ?? null,
            input.due_at ?? null,
            input.priority ?? 'P2',
            projectId ?? null,
            input.goal_ref ?? null,
            input.estimated_minutes ?? null,
            input.remind_minutes ?? null,
            ctx.source === 'agent' ? 'agent' : 'manual',
            status,
          ],
        )

        await register({
          module: 'tasks',
          entityType: 'task',
          entityId: rows[0].id,
          title: input.title,
          text: input.notes,
        })

        return { id: rows[0].id, status }
      },
    }),

    complete: defineTool({
      description: 'Mark a task done, or reopen it. Completing emits the event that earns XP.',
      input: z.object({ id: z.uuid(), done: z.boolean().default(true) }),
      run: async ({ id, done }) => {
        const { rows } = await db().query<{ title: string; status: string }>(
          `update tasks.task
              set status = case when $2 then 'done' else 'open' end,
                  completed_at = case when $2 then now() else null end
            where id = $1
            returning title, status`,
          [id, done],
        )
        if (rows.length === 0) throw new Error(`No task ${id}`)

        // Completion is a thing that happens, and it can happen again on the
        // same row, so the event type is explicit rather than the default
        // creation event register() would emit.
        if (done) {
          await register({
            module: 'tasks',
            entityType: 'task',
            entityId: id,
            title: rows[0].title,
            eventType: 'task_completed',
          })
        }

        return { id, status: rows[0].status }
      },
    }),

    approve: defineTool({
      description: 'Accept an agent-proposed task, moving it from review into the working list.',
      input: z.object({ id: z.uuid() }),
      run: async ({ id }) => {
        await db().query(`update tasks.task set status = 'open' where id = $1 and status = 'review'`, [
          id,
        ])
        return { id }
      },
    }),
  },

  // Nothing here moves money or deletes anything. An agent-created task already
  // lands in review, which is this module's own version of the same guard, and
  // guarding write as well would put it behind two approvals.
  guarded: [],
  requires: [],

  // What a goal can point at. Goals never queries the tasks schema; it stores
  // the key and asks the registry for the number.
  metrics: {
    completed_this_week: {
      label: 'Tasks completed this week',
      unit: 'tasks',
      get: async () => {
        const { rows } = await db().query<{ n: string }>(
          `select count(*)::text as n from tasks.task
            where status = 'done' and completed_at >= core.today() - 7`,
        )
        return Number(rows[0].n)
      },
    },
    open_count: {
      label: 'Open tasks',
      unit: 'tasks',
      get: async () => {
        const { rows } = await db().query<{ n: string }>(
          `select count(*)::text as n from tasks.task where status = 'open'`,
        )
        return Number(rows[0].n)
      },
    },
  },

  // What Tasks contributes to the Weekly Review. Core composes this without
  // reading the tasks schema, and a fork that deletes this folder gets a
  // review with no misses step rather than a broken one.
  review: {
    slipped: async () => {
      const { rows } = await db().query<{
        id: string
        title: string
        due_on: string
        project: string | null
        est: number | null
      }>(
        `select t.id, t.title, t.due_on::text, p.name as project, t.estimated_minutes as est
           from tasks.task t
           left join tasks.project p on p.id = t.project_id
          where t.status = 'open' and t.due_on < core.today()
          order by t.due_on
          limit 12`,
      )
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        meta: `Due ${r.due_on}${r.project ? `, ${r.project}` : ''}`,
        estimateMinutes: r.est,
      }))
    },

    upcoming: async () => {
      const { rows } = await db().query<{
        id: string
        title: string
        project: string | null
        est: number | null
      }>(
        `select t.id, t.title, p.name as project, t.estimated_minutes as est
           from tasks.task t
           left join tasks.project p on p.id = t.project_id
          where t.status = 'open' and (t.due_on is null or t.due_on >= core.today())
          order by t.priority, t.due_on nulls last
          limit 12`,
      )
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        meta: r.project ?? 'No project',
        estimateMinutes: r.est,
      }))
    },

    apply: async ({ carry, carryTo, drop }) => {
      // Carrying moves the date. Dropping closes it: the owner decided it is
      // not happening, and leaving it open would put it back in next week's
      // misses forever.
      if (carry.length > 0) {
        await db().query(
          `update tasks.task set due_on = $2::date where id = any($1) and status = 'open'`,
          [carry, carryTo],
        )
      }
      if (drop.length > 0) {
        await db().query(
          `update tasks.task set status = 'done', completed_at = now()
            where id = any($1) and status = 'open'`,
          [drop],
        )
      }
    },
  },

  /** See ModuleManifest.tile: the module says how its own numbers read. */
  tile: TasksTile,

  jobs: [
    { name: 'roll_forward', run: rollForward },
    { name: 'nightly_digest', run: nightlyDigest },
  ],
  entityTypes: ['task'],
})
