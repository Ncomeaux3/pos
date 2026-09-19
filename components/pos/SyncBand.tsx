'use client'

import { useTransition } from 'react'
import { syncClock } from '@/core/clock'
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
  arrived,
  timeZone,
  onSync,
}: {
  /** The integration's label, or null when the module imports from nothing. */
  provider: string | null
  /** ISO timestamp of the last run, or null if it has never run. */
  at: string | null
  status: string | null
  /** False when the provider has no credentials. */
  connected?: boolean
  /** ISO timestamp of the last inbound payload from a phone, where a module takes one. */
  arrived?: string | null
  /** The owner's zone from core.settings: the clocks below are printed in it on the server and the device alike. */
  timeZone: string
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
      {/* The reading is desktop only: passed as a phoneAction, the band is
        * the button alone, which is all the phone's right slot has room for. */}
      <Eyebrow
        className="hidden md:inline-flex"
        dot={!connected ? 'idle' : status === 'failed' ? 'bad' : at ? 'ok' : 'idle'}
      >
        {provider ?? 'Manual entry'}
        {' · '}
        {!connected
          ? 'not connected'
          : status === 'failed'
            ? 'last sync failed'
            : at
              ? `synced ${syncClock(at, timeZone)}`
              : 'never synced'}
      </Eyebrow>
      {/* Inbound data has no job row to read, so it gets its own line rather
        * than moving the provider's clock: "Strava · synced 07:02" for an
        * Apple payload would name the wrong source. */}
      {arrived !== undefined && (
        <span className="num hidden text-[11px] text-ink-3 md:inline">
          Apple data last arrived {arrived ? syncClock(arrived, timeZone) : 'never'}
        </span>
      )}
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
