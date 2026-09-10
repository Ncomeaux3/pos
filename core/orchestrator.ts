import { db } from './db'
import { latestDigests } from './digests'
import { getModules } from './modules'

// Assembles the dashboard from digests and nothing else. It never reads a
// module's own tables, which is what lets it stay ignorant of all of them.
//
// The summary is built by rules. Only the one sentence at the top is written by
// a model, and if that call fails the summary still stands.

export type Alert = { title: string; detail?: string; tone: 'bad' | 'warn' | 'ok' }

export type Summary = {
  alerts: Alert[]
  failedJobs: { module: string; name: string }[]
  pendingProposals: number
  unreadNotifications: number
  spendCents: number
  capCents: number
  modules: { module: string; payload: Record<string, unknown> }[]
}

async function failedJobs(): Promise<Summary['failedJobs']> {
  const { rows } = await db().query<{ module: string; name: string }>(
    `select module, name from core.jobs where last_status = 'failed' order by module, name`,
  )
  return rows
}

async function counts(): Promise<{ proposals: number; unread: number }> {
  const { rows } = await db().query<{ proposals: string; unread: string }>(
    `select
       (select count(*) from core.proposals
         where status = 'pending'
           and (dismissed_until is null or dismissed_until < now()))::text as proposals,
       (select count(*) from core.notifications where read_at is null)::text as unread`,
  )
  return { proposals: Number(rows[0].proposals), unread: Number(rows[0].unread) }
}

async function spend(): Promise<{ spendCents: number; capCents: number }> {
  const { getSetting } = await import('./settings')
  const { rows } = await db().query<{ cents: string }>(
    `select coalesce(sum(cost_cents), 0)::text as cents
       from core.llm_calls where occurred_at >= date_trunc('month', now())`,
  )
  return { spendCents: Number(rows[0].cents), capCents: await getSetting('llm_soft_cap_cents') }
}

/**
 * The rules half. Deterministic, cheap, and the part that has to be right: a
 * failed job and a proposal waiting are facts, not judgements.
 */
export async function buildSummary(): Promise<Summary> {
  const [digests, failed, { proposals, unread }, { spendCents, capCents }] = await Promise.all([
    latestDigests(),
    failedJobs(),
    counts(),
    spend(),
  ])

  const alerts: Alert[] = []

  for (const job of failed) {
    alerts.push({
      title: `${job.module}.${job.name} failed`,
      detail: 'Check the Agent Log and retry it.',
      tone: 'bad',
    })
  }

  if (spendCents > capCents && capCents > 0) {
    alerts.push({
      title: 'Model spend is past the cap',
      detail: `$${(spendCents / 100).toFixed(2)} against $${(capCents / 100).toFixed(2)}. Research runs are refused until next month.`,
      tone: 'warn',
    })
  }

  if (proposals > 0) {
    alerts.push({
      title: `${proposals} ${proposals === 1 ? 'proposal is' : 'proposals are'} waiting`,
      detail: 'Nothing was written. Review decides.',
      tone: 'warn',
    })
  }

  return {
    alerts,
    failedJobs: failed,
    pendingProposals: proposals,
    unreadNotifications: unread,
    spendCents,
    capCents,
    modules: digests.map((d) => ({ module: d.module, payload: d.payload })),
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * The one sentence at the top, built from the summary.
 *
 * This was a Haiku call. It is a template now, for two reasons that both beat
 * the prose: it cannot invent a number on the most read sentence in the app,
 * and it costs nothing, so it works with no provider connected and never
 * counts against the spend cap.
 *
 * Returns null when there is nothing worth a sentence. A dashboard with no
 * headline is a quiet night, which is the correct output.
 */
export function writeHeadline(summary: Summary): string | null {
  const segments = headlineSegments(summary)
  return segments.length === 0 ? null : segments.map((s) => s.text).join('')
}

/** A run of the headline, with where it points when it points anywhere. */
export type HeadlineSegment = { text: string; href?: string }

/**
 * The headline in pieces, so the dashboard can link the parts of the sentence
 * that name something you can go and look at.
 *
 * The artboard underlines those runs in accent and leaves the joining words
 * alone, which is why the separators are segments of their own rather than
 * something the caller has to reconstruct. `writeHeadline` joins them back
 * into the plain string that goes in the database and the email.
 */
export function headlineSegments(summary: Summary): HeadlineSegment[] {
  const parts: HeadlineSegment[] = []

  const bad = summary.alerts.filter((a) => a.tone === 'bad').length
  const other = summary.alerts.length - bad
  if (bad > 0) {
    parts.push({ text: `${plural(bad, 'thing')} needing attention`, href: '/notifications' })
  }
  if (other > 0) parts.push({ text: plural(other, 'warning'), href: '/notifications' })
  if (summary.failedJobs.length > 0) {
    parts.push({ text: plural(summary.failedJobs.length, 'failed job'), href: '/agent-log' })
  }
  if (summary.pendingProposals > 0) {
    parts.push({ text: `${plural(summary.pendingProposals, 'proposal')} waiting`, href: '/review' })
  }

  if (parts.length === 0) return []

  const out: HeadlineSegment[] = []
  parts.forEach((part, i) => {
    if (i > 0) out.push({ text: i === parts.length - 1 ? ' and ' : ', ' })
    out.push({ ...part, text: i === 0 ? capitalise(part.text) : part.text })
  })
  out.push({ text: '.' })

  // The cap is the one number worth naming unprompted: it is the only thing
  // here that stops working when it is reached.
  if (summary.capCents > 0 && summary.spendCents >= summary.capCents) {
    out.push(
      { text: ' Model spend has reached the ' },
      { text: `${(summary.capCents / 100).toFixed(2)} cap`, href: '/settings' },
      { text: ', so research is paused.' },
    )
  }

  return out
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Writes one core.dashboard_summary row and queues at most one notification.
 *
 * One, not one per alert: the sender bundles anyway, and queueing per alert
 * would make the unread count on the warnings tile grow by however many things
 * happened to be wrong rather than by how many nights have passed.
 *
 * A night with nothing wrong queues nothing. Silence is the correct output.
 */
export async function assembleSummary(): Promise<{ headline: string | null; queued: boolean }> {
  const summary = await buildSummary()
  const headline = writeHeadline(summary)

  await db().query(
    `insert into core.dashboard_summary (summary, headline) values ($1::jsonb, $2)`,
    [JSON.stringify(summary), headline],
  )

  if (summary.alerts.length === 0) return { headline, queued: false }

  const { queue } = await import('./notify')
  const worst = summary.alerts.find((a) => a.tone === 'bad') ?? summary.alerts[0]

  // A digest that has not been sent or read yet is superseded by this one
  // rather than stacked beside it. Without this, pressing Run now four times
  // puts four near-identical warnings on the dashboard, and a week of unread
  // nights would bury whatever is actually new.
  //
  // Sent ones stay: those are history. Module alerts use the default channel
  // and are never touched by this.
  await db().query(
    `delete from core.notifications
      where channel = 'digest' and sent_at is null and read_at is null`,
  )

  await queue({
    channel: 'digest',
    title: headline ?? worst.title,
    body: summary.alerts.map((a) => `${a.title}${a.detail ? `. ${a.detail}` : ''}`).join('\n'),
    urgency: summary.alerts.some((a) => a.tone === 'bad') ? 'urgent' : 'normal',
  })

  return { headline, queued: true }
}

export async function getDashboardHeadline(): Promise<string | null> {
  const { rows } = await db().query<{ headline: string | null }>(
    `select headline from core.dashboard_summary order by run_at desc limit 1`,
  )
  return rows[0]?.headline ?? null
}

export type LatestSummary = {
  runAt: Date
  headline: string | null
  summary: Summary
  notifiedAt: Date | null
} | null

export async function latestSummary(): Promise<LatestSummary> {
  const { rows } = await db().query<{
    run_at: Date
    headline: string | null
    summary: Summary
    notified_at: Date | null
  }>(
    `select run_at, headline, summary, notified_at
       from core.dashboard_summary order by run_at desc limit 1`,
  )
  if (rows.length === 0) return null
  return {
    runAt: rows[0].run_at,
    headline: rows[0].headline,
    summary: rows[0].summary,
    notifiedAt: rows[0].notified_at,
  }
}

/** Every job the system knows about, for the dashboard's system tile. */
export async function jobStates(): Promise<
  { module: string; name: string; status: string | null; lastRun: Date | null }[]
> {
  const { rows } = await db().query<{
    module: string
    name: string
    last_status: string | null
    last_run: Date | null
  }>(`select module, name, last_status, last_run from core.jobs order by module, name`)

  // A module whose jobs have never run still belongs on the tile, greyed.
  const known = new Set(rows.map((r) => `${r.module}.${r.name}`))
  const expected = getModules().flatMap((m) =>
    (m.jobs ?? []).map((j) => ({ module: m.id, name: j.name })),
  )

  return [
    ...rows.map((r) => ({
      module: r.module,
      name: r.name,
      status: r.last_status,
      lastRun: r.last_run,
    })),
    ...expected
      .filter((e) => !known.has(`${e.module}.${e.name}`))
      .map((e) => ({ ...e, status: null, lastRun: null })),
  ]
}
