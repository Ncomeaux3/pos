import type { Autonomy } from './autonomy'
import { writeDigest } from './digests'
import { getModule, getModules, type ToolContext } from './modules'
import { propose } from './proposals'
import { runQuery } from './query'
import { getSetting } from './settings'
import { logWrite } from './writelog'
import type { Diff } from './writelog-shape'

// The one place a tool call is decided. The UI calls tools directly; agents and
// the orchestrator come through here, and this is what stands between them and
// the owner's data.

// Re-exported because this is where callers look for it. The definitions live
// in core/autonomy.ts so a client component can import them without pulling in
// pg and the module registry.
export { AUTONOMY_LABELS, AUTONOMY_LEVELS, type Autonomy } from './autonomy'

/**
 * Whether this call becomes a proposal instead of a write.
 *
 * Writes the owner makes in the UI are never guarded: pressing a button in your
 * own app is the approval.
 *
 * - observe: everything an agent does becomes a proposal, including tools no
 *   manifest listed. The setting for the first weeks of a new module.
 * - propose: the manifest's `guarded` list applies. The default.
 * - act: nothing is held back. Every write still lands in core.write_log with
 *   its before value, so the Agent Log can undo it, and that is what makes this
 *   level safe rather than reckless.
 */
export function shouldGuard(args: {
  source: ToolContext['source']
  autonomy: Autonomy
  guarded: string[]
  tool: string
}): boolean {
  if (args.source === 'ui') return false
  if (args.autonomy === 'observe') return true
  if (args.autonomy === 'act') return false
  return args.guarded.includes(args.tool)
}

export type CallResult =
  | { status: 'done'; result: unknown }
  | { status: 'proposed'; proposalId: string }

/**
 * Run `<module>.<tool>`, or record what it would have done.
 *
 * Every agent path goes through this: the orchestrator in process and /api/mcp
 * over HTTP. A module tool is never reachable by an agent any other way, which
 * is what makes the guard a guarantee rather than a convention.
 */
export async function callTool(
  moduleId: string,
  toolName: string,
  input: unknown,
  ctx: ToolContext & {
    agent?: string
    reason?: string
    /** The run this call belongs to, so the Agent Log can group it. */
    runId?: string | null
    /**
     * The same tool call that would put this back. A caller that knows the
     * before values passes them; one that does not passes nothing, and the
     * entry shows no Undo rather than a button that cannot work.
     */
    revert?: Record<string, unknown> | null
    diff?: Diff[]
    /**
     * What the Review inbox calls this, in the words the owner would use.
     *
     * Without it a proposal is titled `module.tool`, which tells a reader which
     * function wanted to run and nothing about what it would do. The row is the
     * whole decision surface, so the title is not decoration.
     */
    title?: string
    /** 0 to 1, when the caller has a real one. Never invented here. */
    confidence?: number
    evidence?: string
    affects?: string
  },
): Promise<CallResult> {
  const manifest = getModule(moduleId)
  if (!manifest) throw new Error(`No module ${moduleId}`)

  // `query` is implemented once in core and exposed on every module, so a
  // module author never writes one. It reads as pos_readonly and is never
  // guarded: there is nothing to approve about a select.
  if (toolName === 'query') {
    const sql = (input as { sql?: unknown })?.sql
    if (typeof sql !== 'string') throw new Error('query takes { sql: string }')
    // Scoped to this module plus core. pos_readonly can read every module
    // schema, so without this `notes.query` would return the bank rows.
    const others = getModules()
      .map((m) => m.id)
      .filter((id) => id !== moduleId)
    return { status: 'done', result: await runQuery(sql, { forbiddenSchemas: others }) }
  }

  const tool = manifest.tools[toolName]
  if (!tool) throw new Error(`No tool ${moduleId}.${toolName}`)

  const autonomy = await getSetting('agent_autonomy')
  const guarded = manifest.guarded ?? []

  if (shouldGuard({ source: ctx.source, autonomy, guarded, tool: toolName })) {
    // Validate before storing: a proposal the owner approves must be one the
    // tool will actually accept, or approval fails later for a reason they
    // cannot see.
    const parsed = tool.input.parse(input)

    const id = await propose({
      module: moduleId,
      tool: toolName,
      payload: parsed as Record<string, unknown>,
      agent: ctx.agent ?? 'agent',
      reason: ctx.reason ?? `${moduleId}.${toolName} proposed a write.`,
      guarded: guarded.includes(toolName),
      // Everything the caller knows about why, carried through. A proposal the
      // owner cannot read is one they cannot decide, and the same diff that
      // makes the Agent Log's Undo legible makes this row legible.
      title: ctx.title,
      confidence: ctx.confidence,
      evidence: ctx.evidence,
      affects: ctx.affects,
      // The write log carries a diff of unknowns and the proposal renders
      // strings, which is the same conversion the Agent Log does before it
      // hands a row to DiffRow. Done here so a caller passes one shape.
      diff: ctx.diff?.map((d) => ({
        field: d.field,
        before: d.before === null || d.before === undefined ? null : String(d.before),
        after: d.after === null || d.after === undefined ? null : String(d.after),
      })),
    })
    return { status: 'proposed', proposalId: id }
  }

  const result = await tool.run(input, { source: ctx.source })

  // Every tool but get_digest is a write by contract (query returned above),
  // and a write changes the module's numbers, so the digest is recomputed here
  // and the dashboard tile reads it on the next render. Synchronous because
  // this also runs from the cron and MCP, where there is no request to defer
  // into. A digest that fails to compute is logged, never a failed write.
  if (toolName !== 'get_digest') {
    try {
      await writeDigest(manifest)
    } catch (err) {
      console.error(`${moduleId}.get_digest failed after ${toolName}:`, err)
    }
  }

  // An agent write is logged with what it would take to reverse it, which is
  // what makes Undo on the Agent Log real. A UI write is not: undo for one of
  // those is the edit form the owner already has open.
  if (ctx.source !== 'ui') {
    await logWrite({
      runId: ctx.runId,
      module: moduleId,
      tool: toolName,
      kind: toolName,
      title: `${manifest.nav.label}: ${toolName}`,
      reason: ctx.reason ?? `${moduleId}.${toolName} ran unguarded at the current autonomy level.`,
      actor: ctx.agent ?? 'agent',
      applyPayload: input as Record<string, unknown>,
      revertPayload: ctx.revert ?? null,
      diff: ctx.diff,
    })
  }

  return { status: 'done', result }
}
