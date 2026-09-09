'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/core/auth'
import { callTool } from '@/core/tools'

// Server actions are standalone POST endpoints addressed by id, so the (app)
// layout does not run for them and each one authenticates independently.

export type ActionResult = { ok: true } | { ok: false; error: string }

function failed(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : 'Failed' }
}

function done(): ActionResult {
  revalidatePath('/meals')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function planMeal(
  onDate: string,
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  recipeId: string | null,
): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool(
      'meals',
      'plan',
      { on_date: onDate, slot, recipe_id: recipeId },
      { source: 'ui' },
    )
    return done()
  } catch (error) {
    return failed(error)
  }
}

export async function markEaten(id: string, eaten: boolean): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('meals', 'mark_eaten', { id, eaten }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

export async function decideRecipe(id: string, accept: boolean): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('meals', 'accept_recipe', { id, accept }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}
