'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useToast } from '@/components/pos'
import { cn } from '@/lib/utils'
import { readAlert, snoozeAlert } from './notifications/actions'
import { approveProposal, dismissProposal } from './review/actions'

// The two tiles you act on without leaving the dashboard.
//
// Both call the same server actions their own screens do, so a decision made
// here and a decision made there are the same write. Nothing is a dashboard
// only code path.

const MINI =
  'h-11 shrink-0 border border-rule-2 px-2 text-[11px] text-ink-3 transition-colors duration-150 ' +
  'hover:border-ink hover:text-ink disabled:opacity-50 sm:h-[23px]'

export function WarningList({
  warnings,
  phoneLimit,
}: {
  warnings: { id: string; title: string; sub: string; urgent: boolean }[]
  /** Rows shown below md; the rest sit behind a link, so Home fits in two swipes. */
  phoneLimit?: number
}) {
  const [gone, setGone] = useState<string[]>([])
  const [asking, setAsking] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const toast = useToast()

  // Optimistic, and it stays gone: the row is removed here the moment the
  // action is sent, and the server revalidation confirms it a beat later. A
  // failure puts it back and says why.
  const act = (id: string, run: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setGone((g) => [...g, id])
    setAsking(null)
    start(async () => {
      const result = await run()
      if (!result.ok) {
        setGone((g) => g.filter((x) => x !== id))
        toast(result.error)
      }
    })
  }

  const shown = warnings.filter((w) => !gone.includes(w.id))

  if (shown.length === 0) {
    return (
      <p className="grid flex-1 place-items-center text-[26px] font-light text-ink-3">0 warnings</p>
    )
  }

  return (
    <div className="flex flex-col">
      {shown.map((w, i) => (
        <div
          key={w.id}
          className={cn(
            'flex items-center justify-between gap-2.5 border-b border-rule px-1 py-2 hover:bg-brand-soft',
            phoneLimit !== undefined && i >= phoneLimit && 'max-md:hidden',
          )}
        >
          <span className="grid min-w-0 grid-cols-[8px_1fr] items-start gap-2.5">
            <span
              className={cn('mt-[5px] size-1.5', w.urgent ? 'bg-bad' : 'bg-warn')}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block text-[13px] leading-[1.35] text-ink">{w.title}</span>
              {w.sub && <span className="mt-0.5 block truncate text-[11px] text-ink-3">{w.sub}</span>}
            </span>
          </span>

          <span className="flex shrink-0 gap-1">
            {asking === w.id ? (
              <>
                <button
                  type="button"
                  className={MINI}
                  disabled={pending}
                  onClick={() => act(w.id, () => snoozeAlert(w.id, 1))}
                >
                  1d
                </button>
                <button
                  type="button"
                  className={MINI}
                  disabled={pending}
                  onClick={() => act(w.id, () => snoozeAlert(w.id, 7))}
                >
                  7d
                </button>
              </>
            ) : (
              <>
                <button type="button" className={MINI} onClick={() => setAsking(w.id)}>
                  Snooze
                </button>
                <button
                  type="button"
                  aria-label={`Dismiss ${w.title}`}
                  className={cn(MINI, 'hover:border-bad hover:text-bad')}
                  disabled={pending}
                  onClick={() => act(w.id, () => readAlert(w.id))}
                >
                  ✕
                </button>
              </>
            )}
          </span>
        </div>
      ))}
      <More count={phoneLimit === undefined ? 0 : shown.length - phoneLimit} href="/notifications" />
    </div>
  )
}

export function ProposalList({
  proposals,
  phoneLimit,
}: {
  phoneLimit?: number
  proposals: { id: string; title: string; from: string }[]
}) {
  const [gone, setGone] = useState<string[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [pending, start] = useTransition()
  const toast = useToast()

  const act = (id: string, run: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setGone((g) => [...g, id])
    setEditing(null)
    start(async () => {
      const result = await run()
      if (!result.ok) {
        setGone((g) => g.filter((x) => x !== id))
        toast(result.error)
      }
    })
  }

  const shown = proposals.filter((p) => !gone.includes(p.id))

  if (shown.length === 0) {
    return (
      <p className="grid flex-1 place-items-center text-[26px] font-light text-ink-3">inbox clear</p>
    )
  }

  return (
    <div className="flex flex-col">
      {shown.map((p, i) => (
        <div
          key={p.id}
          className={cn('border-b border-rule px-1 py-2.5', phoneLimit !== undefined && i >= phoneLimit && 'max-md:hidden')}
        >
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="truncate text-[11px] text-ink-3">{p.from}</span>
            <span className="label text-[10px] tracking-[0.06em] text-warn">pending</span>
          </div>

          {editing === p.id ? (
            // Approving an edited title is what the artboard's pencil does: the
            // proposal is accepted, with your wording rather than the agent's.
            <input
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(null)
                if (e.key === 'Enter' && draft.trim()) {
                  act(p.id, () => approveProposal(p.id, { title: draft.trim() }))
                }
              }}
              aria-label={`Edit ${p.title}`}
              className="mt-1 w-full border border-brand bg-bg px-2 py-1.5 text-[13px] text-ink outline-none"
            />
          ) : (
            <p className="mt-1 text-[13px] leading-[1.4] text-ink">{p.title}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                act(p.id, () =>
                  approveProposal(
                    p.id,
                    // The edited wording is merged into the proposal's stored
                    // tool input. A tool with no title of its own rejects it
                    // and says so, rather than the edit being silently lost.
                    editing === p.id && draft.trim() ? { title: draft.trim() } : undefined,
                  ),
                )
              }
              className="h-11 shrink-0 border border-brand px-2 text-[11px] text-ink transition-colors duration-150 hover:bg-brand hover:text-white sm:h-[23px]"
            >
              {editing === p.id ? 'Save and approve' : 'Approve'}
            </button>
            <button
              type="button"
              className={MINI}
              onClick={() => {
                setEditing(editing === p.id ? null : p.id)
                setDraft(p.title)
              }}
            >
              {editing === p.id ? 'Cancel' : 'Edit'}
            </button>
            <button
              type="button"
              className={cn(MINI, 'hover:border-bad hover:text-bad')}
              disabled={pending}
              onClick={() => act(p.id, () => dismissProposal(p.id))}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
      <More count={phoneLimit === undefined ? 0 : shown.length - phoneLimit} href="/review" />
    </div>
  )
}

/** The phone's way to the rows it does not show. Nothing from md up. */
function More({ count, href }: { count: number; href: string }) {
  if (count <= 0) return null
  return (
    <Link href={href} className="px-1 py-2 text-[12px] text-ink-2 hover:text-ink md:hidden">
      and {count} more &rarr;
    </Link>
  )
}
