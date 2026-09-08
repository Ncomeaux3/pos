import type { ComponentType } from 'react'
import type { z } from 'zod'

// The module contract: the types and the two identity functions a manifest
// calls. No imports beyond types, on purpose.
//
// A manifest imports defineModule from here, and the registry in core/modules.ts
// imports the manifests through modules/_index.ts. Keeping the contract in its
// own leaf module is what stops that being a cycle. It was one until 2026-09-08:
// Next's bundler hoisted around it, and plain Node did not, so the registry
// could not be loaded by the cron job, a script, or a test outside Next.
// See docs/ARCHITECTURE.md "Module contract".

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
  /**
   * Links an entity to skills. Core calls this from register() for every row
   * every module creates, so at most one module may provide it. No module
   * providing one means no classification, and nothing else changes: this is
   * what lets `rm -r modules/skills` leave a working app.
   */
  classifier?: (entityRef: string, text: string, module: string) => Promise<void>
}

/** Identity, but it pins the manifest type at the definition site. */
export function defineModule(manifest: ModuleManifest): ModuleManifest {
  return manifest
}
