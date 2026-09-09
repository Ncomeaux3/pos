'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/core/auth'
import { db } from '@/core/db'
import { callTool } from '@/core/tools'

// Server actions are standalone POST endpoints addressed by id, so the (app)
// layout does not run for them and each one authenticates independently.

export type ActionResult = { ok: true } | { ok: false; error: string }

function failed(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : 'Failed' }
}

function done(): ActionResult {
  revalidatePath('/health')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function markMedication(id: string, taken: boolean): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('health', 'mark_medication', { id, taken }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

export async function completeScreening(id: string): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('health', 'complete_screening', { id }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

/**
 * Push a screening out.
 *
 * Straight to SQL: it is one date on one row, reversible by completing or
 * snoozing again, and a tool for it would put a snooze button in the MCP
 * surface for no reason. Snoozing is not dismissing, so there is no way here to
 * make a screening go away permanently.
 */
export async function snoozeScreening(id: string, months: number): Promise<ActionResult> {
  await requireOwner()

  if (!Number.isInteger(months) || months < 1 || months > 24) {
    return { ok: false, error: 'A snooze is between one and twenty four months' }
  }

  try {
    await db().query(
      `update health.screening
          set snooze_until = core.today() + make_interval(months => $2)
        where id = $1`,
      [id, months],
    )
    return done()
  } catch (error) {
    return failed(error)
  }
}

export async function setAppointmentStatus(
  id: string,
  status: 'confirmed' | 'held' | 'done' | 'cancelled',
): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('health', 'write_appointment', { id, status }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}
