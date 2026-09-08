'use client'

import { useTransition } from 'react'
import { Switch, useToast } from '@/components/pos'
import type { Channel } from '@/core/notification-rules'
import { cn } from '@/lib/utils'
import { setModuleChannel, setModuleDigest } from './actions'

export type CellState = 'on' | 'off' | 'some'

export type ModuleRow = {
  id: string
  label: string
  digest: CellState
  push: CellState
  inapp: CellState
  triggers: string
  liveCount: number
  ruleCount: number
}

/**
 * Module down the side, the three coarse switches across. A cell writes every
 * rule in its row, so `some` is a real third state and pressing it turns the
 * whole row on rather than toggling to the majority.
 */
export function ChannelGrid({ rows, paused }: { rows: ModuleRow[]; paused: boolean }) {
  const [pending, start] = useTransition()
  const toast = useToast()

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, note: string) =>
    start(async () => {
      const result = await action()
      toast(result.ok ? note : (result.error ?? 'Failed'))
    })

  const cell = (row: ModuleRow, state: CellState, label: string, write: (on: boolean) => void) => (
    <div className="flex items-center justify-center">
      <Switch
        label={`${label} for ${row.label}`}
        disabled={pending}
        checked={state === 'on'}
        onChange={() => write(state !== 'on')}
        className={cn(state === 'some' && 'border-warn')}
      />
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="label grid grid-cols-[1.2fr_repeat(3,48px)_1.6fr] items-center gap-x-3.5 border-b border-rule-2 pb-2 text-[10px] tracking-[0.08em] text-ink-3">
          <span>Module</span>
          <span className="text-center">Digest</span>
          <span className="text-center">Push</span>
          <span className="text-center">In-app</span>
          <span>What triggers it</span>
        </div>

        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1.2fr_repeat(3,48px)_1.6fr] items-center gap-x-3.5 border-b border-rule py-2.5 last:border-b-0"
          >
            <div className="min-w-0">
              <p className={cn('t-caption', paused ? 'text-ink-3' : 'text-ink')}>{row.label}</p>
              <p className="t-caption text-ink-3">
                {row.liveCount} of {row.ruleCount} live
              </p>
            </div>

            {cell(row, row.digest, 'Digest', (on) =>
              run(
                () => setModuleDigest(row.id, on),
                on
                  ? `${row.label} batches into the morning digest.`
                  : `${row.label} delivers immediately.`,
              ),
            )}
            {cell(row, row.push, 'Push', (on) =>
              run(
                () => setModuleChannel(row.id, 'push' satisfies Channel, on),
                `Push ${on ? 'on' : 'off'} for ${row.label}.`,
              ),
            )}
            {cell(row, row.inapp, 'In-app', (on) =>
              run(
                () => setModuleChannel(row.id, 'inapp' satisfies Channel, on),
                `In-app ${on ? 'on' : 'off'} for ${row.label}.`,
              ),
            )}

            <p className="t-caption min-w-0 text-ink-3">{row.triggers}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
