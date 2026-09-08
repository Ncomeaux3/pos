import Link from 'next/link'
import {
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  HeatStrip,
  PaceBar,
  PageHeader,
  Radar,
  Row,
  RowList,
  StatusChip,
  type RadarAxis,
} from '@/components/pos'
import { db } from '@/core/db'
import { getModules } from '@/core/modules'
import { jobStates, latestSummary } from '@/core/orchestrator'
import { getSettings } from '@/core/settings'
import { RunNow } from './RunNow'

// The bento. Every tile reads core, never a module's own tables: module numbers
// arrive through their digests, which is what keeps this page ignorant of all
// of them and stops it breaking when one is deleted.

async function skillAxes(): Promise<RadarAxis[]> {
  // The view rolls events and links into XP; the top level attributes are the
  // skill ids with no dot, by the shape of config/skills.yaml.
  const { rows } = await db().query<{ skill_id: string; xp: string }>(
    `select skill_id, xp::text from core.skill_xp order by xp desc limit 6`,
  )
  return rows.map((r) => ({ label: r.skill_id, value: Number(r.xp) }))
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
  const capCents = summary?.capCents ?? settings.llm_soft_cap_cents

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={latest ? `Nightly run · ${ago(latest.runAt)}` : 'No run yet'}
        dot={failed.length > 0 ? 'bad' : latest ? 'ok' : 'idle'}
        title={
          latest?.headline ?? 'Nothing has run yet.'
        }
        lede={
          latest
            ? 'Written from module digests only.'
            : 'Press Run now, or wait for the nightly cron at 09:00 UTC.'
        }
        actions={<RunNow />}
      />

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
          const label = getModules().find((x) => x.id === m.module)?.nav.label ?? m.module
          const entries = Object.entries(m.payload).filter(
            ([, v]) => typeof v === 'number' || typeof v === 'string',
          )

          return (
            <Card key={m.module} className="space-y-3">
              <CardHead label={label} meta="digest" />
              <RowList>
                {entries.slice(0, 4).map(([key, value]) => (
                  <Row
                    key={key}
                    title={key.replace(/([A-Z])|(\d+)/g, ' $1$2').trim().toLowerCase()}
                    right={<span className="num text-sm text-ink">{String(value)}</span>}
                  />
                ))}
              </RowList>
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
