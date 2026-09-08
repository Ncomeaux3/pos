import { getModule, type ToolContext } from './modules'
import { propose } from './proposals'
import { getSetting } from './settings'

// The one place a tool call is decided. The UI calls tools directly; agents and
// the orchestrator come through here, and this is what stands between them and
// the owner's data.

export type Autonomy = 'observe' | 'propose' | 'act'

export const AUTONOMY_LABELS: Record<Autonomy, string> = {
  observe: 'Observe only',
  propose: 'Propose, I approve',
  act: 'Act, then tell me',
}

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
  ctx: ToolContext & { agent?: string; reason?: string },
): Promise<CallResult> {
  const manifest = getModule(moduleId)
  if (!manifest) throw new Error(`No module ${moduleId}`)

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
    })
    return { status: 'proposed', proposalId: id }
  }

  return { status: 'done', result: await tool.run(input, { source: ctx.source }) }
}
