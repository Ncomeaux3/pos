import Link from 'next/link'
import {
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  HeatStrip,
  PaceBar,
  Row,
  RowList,
} from '@/components/pos'
import { db } from '@/core/db'
import { Bento, ArrangeToggle, type Tile } from './Bento'
import { JobRows, SevenDays } from './DashboardTiles'
import { ProposalList, WarningList } from './Inbox'
import { getModules } from '@/core/modules'
import { upcoming } from '@/core/review-registry'
import { headlineSegments, jobStates, latestSummary } from '@/core/orchestrator'
import { getSettings } from '@/core/settings'
import { dayIn, ownerToday } from '@/core/today'
import { RunNow } from './RunNow'

// The bento. Every tile reads core, never a module's own tables: module numbers
// arrive through their digests, which is what keeps this page ignorant of all
// of them and stops it breaking when one is deleted.

/**
 * What is coming in the next seven days.
 *
 * Composed from what each module says is upcoming, which is the same list the
 * Weekly Review picks next week's three from. Core reads no module schema to
 * build it and a module that dates nothing simply never appears on the strip.
 */
async function nextSevenDays(
  todayIso: string,
): Promise<{ id: string; title: string; meta: string; at: string; module: string }[]> {
  const week = new Date(`${todayIso}T12:00:00`)
  week.setDate(week.getDate() + 7)
  const until = week.toISOString().slice(0, 10)

  return (await upcoming())
    .flatMap((c) => c.items.map((i) => ({ ...i, module: c.module })))
    .flatMap((i) => (i.at && i.at >= todayIso && i.at < until ? [{ ...i, at: i.at }] : []))
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 6)
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

/** This month's model spend, by what it was spent on. */
async function spendByPurpose(): Promise<{ purpose: string; calls: number; cents: number }[]> {
  const { rows } = await db().query<{ purpose: string; calls: string; cents: string }>(
    `select purpose, count(*)::text as calls, sum(cost_cents)::text as cents
       from core.llm_calls
      where occurred_at >= date_trunc('month', now())
      group by purpose
      order by sum(cost_cents) desc
      limit 4`,
  )
  return rows.map((r) => ({ purpose: r.purpose, calls: Number(r.calls), cents: Number(r.cents) }))
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
const ago = (at: Date) => {
  const mins = Math.round((Date.now() - new Date(at).getTime()) / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

export default async function DashboardPage() {
  // The owner's date, not the server's: on Vercel those differ all evening.
  // Two forms of it, and they are not interchangeable. `todayIso` is what
  // dates are compared against; `today` is the label in the band.
  const settings = await getSettings()
  const todayIso = await ownerToday()
  const today = dayIn(new Date(), settings.timezone)

  const [latest, jobs, diary, warnings, proposals, spend] = await Promise.all([
    latestSummary(),
    jobStates(),
    nextSevenDays(todayIso),
    unreadWarnings(),
    pendingProposals(),
    spendByPurpose(),
  ])

  const summary = latest?.summary
  const segments = summary ? headlineSegments(summary) : []
  const failed = jobs.filter((j) => j.status === 'failed')
  const spendCents = summary?.spendCents ?? 0
  const capCents = summary?.capCents ?? settings.llm_soft_cap_cents


  // The artboard's order: what needs you, what is proposed, what is coming,
  // then the modules, then the machine. Everything after that is whatever this
  // device was dragged into.
  const tiles: Tile[] = [
    {
      id: 'warnings',
      node: (
        <Card className="flex h-full flex-col gap-3">
          <CardHead
            label="Warnings"
            dot={warnings.length > 0 ? 'warn' : 'ok'}
            meta={`${warnings.length} unread`}
          />
          {warnings.length === 0 ? (
            <p className="grid flex-1 place-items-center text-[26px] font-light text-ink-3">
              0 warnings
            </p>
          ) : (
            <WarningList
              warnings={warnings.map((w) => ({
                id: w.id,
                title: w.title,
                sub: w.body,
                urgent: w.urgency === 'urgent',
              }))}
            />
          )}
        </Card>
      ),
    },
    {
      id: 'review',
      node: (
        <Card className="flex h-full flex-col gap-3">
          <CardHead label="Review · agent proposals" meta={`${proposals.length} pending`} />
          {proposals.length === 0 ? (
            <p className="grid flex-1 place-items-center text-[26px] font-light text-ink-3">
              inbox clear
            </p>
          ) : (
            <ProposalList
              proposals={proposals.map((p) => ({
                id: p.id,
                title: p.title ?? 'Proposal',
                from: p.agent ?? 'agent',
              }))}
            />
          )}
          <Link
            href="/review"
            className="label mt-auto text-[10px] tracking-[0.1em] text-ink-3 hover:text-ink"
          >
            Open review
          </Link>
        </Card>
      ),
    },
    {
      id: 'timeline',
      node: (
        <Card className="flex h-full flex-col gap-3">
          <CardHead label="Next 7 days" meta={`${diary.length} scheduled`} />
          <SevenDays
            today={todayIso}
            items={diary.map((d) => ({
              id: `${d.module}.${d.id}`,
              title: d.title,
              meta: d.meta,
              at: d.at,
              module: d.module,
            }))}
          />
        </Card>
      ),
    },

    // One tile per module that wrote a digest. A module is responsible for its
    // own numbers; this page only lays them out.
    ...(summary?.modules ?? []).map((m) => {
      const manifest = getModules().find((x) => x.id === m.module)
      const label = manifest?.nav.label ?? m.module
      const ModuleTile = manifest?.tile

      return {
        id: m.module,
        node: (
          <Card className="flex h-full flex-col gap-3">
            <CardHead label={label} meta={ModuleTile ? undefined : 'digest'} />
            {/* The module says how its own numbers read. Core only places the
              * result: it has no way to know what a finance payload holds, and
              * walking the object generically is what put "debt cents 231000"
              * on the dashboard. */}
            {ModuleTile ? (
              <ModuleTile payload={m.payload} />
            ) : (
              <GenericDigest payload={m.payload} />
            )}
            <Link
              href={`/${m.module}`}
              className="label mt-auto text-[10px] tracking-[0.1em] text-ink-3 hover:text-ink"
            >
              Open {label}
            </Link>
          </Card>
        ),
      }
    }),

    {
      id: 'jobs',
      node: (
        <Card className="flex h-full flex-col gap-3">
          <CardHead
            label="System"
            dot={failed.length > 0 ? 'bad' : 'ok'}
            meta={`${jobs.length} jobs`}
          />
          <HeatStrip cells={jobs.map((j) => ({ label: `${j.module}.${j.name}`, status: j.status }))} />
          <JobRows
            jobs={jobs.map((j) => ({
              name: `${j.module}.${j.name}`,
              status: j.status,
              at: j.lastRun ? new Date(j.lastRun).toISOString() : null,
            }))}
            timezone={settings.timezone}
          />
        </Card>
      ),
    },
    {
      id: 'llm',
      node: (
        <Card className="flex h-full flex-col gap-3">
          <CardHead label="Model spend · month" meta={`cap ${money(capCents)}`} />
          <div className="flex items-baseline gap-2.5">
            <span className="num text-[30px] font-light leading-none text-ink">
              {money(spendCents)}
            </span>
            <span className="num text-[11px] text-ink-3">
              {capCents > 0 ? `${Math.round((spendCents / capCents) * 100)}% of cap` : 'no cap set'}
            </span>
          </div>
          <PaceBar
            value={spendCents}
            max={capCents}
            tone={spendCents >= capCents ? 'bad' : spendCents > capCents * 0.8 ? 'warn' : 'brand'}
          />
          {spend.length === 0 ? (
            <p className="t-caption text-ink-3">
              Nothing has been spent this month. Past the cap, research runs are refused and logged.
            </p>
          ) : (
            <div className="flex flex-col">
              {spend.map((row) => (
                <div
                  key={row.purpose}
                  className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-rule py-[7px] text-[12px]"
                >
                  <span className="truncate text-ink-2">{row.purpose}</span>
                  <span className="num text-[11px] text-ink-3">{row.calls}</span>
                  <span className="num text-[11px] text-ink">{money(row.cents)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      ),
    },
  ]

  return (
    <div className="space-y-7">
      {/* Two bands, as the design has it: a thin breadcrumb row with the
        * actions, then the summary as the page's opening statement. The two
        * were merged into one PageHeader, which made the headline a title and
        * shrank it to a title's size. */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-3">
        <span className="eyebrow shrink-0 whitespace-nowrap text-ink-3">
          Dashboard <span className="text-ink-4">/</span> {today}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-4">
          {/* A GET form, so search from the dashboard needs no javascript and
              lands on the same screen the palette does. */}
          <form action="/search" className="min-w-[220px] max-w-[320px] flex-1">
            <input
              type="search"
              name="q"
              aria-label="Search everything"
              placeholder="Search everything"
              className="h-[34px] w-full border border-rule-2 bg-transparent px-3 text-[13px] text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand"
            />
          </form>
          <ArrangeToggle />
          <RunNow />
        </div>
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
          * first thing on the page and reads as a sentence, not a heading, and
          * the parts of it that name something you can open are links, which
          * is the artboard's one piece of colour in the sentence. */}
        <h1 className="max-w-[920px] text-pretty text-[clamp(22px,2.2vw,30px)] font-normal leading-[1.25] tracking-[-0.03em] text-ink">
          {segments.length > 0
            ? segments.map((s, i) =>
                s.href ? (
                  <Link
                    key={i}
                    href={s.href}
                    className="underline decoration-brand decoration-1 underline-offset-4 hover:text-brand"
                  >
                    {s.text}
                  </Link>
                ) : (
                  <span key={i}>{s.text}</span>
                ),
              )
            : (latest?.headline ?? 'Nothing has run yet.')}
        </h1>
        <p className="t-caption text-ink-3">
          {latest
            ? 'Written from module digests only. Raw data is touched when you ask a direct question.'
            : 'Press Run now, or wait for the nightly cron.'}
        </p>
      </section>

      <Bento tiles={tiles} />

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
