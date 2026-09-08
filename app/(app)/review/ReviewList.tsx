'use client'

import { useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  Chip,
  DiffList,
  EmptyState,
  Eyebrow,
  StatusChip,
  useToast,
} from '@/components/pos'
import type { DiffEntry, ProposalStatus } from '@/core/proposals'
import { cn } from '@/lib/utils'
import { approveProposal, dismissProposal, reopenProposal } from './actions'

export type ReviewItem = {
  id: string
  module: string
  moduleLabel: string
  tool: string
  title: string
  agent: string
  reason: string
  confidence: number | null
  evidence: string | null
  affects: string | null
  guarded: boolean
  diff: DiffEntry[]
  status: ProposalStatus
  age: string
}

/** Grades the number the way the design does, and never colour alone. */
function confidenceTone(c: number): 'ok' | 'neutral' | 'warn' {
  if (c >= 0.8) return 'ok'
  if (c >= 0.7) return 'neutral'
  return 'warn'
}

export function ReviewList({ items, status }: { items: ReviewItem[]; status: ProposalStatus }) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const toast = useToast()

  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null

  function run(action: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setError(null)
    start(async () => {
      const result = await action()
      if (result.ok) toast(done)
      else setError(result.error ?? 'Failed')
    })
  }

  if (items.length === 0) {
    return (
      <EmptyState headline={status === 'pending' ? 'Inbox clear' : 'Nothing here'}>
        {status === 'pending'
          ? 'Nothing is waiting on you. The next proposals arrive after the nightly run.'
          : `No ${status} proposals.`}
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="min-w-0 flex-1 basis-[420px] space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedId(item.id)}
            className="block w-full text-left"
          >
            <Card selected={item.id === selected?.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Eyebrow>
                  {item.agent} · {item.age}
                </Eyebrow>
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.guarded && <StatusChip tone="warn">Guarded</StatusChip>}
                  <StatusChip tone={item.status === 'pending' ? 'neutral' : 'quiet'}>
                    {item.status}
                  </StatusChip>
                </div>
              </div>

              <p className="t-body text-ink">{item.title}</p>

              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="quiet">
                  {item.module}.{item.tool}
                </Chip>
                {item.confidence !== null && (
                  <Chip tone={confidenceTone(item.confidence)}>
                    {Math.round(item.confidence * 100)}% confident
                  </Chip>
                )}
              </div>
            </Card>
          </button>
        ))}
      </div>

      {selected && (
        // Sticky panel rather than a drawer: the design keeps the list visible
        // so you can work down the inbox without reopening anything.
        <aside className="min-w-0 flex-1 basis-[320px] md:sticky md:top-7">
          <Card className="space-y-5">
            <div className="space-y-2">
              <Eyebrow>
                {selected.moduleLabel} / {selected.tool}
              </Eyebrow>
              <h2 className="t-title text-ink">{selected.title}</h2>
            </div>

            <Section label="Why">
              <p className="t-caption text-ink-2">{selected.reason}</p>
            </Section>

            {selected.diff.length > 0 && (
              <Section label="Proposed change">
                <DiffList diffs={selected.diff} />
              </Section>
            )}

            {selected.confidence !== null && (
              <Section label="Confidence">
                <p className={cn('num text-[22px] font-light', {
                  'text-ok': selected.confidence >= 0.8,
                  'text-warn': selected.confidence < 0.7,
                })}>
                  {Math.round(selected.confidence * 100)}%
                </p>
              </Section>
            )}

            {selected.evidence && (
              <Section label="Evidence">
                <p className="t-caption text-ink-2">{selected.evidence}</p>
              </Section>
            )}

            {selected.affects && (
              <Section label="Affects">
                <p className="t-caption text-ink-2">{selected.affects}</p>
              </Section>
            )}

            {error && (
              <p className="t-caption rounded-md border border-bad/60 px-3 py-2 text-bad">{error}</p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
              {selected.status === 'pending' ? (
                <>
                  <ActionButton
                    variant="solid"
                    disabled={pending}
                    onClick={() => run(() => approveProposal(selected.id), `Approved: ${selected.title}`)}
                  >
                    Approve
                  </ActionButton>
                  <ActionButton
                    disabled={pending}
                    onClick={() => run(() => dismissProposal(selected.id), 'Dismissed for 30 days')}
                  >
                    Dismiss
                  </ActionButton>
                </>
              ) : (
                <ActionButton
                  disabled={pending}
                  onClick={() => run(() => reopenProposal(selected.id), 'Back in the inbox')}
                >
                  Undo
                </ActionButton>
              )}
            </div>

            {selected.guarded && selected.status === 'pending' && (
              <p className="t-caption text-ink-3">
                Guarded. Approving writes to {selected.moduleLabel} immediately.
              </p>
            )}
          </Card>
        </aside>
      )}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Eyebrow>{label}</Eyebrow>
      {children}
    </div>
  )
}
