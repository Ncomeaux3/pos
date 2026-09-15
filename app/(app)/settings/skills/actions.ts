'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/core/auth'
import { callTool } from '@/core/tools'

// Every edit goes through the module's tools rather than straight to SQL, so
// the UI and an MCP client share one implementation and one set of rules.
// Server actions are standalone POST endpoints addressed by id, so the (app)
// layout does not run for them and each of these authenticates on its own.

async function write(input: Record<string, unknown>): Promise<void> {
  await requireOwner()
  await callTool('skills', 'write', input, { source: 'ui' })
  revalidatePath('/settings/skills')
  revalidatePath('/skills')
}

export async function renameSkill(skillId: string, name: string): Promise<void> {
  await write({ kind: 'rename', skillId, name })
}

export async function setKeywords(skillId: string, keywords: string[]): Promise<void> {
  await write({ kind: 'rename', skillId, keywords })
}

export async function deleteSkill(skillId: string): Promise<void> {
  await write({ kind: 'delete', skillId })
}

export async function addSkill(skillId: string, name: string, parent: string): Promise<void> {
  await write({ kind: 'custom', skillId, name, parent })
}

export async function restoreSkill(skillId: string): Promise<void> {
  await requireOwner()
  await callTool('skills', 'restore', { skillId }, { source: 'ui' })
  revalidatePath('/settings/skills')
  revalidatePath('/skills')
}

/** Back to the committed skills.yaml. Every override, gone. */
export async function resetTree(): Promise<void> {
  await requireOwner()
  await callTool('skills', 'restore', {}, { source: 'ui' })
  revalidatePath('/settings/skills')
  revalidatePath('/skills')
}

// The picker on every entity drawer. The whole layout is revalidated because
// the drawer that called this lives on whichever screen the entity is from.
export async function linkSkill(entityRef: string, skillId: string): Promise<void> {
  await requireOwner()
  await callTool('skills', 'link', { entityRef, skillId }, { source: 'ui' })
  revalidatePath('/', 'layout')
}

export async function unlinkSkill(entityRef: string, skillId: string): Promise<void> {
  await requireOwner()
  await callTool('skills', 'unlink', { entityRef, skillId }, { source: 'ui' })
  revalidatePath('/', 'layout')
}
