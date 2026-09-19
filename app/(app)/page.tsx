import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card, Chip, EmptyState, PaceBar, PageHeader, Row, RowList, StatusDot } from '@/components/pos'
import { db } from '@/core/db'
import { Bento, ArrangeToggle, type Tile } from './Bento'
import { SevenDays } from './DashboardTiles'
import { ProposalList, WarningList } from './Inbox'
import { latestDigests } from '@/core/digests'
import { getModules } from '@/core/modules'
import { getNav, getOffRailNav } from '@/core/nav'
import { unreadWarnings } from '@/core/notify'
import { upcoming } from '@/core/review-registry'
import { headlineSegments, jobStates, latestSummary } from '@/core/orchestrator'
import { getSettings } from '@/core/settings'
import { clockIn, minutesIn, ownerToday, zoneAbbrIn } from '@/core/today'
import { RunNow } from './RunNow'

// Today. Every part of it reads core, never a module's own tables: module
// numbers arrive through their digests, which is what keeps this page ignorant
// of all of them and stops it breaking when one is deleted.
//
// Top to bottom, as the Holon mockup (docs/design/holon/today.html) lays it
// out: the greeting, what needs attention, today's work beside the week
// ahead, then one summary per module in the owner's saved order, and the
// system's own line last.

/**
 * What is coming in the next seven days.
 *
 * Composed from what each module says is upcoming, which is the same list the
 * Weekly Review picks next week's three from. Core reads no module schema to
 * build it and a module that dates nothing simply never appears.
 */
async function nextSevenDays(
  todayIso: string,
): Promise<{ id: string; title: string; meta: string; at: string; module: string; href?: string }[]> {
  const week = new Date(`${todayIso}T12:00:00`)
  week.setDate(week.getDate() + 7)
  const until = week.toISOString().slice(0, 10)

  return (await upcoming())
    .flatMap((c) => c.items.map((i) => ({ ...i, module: c.module })))
    .flatMap((i) => (i.at && i.at >= todayIso && i.at < until ? [{ ...i, at: i.at }] : []))
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 6)
}

async function pendingProposals() {
  const { rows } = await db().query<{ id: string; title: string | null; agent: string | null }>(
    `select id, title, agent from core.proposals
      where status = 'pending' and (dismissed_until is null or dismissed_until < now())
      order by created_at desc limit 4`,
  )
  return rows
}

/** This month's model spend, by what it was spent on and which model did it. */
async function spendByPurpose(): Promise<
  { purpose: string; model: string; calls: number; cents: number }[]
> {
  const { rows } = await db().query<{ purpose: string; model: string; calls: string; cents: string }>(
    `select purpose, model, count(*)::text as calls, sum(cost_cents)::text as cents
       from core.llm_calls
      where occurred_at >= date_trunc('month', now())
      group by purpose, model
      order by sum(cost_cents) desc
      limit 4`,
  )
  return rows.map((r) => ({
    purpose: r.purpose,
    model: r.model,
    calls: Number(r.calls),
    cents: Number(r.cents),
  }))
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "claude-haiku-4-5-20251001" reads as "Haiku" on a tile. */
function modelName(model: string): string {
  const family = model.match(/haiku|sonnet|opus|fable/i)?.[0]
  return family ? capitalise(family.toLowerCase()) : model
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

/**
 * The default order of the summaries: the three the owner uses most, then
 * every other module that wrote a digest in rail order, and the model spend
 * last. The owner's saved layout wins over this once there is one.
 *
 * Saved layouts from before Holon phase 3 may still name `warnings`,
 * `review`, `tasks` and `timeline`, which are sections above the grid now
 * rather than tiles. Bento keeps only the ids it is handed, so those entries
 * are ignored, hidden or not, and nothing has to be migrated.
 */
const ORDER = ['finance', 'goals', 'skills']

/** A section heading: the title, and the count or line that qualifies it. */
function SectionHead({ id, title, meta, className }: { id: string; title: string; meta?: string; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-1 pb-3', className)}>
      <h2 id={id} className="text-[20px] font-semibold leading-tight tracking-[-0.015em] text-ink">
        {title}
      </h2>
      {meta && <span className="t-caption num text-ink-3">{meta}</span>}
    </div>
  )
}

/**
 * A summary's head: the module name, which opens it, and the line the module
 * wrote for the right, which opens it too. No footer link.
 */
function TileHead({ href, name, meta }: { href: string; name: string; meta?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="text-[15px] font-semibold leading-tight text-ink">
        <Link href={href} aria-label={`Open ${name}`} className="hover:text-action">
          {name}
        </Link>
      </h2>
      {meta && (
        <Link href={href} className="t-caption text-ink-3 hover:text-ink">
          {meta}
        </Link>
      )}
    </div>
  )
}

/** A summary fills its grid cell so the bottoms of a row align. */
const tileClass = 'flex h-full flex-col gap-3 transition-colors duration-150'

export default async function DashboardPage() {
  // The owner's date, not the server's: on Vercel those differ all evening.
  // `todayIso` is what dates are compared against; `today` is the label.
  const [settings, todayIso] = await Promise.all([getSettings(), ownerToday()])
  // "Friday 18 September", in the owner's zone.
  const today = new Intl.DateTimeFormat('en-GB', {
    timeZone: settings.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  const [latest, digests, jobs, diary, warnings, proposals, spend, nav, offRail] = await Promise.all([
    latestSummary(),
    latestDigests(),
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
  const alerts = summary?.alerts ?? []
  const failed = jobs.filter((j) => j.status === 'failed')
  const spendCents = summary?.spendCents ?? 0
  const capCents = summary?.capCents ?? settings.llm_soft_cap_cents

  // The summaries read the latest digest per module, not the nightly's copy:
  // every write tool recomputes its digest (core/tools.ts), so this is this
  // minute's numbers. The headline, alerts and the run line stay nightly. A
  // module that is off in Settings, or gone from the folder, has no summary.
  const enabled = settings.modules_enabled
  const moduleDigests = digests.flatMap((d) => {
    const manifest = getModules().find((m) => m.id === d.module)
    if (!manifest || (enabled !== null && !enabled.includes(d.module))) return []
    return [{ module: d.module, payload: d.payload, manifest }]
  })

  // Today's work is the tasks module's own tile, promoted out of the grid: the
  // rows with their checkboxes are what the module draws from its digest, and
  // ticking one here is the same write the board makes. With no Tasks module
  // there is no Today section, and the week ahead takes the width.
  const tasks = moduleDigests.find((m) => m.module === 'tasks')
  const TasksTile = tasks?.manifest.tile
  const tasksHead = tasks && tasks.manifest.tileHead?.(tasks.payload)

  const unsorted: Tile[] = [
    // One summary per module that wrote a digest. A module is responsible
    // for its own numbers; this page only lays them out.
    ...moduleDigests
      .filter((m) => m.module !== 'tasks')
      .map((m) => {
        const { manifest } = m
        const name = manifest.nav.label
        const ModuleTile = manifest.tile
        const head = manifest.tileHead?.(m.payload) ?? {}
        const href = `/${m.module}`

        return {
          id: m.module,
          node: (
            <Card className={cn(tileClass, 'hover:border-rule-2')}>
              <TileHead href={href} name={head.label ?? name} meta={head.meta} />
              {/* The module says how its own numbers read. Core only places
                * the result: it has no way to know what a finance payload
                * holds, and walking the object generically is what put
                * "debt cents 231000" on the dashboard. */}
              {ModuleTile ? <ModuleTile payload={m.payload} /> : <GenericDigest payload={m.payload} />}
            </Card>
          ),
        }
      }),

    {
      id: 'llm',
      node: (
        <Card className={tileClass}>
          <TileHead href="/settings" name="Model spend" meta={`cap ${money(capCents)} this month`} />
          <div className="mt-0.5 flex items-baseline gap-2.5">
            <span className="num text-[24px] font-semibold leading-none tracking-[-0.02em] text-ink">
              {money(spendCents)}
            </span>
            <span className="t-caption num text-ink-3">
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
                  key={`${row.purpose}.${row.model}`}
                  className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-rule py-[7px] text-[13px] last:border-b-0"
                >
                  <span className="truncate text-ink">
                    {capitalise(row.purpose)} · {modelName(row.model)}
                  </span>
                  <span className="num t-caption text-ink-3">
                    {row.calls.toLocaleString('en-US')} {row.calls === 1 ? 'call' : 'calls'}
                  </span>
                  <span className="num t-caption text-ink">{money(row.cents)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      ),
    },
  ]

  // The three most used first, then the rest of the modules in rail order,
  // then the model spend. `unsorted` above is grouped by kind because that is
  // how the tiles are built, not how they are laid out.
  const position = (id: string) => {
    const fixed = ORDER.indexOf(id)
    if (fixed >= 0) return fixed
    if (id === 'llm') return ORDER.length + rail.length + 1
    const onRail = rail.indexOf(id)
    return ORDER.length + (onRail >= 0 ? onRail : rail.length)
  }
  const tiles = [...unsorted].sort((a, b) => position(a.id) - position(b.id))

  const hour = Math.floor(minutesIn(new Date(), settings.timezone) / 60)
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'

  const attention = warnings.length + proposals.length + alerts.length

  return (
    <div>
      {/* Band one only: the greeting below is the page's opening statement
        * and the h1 is PageHeader's "Today". On the phone this is the
        * back-control-less title row (Today is a tab root) with Run now as
        * the one action. */}
      <PageHeader
        eyebrow="Today"
        title="Today"
        hideTitle
        searchPlaceholder="What are you looking for?"
        phoneAction={<RunNow />}
        status={
          <>
            <ArrangeToggle />
            <RunNow />
          </>
        }
      />

      <section className="mt-5 max-w-[920px] md:mt-6">
        <p className="label text-ink-3">{today}</p>
        {/* The opening statement, at the size the design gives it. It reads
          * as a sentence, not a heading, and the parts of it that name
          * something you can open are links, the one piece of colour in it. */}
        <p className="mt-2 text-pretty text-[clamp(22px,2.2vw,30px)] font-normal leading-[1.25] tracking-[-0.03em] text-ink">
          {/* The one place the owner's name appears since it left the rail. */}
          {settings.owner_name && <span className="font-semibold">{greeting}, {settings.owner_name}. </span>}
          {segments.length > 0
            ? segments.map((s, i) =>
                s.href ? (
                  <Link key={i} href={s.href} className="text-action hover:underline">
                    {s.text}
                  </Link>
                ) : (
                  <span key={i}>{s.text}</span>
                ),
              )
            : (latest?.headline ?? 'Nothing has run yet.')}
        </p>
        {/* Hidden on a phone: none of the phone artboards puts a paragraph
          * under its opening line. */}
        <p className="mt-2 hidden text-[13px] text-ink-3 md:block">
          {latest
            ? 'Written from module digests only. Raw data is touched when you ask a direct question.'
            : 'Press Run now, or wait for the nightly cron.'}
        </p>
      </section>

      {!latest && (
        <EmptyState headline="No run yet" className="mt-6">
          The orchestrator writes core.dashboard_summary on the nightly run. Press Run now to do it
          straight away.
        </EmptyState>
      )}

      {/* Only actionable things, and only when there are any: a warning, a
        * proposal, or an alert the nightly summary raised. Sand, because this
        * is the one warm surface on the page and it is meant to be read
        * first. Every row's action is the same write its own screen makes. */}
      {attention > 0 && (
        <section
          aria-labelledby="attention"
          data-testid="dashboard-attention"
          className="mt-6 rounded-[18px] bg-sand-surface px-4 py-3.5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--sand)_45%,transparent)] md:px-5 md:py-4"
        >
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h2 id="attention" className="text-[15px] font-semibold leading-tight text-ink">
              Needs attention
            </h2>
            <span className="t-caption num text-ink-3">
              {attention} {attention === 1 ? 'item' : 'items'}
            </span>
          </div>
          {warnings.length > 0 && (
            <WarningList
              phoneLimit={2}
              warnings={warnings.map((w) => ({
                id: w.id,
                title: w.title,
                sub: w.body,
                urgent: w.urgency === 'urgent',
                href: w.href,
              }))}
            />
          )}
          {proposals.length > 0 && (
            <ProposalList
              phoneLimit={1}
              proposals={proposals.map((p) => ({
                id: p.id,
                title: p.title ?? 'Proposal',
                from: p.agent ?? 'agent',
              }))}
            />
          )}
          {alerts.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
              {alerts.map((a) => (
                <Chip key={a.title} tone={a.tone === 'bad' ? 'bad' : a.tone === 'ok' ? 'ok' : 'warn'}>
                  {a.title}
                </Chip>
              ))}
            </div>
          )}
        </section>
      )}

      <div
        className={cn(
          'mt-7 grid gap-7 md:mt-8',
          TasksTile && 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-8',
        )}
      >
        {TasksTile && tasks && (
          <section aria-labelledby="today-work" data-testid="dashboard-today">
            <SectionHead id="today-work" title="Today" meta={tasksHead?.meta} />
            <TasksTile payload={tasks.payload} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href="/tasks?task=new"
                className="inline-flex h-11 items-center rounded-full border border-glass-line bg-glass-strong px-4 text-[13px] font-medium text-ink shadow-[inset_0_1px_0_var(--glass-edge),var(--lift)] hover:bg-bg-elev sm:h-9"
              >
                Add a task
              </Link>
              <Link
                href="/tasks"
                className="inline-flex h-11 items-center rounded-full px-4 text-[13px] font-medium text-ink-3 hover:bg-glass hover:text-ink sm:h-9"
              >
                All tasks
              </Link>
            </div>
          </section>
        )}

        <section aria-labelledby="next-days" data-testid="dashboard-week">
          <SectionHead
            id="next-days"
            title="Next 7 days"
            meta={`${diary.length} item${diary.length === 1 ? '' : 's'}`}
          />
          <SevenDays
            today={todayIso}
            items={diary.map((d) => ({
              id: `${d.module}.${d.id}`,
              title: d.title,
              meta: d.meta,
              at: d.at,
              module: d.module,
              href: d.href,
            }))}
          />
        </section>
      </div>

      <Bento tiles={tiles} layout={settings.dashboard_layout} />

      {/* The system's own line, last: discoverable, and below every piece of
        * personal work. The run's own clock, in the owner's zone. */}
      <p className="mt-8 flex flex-wrap items-center gap-x-1.5 gap-y-1 px-1 t-caption text-ink-3">
        <StatusDot tone={failed.length > 0 ? 'bad' : latest ? 'ok' : 'idle'} />
        <span>
          {latest
            ? `Nightly summary ran at ${clockIn(new Date(latest.runAt), settings.timezone)} ${zoneAbbrIn(settings.timezone)}, ${failed.length > 0 ? `${failed.length} job${failed.length === 1 ? '' : 's'} failed` : 'all jobs ok'}.`
            : 'No run yet.'}{' '}
          Model spend this month {money(spendCents)}
          {capCents > 0 ? ` of ${money(capCents)}` : ''}.
        </span>
        <Link href="/agent-log" className="text-action hover:underline">
          Agent log
        </Link>
      </p>
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
