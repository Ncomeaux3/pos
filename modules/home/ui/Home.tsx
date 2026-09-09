'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  MetricTile,
  Overlay,
  PillGroup,
  Row,
  RowList,
  StatusChip,
  fieldClass,
  useToast,
} from '@/components/pos'
import { cn } from '@/lib/utils'
import { dueLabel, monthKey, monthLabel, next12Months, type DueStatus } from '../schedule'
import { logService, markDone, snoozeService, type ActionResult } from './actions'

export type Fact = { label: string; value: string }

export type HomeData = {
  todayIso: string
  /** From Finance through the registry, or null when it is not installed. */
  netWorth: number | null
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

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'property', label: 'Property' },
  { value: 'vehicle', label: 'Vehicles' },
  { value: 'equipment', label: 'Equipment' },
]

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

const shortDate = (iso: string | null) => {
  if (!iso) return 'no date'
  const d = new Date(`${iso}T12:00:00`)
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

const STATE: Record<DueStatus, { label: string; tone: 'brand' | 'quiet' | 'warn' | 'bad' }> = {
  overdue: { label: 'Overdue', tone: 'bad' },
  due: { label: 'Service due', tone: 'warn' },
  soon: { label: 'Due soon', tone: 'quiet' },
  later: { label: 'Good', tone: 'brand' },
  snoozed: { label: 'Snoozed', tone: 'quiet' },
  unscheduled: { label: 'Good', tone: 'brand' },
}

/** Worst first, so an asset's chip shows the thing that needs attention. */
const SEVERITY: DueStatus[] = ['overdue', 'due', 'soon', 'snoozed', 'later', 'unscheduled']

export function Home({ data }: { data: HomeData }) {
  const router = useRouter()
  const params = useSearchParams()
  const filter = params.get('kind') ?? 'all'
  const month = params.get('month') ?? monthKey(data.todayIso)
  const openAsset = data.assets.find((a) => a.id === params.get('asset')) ?? null
  const openWarranty = data.warranties.find((w) => w.id === params.get('warranty')) ?? null
  const logging = params.get('log') === '1'

  const setParams = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
    const query = search.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }

  const [, start] = useTransition()
  const toast = useToast()

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  const scheduled = data.services.filter((s) => s.dueOn !== null)
  const months = next12Months(
    scheduled.map((s) => ({ dueOn: s.dueOn!, costEstimateCents: s.costEstimateCents })),
    data.todayIso,
  )
  const yearCents = months.reduce((sum, m) => sum + m.costCents, 0)
  const monthJobs = scheduled.filter((s) => monthKey(s.dueOn!) === month)
  const monthCents = monthJobs.reduce((sum, s) => sum + s.costEstimateCents, 0)

  const attention = data.services.filter((s) => s.status === 'overdue' || s.status === 'due')
  const nextUp = scheduled
    .filter((s) => s.status !== 'snoozed')
    .sort((a, b) => (a.dueOn! < b.dueOn! ? -1 : 1))[0]

  const shownAssets = data.assets.filter((a) => filter === 'all' || a.kind === filter)
  const valueCents = data.assets.reduce((sum, a) => sum + a.valueCents, 0)
  const upkeepCents = data.assets.reduce((sum, a) => sum + a.annualCostCents, 0)
  const property = data.assets.find((a) => a.kind === 'property') ?? null

  const worstFor = (assetId: string): DueStatus => {
    const here = data.services.filter((s) => s.assetId === assetId)
    for (const status of SEVERITY) if (here.some((s) => s.status === status)) return status
    return 'unscheduled'
  }

  const nextFor = (assetId: string) =>
    data.services
      .filter((s) => s.assetId === assetId && s.dueOn !== null)
      .sort((a, b) => (a.dueOn! < b.dueOn! ? -1 : 1))[0] ?? null

  return (
    <div className="space-y-5">
      <div className="grid gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))]">
        <MetricTile
          label="Assets tracked"
          value={data.assets.length}
          delta={FILTERS.slice(1)
            .map((f) => `${data.assets.filter((a) => a.kind === f.value).length} ${f.label.toLowerCase()}`)
            .join(' / ')}
        />
        <MetricTile
          label="Combined value"
          value={money(valueCents)}
          delta="your own estimate"
          deltaTone="quiet"
        />
        <MetricTile label="Annual upkeep" value={money(upkeepCents)} delta="tax and insurance included" />
        <MetricTile
          label="Next 12 months"
          value={money(yearCents)}
          delta={`${scheduled.length} scheduled jobs, estimated`}
          deltaTone="quiet"
        />
      </div>

      <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
        <div className="min-w-0 flex-[1_1_460px] space-y-5">
          <Card className="space-y-3">
            <CardHead label="Assets" meta={`${shownAssets.length} shown`} />
            <PillGroup
              label="Asset kinds"
              value={filter}
              options={FILTERS}
              onChange={(next) => setParams({ kind: next === 'all' ? null : next, asset: null })}
            />

            {shownAssets.length === 0 ? (
              <EmptyState headline="Nothing here" className="border-0">
                Nothing of this kind is tracked yet.
              </EmptyState>
            ) : (
              <RowList>
                {shownAssets.map((asset) => {
                  const status = worstFor(asset.id)
                  const next = nextFor(asset.id)
                  return (
                    <Row
                      key={asset.id}
                      title={asset.name}
                      meta={asset.subtitle}
                      selected={openAsset?.id === asset.id}
                      onClick={() => setParams({ asset: asset.id })}
                      right={
                        <>
                          <Chip tone="quiet">{asset.kind}</Chip>
                          <Chip tone={STATE[status].tone}>{STATE[status].label}</Chip>
                          <span className="num text-[11px] text-ink-2">{money(asset.valueCents)}</span>
                        </>
                      }
                    >
                      <p className="t-caption text-ink-3">
                        Annual cost {money(asset.annualCostCents)}
                        {next ? ` / next: ${next.title}, ${monthLabel(monthKey(next.dueOn!))}` : ' / nothing scheduled'}
                      </p>
                    </Row>
                  )
                })}
              </RowList>
            )}
          </Card>

          <Card className="space-y-3">
            <CardHead
              label="Maintenance, next 12 months"
              meta={`${scheduled.length} jobs / ${money(yearCents)} estimated`}
            />

            <div className="overflow-x-auto">
              <div className="grid min-w-[620px] grid-cols-12 gap-px bg-rule">
                {months.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setParams({ month: m.key })}
                    aria-pressed={m.key === month}
                    className={cn(
                      'space-y-1 px-1.5 py-2 text-left',
                      m.key === month ? 'bg-brand-soft' : 'bg-bg-elev',
                    )}
                  >
                    <span className="label block text-[9px] tracking-[0.1em] text-ink-3">
                      {m.label}
                    </span>
                    <span
                      className={cn(
                        'num block text-[13px]',
                        m.isCurrent ? 'text-brand' : m.count > 0 ? 'text-ink' : 'text-ink-4',
                      )}
                    >
                      {m.count > 0 ? m.count : '0'}
                    </span>
                    <span className="num block text-[10px] text-ink-3">
                      {m.costCents > 0 ? money(m.costCents) : 'no cost'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Eyebrow>{monthLabel(month)}</Eyebrow>
              <span className="num text-[11px] text-ink-3">
                {monthCents > 0 ? `${money(monthCents)} estimated` : 'no cost'}
              </span>
            </div>

            {monthJobs.length === 0 ? (
              <EmptyState headline="Nothing scheduled" className="border-0">
                No recurring service falls in this month.
              </EmptyState>
            ) : (
              <RowList>
                {monthJobs.map((job) => (
                  <Row
                    key={job.id}
                    title={job.title}
                    meta={`${job.assetName} / ${job.intervalMonths === 12 ? 'yearly' : job.intervalMonths > 0 ? `every ${job.intervalMonths} months` : 'one off'}${job.vendorName ? ` / ${job.vendorName}` : ''}`}
                    right={
                      <>
                        <span className="num text-[11px] text-ink-2">
                          {job.costEstimateCents > 0 ? money(job.costEstimateCents) : 'no estimate'}
                        </span>
                        <ActionButton
                          onClick={() =>
                            run(
                              () => markDone(job.id, job.assetId, job.title),
                              'Logged. The next one is scheduled on its interval.',
                            )
                          }
                        >
                          Mark done
                        </ActionButton>
                      </>
                    }
                  />
                ))}
              </RowList>
            )}
          </Card>

          <Card className="space-y-3">
            <CardHead
              label="Warranties and documents"
              meta={`${data.warranties.filter((w) => w.expiresOn !== null).length} with an expiry`}
            />
            <RowList>
              {data.warranties.map((w) => (
                <Row
                  key={w.id}
                  title={w.name}
                  meta={w.detail}
                  selected={openWarranty?.id === w.id}
                  onClick={() => setParams({ warranty: w.id })}
                  right={
                    <>
                      <Chip tone="quiet">{w.cover}</Chip>
                      <span className="num text-[11px] text-ink-3">
                        {/* No expiry is a real state for a deed, not a missing date. */}
                        {w.expiresOn ? shortDate(w.expiresOn) : 'no expiry'}
                      </span>
                    </>
                  }
                />
              ))}
            </RowList>
          </Card>
        </div>

        <div className="min-w-0 flex-[1_1_320px] space-y-5 md:max-w-[420px]">
          <Card className="space-y-3">
            <CardHead label="Needs attention" meta={attention.length > 0 ? `${attention.length}` : ''} />

            {attention.length === 0 ? (
              <p className="t-caption text-ink-3">
                Nothing outstanding.{' '}
                {nextUp
                  ? `The next scheduled job is ${nextUp.title} in ${monthLabel(monthKey(nextUp.dueOn!))}.`
                  : 'Nothing is scheduled.'}
              </p>
            ) : (
              <RowList>
                {attention.map((job) => (
                  <Row
                    key={job.id}
                    title={job.title}
                    meta={`${job.assetName} / ${dueLabel(
                      {
                        intervalMonths: job.intervalMonths,
                        lastDoneOn: job.lastDoneOn,
                        dueOn: job.dueOn,
                        snoozeUntil: job.snoozeUntil,
                      },
                      data.todayIso,
                    )}`}
                    right={
                      <>
                        <StatusChip tone={job.status === 'overdue' ? 'bad' : 'warn'}>
                          {STATE[job.status].label}
                        </StatusChip>
                        <ActionButton
                          variant="brand"
                          onClick={() =>
                            run(
                              () => markDone(job.id, job.assetId, job.title),
                              'Logged. The next one is scheduled on its interval.',
                            )
                          }
                        >
                          Mark done
                        </ActionButton>
                        <ActionButton
                          onClick={() =>
                            run(
                              () => snoozeService(job.id, 30),
                              'Snoozed 30 days. It comes back, it does not go away.',
                            )
                          }
                        >
                          Snooze 30d
                        </ActionButton>
                      </>
                    }
                  />
                ))}
              </RowList>
            )}

            <ActionButton variant="brand" onClick={() => setParams({ log: '1' })}>
              Log service
            </ActionButton>
          </Card>

          {property && (
            <Card className="space-y-2.5">
              <CardHead label="Property" meta={property.name} />
              {property.facts.map((f) => (
                <div key={f.label} className="flex items-baseline justify-between gap-3">
                  <span className="t-caption text-ink-3">{f.label}</span>
                  <span className="num text-[11px] text-ink-2">{f.value}</span>
                </div>
              ))}
              <p className="t-caption border-t border-rule pt-2 text-ink-3">
                {data.netWorth === null
                  ? 'Mortgage and escrow live in Finance, coverage in Insurance. Neither is installed, so neither number is shown here rather than kept twice and going stale.'
                  : 'Mortgage and escrow come from Finance, coverage from Insurance. They are read there rather than copied here, so there is one number and it is the current one.'}
              </p>
            </Card>
          )}

          <Card className="space-y-2.5">
            <CardHead label="Vendors" meta={`${data.vendors.length}`} />
            <RowList>
              {data.vendors.map((v) => (
                <Row
                  key={v.id}
                  title={v.name}
                  meta={`${v.trade}${v.contact ? ` / ${v.contact}` : ''}`}
                  right={
                    <span className="num text-[11px] text-ink-3">
                      {v.lastUsedOn
                        ? `${shortDate(v.lastUsedOn)}${v.lastCostCents !== null ? ` / ${money(v.lastCostCents)}` : ''}`
                        : 'not used yet'}
                    </span>
                  }
                />
              ))}
            </RowList>
          </Card>
        </div>
      </div>

      <Overlay
        open={openAsset !== null}
        onClose={() => setParams({ asset: null })}
        eyebrow={openAsset?.kind}
        title={openAsset?.name ?? ''}
      >
        {openAsset && (
          <div className="space-y-4">
            <p className="t-caption text-ink-3">{openAsset.subtitle}</p>

            <div className="space-y-1.5">
              {openAsset.facts.map((f) => (
                <div key={f.label} className="flex items-baseline justify-between gap-3">
                  <span className="t-caption text-ink-3">{f.label}</span>
                  <span className="num text-right text-[11px] text-ink-2">{f.value}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Eyebrow>Service history</Eyebrow>
              {data.log.filter((l) => l.assetId === openAsset.id).length === 0 ? (
                <p className="t-caption text-ink-3">Nothing logged yet.</p>
              ) : (
                <RowList>
                  {data.log
                    .filter((l) => l.assetId === openAsset.id)
                    .map((l) => (
                      <Row
                        key={l.id}
                        title={l.what}
                        meta={`${shortDate(l.doneOn)}${l.vendorName ? ` / ${l.vendorName}` : ''}`}
                        right={
                          <span className="num text-[11px] text-ink-2">
                            {/* Null is "no receipt to hand", which is not the
                                same claim as free. */}
                            {l.costCents === null ? 'no cost recorded' : money(l.costCents)}
                          </span>
                        }
                      />
                    ))}
                </RowList>
              )}
            </div>
          </div>
        )}
      </Overlay>

      <Overlay
        open={openWarranty !== null}
        onClose={() => setParams({ warranty: null })}
        eyebrow="Warranty"
        title={openWarranty?.name ?? ''}
      >
        {openWarranty && (
          <div className="space-y-4">
            <p className="t-caption text-ink-3">{openWarranty.detail}</p>
            <div className="space-y-1.5">
              {openWarranty.facts.map((f) => (
                <div key={f.label} className="flex items-baseline justify-between gap-3">
                  <span className="t-caption text-ink-3">{f.label}</span>
                  <span className="num text-right text-[11px] text-ink-2">{f.value}</span>
                </div>
              ))}
            </div>
            {openWarranty.documentUrl && (
              <a className="t-caption text-brand" href={openWarranty.documentUrl}>
                Open the file
              </a>
            )}
          </div>
        )}
      </Overlay>

      <LogServiceDrawer
        open={logging}
        data={data}
        onClose={() => setParams({ log: null })}
        run={run}
      />
    </div>
  )
}

function LogServiceDrawer({
  open,
  data,
  onClose,
  run,
}: {
  open: boolean
  data: HomeData
  onClose: () => void
  run: (action: () => Promise<ActionResult>, ok?: string) => void
}) {
  const [assetId, setAssetId] = useState(data.assets[0]?.id ?? '')
  const [what, setWhat] = useState('')
  const [doneOn, setDoneOn] = useState(data.todayIso)
  const [cost, setCost] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [intervalMonths, setIntervalMonths] = useState('12')

  const submit = () => {
    run(
      () =>
        logService({
          assetId,
          what,
          doneOn,
          // Empty means the receipt is not to hand, which is not a claim that
          // it was free. Null rather than zero.
          costCents: cost.trim() === '' ? null : Math.round(Number(cost) * 100),
          vendorId: vendorId || null,
          intervalMonths: Number(intervalMonths),
        }),
      Number(intervalMonths) > 0
        ? 'Logged, and the next one is on the calendar.'
        : 'Logged to the service history.',
    )
    setWhat('')
    setCost('')
    onClose()
  }

  return (
    <Overlay
      open={open}
      onClose={onClose}
      eyebrow="New entry"
      title="Log service"
      footer={
        <div className="flex gap-2">
          <ActionButton variant="brand" disabled={!what.trim() || !assetId} onClick={submit}>
            Save service
          </ActionButton>
          <ActionButton onClick={onClose}>Cancel</ActionButton>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="t-caption text-ink-3">
          Logs what was done and, if you give it an interval, schedules the next one from this date.
        </p>

        <label className="block space-y-1.5">
          <Eyebrow>Asset</Eyebrow>
          <select
            value={assetId}
            aria-label="Asset"
            onChange={(e) => setAssetId(e.target.value)}
            className={cn(fieldClass, 'w-full')}
          >
            {data.assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <Eyebrow>What was done</Eyebrow>
          <input
            value={what}
            aria-label="What was done"
            onChange={(e) => setWhat(e.target.value)}
            placeholder="Gutter clean and reseal"
            className={cn(fieldClass, 'w-full')}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <label className="min-w-0 flex-1 space-y-1.5">
            <Eyebrow>Date</Eyebrow>
            <input
              type="date"
              aria-label="Date"
              value={doneOn}
              onChange={(e) => setDoneOn(e.target.value)}
              className={cn(fieldClass, 'w-full')}
            />
          </label>
          <label className="min-w-0 flex-1 space-y-1.5">
            <Eyebrow>Cost</Eyebrow>
            <input
              inputMode="decimal"
              aria-label="Cost"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="leave blank if unknown"
              className={cn(fieldClass, 'w-full')}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <Eyebrow>Vendor</Eyebrow>
          <select
            value={vendorId}
            aria-label="Vendor"
            onChange={(e) => setVendorId(e.target.value)}
            className={cn(fieldClass, 'w-full')}
          >
            <option value="">Did it myself</option>
            {data.vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-1.5">
          <Eyebrow>Schedule the next one</Eyebrow>
          <PillGroup
            label="Interval"
            value={intervalMonths}
            options={[
              { value: '0', label: 'One off' },
              { value: '3', label: '3 months' },
              { value: '6', label: '6 months' },
              { value: '12', label: 'Yearly' },
              { value: '24', label: '2 years' },
            ]}
            onChange={setIntervalMonths}
          />
        </div>
      </div>
    </Overlay>
  )
}
