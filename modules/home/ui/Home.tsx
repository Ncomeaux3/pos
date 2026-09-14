'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import {
  ActionButton,
  Card,
  EmptyState,
  Eyebrow,
  PageHeader,
  PillGroup,
  useToast,
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

const MONO = 'label text-[10px] tracking-[0.12em]'

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

  const done = (job: Service) =>
    run(
      () => markDone(job.id, job.assetId, job.title),
      'Marked done. It moves to the service history and reschedules on its interval.',
    )

  const scheduled = data.services.filter((s) => s.dueOn !== null)
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

  const attention = data.services
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
        title="Home & assets"
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
            variant="accent"
            className="h-11 px-4 text-[13px] sm:h-10"
            onClick={() => setParams({ log: '1' }, { push: true })}
          >
            Log service
          </ActionButton>
        }
      />

      <div className="flex flex-wrap items-start gap-x-[52px] gap-y-7">
        <div className="min-w-0 flex-[1_1_540px] space-y-7">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,168px),1fr))] gap-2.5">
            <Kpi name="Assets tracked" value={String(data.assets.length)} note={kinds} />
            <Kpi
              name="Combined value"
              value={compactMoney(valueCents)}
              note={`${property && valueCents > 0 ? `House at ${Math.round((property.valueCents / valueCents) * 100)}% · ` : ''}your own estimate`}
            />
            <Kpi name="Annual upkeep" value={compactMoney(upkeepCents)} note="Your own figures" />
            <Kpi
              name="Next 12 months"
              value={compactMoney(yearCents)}
              note={`${inYear.length} scheduled jobs`}
              noteClass="text-brand"
            />
          </div>

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
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setParams({ asset: asset.id }, { push: true })}
                      className={cn(
                        'block w-full border bg-bg-elev p-[18px] text-left transition-colors duration-150 active:scale-[.985]',
                        state === 'due' ? 'border-warn' : 'border-rule-2',
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2.5">
                        <span
                          className={cn(
                            'label text-[9px] tracking-[0.12em]',
                            asset.kind === 'equipment' ? 'text-ink-3' : 'text-brand',
                          )}
                        >
                          {asset.kind.toUpperCase()}
                        </span>
                        <span
                          className={cn(
                            'label border px-1.5 py-[3px] text-[9px] tracking-[0.1em]',
                            state === 'overdue'
                              ? 'border-bad text-bad'
                              : state === 'due'
                                ? 'border-warn text-warn'
                                : 'border-rule-2 text-brand',
                          )}
                        >
                          {state === 'overdue' ? 'OVERDUE' : state === 'due' ? 'SERVICE DUE' : 'GOOD'}
                        </span>
                      </div>
                      <div className="mt-3 text-[17px] leading-[1.3] tracking-[-0.01em] text-ink">
                        {asset.name}
                      </div>
                      <div className="mt-[5px] text-[11px] leading-[1.45] text-ink-3">{asset.subtitle}</div>
                      <div className="mt-4 flex flex-wrap gap-3.5">
                        <span className="min-w-0 flex-[1_1_90px]">
                          <span className="label block text-[10px] tracking-[0.1em] text-ink-3">VALUE</span>
                          <span className="num mt-[5px] block text-[16px] text-ink">{money(asset.valueCents)}</span>
                        </span>
                        <span className="min-w-0 flex-[1_1_90px]">
                          <span className="label block text-[10px] tracking-[0.1em] text-ink-3">ANNUAL COST</span>
                          <span className="num mt-[5px] block text-[16px] text-ink">{money(asset.annualCostCents)}</span>
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2 border-t border-rule pt-3">
                        <span className="min-w-0 flex-[1_1_140px] text-[12px] leading-[1.4] text-ink-2">
                          {next ? next.title : 'Nothing scheduled'}
                        </span>
                        <span
                          className={cn(
                            'num shrink-0 text-[10px]',
                            state === 'good' ? 'text-ink-3' : 'text-warn',
                          )}
                        >
                          {next ? monthLabelLong(monthKey(next.dueOn!)) : 'none'}
                        </span>
                      </div>
                    </button>
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
                      'block w-full border p-3 text-left transition-colors duration-150 active:scale-[.985]',
                      selected ? 'border-brand bg-brand-soft' : 'border-rule-2 bg-bg-elev',
                    )}
                  >
                    <span className="flex items-baseline justify-between">
                      <span className={cn(MONO, selected ? 'text-brand' : 'text-ink-3')}>{m.label}</span>
                      <span
                        className={cn(
                          'num text-[10px]',
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
                    <span className="mt-2.5 block text-[10px] text-ink-3">
                      {m.costCents > 0 ? money(m.costCents) : 'no cost'}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-[18px]">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className={cn(MONO, 'text-brand')}>{monthLabelLong(month)}</span>
                <span className="num text-[10px] text-ink-3">
                  {monthCents > 0 ? `${money(monthCents)} estimated` : 'no cost'}
                </span>
              </div>

              {monthJobs.length === 0 ? (
                <EmptyState headline="Nothing scheduled" className="mt-3 px-[18px] py-[26px]">
                  No recurring service falls in this month.
                </EmptyState>
              ) : (
                monthJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex flex-wrap items-start gap-x-3.5 gap-y-3 border-b border-rule px-3 py-3.5"
                  >
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT[job.status])} />
                    <span className="min-w-0 flex-[1_1_200px]">
                      <span className="block text-[14px] text-ink">{job.title}</span>
                      <span className="mt-1 block text-[11px] leading-[1.45] text-ink-3">{jobMeta(job)}</span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="num text-[10px] text-ink-3">
                        {job.costEstimateCents > 0 ? money(job.costEstimateCents) : 'no estimate'}
                      </span>
                      <ActionButton className="sm:h-8" onClick={() => done(job)}>
                        Mark done
                      </ActionButton>
                    </span>
                  </div>
                ))
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
            <div className="label flex flex-wrap gap-3 border-b border-rule-2 px-3 pb-2.5 pt-3.5 text-[10px] tracking-[0.12em] text-ink-3">
              <span className="min-w-0 flex-[1_1_200px]">ITEM</span>
              <span className="shrink-0">COVER · EXPIRES · FILE</span>
            </div>
            {data.warranties.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setParams({ warranty: w.id }, { push: true })}
                className="flex w-full flex-wrap items-center gap-x-3.5 gap-y-3 border-b border-rule px-3 py-[15px] text-left active:scale-[.985]"
              >
                <span className="min-w-0 flex-[1_1_200px]">
                  <span className="block text-[14px] text-ink">{w.name}</span>
                  <span className="mt-1 block text-[11px] leading-[1.45] text-ink-3">{w.detail}</span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-3">
                  <span className="label text-[9px] tracking-[0.1em] text-ink-3">{w.cover}</span>
                  <span
                    className={cn(
                      'num text-[10px]',
                      expiringSoon(w.expiresOn) ? 'text-warn' : 'text-ink-3',
                    )}
                  >
                    {/* No expiry is a real state for a deed, not a missing date. */}
                    {w.expiresOn ? monthLabelLong(monthKey(w.expiresOn)) : 'NO EXPIRY'}
                  </span>
                  <span className="label text-[9px] tracking-[0.08em] text-ink-3">
                    {w.documentUrl ? 'PDF' : 'NO FILE'}
                  </span>
                </span>
              </button>
            ))}
          </section>
        </div>

        <div className="min-w-0 flex-[1_1_320px] space-y-[26px] md:max-w-[352px]">
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
                  <div
                    key={job.id}
                    className={cn(
                      'mt-2.5 border bg-bg-elev p-3.5',
                      job.status === 'overdue' ? 'border-bad' : 'border-rule-2',
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2.5">
                      <span
                        className={cn(
                          'label text-[9px] tracking-[0.12em]',
                          job.status === 'overdue' ? 'text-bad' : 'text-warn',
                        )}
                      >
                        {job.status === 'overdue' ? 'OVERDUE' : 'DUE NOW'}
                      </span>
                      <span className="label text-[10px] tracking-normal text-ink-3">
                        {dueLabel(job, data.todayIso)}
                      </span>
                    </div>
                    <div className="mt-[7px] text-[14px] leading-[1.4] text-ink">{job.title}</div>
                    <div className="mt-1 text-[11px] leading-[1.45] text-ink-3">{jobMeta(job)}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionButton
                        className="border-brand px-[13px] text-brand hover:border-brand sm:h-[34px]"
                        onClick={() => done(job)}
                      >
                        Mark done
                      </ActionButton>
                      <ActionButton
                        className="px-[11px] text-[10px] tracking-[0.08em] text-ink-3 sm:h-8"
                        onClick={() =>
                          run(
                            () => snoozeService(job.id, 30),
                            'Snoozed 30 days. It comes back, it does not go away.',
                          )
                        }
                      >
                        Snooze 30d
                      </ActionButton>
                    </div>
                  </div>
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
              {property.facts.map((f) => (
                <PropertyRow key={f.label} label={f.label} value={f.value} />
              ))}
              {data.propertyPremium !== null && (
                <PropertyRow label="Insurance" value={`${money(data.propertyPremium * 100)} / yr`} />
              )}
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
            {data.vendors.map((v) => (
              <div key={v.id} className="border-b border-rule py-3">
                <div className="flex items-baseline justify-between gap-2.5">
                  <span className="text-[13px] text-ink">{v.name}</span>
                  <span className="label text-[9px] tracking-[0.1em] text-ink-3">{v.trade}</span>
                </div>
                <div className="mt-1 text-[11px] text-ink-3">{v.contact}</div>
                <div className="mt-1 text-[11px] text-ink-3">
                  {v.lastUsedOn
                    ? `Last used ${monthYear(v.lastUsedOn)}${v.lastCostCents !== null ? ` · ${money(v.lastCostCents)}` : ''}`
                    : 'Not used yet'}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>

      <AssetDrawer
        asset={openAsset}
        log={openAsset ? data.log.filter((l) => l.assetId === openAsset.id) : []}
        onClose={() => setParams({ asset: null })}
      />
      <WarrantyDrawer warranty={openWarranty} onClose={() => setParams({ warranty: null })} />
      <LogServiceDrawer open={logging} data={data} onClose={() => setParams({ log: null })} run={run} />
    </div>
  )
}

/** A KPI card: 11px name, 25px number, 10px note. Four separate cards, not the joined strip. */
function Kpi({
  name,
  value,
  note,
  noteClass = 'text-ink-3',
}: {
  name: string
  value: string
  note: string
  noteClass?: string
}) {
  return (
    <Card className="p-[15px] px-[15px] py-[15px]">
      <span className="text-[11px] text-ink-3">{name}</span>
      <div className="num mt-2 text-[25px] font-light leading-none tracking-[-0.02em] text-ink">{value}</div>
      <div className={cn('num mt-1.5 text-[10px]', noteClass)}>{note}</div>
    </Card>
  )
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-rule py-[11px]">
      <span className="min-w-0 flex-[1_1_130px] text-[13px] text-ink">{label}</span>
      <span className="num shrink-0 text-[12px] text-ink-2">{value}</span>
    </div>
  )
}
