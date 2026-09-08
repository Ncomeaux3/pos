'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/core/auth'
import { callTool } from '@/core/tools'

/**
 * Dropping an event onto a different skill. Server actions are standalone POST
 * endpoints addressed by id, so the (app) layout does not run for them and this
 * authenticates on its own.
 */
export async function reassignEvent(
  entityRef: string,
  fromSkillId: string,
  toSkillId: string,
): Promise<void> {
  await requireOwner()

  // Through the tool rather than straight to SQL, so the one write that sets
  // is_manual has one implementation and the MCP client gets the same one.
  await callTool('skills', 'reassign', { entityRef, fromSkillId, toSkillId }, { source: 'ui' })
  revalidatePath('/skills')
}
