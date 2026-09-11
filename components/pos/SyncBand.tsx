'use client'

import { useTransition } from 'react'
import { cn } from '@/lib/utils'
import { ActionButton } from './Button'
import { Eyebrow } from './text'
import { useToast } from './Toast'

/**
 * "SimpleFIN Bridge · synced 04:02" and a Sync now button, for a module
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
        {' · '}
        {!connected
          ? 'not connected'
          : status === 'failed'
            ? 'last sync failed'
            : at
              ? `synced ${clock(at)}`
              : 'never synced'}
      </Eyebrow>
      {/* The DS button at 51px on the desktop band, the 44px control on a phone. */}
      <ActionButton
        variant="solid"
        size="xl"
        className="h-11 gap-2 px-3 text-[12px] md:h-[51px] md:px-[22px] md:text-[15px]"
        onClick={sync}
        disabled={pending}
      >
        <span className={cn(pending && 'animate-pulse')}>{pending ? 'Syncing' : 'Sync now'}</span>
        {!pending && <span aria-hidden="true">&rarr;</span>}
      </ActionButton>
    </>
  )
}

/**
 * "04:02", the run's clock as the artboard prints it, in the device's zone:
 * this is a client component and the device is the owner's. A run older than
 * today says its date too, so "04:02" never means last week's.
 */
function clock(iso: string): string {
  const at = new Date(iso)
  const time = at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  const sameDay = at.toDateString() === new Date().toDateString()
  return sameDay ? time : `${at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`
}
