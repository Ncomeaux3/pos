'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/core/auth'
import { db } from '@/core/db'
import { callTool } from '@/core/tools'
import { geocode, type Hit } from '../geocode'

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

/** One call per tool, the same shape for each: authenticate, call, revalidate. */
async function through(tool: string, input: Record<string, unknown>): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('travel', tool, input, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

export async function saveTrip(input: {
  id?: string
  name?: string
  destination?: string
  lat?: number | null
  lon?: number | null
  starts_on?: string | null
  ends_on?: string | null
  budget_cents?: number
  travellers?: number
  status?: 'idea' | 'planned' | 'booked' | 'done'
  notes?: string
  /** The whole set, in order. Left out entirely to leave the destinations alone. */
  destinations?: {
    name: string
    lat?: number | null
    lon?: number | null
    starts_on?: string | null
    ends_on?: string | null
  }[]
}): Promise<ActionResult> {
  return through('write_trip', input)
}

export async function deleteTrip(id: string): Promise<ActionResult> {
  return through('delete_trip', { id })
}

/**
 * Fold one trip into another. Guarded, like every other write to a trip, so it
 * lands in the review inbox when an agent asks for it and goes straight
 * through when the owner presses the button.
 */
export async function mergeTrip(id: string, into: string): Promise<ActionResult> {
  return through('merge_trip', { id, into })
}

export async function saveItem(input: {
  id?: string
  trip_id?: string
  kind?: 'flight' | 'lodging' | 'transit' | 'activity' | 'food'
  title?: string
  detail?: string
  occurs_on?: string | null
  occurs_at?: string | null
  amount_cents?: number
}): Promise<ActionResult> {
  return through('write_item', input)
}

export async function deleteItem(id: string): Promise<ActionResult> {
  return through('delete_item', { id })
}

export async function saveBudgetLine(input: {
  trip_id: string
  category: string
  planned_cents?: number
  actual_override_cents?: number | null
}): Promise<ActionResult> {
  return through('write_budget_line', input)
}

export async function deleteBudgetLine(trip_id: string, category: string): Promise<ActionResult> {
  return through('delete_budget_line', { trip_id, category })
}

export async function savePacking(input: {
  trip_id?: string
  id?: string
  label?: string
  packed?: boolean
  remove?: boolean
}): Promise<ActionResult> {
  return through('write_packing', input)
}

/** Destination suggestions while typing. Unguarded: no money spent, nothing written. */
export async function suggestPlaces(query: string): Promise<Hit[]> {
  await requireOwner()
  return geocode(query)
}
