import { db } from './db'
import { getModules } from './modules'

// Every module writes one digest a night. The orchestrator reads digests only,
// never a module's own tables, which is what keeps it from having to know
// anything about any of them.

export type Digest = { module: string; runAt: Date; payload: Record<string, unknown> }

/** Runs every module's get_digest and stores the result. */
export async function writeDigests(): Promise<{ written: string[] }> {
  const written: string[] = []

  for (const manifest of getModules()) {
    const tool = manifest.tools.get_digest
    // The contract says every module ships one, but a half-built module in a
    // fork should not take the whole run down.
    if (!tool) continue

    const payload = await tool.run({}, { source: 'agent' })
    await db().query(
      `insert into core.digests (module, payload) values ($1, $2::jsonb)`,
      [manifest.id, JSON.stringify(payload ?? {})],
    )
    written.push(manifest.id)
  }

  return { written }
}

/**
 * The latest digest per module.
 *
 * This is also the cross-module read mechanism: a screen that needs a number
 * another module owns reads it from here rather than reaching into that
 * module's schema. Health's insurance deductible and Home's mortgage balance
 * both arrive this way.
 */
export async function latestDigests(): Promise<Digest[]> {
  const { rows } = await db().query<{ module: string; run_at: Date; payload: Record<string, unknown> }>(
    `select distinct on (module) module, run_at, payload
       from core.digests
      order by module, run_at desc`,
  )
  return rows.map((r) => ({ module: r.module, runAt: r.run_at, payload: r.payload }))
}

export async function getDigest(module: string): Promise<Record<string, unknown> | null> {
  const { rows } = await db().query<{ payload: Record<string, unknown> }>(
    `select payload from core.digests where module = $1 order by run_at desc limit 1`,
    [module],
  )
  return rows[0]?.payload ?? null
}
