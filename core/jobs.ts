import { db } from './db'
import { getModules } from './modules'

// The nightly run. One cron hits /api/cron/nightly, this is what happens.
//
// The rule that matters: one job failing never stops the rest. A bank sync that
// cannot reach its provider must not cost you the digest, so every job is
// wrapped, its failure recorded, and the run continues.

export type JobResult = {
  module: string
  name: string
  status: 'ok' | 'failed'
  durationMs: number
  detail?: string
}

export type RunSummary = {
  runId: string
  status: 'clean' | 'partial' | 'failed'
  durationMs: number
  jobs: JobResult[]
}

/** Opens the run row the Agent Log groups by. */
async function startRun(trigger: string): Promise<string> {
  const { rows } = await db().query<{ id: string }>(
    `insert into core.job_runs (trigger_source, status) values ($1, 'running') returning id`,
    [trigger],
  )
  return rows[0].id
}

async function finishRun(runId: string, summary: Omit<RunSummary, 'runId'>): Promise<void> {
  await db().query(
    `update core.job_runs
        set status = $2, finished_at = now(), duration_ms = $3, log = $4::jsonb
      where id = $1`,
    [runId, summary.status, summary.durationMs, JSON.stringify({ jobs: summary.jobs })],
  )
}

/**
 * Runs one job and records it, whatever happens.
 *
 * `core.jobs` holds the current state of each named job, which is what the
 * dashboard's system tile and the Settings nightly card read. The run row holds
 * the history.
 */
export async function runJob(
  module: string,
  name: string,
  run: () => Promise<unknown>,
): Promise<JobResult> {
  const started = Date.now()

  await db().query(
    `insert into core.jobs (module, name, last_run, last_status)
     values ($1, $2, now(), 'running')
     on conflict (module, name) do update set last_run = now(), last_status = 'running'`,
    [module, name],
  )

  try {
    const output = await run()
    const durationMs = Date.now() - started

    await db().query(
      `update core.jobs
          set last_status = 'ok', log = $3::jsonb
        where module = $1 and name = $2`,
      [module, name, JSON.stringify({ durationMs, output: output ?? null })],
    )

    return { module, name, status: 'ok', durationMs }
  } catch (error) {
    const durationMs = Date.now() - started
    const detail = error instanceof Error ? error.message : 'unknown failure'

    // Recorded, not thrown. The next job still runs, and the failure shows up
    // on the dashboard and in the morning email.
    await db().query(
      `update core.jobs
          set last_status = 'failed', log = $3::jsonb
        where module = $1 and name = $2`,
      [module, name, JSON.stringify({ durationMs, error: detail })],
    )

    return { module, name, status: 'failed', durationMs, detail }
  }
}

export type NightlyOptions = {
  trigger?: string
  /** Run one module's jobs only. What Retry now on the Agent Log uses. */
  module?: string
}

/**
 * The order is the one in ARCHITECTURE: refresh credentials, module jobs,
 * embed, digests, orchestrate, notify, prune. Each stage is a job like any
 * other, so a failure in any of them is recorded rather than fatal.
 */
export async function runNightly(opts: NightlyOptions = {}): Promise<RunSummary> {
  const started = Date.now()
  const trigger = opts.trigger ?? 'cron'
  const runId = await startRun(trigger)
  const jobs: JobResult[] = []

  const only = opts.module
  const modules = getModules().filter((m) => !only || m.id === only)

  // Imported here rather than at the top so a module job that never touches
  // search or mail does not pull those in when this file is loaded.
  const { embedChanged } = await import('./search')
  const { writeDigests } = await import('./digests')
  const { assembleSummary } = await import('./orchestrator')
  const { sendPending } = await import('./notify')

  for (const manifest of modules) {
    for (const job of manifest.jobs ?? []) {
      jobs.push(await runJob(manifest.id, job.name, job.run))
    }
  }

  if (!only) {
    jobs.push(await runJob('core', 'embed', () => embedChanged()))
    jobs.push(await runJob('core', 'digests', () => writeDigests()))
    jobs.push(await runJob('core', 'orchestrate', () => assembleSummary()))
    // Run now recomputes the dashboard; it does not mail you. The cron is the
    // one thing that sends, which is what makes "one email a day" true rather
    // than aspirational: every press used to be a digest, and on 2026-09-15 six
    // presses in two minutes were six emails. Nothing is lost by holding them.
    // The rows stay queued and go out on the next nightly run.
    if (trigger !== 'manual') {
      jobs.push(await runJob('core', 'notify', () => sendPending()))
    }
    jobs.push(await runJob('core', 'prune', pruneRequestLog))
  }

  const failures = jobs.filter((j) => j.status === 'failed').length
  const status: RunSummary['status'] =
    failures === 0 ? 'clean' : failures === jobs.length ? 'failed' : 'partial'

  const durationMs = Date.now() - started
  await finishRun(runId, { status, durationMs, jobs })

  return { runId, status, durationMs, jobs }
}

/** 90 days, per the architecture. Keeps the table from growing without bound. */
export async function pruneRequestLog(): Promise<{ deleted: number }> {
  const { rowCount } = await db().query(
    `delete from core.request_log where occurred_at < now() - interval '90 days'`,
  )
  return { deleted: rowCount ?? 0 }
}
