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
  revalidatePath('/ideas')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function captureIdea(title: string): Promise<ActionResult> {
  await requireOwner()
  if (!title.trim()) return { ok: false, error: 'An idea needs a title' }
  try {
    await callTool('ideas', 'write', { title: title.trim() }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

export async function moveIdea(
  id: string,
  stage: 'exploring' | 'validated' | 'building' | 'killed',
  killedReason?: string,
): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool(
      'ideas',
      'write',
      { id, stage, ...(killedReason !== undefined && { killed_reason: killedReason }) },
      { source: 'ui' },
    )
    return done()
  } catch (error) {
    return failed(error)
  }
}

export async function scoreIdea(
  id: string,
  effort: number,
  impact: number,
): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('ideas', 'write', { id, effort, impact }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

/**
 * Run the rubric. This spends money, so it is one deliberate press.
 *
 * The tool is guarded, which means an agent asking lands in the Review inbox.
 * The owner pressing the button is the approval, which is what source: 'ui'
 * says.
 */
export async function researchIdea(
  id: string,
  depth: 'quick' | 'deep',
): Promise<ActionResult> {
  await requireOwner()
  try {
    const result = await callTool('ideas', 'research', { id, depth }, { source: 'ui' })
    const run =
      result.status === 'done'
        ? (result.result as { status: string; detail: string; costCents: number })
        : null
    if (run?.status === 'failed') return { ok: false, error: run.detail }
    return done()
  } catch (error) {
    return failed(error)
  }
}
