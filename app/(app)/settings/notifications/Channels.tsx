'use client'

import { useTransition } from 'react'
import { Switch, useToast } from '@/components/pos'
import type { Channel } from '@/core/notification-rules'
import { cn } from '@/lib/utils'
import type { CellState } from './ChannelGrid'
import { setChannelEverywhere } from './actions'

/**
 * The coarse channel switches: each writes its channel onto or off every
 * rule. `some` is a real third state (the amber border the grid uses too),
 * and pressing it turns the channel on everywhere.
 */
export function Channels({
  channels,
}: {
  channels: { value: Channel; label: string; sub: string; state: CellState }[]
}) {
  const [pending, start] = useTransition()
  const toast = useToast()

  return (
    <div className="mt-3 grid gap-px border border-rule bg-rule sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] rounded-[18px]">
      {channels.map((c) => (
        <div key={c.value} className="flex items-center justify-between gap-2.5 bg-bg px-3.5 py-3">
          <span>
            <span className="block text-[13px] text-ink">{c.label}</span>
            <span className="text-[11px] text-ink-3">{c.sub}</span>
          </span>
          <Switch
            label={c.label}
            checked={c.state === 'on'}
            disabled={pending}
            className={cn(c.state === 'some' && 'border-warn')}
            onChange={() =>
              start(async () => {
                const on = c.state !== 'on'
                const result = await setChannelEverywhere(c.value, on)
                toast(result.ok ? `${c.label} ${on ? 'on' : 'off'} for every rule.` : (result.error ?? 'Failed'))
              })
            }
          />
        </div>
      ))}
    </div>
  )
}
