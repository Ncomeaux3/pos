'use client'

import { Fragment, useState, useTransition, type ReactNode } from 'react'
import { ActionButton, Card, Eyebrow, useToast } from '@/components/pos'
import { cn } from '@/lib/utils'
import { approveProposal, dismissProposal, reopenProposal } from './actions'
import { confidenceClass, STATE_CLASS, type ReviewItem } from './ReviewList'

// Sticky panel rather than a drawer: the design keeps the list visible so you
// can work down the inbox without reopening anything.
export function ProposalPanel({ item }: { item: ReviewItem }) {
  const [editing, setEditing] = useState(false)
  // `edits` are kept after Enter; `drafts` are what the inputs hold now.
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, start] = useTransition()
  const toast = useToast()

  const canEdit = item.status === 'pending' && item.diff.some((d) => d.editable)
  const after = (field: string, fallback: string | null) => edits[field] ?? fallback

  function run(action: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setError(null)
    start(async () => {
      const result = await action()
      if (result.ok) toast(done)
      else setError(result.error ?? 'Failed')
    })
  }

  function toggleEdit() {
    if (!editing) {
      setDrafts(Object.fromEntries(item.diff.filter((d) => d.editable).map((d) => [d.field, after(d.field, d.after) ?? ''])))
    }
    setEditing(!editing)
  }

  function keep() {
    setEdits({ ...edits, ...drafts })
    setEditing(false)
  }

  function approve() {
    const patch = editing ? { ...edits, ...drafts } : edits
    run(
      () => approveProposal(item.id, Object.keys(patch).length ? patch : undefined),
      `Approved: ${item.title}`,
    )
  }

  const show = (v: string | null) => (v === null || v === '' ? 'empty' : v)

  return (
    <Card className="flex flex-col gap-4 px-[22px] py-5 md:sticky md:top-7">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>
            {item.moduleLabel} <span className="text-ink-4">/</span> {item.module}.{item.tool}
          </Eyebrow>
          <h2 className="mt-2.5 text-[20px] leading-[1.3] tracking-[-0.02em] text-ink">{item.title}</h2>
        </div>
        <span
          className={cn(
            'num shrink-0 whitespace-nowrap pt-1 text-[10px] uppercase tracking-[0.08em]',
            STATE_CLASS[item.status],
          )}
        >
          {item.status.toUpperCase()}
        </span>
      </div>

      <div>
        <Eyebrow>Why</Eyebrow>
        <p className="mt-2 text-[13px] leading-[1.55] text-ink-2">{item.reason}</p>
      </div>

      {item.diff.length > 0 && (
        <div>
          <Eyebrow>Proposed change</Eyebrow>
          <div className="mt-2 grid grid-cols-2 gap-px border border-rule bg-rule rounded-[18px]">
            {item.diff.map((d) => {
              const one = item.diff.length === 1
              const before = show(d.before)
              return (
                <Fragment key={d.field}>
                  <div className="min-w-0 bg-bg px-3 py-2.5">
                    <span className="text-[11px] text-ink-3">{one ? 'Current' : `${d.field} · current`}</span>
                    <div className={cn('num mt-1.5 break-words text-[13px]', before === 'empty' ? 'text-ink-4' : 'text-ink')}>
                      {before}
                    </div>
                  </div>
                  <div className="min-w-0 bg-bg px-3 py-2.5">
                    <span className="text-[11px] text-ink-3">{one ? 'After' : `${d.field} · after`}</span>
                    {editing && d.editable ? (
                      <input
                        aria-label={`After · ${d.field}`}
                        className="num mt-1 w-full rounded-lg border border-brand bg-bg-elev px-2 py-[5px] text-[13px] text-ink outline-none"
                        value={drafts[d.field] ?? ''}
                        onChange={(e) => setDrafts({ ...drafts, [d.field]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') keep()
                          if (e.key === 'Escape') setEditing(false)
                        }}
                      />
                    ) : (
                      <div className="num mt-1.5 break-words text-[13px] text-brand">
                        {show(after(d.field, d.after))}
                      </div>
                    )}
                  </div>
                </Fragment>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-px border border-rule bg-rule rounded-[18px]">
        <Cell label="Confidence">
          <div
            className={cn(
              'num mt-1.5 text-[16px]',
              item.confidence === null ? 'text-ink-4' : confidenceClass(item.confidence),
            )}
          >
            {item.confidence === null ? 'not given' : `${Math.round(item.confidence * 100)}%`}
          </div>
        </Cell>
        <Cell label="Evidence">
          <div className={cn('mt-1.5 text-[12px]', item.evidence ? 'text-ink' : 'text-ink-4')}>
            {item.evidence ?? 'not given'}
          </div>
        </Cell>
        <Cell label="Affects">
          <div className={cn('mt-1.5 text-[12px]', item.affects ? 'text-ink' : 'text-ink-4')}>
            {item.affects ?? 'not given'}
          </div>
        </Cell>
      </div>

      {error && (
        <p className="t-caption rounded-md border border-bad/60 px-3 py-2 text-bad">{error}</p>
      )}

      {item.status === 'pending' ? (
        <>
          <div className="flex flex-wrap gap-2 pt-1">
            <ActionButton variant="solid" size="xl" disabled={busy} onClick={approve}>
              {editing ? 'Save & approve' : 'Approve'} <span aria-hidden="true">&rarr;</span>
            </ActionButton>
            {canEdit && (
              <ActionButton
                className="h-auto self-stretch px-3.5 text-[13px] text-ink sm:h-auto"
                disabled={busy}
                onClick={toggleEdit}
              >
                {editing ? 'Cancel edit' : 'Edit'}
              </ActionButton>
            )}
            <ActionButton
              className="ml-auto h-auto self-stretch px-3.5 text-[13px] text-ink-3 hover:border-bad hover:text-bad sm:h-auto"
              disabled={busy}
              onClick={() => run(() => dismissProposal(item.id), 'Dismissed')}
            >
              Dismiss
            </ActionButton>
          </div>
          {item.guarded && (
            <p className="-mt-1.5 text-[12px] text-warn">
              Guarded tool: approving writes to {item.moduleLabel} immediately.
            </p>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[13px] text-ink-3">
            {item.status === 'approved'
              ? `Approved. ${item.module}.${item.tool} ran.`
              : 'Dismissed. The agent will not re-propose this for 30 days. Undo puts it back in the inbox.'}
          </span>
          {/* Only a dismissal comes back: reopening an approved proposal would
            * run its tool a second time, and the write it made stays. */}
          {item.status === 'dismissed' && (
            <ActionButton
              className="text-ink-2"
              disabled={busy}
              onClick={() => run(() => reopenProposal(item.id), 'Back in the inbox')}
            >
              Undo
            </ActionButton>
          )}
        </div>
      )}
    </Card>
  )
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-bg px-3 py-2.5">
      <Eyebrow>{label}</Eyebrow>
      {children}
    </div>
  )
}
