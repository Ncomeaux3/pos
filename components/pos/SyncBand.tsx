'use client'

import { useTransition } from 'react'
import { cn } from '@/lib/utils'
import { ActionButton } from './Button'
import { Eyebrow } from './text'
import { useToast } from './Toast'

/**
 * "SimpleFIN Bridge / synced 2h ago" and a Sync now button, for a module
 * header's first band.
 *
 * What it says is a fact from core.jobs: the same row the nightly run writes,
 * so a module that has never pulled says so rather than showing a time that
 * came from somewhere else.
 */
export function SyncBand({
  provider,
  at,
  status,
  connected = true,
  onSync,
}: {
  /** The integration's label, or null when the module imports from nothing. */
  provider: string | null
  /** ISO timestamp of the last run, or null if it has never run. */
  at: string | null
  status: string | null
  /** False when the provider has no credentials. */
  connected?: boolean
  onSync: () => Promise<{ ran: number; failed: string[] }>
}) {
  const [pending, start] = useTransition()
  const toast = useToast()

  const sync = () =>
    start(async () => {
      const result = await onSync()
      toast(
        result.failed.length > 0
          ? `${result.failed.join(', ')} failed. The Agent Log has the error.`
          : result.ran === 0
            ? 'Nothing to sync: this module imports from nothing.'
            : 'Synced.',
      )
    })

  return (
    <>
      <Eyebrow dot={!connected ? 'idle' : status === 'failed' ? 'bad' : at ? 'ok' : 'idle'}>
        {provider ?? 'Manual entry'}
        {' / '}
        {!connected
          ? 'not connected'
          : status === 'failed'
            ? 'last sync failed'
            : at
              ? `synced ${ago(at)}`
              : 'never synced'}
      </Eyebrow>
      <ActionButton variant="outline" onClick={sync} disabled={pending}>
        <span className={cn(pending && 'animate-pulse')}>{pending ? 'Syncing' : 'Sync now'}</span>
      </ActionButton>
    </>
  )
}

/** "just now", "12m ago", "3h ago", "2d ago". */
function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}
