import Link from 'next/link'
import {
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  HeatStrip,
  PaceBar,
  Radar,
  Row,
  RowList,
  StatusChip,
  type RadarAxis,
} from '@/components/pos'
import { db } from '@/core/db'
import { getModules } from '@/core/modules'
import { jobStates, latestSummary } from '@/core/orchestrator'
import { getDigest } from '@/core/digests'
import { getSettings } from '@/core/settings'
import { dayIn } from '@/core/today'
import { RunNow } from './RunNow'

// The bento. Every tile reads core, never a module's own tables: module numbers
// arrive through their digests, which is what keeps this page ignorant of all
// of them and stops it breaking when one is deleted.

async function skillAxes(): Promise<RadarAxis[]> {
  // Through the digest, not skills.xp. The skills schema belongs to a module
  // and this page reads none of them directly; an uninstalled Skill Tree gives
  // an empty radar rather than a missing relation.
  const digest = (await getDigest('skills')) as {
    attributes?: { name: string; level: number }[]
  } | null

  return (digest?.attributes ?? []).slice(0, 6).map((a) => ({ label: a.name, value: a.level }))
}

async function unreadWarnings() {
  const { rows } = await db().query<{ id: string; title: string; body: string; urgency: string }>(
    `select id, title, body, urgency from core.notifications
      where read_at is null order by (urgency = 'urgent') desc, due_at desc limit 4`,
  )
  return rows
}

async function pendingProposals() {
  const { rows } = await db().query<{ id: string; title: string | null; agent: string | null }>(
    `select id, title, agent from core.proposals
      where status = 'pending' and (dismissed_until is null or dismissed_until < now())
      order by created_at desc limit 4`,
  )
  return rows
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
const ago = (at: Date) => {
  const mins = Math.round((Date.now() - new Date(at).getTime()) / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

export default async function DashboardPage() {
  const [latest, jobs, axes, warnings, proposals, settings] = await Promise.all([
    latestSummary(),
    jobStates(),
    skillAxes(),
    unreadWarnings(),
    pendingProposals(),
    getSettings(),
  ])

  const summary = latest?.summary
  const failed = jobs.filter((j) => j.status === 'failed')
  const spendCents = summary?.spendCents ?? 0
  // The owner's date, not the server's: on Vercel those differ all evening.
  const today = dayIn(new Date(), settings.timezone)
  const capCents = summary?.capCents ?? settings.llm_soft_cap_cents

  return (
    <div className="space-y-7">
      {/* Two bands, as the design has it: a thin breadcrumb row with the
        * actions, then the summary as the page's opening statement. The two
        * were merged into one PageHeader, which made the headline a title and
        * shrank it to a title's size. */}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-rule pb-3">
        <span className="eyebrow text-ink-3">Dashboard / {today}</span>
        <RunNow />
      </header>

      <section className="space-y-2">
        <span className="eyebrow text-ink-3">
          <span
            className="status-dot"
            data-tone={failed.length > 0 ? 'bad' : latest ? 'ok' : 'idle'}
            aria-hidden="true"
          />
          {latest
            ? `Nightly summary · last run ${ago(latest.runAt)} · ${failed.length > 0 ? `${failed.length} failed` : 'ok'}`
            : 'No run yet'}
        </span>
        {/* The opening statement, at the size the design gives it. It is the
          * first thing on the page and reads as a sentence, not a heading. */}
        <h1 className="max-w-[46ch] text-[clamp(22px,2.6vw,34px)] font-light leading-[1.25] tracking-[-0.02em] text-ink">
          {latest?.headline ?? 'Nothing has run yet.'}
        </h1>
        <p className="t-caption text-ink-3">
          {latest
            ? 'Written from module digests only. Raw data is touched when you ask a direct question.'
            : 'Press Run now, or wait for the nightly cron.'}
        </p>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card className="space-y-3">
          <CardHead
            label="Warnings"
            dot={warnings.length > 0 ? 'warn' : 'ok'}
            meta={`${warnings.length} unread`}
          />
          {warnings.length === 0 ? (
            <p className="t-caption text-ink-3">Nothing needs you today.</p>
          ) : (
            <RowList>
              {warnings.map((w) => (
                <Row
                  key={w.id}
                  title={w.title}
                  right={
                    w.urgency === 'urgent' ? <StatusChip tone="bad">Urgent</StatusChip> : undefined
                  }
                />
              ))}
            </RowList>
          )}
        </Card>

        <Card className="space-y-3">
          <CardHead label="Review" meta={`${proposals.length} pending`} />
          {proposals.length === 0 ? (
            <p className="t-caption text-ink-3">Inbox clear.</p>
          ) : (
            <RowList>
              {proposals.map((p) => (
                <Row key={p.id} title={p.title ?? 'Proposal'} meta={p.agent ?? undefined} />
              ))}
            </RowList>
          )}
          <Link href="/review" className="label text-[10px] tracking-[0.1em] text-ink-3 hover:text-ink">
            Open review
          </Link>
        </Card>

        <Card className="space-y-3">
          <CardHead label="Model spend" meta="this month" />
          <p className="num text-[30px] font-light leading-none text-ink">{money(spendCents)}</p>
          <PaceBar
            value={spendCents}
            max={capCents}
            tone={spendCents >= capCents ? 'bad' : spendCents > capCents * 0.8 ? 'warn' : 'brand'}
          />
          <p className="t-caption text-ink-3">
            of {money(capCents)} cap. Past it, research runs are refused and logged.
          </p>
        </Card>

        <Card className="space-y-3">
          <CardHead
            label="System"
            dot={failed.length > 0 ? 'bad' : 'ok'}
            meta={`${jobs.length} jobs`}
          />
          <HeatStrip cells={jobs.map((j) => ({ label: `${j.module}.${j.name}`, status: j.status }))} />
          {failed.length > 0 ? (
            <RowList>
              {failed.map((j) => (
                <Row
                  key={`${j.module}.${j.name}`}
                  title={`${j.module}.${j.name}`}
                  right={<StatusChip tone="bad">Failed</StatusChip>}
                />
              ))}
            </RowList>
          ) : (
            <p className="t-caption text-ink-3">
              Every job clean. Next run 09:00 UTC.
            </p>
          )}
        </Card>

        <Card className="space-y-3">
          <CardHead label="Skill tree" meta={axes.length > 0 ? `${axes.length} tracked` : 'no xp yet'} />
          {axes.length >= 3 ? (
            <div className="flex justify-center">
              <Radar axes={axes} />
            </div>
          ) : (
            <p className="t-caption text-ink-3">
              XP arrives as entities are classified. The Skill Tree module renders the whole thing.
            </p>
          )}
        </Card>

        {/* One tile per module that wrote a digest. A module is responsible for
            its own numbers; this page only lays them out. */}
        {(summary?.modules ?? []).map((m) => {
          const manifest = getModules().find((x) => x.id === m.module)
          const label = manifest?.nav.label ?? m.module
          const Tile = manifest?.tile

          return (
            <Card key={m.module} className="space-y-3">
              <CardHead label={label} meta={Tile ? undefined : 'digest'} />
              {/* The module says how its own numbers read. Core only places
                * the result: it has no way to know what a finance payload
                * holds, and walking the object generically is what put
                * "debt cents 231000" on the dashboard. */}
              {Tile ? <Tile payload={m.payload} /> : <GenericDigest payload={m.payload} />}
              <Link
                href={`/${m.module}`}
                className="label text-[10px] tracking-[0.1em] text-ink-3 hover:text-ink"
              >
                Open {label}
              </Link>
            </Card>
          )
        })}
      </div>

      {!latest && (
        <EmptyState headline="No run yet">
          The orchestrator writes core.dashboard_summary on the nightly run. Press Run now to do it
          straight away.
        </EmptyState>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>Alerts</Eyebrow>
        {(summary?.alerts ?? []).length === 0 ? (
          <Chip tone="ok">Nothing outstanding</Chip>
        ) : (
          (summary?.alerts ?? []).map((a) => (
            <Chip key={a.title} tone={a.tone === 'bad' ? 'bad' : 'warn'}>
              {a.title}
            </Chip>
          ))
        )}
      </div>
    </div>
  )
}

/**
 * The fallback for a module that supplies no tile.
 *
 * Still generic, because core cannot be otherwise, but no longer raw: a key
 * becomes words rather than a column name, and a value that is plainly cents
 * becomes money. A module that wants better than this supplies a `tile`.
 */
function GenericDigest({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload)
    .filter((e): e is [string, number | string] => {
      const v = e[1]
      return typeof v === 'number' || typeof v === 'string'
    })
    .slice(0, 4)

  if (entries.length === 0) {
    return <p className="t-caption text-ink-3">This module wrote no numbers last night.</p>
  }

  return (
    <RowList>
      {entries.map(([key, value]) => (
        <Row
          key={key}
          title={readableKey(key)}
          right={<span className="num text-sm text-ink">{readableValue(key, value)}</span>}
        />
      ))}
    </RowList>
  )
}

/** "debtCents" and "debt_cents" both become "Debt". */
function readableKey(key: string): string {
  const words = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\bcents\b/g, '')
    .trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * A key ending in `cents` is money, which is the one convention core is
 * allowed to know: it is written down in CLAUDE.md as a repo-wide rule, not
 * as a fact about any one module.
 */
function readableValue(key: string, value: number | string): string {
  if (typeof value === 'number' && /cents$/i.test(key)) {
    return `$${(value / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }
  return typeof value === 'number' ? value.toLocaleString() : String(value)
}
