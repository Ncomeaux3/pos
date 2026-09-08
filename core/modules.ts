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
