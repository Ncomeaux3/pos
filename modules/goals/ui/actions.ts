'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/core/auth'
import { callTool } from '@/core/tools'

// Server actions are standalone POST endpoints addressed by id, so the (app)
// layout does not run for them and each one authenticates independently.
//
// Every write goes through callTool, so the owner's edits and an agent's use
// the same implementation and the same validation.

export type ActionResult = { ok: true } | { ok: false; error: string }

function failed(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : 'Failed' }
}

function done(): ActionResult {
  revalidatePath('/goals')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export type GoalInput = {
  id?: string
  title?: string
  notes?: string
  area?: string
  kind?: 'number' | 'count' | 'streak' | 'milestone'
  unit?: string
  start_value?: number
  target_value?: number
  deadline?: string
  metric_source?: string | null
  archived?: boolean
}

export async function writeGoal(input: GoalInput): Promise<ActionResult> {
  await requireOwner()
  try {
    // source 'ui' on purpose. `write` is guarded, and a guarded call from an
    // agent becomes a proposal; pressing a button in your own app is already
    // the approval, so it must not queue one for yourself.
    await callTool('goals', 'write', input, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

export async function recordCheckin(
  goalId: string,
  value: number,
  note?: string,
): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('goals', 'checkin', { goal_id: goalId, value, note }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}
