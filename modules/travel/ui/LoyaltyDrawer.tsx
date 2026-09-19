'use client'

import { useState, useTransition } from 'react'
import { DataRow, DataTable, Eyebrow, Overlay, fieldClass, useToast } from '@/components/pos'
import { parseNumber } from '@/core/numbers'
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
  const cpp = centsPerPoint(Math.round((parseNumber(cash) ?? 0) * 100), parseNumber(points) ?? 0)

  return (
    <Overlay
      open
      onClose={onClose}
      eyebrow="Travel / Loyalty"
      title="Loyalty"
      lede="Balances you type; no programme publishes an API worth reading. The move shown in the strip is against the last figure you entered."
    >
      <DataTable head={['Program', 'Balance']} cols="minmax(0,1fr) 130px">
        {loyalty.map((p) => (
          <DataRow key={p.id}>
            <span className="min-w-0">
              <span className="block truncate text-ink">{p.name}</span>
              <span className="mt-0.5 block text-[11px] text-ink-3">{[p.kind, p.statusTier].filter(Boolean).join(' · ')}</span>
            </span>
            <input
              inputMode="decimal"
              defaultValue={p.balance}
              aria-label={`${p.name} balance`}
              onBlur={(e) => {
                const next = parseNumber(e.target.value)
                if (next === null || next === p.balance) return
                start(async () => {
                  const result = await saveLoyalty(p.name, next, p.kind as 'airline' | 'hotel' | 'card' | 'rail')
                  toast(result.ok ? `${p.name} saved` : result.error)
                })
              }}
              className={cn(fieldClass, 'num w-[130px] max-w-full py-1.5 text-right')}
            />
          </DataRow>
        ))}
      </DataTable>

      <div className="mt-5 border border-rule px-3.5 py-3 rounded-[18px]">
        <div className="flex items-baseline justify-between">
          <Eyebrow>Cents per point</Eyebrow>
          <Eyebrow className="text-[11px]">Both numbers yours</Eyebrow>
        </div>
        <p className="mt-2 text-[12px] leading-[1.5] text-ink-3">
          What the cash fare would have been, against the points it would cost. Above about 1.5
          cents a point is usually worth spending them; below it, pay cash and keep the points.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <label className="space-y-1.5">
            <Eyebrow className="text-[10px]">Cash fare</Eyebrow>
            <input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} aria-label="Cash fare in dollars" placeholder="640" className={cn(fieldClass, 'w-full')} />
          </label>
          <label className="space-y-1.5">
            <Eyebrow className="text-[10px]">Points</Eyebrow>
            <input inputMode="decimal" value={points} onChange={(e) => setPoints(e.target.value)} aria-label="Points required" placeholder="35000" className={cn(fieldClass, 'w-full')} />
          </label>
        </div>
        <div className="mt-3 flex items-baseline gap-2.5">
          <span className="num text-[22px] font-light leading-none text-ink">{cpp === null ? '--' : `${cpp.toFixed(2)}c`}</span>
          <span className={cn('text-[12px]', cpp === null ? 'text-ink-3' : cpp >= 1.5 ? 'text-ok' : 'text-warn')}>
            {cpp === null ? 'Enter both' : cpp >= 1.5 ? 'Worth using points' : 'Pay cash'}
          </span>
        </div>
      </div>
    </Overlay>
  )
}
