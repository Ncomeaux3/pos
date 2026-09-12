'use client'

import { useState } from 'react'
import { ActionButton, Overlay, PillGroup, fieldClass } from '@/components/pos'
import { cn } from '@/lib/utils'
import { addMonths, logDate, money, monthKey, monthLabelLong } from '../schedule'
import { logService, type ActionResult } from './actions'
import type { Fact, HomeData } from './Home'

// The three drawers: an asset, a warranty, the Log service form. The shared
// Overlay at `narrow` draws the band and the title; what is here is the rows.

const KEY = 'label w-[126px] shrink-0 text-[10px] tracking-[0.12em] text-ink-3'
const FIELD = cn(fieldClass, 'h-[42px] px-3 text-[14px]')
const LABEL = 'label text-[10px] tracking-[0.12em] text-ink-3'

function FactRows({ facts }: { facts: Fact[] }) {
  return (
    <div>
      {facts.map((f) => (
        <div
          key={f.label}
          className="flex flex-wrap items-baseline gap-x-3.5 gap-y-2 border-b border-rule py-[13px]"
        >
          <span className={KEY}>{f.label}</span>
          <span className="min-w-0 flex-[1_1_160px] text-[14px] leading-[1.45] text-ink">{f.value}</span>
        </div>
      ))}
    </div>
  )
}

const closeFooter = (onClose: () => void) => (
  <ActionButton variant="accent" className="h-10 px-4 text-[13px]" onClick={onClose}>
    Close
  </ActionButton>
)

export function AssetDrawer({
  asset,
  log,
  onClose,
}: {
  asset: HomeData['assets'][number] | null
  log: HomeData['log']
  onClose: () => void
}) {
  return (
    <Overlay
      open={asset !== null}
      onClose={onClose}
      narrow
      eyebrow={asset?.kind}
      title={asset?.name ?? ''}
      lede={asset?.subtitle}
      footer={closeFooter(onClose)}
    >
      {asset && (
        <div className="space-y-[22px]">
          <FactRows facts={asset.facts} />
          {log.length > 0 && (
            <div>
              <span className={LABEL}>Service history</span>
              {log.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-rule py-[11px]"
                >
                  <span className="num w-[74px] shrink-0 text-[10px] text-ink-3">{logDate(l.doneOn)}</span>
                  <span className="min-w-0 flex-[1_1_140px] text-[13px] leading-[1.4] text-ink">
                    {l.what}
                    {l.vendorName ? ` · ${l.vendorName}` : ''}
                  </span>
                  <span className="num shrink-0 text-[11px] text-ink-3">
                    {/* Null is "no receipt to hand", which is not the same claim as free. */}
                    {l.costCents === null ? 'not recorded' : money(l.costCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Overlay>
  )
}

export function WarrantyDrawer({
  warranty,
  onClose,
}: {
  warranty: HomeData['warranties'][number] | null
  onClose: () => void
}) {
  return (
    <Overlay
      open={warranty !== null}
      onClose={onClose}
      narrow
      eyebrow="Warranty"
      title={warranty?.name ?? ''}
      lede={warranty?.detail}
      footer={closeFooter(onClose)}
    >
      {warranty && (
        <div className="space-y-[22px]">
          <FactRows facts={warranty.facts} />
          {warranty.documentUrl && (
            <a className="block text-[12px] text-brand" href={warranty.documentUrl}>
              Open the file
            </a>
          )}
        </div>
      )}
    </Overlay>
  )
}

const INTERVALS = [
  { value: '0', label: 'One off' },
  { value: '3', label: 'Every 3 mo' },
  { value: '6', label: 'Every 6 mo' },
  { value: '12', label: 'Yearly' },
  { value: '24', label: 'Every 2 yr' },
]

export function LogServiceDrawer({
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
  const [notes, setNotes] = useState('')
  const [missing, setMissing] = useState(false)

  const months = Number(intervalMonths)
  const lands = doneOn ? ` (${monthLabelLong(monthKey(addMonths(doneOn, months)))})` : ''

  const submit = () => {
    if (!what.trim() || !doneOn) {
      setMissing(true)
      return
    }
    run(
      () =>
        logService({
          assetId,
          what: what.trim(),
          doneOn,
          // Empty means the receipt is not to hand, which is not a claim that
          // it was free. Null rather than zero.
          costCents: cost.trim() === '' ? null : Math.round(Number(cost.replace(/[^0-9.]/g, '')) * 100),
          vendorId: vendorId || null,
          intervalMonths: months,
          notes: notes.trim(),
        }),
      months > 0
        ? `Logged. Next one scheduled for ${monthLabelLong(monthKey(addMonths(doneOn, months)))}.`
        : 'Logged to the service history.',
    )
    setWhat('')
    setCost('')
    setNotes('')
    setMissing(false)
    onClose()
  }

  return (
    <Overlay
      open={open}
      onClose={onClose}
      narrow
      eyebrow="New entry"
      title="Log service"
      lede="Logs what was done and, if you pick an interval, schedules the next one on the calendar."
      footer={
        <div className="flex gap-2.5">
          <ActionButton variant="accent" className="h-10 px-4 text-[13px]" onClick={submit}>
            Save service
          </ActionButton>
          <ActionButton className="label h-10 px-4 text-[11px] tracking-[0.12em] sm:h-10" onClick={onClose}>
            Cancel
          </ActionButton>
        </div>
      }
    >
      <div className="flex flex-col gap-[18px]">
        <div>
          <span className={LABEL}>Asset</span>
          <select
            value={assetId}
            aria-label="Asset"
            onChange={(e) => setAssetId(e.target.value)}
            className={cn(FIELD, 'mt-2.5')}
          >
            {data.assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex flex-col gap-2">
          <span className={LABEL}>What was done</span>
          <input
            value={what}
            aria-label="What was done"
            onChange={(e) => setWhat(e.target.value)}
            placeholder="Replaced the water heater anode rod"
            className={FIELD}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <label className="flex min-w-0 flex-[1_1_140px] flex-col gap-2">
            <span className={LABEL}>Date</span>
            <input
              type="date"
              aria-label="Date"
              value={doneOn}
              onChange={(e) => setDoneOn(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="flex min-w-0 flex-[1_1_110px] flex-col gap-2">
            <span className={LABEL}>Cost</span>
            <input
              inputMode="decimal"
              aria-label="Cost"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="$180"
              className={FIELD}
            />
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className={LABEL}>Vendor</span>
          <select
            value={vendorId}
            aria-label="Vendor"
            onChange={(e) => setVendorId(e.target.value)}
            className={FIELD}
          >
            {data.vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
            <option value="">Did it myself</option>
          </select>
        </label>

        <div>
          <span className={LABEL}>Schedule the next one</span>
          <PillGroup
            label="Interval"
            value={intervalMonths}
            options={INTERVALS}
            onChange={setIntervalMonths}
            className="mt-2.5"
          />
        </div>

        <label className="flex flex-col gap-2">
          <span className={LABEL}>Notes</span>
          <textarea
            value={notes}
            aria-label="Notes"
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Part numbers, what to watch, who to call next time"
            className={cn(fieldClass, 'min-h-[88px] resize-y px-3 py-2.5 text-[14px] leading-[1.5]')}
          />
        </label>

        <p className={cn('text-[12px] leading-[1.5]', missing ? 'text-bad' : 'text-ink-3')}>
          {missing
            ? 'A description and a date are required.'
            : months === 0
              ? 'One off: nothing gets added to the calendar.'
              : `The next one lands ${months} months out${lands} on the maintenance calendar.`}
        </p>
      </div>
    </Overlay>
  )
}
