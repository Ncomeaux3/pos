'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/core/auth'
import { callTool, ToolInputError } from '@/core/tools'

// Server actions are standalone POST endpoints addressed by id, so the (app)
// layout does not run for them and each one authenticates independently.

export type ActionResult = { ok: true } | { ok: false; error: string; fields?: Record<string, string> }

function failed(error: unknown): ActionResult {
  return {
    ok: false,
    error: error instanceof Error ? error.message : 'Failed',
    ...(error instanceof ToolInputError && { fields: error.fields }),
  }
}

function done(): ActionResult {
  revalidatePath('/finance')
  revalidatePath('/', 'layout')
  return { ok: true }
}

/**
 * Recategorise a transaction and learn from it.
 *
 * source 'ui' on purpose: `categorise` is unguarded, but going through callTool
 * keeps one implementation shared with MCP, and the owner pressing a button in
 * their own app is already the approval.
 */
export async function recategorise(id: string, categoryId: string): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('finance', 'categorise', { id, category_id: categoryId }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

/** Limits are in dollars on screen and cents in the database. Converted once, here. */
export async function saveBudget(categoryId: string, limitDollars: number): Promise<ActionResult> {
  await requireOwner()

  if (!Number.isFinite(limitDollars) || limitDollars <= 0) {
    return { ok: false, error: 'A limit has to be a positive number' }
  }

  try {
    await callTool(
      'finance',
      'set_budget',
      { category_id: categoryId, limit_cents: Math.round(limitDollars * 100) },
      { source: 'ui' },
    )
    return done()
  } catch (error) {
    return failed(error)
  }
}

export async function saveThreshold(percent: number): Promise<ActionResult> {
  await requireOwner()
  if (!Number.isInteger(percent) || percent < 50 || percent > 100) {
    return { ok: false, error: 'The threshold is a whole percentage from 50 to 100' }
  }
  try {
    await callTool('finance', 'set_alert_threshold', { percent }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

export async function setSubscriptionStatus(
  id: string,
  status: 'active' | 'paused' | 'cancelled',
): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('finance', 'write_subscription', { id, status }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}
