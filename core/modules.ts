import { modules } from '../modules/_index'
import { db } from './db'
import type { ModuleManifest } from './module-contract'

// The registry. The contract it implements lives in core/module-contract.ts,
// which imports nothing, so a manifest can import defineModule without this
// file and its module graph coming with it.

export {
  defineModule,
  defineTool,
  type ModuleJob,
  type ModuleManifest,
  type ModuleTool,
  type ToolContext,
} from './module-contract'

/** Every module, nav order first so callers do not each re-sort. */
export function getModules(): ModuleManifest[] {
  return [...modules].sort((a, b) => a.nav.order - b.nav.order)
}

export function getModule(id: string): ModuleManifest | undefined {
  return modules.find((m) => m.id === id)
}

/**
 * The one module that classifies entities to skills, if it is installed.
 *
 * Two would each write core.skill_links for the same entity and the result
 * would depend on array order, so this throws rather than picking one. A
 * template that ships without modules/skills gets undefined, and register()
 * simply does not classify.
 */
export function getClassifier(): ModuleManifest['classifier'] {
  const found = modules.filter((m) => m.classifier)
  if (found.length > 1) {
    throw new Error(
      `Two modules declare a classifier (${found.map((m) => m.id).join(', ')}). Only one may.`,
    )
  }
  return found[0]?.classifier
}

/**
 * Which of these integrations have no connected row yet. Drives the
 * "Connect <provider>" card that stands in for a module's pages.
 */
export async function missingConnections(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const { rows } = await db().query<{ integration_id: string }>(
    `select integration_id from core.connections
     where integration_id = any($1) and status = 'connected'`,
    [ids],
  )
  const connected = new Set(rows.map((r) => r.integration_id))
  return ids.filter((id) => !connected.has(id))
}
