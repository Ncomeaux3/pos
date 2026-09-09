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
  revalidatePath('/travel')
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Accept a parsed booking into the itinerary, or throw it away. */
export async function decideItem(id: string, accept: boolean): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('travel', 'accept_item', { id, accept }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

export async function setTripStatus(
  id: string,
  status: 'idea' | 'planned' | 'booked' | 'done',
): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('travel', 'write_trip', { id, status }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

/**
 * Tick a packing item.
 *
 * Straight to SQL rather than through a tool: it is a boolean on one row, it
 * is reversible by pressing it again, and giving it a tool would put a
 * checkbox in the MCP surface for no reason.
 */
export async function togglePacked(id: string, packed: boolean): Promise<ActionResult> {
  await requireOwner()
  try {
    await db().query(`update travel.packing_item set packed = $2 where id = $1`, [id, packed])
    return done()
  } catch (error) {
    return failed(error)
  }
}

export async function saveLoyalty(
  name: string,
  balance: number,
  kind: 'airline' | 'hotel' | 'card' | 'rail',
): Promise<ActionResult> {
  await requireOwner()

  if (!Number.isFinite(balance) || balance < 0) {
    return { ok: false, error: 'A balance has to be zero or more' }
  }

  try {
    await callTool(
      'travel',
      'set_loyalty',
      { name, balance: Math.round(balance), kind },
      { source: 'ui' },
    )
    return done()
  } catch (error) {
    return failed(error)
  }
}
