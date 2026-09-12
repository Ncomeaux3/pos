'use client'

import { useState, useTransition } from 'react'
import { Eyebrow, Overlay, fieldClass, useToast } from '@/components/pos'
import { cn } from '@/lib/utils'
import { centsPerPoint } from '../globe'
import { saveLoyalty } from './actions'
import type { TravelData } from './Travel'

// Behind the strip's Manage: every balance as a number you type (no loyalty
// site is scraped, per SPEC), and the cents-per-point calculator over two
// numbers you supply.

export function LoyaltyDrawer({
  loyalty,
  onClose,
}: {
  loyalty: TravelData['loyalty']
  onClose: () => void
}) {
  const [, start] = useTransition()
  const toast = useToast()
  const [cash, setCash] = useState('')
  const [points, setPoints] = useState('')
  const cpp = centsPerPoint(Math.round(Number(cash) * 100) || 0, Number(points) || 0)

  return (
    <Overlay
      open
      onClose={onClose}
      eyebrow="Travel / Loyalty"
      title="Loyalty"
      lede="Balances you type; no programme publishes an API worth reading. The move shown in the strip is against the last figure you entered."
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_130px] gap-x-3.5 border-b border-rule-2 py-[7px]">
        {['Program', 'Kind', 'Balance'].map((h, i) => (
          <span key={h} className={cn('label text-[11px] tracking-[0.08em] text-ink-3', i > 0 && 'text-right')}>
            {h}
          </span>
        ))}
      </div>
      {loyalty.map((p) => (
        <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto_130px] items-center gap-x-3.5 border-b border-rule py-2.5 text-[13px]">
          <span className="min-w-0">
            <span className="block truncate text-ink">{p.name}</span>
            {p.statusTier && <span className="mt-0.5 block text-[11px] text-ink-3">{p.statusTier}</span>}
          </span>
          <span className="text-[11px] text-ink-3">{p.kind}</span>
          <input
            type="number"
            min={0}
            step={1}
            defaultValue={p.balance}
            aria-label={`${p.name} balance`}
            onBlur={(e) => {
              const next = Number(e.target.value)
              if (!Number.isFinite(next) || next === p.balance) return
              start(async () => {
                const result = await saveLoyalty(p.name, next, p.kind as 'airline' | 'hotel' | 'card' | 'rail')
                toast(result.ok ? `${p.name} saved` : result.error)
              })
            }}
            className="num w-full border border-rule-2 bg-bg px-2.5 py-1.5 text-right text-[13px] text-ink outline-none focus-visible:border-brand"
          />
        </div>
      ))}

      <div className="mt-5 border border-rule px-3.5 py-3">
        <div className="flex items-baseline justify-between">
          <Eyebrow>Cents per point</Eyebrow>
          <span className="label text-[11px] text-ink-3">both numbers yours</span>
        </div>
        <p className="mt-2 text-[12px] leading-[1.5] text-ink-3">
          What the cash fare would have been, against the points it would cost. Above about 1.5
          cents a point is usually worth spending them; below it, pay cash and keep the points.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <label className="space-y-1.5">
            <Eyebrow className="text-[10px]">Cash fare</Eyebrow>
            <input type="number" min={0} value={cash} onChange={(e) => setCash(e.target.value)} aria-label="Cash fare in dollars" placeholder="640" className={cn(fieldClass, 'w-full')} />
          </label>
          <label className="space-y-1.5">
            <Eyebrow className="text-[10px]">Points</Eyebrow>
            <input type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} aria-label="Points required" placeholder="35000" className={cn(fieldClass, 'w-full')} />
          </label>
        </div>
        <div className="mt-3 flex items-baseline gap-2.5">
          <span className="num text-[22px] font-light leading-none text-ink">{cpp === null ? '--' : `${cpp.toFixed(2)}c`}</span>
          <span className={cn('label text-[10px] tracking-[0.1em]', cpp === null ? 'text-ink-3' : cpp >= 1.5 ? 'text-ok' : 'text-warn')}>
            {cpp === null ? 'enter both' : cpp >= 1.5 ? 'worth using points' : 'pay cash'}
          </span>
        </div>
      </div>
    </Overlay>
  )
}
