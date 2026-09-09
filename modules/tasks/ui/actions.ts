'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/core/auth'
import { callTool } from '@/core/tools'

// Server actions are standalone POST endpoints addressed by id, so the (app)
// layout does not run for them and each one authenticates independently.
//
// Every write goes through callTool rather than straight to SQL, so the one
// implementation is shared with MCP and the orchestrator, and the module's own
// validation runs whoever is calling.

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

function failed(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : 'Failed' }
}

function done(id?: string): ActionResult {
  revalidatePath('/tasks')
  revalidatePath('/', 'layout')
  return { ok: true, id }
}

export type WriteInput = {
  id?: string
  title?: string
  notes?: string
  due_on?: string | null
  due_at?: string | null
  priority?: 'P1' | 'P2' | 'P3'
  project?: string | null
  goal_ref?: string | null
  estimated_minutes?: number | null
  remind_minutes?: number | null
}

export async function writeTask(input: WriteInput): Promise<ActionResult> {
  await requireOwner()
  try {
    const result = await callTool('tasks', 'write', input, { source: 'ui' })
    const id = (result.status === 'done' ? (result.result as { id?: string }) : null)?.id
    return done(id)
  } catch (error) {
    // Surfaced, not thrown: the tool's own validation is what rejects a bad
    // input, and the form has to say which field it was unhappy with.
    return failed(error)
  }
}

export async function completeTask(id: string, done_ = true): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('tasks', 'complete', { id, done: done_ }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

/** Accept an agent-proposed task, moving it out of Review into the working list. */
export async function approveTask(id: string): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('tasks', 'approve', { id }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}
