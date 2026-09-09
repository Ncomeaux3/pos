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
  /**
   * Numbers this module will compute on request, for a goal to track.
   *
   * This is the whole cross-module read mechanism for a live value, and it
   * exists so Goals never parses a string like `finance.net_worth latest` and
   * never issues SQL against another module's schema. Goals enumerates what is
   * registered and stores the key it was given; deleting the module makes the
   * key stop resolving, and the goal falls back to manual check-ins rather than
   * erroring.
   */
  metrics?: Record<string, { label: string; unit: string; get: () => Promise<number> }>
  /**
   * What this module contributes to the Weekly Review.
   *
   * The review is a core screen and core does not read module schemas, so a
   * module hands over its own rows rather than being queried for them. Every
   * part is optional and a module that supplies none simply does not appear:
   * a fork with no Tasks gets a review with a glance and a note, which still
   * closes.
   */
  review?: {
    /** Slipped this week and needs a decision: carry, shrink or drop. */
    slipped?: () => Promise<ReviewItem[]>
    /** Could be next week. Feeds the three priorities. */
    upcoming?: () => Promise<ReviewItem[]>
    /** Needs a number from the owner before the week closes. */
    pending?: () => Promise<ReviewCheck[]>
    /** Called on close, with what the owner decided about this module's items. */
    apply?: (decisions: ReviewDecisions) => Promise<void>
  }
}

/** One thing on the review's misses or backlog list. */
export type ReviewItem = {
  id: string
  title: string
  /** One grey line under it: where it came from, how late it is. */
  meta: string
  estimateMinutes?: number | null
}

/** Something the owner has to put a number on before the week closes. */
export type ReviewCheck = {
  id: string
  title: string
  unit: string
  /** True when the module computes it and no input is needed. */
  computed: boolean
}

/** What the owner decided, handed back to the module that owns the rows. */
export type ReviewDecisions = {
  /** Item ids to carry, with the date they move to. */
  carry: string[]
  carryTo: string
  /** Item ids to drop. */
  drop: string[]
  /** Check id to the value entered. */
  values: Record<string, number>
}

/** Identity, but it pins the manifest type at the definition site. */
export function defineModule(manifest: ModuleManifest): ModuleManifest {
  return manifest
}
