import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  BandSearch,
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  HeatStrip,
  PaceBar,
  Row,
  RowList,
  SearchButton,
} from '@/components/pos'
import { db } from '@/core/db'
import { Bento, ArrangeToggle, type Tile } from './Bento'
import { JobRows, SevenDays } from './DashboardTiles'
import { ProposalList, WarningList } from './Inbox'
import { getModules } from '@/core/modules'
import { getNav, getOffRailNav } from '@/core/nav'
import { upcoming } from '@/core/review-registry'
import { headlineSegments, jobStates, latestSummary } from '@/core/orchestrator'
import { getSettings } from '@/core/settings'
import { clockIn, ownerToday } from '@/core/today'
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

/**
 * The artboard's default order, POS Dashboard.dc.html line 194. Everything
 * else that wrote a digest follows in rail order; a device's own arrangement
 * still wins over both once it has one.
 */
const ORDER = ['warnings', 'finance', 'tasks', 'review', 'goals', 'skills', 'jobs', 'llm', 'timeline']

/** The tile's border is the quiet rule, not rule-2; module tiles lift on hover. */
const tileClass = 'flex h-full flex-col gap-3 border-rule'

export default async function DashboardPage() {
  // The owner's date, not the server's: on Vercel those differ all evening.
  // Two forms of it, and they are not interchangeable. `todayIso` is what
  // dates are compared against; `today` is the label in the band.
  const settings = await getSettings()
  const todayIso = await ownerToday()
  // "Fri Sep 11", the artboard's band date, in the owner's zone.
  const today = new Intl.DateTimeFormat('en-US', {
    timeZone: settings.timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
    .format(new Date())
    .replace(',', '')

  const [latest, jobs, diary, warnings, proposals, spend, nav, offRail] = await Promise.all([
    latestSummary(),
    jobStates(),
    nextSevenDays(todayIso),
    unreadWarnings(),
    pendingProposals(),
    spendByPurpose(),
    getNav(),
    getOffRailNav(),
  ])
  const rail = [...nav, ...offRail].map((n) => n.href.slice(1))

  const summary = latest?.summary
  const segments = summary ? headlineSegments(summary, todayIso) : []
  const failed = jobs.filter((j) => j.status === 'failed')
  const spendCents = summary?.spendCents ?? 0
  const capCents = summary?.capCents ?? settings.llm_soft_cap_cents


  const unsorted: Tile[] = [
    {
      id: 'warnings',
      node: (
        <Card className={tileClass}>
          <CardHead
            label="Warnings"
            dot={warnings.length > 0 ? 'warn' : 'ok'}
            meta={`${warnings.length} open`}
            plainMeta
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
        <Card className={tileClass}>
          <CardHead label="Review · agent proposals" meta={`${proposals.length} pending →`} plainMeta />
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
        <Card className={tileClass}>
          <CardHead label="Next 7 days" meta={`${diary.length} scheduled`} plainMeta />
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
      const name = manifest?.nav.label ?? m.module
      const ModuleTile = manifest?.tile
      const head = manifest?.tileHead?.(m.payload) ?? {}
      const href = `/${m.module}`

      return {
        id: m.module,
        node: (
          <Card className={cn(tileClass, 'transition-colors duration-150 hover:border-rule-2')}>
            {/* The head is the way in, as the artboard has it: the name and
              * the line on the right both open the module. No footer link. */}
            <CardHead
              label={
                <Link href={href} aria-label={`Open ${name}`} className="hover:text-ink">
                  {head.label ?? name}
                </Link>
              }
              meta={
                head.meta ? (
                  <Link href={href} className="hover:text-ink">
                    {head.meta} →
                  </Link>
                ) : ModuleTile ? undefined : (
                  'digest'
                )
              }
              plainMeta
            />
            {/* The module says how its own numbers read. Core only places the
              * result: it has no way to know what a finance payload holds, and
              * walking the object generically is what put "debt cents 231000"
              * on the dashboard. */}
            {ModuleTile ? (
              <ModuleTile payload={m.payload} />
            ) : (
              <GenericDigest payload={m.payload} />
            )}
          </Card>
        ),
      }
    }),

    {
      id: 'jobs',
      node: (
        <Card className={tileClass}>
          <CardHead
            label="System"
            dot={failed.length > 0 ? 'bad' : 'ok'}
            meta={`${jobs.length} jobs`}
            plainMeta
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
        <Card className={tileClass}>
          <CardHead label="Model spend · month" meta={`cap ${money(capCents)} →`} plainMeta />
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

  // The artboard's nine first, in its order, then the rest of the modules in
  // rail order. `unsorted` above is grouped by kind because that is how the
  // tiles are built, not how they are laid out.
  const position = (id: string) => {
    const fixed = ORDER.indexOf(id)
    if (fixed >= 0) return fixed
    const onRail = rail.indexOf(id)
    return ORDER.length + (onRail >= 0 ? onRail : rail.length)
  }
  const tiles = [...unsorted].sort((a, b) => position(a.id) - position(b.id))

  return (
    <div>
      {/* Two bands, as the design has it: a thin breadcrumb row with the
        * actions, then the summary as the page's opening statement. The two
        * were merged into one PageHeader, which made the headline a title and
        * shrank it to a title's size. */}
      {/* The band is 56px, full bleed, with the actions on the right: the
        * page's 28px padding is cancelled so the band's rule runs edge to edge
        * and its contents sit on the artboard's centre line. On a phone the
        * band wraps, so the height is a minimum there. */}
      <header className="-mx-[18px] -mt-[14px] flex min-h-14 flex-wrap items-center justify-between gap-4 border-b border-rule px-[18px] py-2 md:-mx-7 md:-mt-7 md:h-14 md:flex-nowrap md:px-7 md:py-0">
        <span className="eyebrow shrink-0 whitespace-nowrap text-ink-3">
          Dashboard <span className="text-ink-4">/</span> {today}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-4 md:flex-nowrap">
          {/* On a phone the artboard carries a 44px search icon in this band,
              not a field. Same destination either way: the palette. */}
          <SearchButton href="/search" className="md:hidden" />
          <BandSearch className="hidden min-w-[220px] flex-1 md:flex" />
          <ArrangeToggle />
          <RunNow />
        </div>
      </header>

      <section className="mt-[26px]">
        <span className="eyebrow text-ink-3">
          <span
            className="status-dot"
            data-tone={failed.length > 0 ? 'bad' : latest ? 'ok' : 'idle'}
            aria-hidden="true"
          />
          {/* The run's own clock, in the owner's zone, as the artboard writes
            * it: "Last run 04:02 CDT · ok". */}
          {latest
            ? `Nightly summary · Last run ${clockIn(new Date(latest.runAt), settings.timezone)} ${zoneAbbr(settings.timezone)} · ${failed.length > 0 ? `${failed.length} failed` : 'ok'}`
            : 'No run yet'}
        </span>
        {/* The opening statement, at the size the design gives it. It is the
          * first thing on the page and reads as a sentence, not a heading, and
          * the parts of it that name something you can open are links, which
          * is the artboard's one piece of colour in the sentence. */}
        <h1 className="mt-3 max-w-[920px] text-pretty text-[clamp(22px,2.2vw,30px)] font-normal leading-[1.25] tracking-[-0.03em] text-ink">
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
        {/* Hidden on a phone, as everywhere else: none of the four phone
          * artboards puts a paragraph under its opening line. */}
        <p className="mt-2 hidden text-[13px] text-ink-3 md:block">
          {latest
            ? 'Written from module digests only. Raw data is touched when you ask a direct question.'
            : 'Press Run now, or wait for the nightly cron.'}
        </p>
      </section>

      <Bento tiles={tiles} />

      {!latest && (
        <EmptyState headline="No run yet" className="mt-7">
          The orchestrator writes core.dashboard_summary on the nightly run. Press Run now to do it
          straight away.
        </EmptyState>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-2">
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

/** "CDT" for America/Chicago today; what the artboard prints after the clock. */
function zoneAbbr(timeZone: string): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')
  return part?.value ?? ''
}
