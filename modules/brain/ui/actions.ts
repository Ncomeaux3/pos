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
  revalidatePath('/brain')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function saveNote(input: {
  id?: string
  title?: string
  body?: string
  kind?: string
}): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('brain', 'write', input, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

/**
 * Read a URL and draft a note from it.
 *
 * `source: 'ui'` is the approval: `ingest` is guarded because it spends money,
 * and a guarded tool called from the UI is the owner pressing the button. The
 * same tool called by an agent lands in the Review inbox instead.
 *
 * Returns the note it made so the screen can open it, and the ingest's own note
 * about anything that did not go to plan: an automatic transcript, a trimmed
 * article, a summary that could not be written because the cap was reached.
 */
export async function ingestFromUrl(
  url: string,
): Promise<ActionResult & { id?: string; note?: string }> {
  await requireOwner()
  try {
    const call = await callTool('brain', 'ingest', { url }, { source: 'ui' })
    // A UI call is pre-approved, so this is always 'done'. Handled rather than
    // asserted, because the day the guard changes this should not silently
    // report success for a note that does not exist yet.
    if (call.status === 'proposed') {
      return { ...done(), note: 'That went to the Review inbox for approval.' }
    }
    const result = call.result as { id: string; note: string }
    return { ...done(), id: result.id, note: result.note }
  } catch (error) {
    return failed(error)
  }
}

/** Accept a draft into the vault, or send a note back to the inbox. */
export async function publishNote(id: string, publish: boolean): Promise<ActionResult> {
  await requireOwner()
  try {
    await callTool('brain', 'publish', { id, publish }, { source: 'ui' })
    return done()
  } catch (error) {
    return failed(error)
  }
}

/**
 * Start the note a dangling link points at, with the link's own slug as its
 * title. Writing it is what connects the two, and the nightly job would do the
 * same resolution anyway.
 */
export async function startFromLink(slug: string): Promise<ActionResult> {
  await requireOwner()
  try {
    const title = slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
    await callTool(
      'brain',
      'write',
      { title, body: `Started from a link in another note.\n` },
      { source: 'ui' },
    )
    return done()
  } catch (error) {
    return failed(error)
  }
}
