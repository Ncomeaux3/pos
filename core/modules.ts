import type { ComponentType } from 'react'
import type { z } from 'zod'
import { modules } from '../modules/_index'
import { db } from './db'

// One folder, one manifest. Nothing in core is edited to add a module, and
// deleting the folder removes it. See docs/ARCHITECTURE.md "Module contract".

export type ToolContext = {
  /** 'ui' for the owner's own writes, 'agent' for MCP and the orchestrator. */
  source: 'ui' | 'agent'
}

/**
 * As stored in the registry: input is erased, because a Record cannot hold
 * tools with different schemas and stay type safe. Authors use defineTool(),
 * which keeps the types at the definition site.
 */
export type ModuleTool = {
  description: string
  input: z.ZodTypeAny
  run: (input: unknown, ctx: ToolContext) => Promise<unknown>
}

/**
 * Pins the input type inside run() from the zod schema, and parses on the way
 * in so every caller (UI, MCP, orchestrator) gets validation for free.
 */
export function defineTool<I extends z.ZodTypeAny>(tool: {
  description: string
  input: I
  run: (input: z.infer<I>, ctx: ToolContext) => Promise<unknown>
}): ModuleTool {
  return {
    description: tool.description,
    input: tool.input,
    run: (raw, ctx) => tool.run(tool.input.parse(raw), ctx),
  }
}

export type ModuleJob = {
  name: string
  run: () => Promise<unknown>
}

export type ModuleManifest = {
  /** Postgres schema name and URL segment. Lowercase identifier. */
  id: string
  nav: { label: string; icon?: string; order: number }
  /** Keyed by path under /<id>/. '' is the index page, no leading slash. */
  pages: Record<string, ComponentType>
  /** core adds query and search; every module supplies at least get_digest. */
  tools: Record<string, ModuleTool>
  /** Called by an agent, these land in core.proposals instead of the table. */
  guarded?: string[]
  /** Integration ids that must be connected before the pages are useful. */
  requires?: string[]
  jobs?: ModuleJob[]
  entityTypes?: string[]
  searchText?: (row: Record<string, unknown>) => string
}

/** Identity, but it pins the manifest type at the definition site. */
export function defineModule(manifest: ModuleManifest): ModuleManifest {
  return manifest
}

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
