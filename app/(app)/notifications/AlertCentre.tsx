'use client'

import { useState, useTransition } from 'react'
import { ActionButton, EmptyState, Eyebrow, StatusDot, useToast } from '@/components/pos'
import type { DotTone } from '@/components/pos'
import { cn } from '@/lib/utils'
import { readAlert, readAllAlerts } from './actions'

export type AlertItem = {
  id: string
  title: string
  body: string
  module: string
  via: string
  time: string
  tone: DotTone
  read: boolean
}

/**
 * Unread first with the accent fill, then history. History is ink-3 rather than
 * faded: the design's rule is that a de-emphasised row keeps full opacity so its
 * text and any button inside stay readable.
 */
export function AlertCentre({ alerts }: { alerts: AlertItem[] }) {
  const [showHistory, setShowHistory] = useState(true)
  const [, start] = useTransition()
  const toast = useToast()

  const unread = alerts.filter((a) => !a.read)
  const history = alerts.filter((a) => a.read)

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const result = await action()
      if (!result.ok && result.error) toast(result.error)
    })

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <Eyebrow dot={unread.length > 0 ? 'warn' : 'ok'}>
          Alert centre / {unread.length} unread
        </Eyebrow>
        <div className="flex gap-2">
          <ActionButton disabled={unread.length === 0} onClick={() => run(readAllAlerts)}>
            Mark all read
          </ActionButton>
          <ActionButton onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? 'Hide history' : 'Show history'}
          </ActionButton>
        </div>
      </div>

      {unread.length === 0 ? (
        <EmptyState headline="Inbox zero">
          Everything raised so far has been read. New alerts land here the moment a rule fires.
        </EmptyState>
      ) : (
        <div>
          {unread.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-start gap-x-3.5 gap-y-2 border-b border-rule bg-brand-soft px-3 py-3.5"
            >
              <StatusDot tone={a.tone} className="mt-2" />
              <div className="min-w-0 flex-1 basis-[180px] space-y-1">
                <div className="flex flex-wrap items-baseline gap-x-2.5">
                  <span className="label text-[10px] tracking-[0.12em] text-ok">{a.module}</span>
                  <span className="label text-[10px] tracking-[0.1em] text-ink-3">{a.via}</span>
                </div>
                <p className="t-body text-ink">{a.title}</p>
                {a.body && <p className="t-caption text-ink-3">{a.body}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="label text-[10px] text-ink-3">{a.time}</span>
                <ActionButton onClick={() => run(() => readAlert(a.id))}>Read</ActionButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {showHistory && history.length > 0 && (
        <div className="space-y-2 pt-4">
          <Eyebrow className="text-[10px] tracking-[0.12em]">History / {history.length}</Eyebrow>
          <div>
            {history.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-start gap-x-3.5 gap-y-2 border-b border-rule px-3 py-3"
              >
                <StatusDot tone="idle" className="mt-2" />
                <div className="min-w-0 flex-1 basis-[180px] space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5">
                    <span className={cn('label text-[10px] tracking-[0.12em] text-ink-3')}>
                      {a.module}
                    </span>
                    <span className="label text-[10px] tracking-[0.1em] text-ink-3">{a.via}</span>
                  </div>
                  <p className="t-caption text-ink-2">{a.title}</p>
                </div>
                <span className="label shrink-0 text-[10px] text-ink-3">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
