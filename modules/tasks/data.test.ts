import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/core/db'
import { listByGoal, listTasks } from './data'

// Against pos_test, because the thing worth proving is one SQL expression:
// coalesce(task.goal_ref, project.goal_ref). The board and the Goals drawer
// both read it, so they cannot disagree.

async function goal(title: string): Promise<string> {
  const { rows } = await db().query<{ id: string }>(
    `insert into core.entities (module, entity_type, entity_id, title)
     values ('goals', 'goal', gen_random_uuid(), $1) returning id`,
    [title],
  )
  return rows[0].id
}

async function task(title: string, projectId: string | null, goalRef: string | null) {
  await db().query(
    `insert into tasks.task (title, project_id, goal_ref) values ($1, $2, $3)`,
    [title, projectId, goalRef],
  )
}

beforeEach(async () => {
  await db().query('delete from tasks.task')
  await db().query('delete from tasks.project')
  await db().query(`delete from core.entities where module = 'goals'`)
})

describe('a project linked to a goal', () => {
  it('lends its goal to a task that has none, and not to one with its own', async () => {
    const g = await goal('G')
    const h = await goal('H')
    const { rows } = await db().query<{ id: string }>(
      `insert into tasks.project (name, goal_ref) values ('Linked', $1) returning id`,
      [g],
    )
    const project = rows[0].id
    await task('Inherits', project, null)
    await task('Own goal', project, h)
    await task('No project', null, null)

    const forG = (await listByGoal(g)).map((r) => r.title)
    const forH = (await listByGoal(h)).map((r) => r.title)
    expect(forG).toEqual(['Inherits'])
    expect(forH).toEqual(['Own goal'])

    const board = Object.fromEntries((await listTasks()).map((t) => [t.title, t]))
    expect(board.Inherits.goal_ref).toBe(g)
    expect(board.Inherits.goal_title).toBe('G')
    expect(board.Inherits.own_goal_ref).toBeNull()
    expect(board.Inherits.project_goal_ref).toBe(g)
    expect(board['Own goal'].goal_ref).toBe(h)
    expect(board['Own goal'].own_goal_ref).toBe(h)
    expect(board['No project'].goal_ref).toBeNull()
  })
})
