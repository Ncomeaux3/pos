'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  Chip,
  EmptyState,
  Eyebrow,
  MetricStrip,
  MetricTile,
  PageHeader,
  PillGroup,
  Row,
  RowList,
  StatusChip,
  useToast,
  type SkillLink,
} from '@/components/pos'
import { useSearchState } from '@/components/pos/searchState'
import { cn } from '@/lib/utils'
import {
  addMonths,
  compactMoney,
  dueLabel,
  intervalLabel,
  money,
  monthKey,
  monthLabelLong,
  monthYear,
  next12Months,
  type DueStatus,
} from '../schedule'
import { markDone, snoozeService, type ActionResult } from './actions'
import { AssetDrawer, LogServiceDrawer, WarrantyDrawer } from './Drawers'

export type Fact = { label: string; value: string }

export type HomeData = {
  todayIso: string
  /** Insurance's annual property cover through the registry, or null when it is not installed. */
  propertyPremium: number | null
  assets: {
    id: string
    kind: string
    name: string
    subtitle: string
    valueCents: number
    annualCostCents: number
    valueAsOf: string | null
    notes: string
    facts: Fact[]
    entityRef: string | null
    skills: SkillLink[]
  }[]
  services: {
    id: string
    assetId: string
    assetName: string
    title: string
    intervalMonths: number
    lastDoneOn: string | null
    dueOn: string | null
    status: DueStatus
    snoozeUntil: string | null
    costEstimateCents: number
    vendorName: string | null
    notes: string
  }[]
  log: {
    id: string
    assetId: string
    what: string
    doneOn: string
    costCents: number | null
    vendorName: string | null
  }[]
  warranties: {
    id: string
    assetId: string | null
    name: string
    detail: string
    cover: string
    expiresOn: string | null
    documentUrl: string
    facts: Fact[]
  }[]
  vendors: {
    id: string
    name: string
    trade: string
    contact: string
    lastUsedOn: string | null
    lastCostCents: number | null
  }[]
  /** Every skill in the tree, id and name. From getSkillNames() on the page. */
  skills: [string, string][]
}

export type Service = HomeData['services'][number]

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'property', label: 'Property' },
  { value: 'vehicle', label: 'Vehicles' },
  { value: 'equipment', label: 'Equipment' },
]

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`
}

/** The 6px and 8px dots: what the job's status looks like on the calendar. */
const DOT: Record<DueStatus, string> = {
  overdue: 'bg-bad',
  due: 'bg-warn',
  soon: 'bg-ink-2',
  later: 'bg-ink-2',
  snoozed: 'bg-ink-4',
  unscheduled: 'bg-ink-2',
}

/** "{asset} · yearly · {vendor}", the line under every job. */
export function jobMeta(job: Service) {
  return [
    job.assetName,
    intervalLabel(job.intervalMonths),
    job.vendorName,
    job.status === 'snoozed' && job.snoozeUntil ? `snoozed until ${shortDate(job.snoozeUntil)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function Home({ data }: { data: HomeData }) {
  const { params, set: setParams } = useSearchState()
  const filter = params.get('kind') ?? 'all'
  const month = params.get('month') ?? monthKey(data.todayIso)
  const openAsset = data.assets.find((a) => a.id === params.get('asset')) ?? null
  const openWarranty = data.warranties.find((w) => w.id === params.get('warranty')) ?? null
  const logging = params.get('log') === '1'

  const [, start] = useTransition()
  const toast = useToast()

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  // A job leaves the calendar and the attention rail the moment Mark done or
  // Snooze is pressed, same shape as Inbox.tsx's act(): optimistic, reverted
  // with a toast on failure.
  const [gone, setGone] = useState<string[]>([])
  const flip = (id: string, action: () => Promise<ActionResult>, ok: string) => {
    setGone((g) => [...g, id])
    start(async () => {
      const result = await action()
      if (result.ok) toast(ok)
      else {
        setGone((g) => g.filter((x) => x !== id))
        toast(result.error)
      }
    })
  }
  const services = data.services.filter((s) => !gone.includes(s.id))

  const done = (job: Service) =>
    flip(
      job.id,
      () => markDone(job.id, job.assetId, job.title),
      'Marked done. It moves to the service history and reschedules on its interval.',
    )

  const scheduled = services.filter((s) => s.dueOn !== null)
  const months = next12Months(
    scheduled.map((s) => ({ dueOn: s.dueOn!, costEstimateCents: s.costEstimateCents })),
    data.todayIso,
  )
  const yearCents = months.reduce((sum, m) => sum + m.costCents, 0)
  const yearEnd = monthKey(addMonths(`${monthKey(data.todayIso)}-01`, 11))
  const inYear = scheduled.filter((s) => monthKey(s.dueOn!) <= yearEnd)
  const byDue = (a: Service, b: Service) => (a.dueOn! < b.dueOn! ? -1 : 1)
  const jobsIn = (key: string) => scheduled.filter((s) => monthKey(s.dueOn!) === key).sort(byDue)
  const monthJobs = jobsIn(month)
  const monthCents = monthJobs.reduce((sum, s) => sum + s.costEstimateCents, 0)

  const attention = services
    .filter((s) => s.status === 'overdue' || s.status === 'due')
    .sort((a, b) => (a.status === b.status ? byDue(a, b) : a.status === 'overdue' ? -1 : 1))
  const dueCents = attention.reduce((sum, s) => sum + s.costEstimateCents, 0)
  const nextUp = scheduled.filter((s) => s.status !== 'snoozed').sort(byDue)[0]

  const shownAssets = data.assets.filter((a) => filter === 'all' || a.kind === filter)
  const valueCents = data.assets.reduce((sum, a) => sum + a.valueCents, 0)
  const upkeepCents = data.assets.reduce((sum, a) => sum + a.annualCostCents, 0)
  const property = data.assets.find((a) => a.kind === 'property') ?? null
  const count = (kind: string) => data.assets.filter((a) => a.kind === kind).length
  const kinds = [
    `${count('property')} ${count('property') === 1 ? 'property' : 'properties'}`,
    `${count('vehicle')} ${count('vehicle') === 1 ? 'vehicle' : 'vehicles'}`,
    `${count('equipment')} equipment`,
  ].join(' · ')

  /** The soonest job that is not snoozed: what the card's pill and footer read. */
  const soonestFor = (assetId: string) =>
    scheduled.filter((s) => s.assetId === assetId && s.status !== 'snoozed').sort(byDue)[0] ?? null

  const yearAhead = addMonths(data.todayIso, 12)
  const expiringSoon = (iso: string | null) => iso !== null && iso <= yearAhead

  const dot = attention.some((s) => s.status === 'overdue')
    ? 'bad'
    : attention.length > 0
      ? 'warn'
      : 'brand'

  return (
    <div className="space-y-[22px]">
      <PageHeader
        eyebrow={
          <>
            Home <span className="text-ink-4">/</span> Assets
          </>
        }
        title="Home & Property"
        lede="The house, the vehicles and the equipment worth tracking: what each is worth, what it costs to keep, and what it needs next."
        status={
          <Eyebrow dot={dot} className="whitespace-nowrap">
            {attention.length === 0
              ? 'Nothing due this month'
              : `${attention.length} job${attention.length === 1 ? '' : 's'} due this month · ${money(dueCents)} estimated`}
          </Eyebrow>
        }
        actions={
          <ActionButton
            variant="solid"
            size="xl"
            className="h-11 gap-2 px-3.5 text-[13px] md:h-[51px] md:px-[22px] md:text-[15px]"
            onClick={() => setParams({ log: '1' }, { push: true })}
          >
            Log service <span aria-hidden="true">&rarr;</span>
          </ActionButton>
        }
      />

      <div className="flex flex-wrap items-start gap-x-[52px] gap-y-7">
        <div className="min-w-0 flex-[1_1_540px] space-y-7">
          <MetricStrip>
            <MetricTile size="sm" label="Assets tracked" value={data.assets.length} delta={kinds} />
            <MetricTile
              size="sm"
              label="Combined value"
              value={compactMoney(valueCents)}
              delta={`${property && valueCents > 0 ? `House at ${Math.round((property.valueCents / valueCents) * 100)}% · ` : ''}your own estimate`}
            />
            <MetricTile size="sm" label="Annual upkeep" value={compactMoney(upkeepCents)} delta="Your own figures" />
            <MetricTile size="sm" label="Next 12 months" value={compactMoney(yearCents)} delta={`${inYear.length} scheduled jobs`} />
          </MetricStrip>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <Eyebrow>Assets</Eyebrow>
              <PillGroup
                label="Asset kinds"
                value={filter}
                options={FILTERS}
                onChange={(next) => setParams({ kind: next === 'all' ? null : next, asset: null })}
              />
            </div>

            {shownAssets.length === 0 ? (
              <EmptyState headline="Nothing here" className="mt-3.5">
                Nothing of this kind is tracked yet.
              </EmptyState>
            ) : (
              <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-stretch gap-3">
                {shownAssets.map((asset) => {
                  const next = soonestFor(asset.id)
                  const state =
                    next?.status === 'overdue' ? 'overdue' : next?.status === 'due' ? 'due' : 'good'
                  return (
                    <Card
                      key={asset.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setParams({ asset: asset.id }, { push: true })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setParams({ asset: asset.id }, { push: true })
                        }
                      }}
                      className={cn(
                        'block w-full cursor-pointer px-[18px] text-left transition-colors duration-150 hover:bg-glass-strong active:scale-[.985]',
                        state !== 'good' && 'ring-1',
                        state === 'overdue' ? 'ring-bad' : state === 'due' ? 'ring-warn' : '',
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2.5">
                        <Eyebrow>{cap(asset.kind)}</Eyebrow>
                        <StatusChip tone={state === 'overdue' ? 'bad' : state === 'due' ? 'warn' : 'ok'}>
                          {state === 'overdue' ? 'Overdue' : state === 'due' ? 'Service due' : 'Good'}
                        </StatusChip>
                      </div>
                      <div className="mt-3 text-[17px] leading-[1.3] tracking-[-0.01em] text-ink">
                        {asset.name}
                      </div>
                      <div className="mt-[5px] text-[11px] leading-[1.45] text-ink-3">{asset.subtitle}</div>
                      <div className="mt-4 flex flex-wrap gap-3.5">
                        <span className="min-w-0 flex-[1_1_90px]">
                          <Eyebrow className="block">Value</Eyebrow>
                          <span className="num mt-[5px] block text-[16px] text-ink">{money(asset.valueCents)}</span>
                        </span>
                        <span className="min-w-0 flex-[1_1_90px]">
                          <Eyebrow className="block">Annual cost</Eyebrow>
                          <span className="num mt-[5px] block text-[16px] text-ink">{money(asset.annualCostCents)}</span>
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2 border-t border-rule pt-3">
                        <span className="min-w-0 flex-[1_1_140px] text-[12px] leading-[1.4] text-ink-2">
                          {next ? next.title : 'Nothing scheduled'}
                        </span>
                        <span
                          className={cn(
                            'num shrink-0 text-[11px]',
                            state === 'good' ? 'text-ink-3' : 'text-warn',
                          )}
                        >
                          {next ? monthLabelLong(monthKey(next.dueOn!)) : 'none'}
                        </span>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <Eyebrow>Maintenance · next 12 months</Eyebrow>
              <span className="num text-[11px] text-ink-3">
                {inYear.length} jobs · {money(yearCents)} estimated
              </span>
            </div>

            <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,110px),1fr))] gap-2">
              {months.map((m) => {
                const selected = m.key === month
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setParams({ month: m.key })}
                    aria-pressed={selected}
                    className={cn(
                      'glass block w-full rounded-[18px] p-3 text-left transition-colors duration-150 active:scale-[.985]',
                      selected ? 'bg-brand-soft ring-1 ring-action' : 'hover:bg-glass-strong',
                    )}
                  >
                    <span className="flex items-baseline justify-between">
                      <span className={cn('label', selected ? 'text-ink' : 'text-ink-3')}>{m.label}</span>
                      <span
                        className={cn(
                          'num text-[11px]',
                          m.isCurrent ? 'text-warn' : selected ? 'text-ink' : 'text-ink-3',
                        )}
                      >
                        {m.count}
                      </span>
                    </span>
                    <span className="mt-2.5 flex min-h-1.5 flex-wrap gap-[3px]">
                      {jobsIn(m.key)
                        .slice(0, 4)
                        .map((j) => (
                          <span key={j.id} className={cn('block size-1.5 rounded-full', DOT[j.status])} />
                        ))}
                    </span>
                    <span className="mt-2.5 block text-[11px] text-ink-3">
                      {m.costCents > 0 ? money(m.costCents) : 'No cost'}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-[18px]">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <Eyebrow>{monthLabelLong(month)}</Eyebrow>
                <span className="num text-[11px] text-ink-3">
                  {monthCents > 0 ? `${money(monthCents)} estimated` : 'No cost'}
                </span>
              </div>

              {monthJobs.length === 0 ? (
                <EmptyState headline="Nothing scheduled" className="mt-3 px-[18px] py-[26px]">
                  No recurring service falls in this month.
                </EmptyState>
              ) : (
                <RowList className="mt-3">
                  {monthJobs.map((job) => (
                    <Row
                      key={job.id}
                      title={
                        <span className="flex items-center gap-2">
                          <span className={cn('size-2 shrink-0 rounded-full', DOT[job.status])} />
                          {job.title}
                        </span>
                      }
                      meta={jobMeta(job)}
                      amount={job.costEstimateCents > 0 ? money(job.costEstimateCents) : 'no estimate'}
                      right={
                        <ActionButton size="sm" onClick={() => done(job)}>
                          Mark done
                        </ActionButton>
                      }
                    />
                  ))}
                </RowList>
              )}
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <Eyebrow>Warranties & documents</Eyebrow>
              <span className="num text-[11px] text-ink-3">
                {data.warranties.filter((w) => expiringSoon(w.expiresOn)).length} expiring within a year
              </span>
            </div>
            <RowList className="mt-3">
              {data.warranties.map((w) => (
                <Row
                  key={w.id}
                  title={w.name}
                  meta={w.detail}
                  onClick={() => setParams({ warranty: w.id }, { push: true })}
                  right={
                    <>
                      <Chip tone="quiet">{w.cover}</Chip>
                      {/* No expiry is a real state for a deed, not a missing date. */}
                      <span className={cn('num text-[12px]', expiringSoon(w.expiresOn) ? 'text-warn' : 'text-ink-3')}>
                        {w.expiresOn ? monthLabelLong(monthKey(w.expiresOn)) : 'No expiry'}
                      </span>
                      <Chip tone={w.documentUrl ? 'neutral' : 'quiet'}>{w.documentUrl ? 'PDF' : 'No file'}</Chip>
                    </>
                  }
                />
              ))}
            </RowList>
          </section>
        </div>

        <div className="min-w-0 flex-[1_1_320px] space-y-[26px] xl:max-w-[352px]">
          <section>
            <Eyebrow>Needs attention</Eyebrow>
            {attention.length === 0 ? (
              <p className="mt-3 text-[12px] leading-[1.5] text-ink-3">
                Nothing outstanding. The next scheduled job is{' '}
                {nextUp ? `${nextUp.title} in ${monthLabelLong(monthKey(nextUp.dueOn!))}` : 'not scheduled'}.
              </p>
            ) : (
              <>
                {attention.slice(0, 4).map((job) => (
                  <Card
                    key={job.id}
                    className={cn('mt-2.5 px-3.5 py-3.5', job.status === 'overdue' && 'ring-1 ring-bad')}
                  >
                    <div className="flex items-baseline justify-between gap-2.5">
                      <StatusChip tone={job.status === 'overdue' ? 'bad' : 'warn'}>
                        {job.status === 'overdue' ? 'Overdue' : 'Due now'}
                      </StatusChip>
                      <span className="text-[12px] text-ink-3">{dueLabel(job, data.todayIso)}</span>
                    </div>
                    <div className="mt-[7px] text-[14px] leading-[1.4] text-ink">{job.title}</div>
                    <div className="mt-1 text-[11px] leading-[1.45] text-ink-3">{jobMeta(job)}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionButton size="sm" variant="accent" onClick={() => done(job)}>
                        Mark done
                      </ActionButton>
                      <ActionButton
                        size="sm"
                        onClick={() =>
                          flip(
                            job.id,
                            () => snoozeService(job.id, 30),
                            'Snoozed 30 days. It comes back, it does not go away.',
                          )
                        }
                      >
                        Snooze 30d
                      </ActionButton>
                    </div>
                  </Card>
                ))}
                {attention.length > 4 && (
                  <p className="mt-2.5 text-[11px] text-ink-3">+{attention.length - 4} more on the calendar</p>
                )}
              </>
            )}
          </section>

          {property && (
            <section>
              <Eyebrow>Property</Eyebrow>
              <RowList className="mt-3">
                {property.facts.map((f) => (
                  <Row key={f.label} title={f.label} amount={f.value} />
                ))}
                {data.propertyPremium !== null && (
                  <Row title="Insurance" amount={`${money(data.propertyPremium * 100)} / yr`} />
                )}
              </RowList>
              <p className="mt-3 text-[11px] leading-[1.5] text-ink-3">
                {data.propertyPremium === null ? (
                  'Coverage lives in Insurance, which is not installed.'
                ) : (
                  <>
                    Coverage comes from{' '}
                    <Link href="/insurance" className="border-b border-rule-2 text-ink-2">
                      Insurance
                    </Link>
                    .
                  </>
                )}
              </p>
            </section>
          )}

          <section>
            <Eyebrow>Vendors</Eyebrow>
            <RowList className="mt-3">
              {data.vendors.map((v) => (
                <Row
                  key={v.id}
                  title={v.name}
                  meta={[
                    v.contact,
                    v.lastUsedOn
                      ? `Last used ${monthYear(v.lastUsedOn)}${v.lastCostCents !== null ? ` · ${money(v.lastCostCents)}` : ''}`
                      : 'Not used yet',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  right={<Chip tone="quiet">{v.trade}</Chip>}
                />
              ))}
            </RowList>
          </section>
        </div>
      </div>

      <AssetDrawer
        asset={openAsset}
        log={openAsset ? data.log.filter((l) => l.assetId === openAsset.id) : []}
        skills={data.skills}
        onClose={() => setParams({ asset: null })}
      />
      <WarrantyDrawer warranty={openWarranty} onClose={() => setParams({ warranty: null })} />
      <LogServiceDrawer open={logging} data={data} onClose={() => setParams({ log: null })} run={run} />
    </div>
  )
}

