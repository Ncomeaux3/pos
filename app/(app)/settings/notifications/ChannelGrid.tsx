'use client'

import { useTransition } from 'react'
import { DataRow, DataTable, Switch, useToast } from '@/components/pos'
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
    <div className="flex items-center md:justify-center">
      <Switch
        label={`${label} for ${row.label}`}
        disabled={pending}
        checked={state === 'on'}
        onChange={() => write(state !== 'on')}
        className={cn(state === 'some' && 'border-warn')}
      />
    </div>
  )

  // The three switch columns are headed by their channel; the phone drops the
  // head, so each switch keeps its own "Digest for Finance" name.
  return (
    <DataTable
      className="mt-2"
      cols="1.2fr repeat(3, 56px) 1.6fr"
      head={[
        'Module',
        <span key="d" className="block text-center">
          Digest
        </span>,
        <span key="p" className="block text-center">
          Push
        </span>,
        <span key="i" className="block text-center">
          In-app
        </span>,
        'What triggers it',
      ]}
    >
      {rows.map((row) => (
        <DataRow key={row.id} className="text-[13px]">
          <span className={cn('min-w-0 truncate', paused ? 'text-ink-3' : 'text-ink')}>{row.label}</span>

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

          <p className="t-caption min-w-0 text-ink-3 max-md:text-left">{row.triggers}</p>
        </DataRow>
      ))}
    </DataTable>
  )
}
