'use client'

import { useEffect, useRef, useState } from 'react'
import { ActionButton, Eyebrow, useToast } from '@/components/pos'
import { cn } from '@/lib/utils'
import type { Related } from '../related'
import { captureText, ingestFromUrl, relatedForDraft } from './actions'
import type { BrainNote, SetParams } from './Brain'

// The capture box pinned above the list (plan: docs/plans/brain-capture.md).
// One textarea, no title field: the first line is the title. A bare URL is
// ingested through the existing tool; anything else is saved as a note, or as
// a daily when it is something worked on. Related notes surface while typing,
// which is the one mechanism that brings an old note back.

const URL_ONLY = /^https?:\/\/\S+$/
const MIN_RELATED = 20

export function CaptureBox({ notes, setParams }: { notes: BrainNote[]; setParams: SetParams }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [worked, setWorked] = useState(false)
  const [running, setRunning] = useState(false)
  // null until the first lookup answers, so the heading appears with its rows.
  const [related, setRelated] = useState<Related[] | 'unavailable' | null>(null)
  const inFlight = useRef(false)
  const pending = useRef<string | null>(null)

  const trimmed = text.trim()
  const isUrl = URL_ONLY.test(trimmed)
  const wantRelated = !isUrl && trimmed.length >= MIN_RELATED

  // ponytail: related fires once per pause against a 3 RPM Voyage ceiling;
  // text-only hits when it 429s (search() already falls back).
  useEffect(() => {
    if (!wantRelated) return
    const timer = setTimeout(() => {
      const lookup = async (q: string) => {
        inFlight.current = true
        try {
          const result = await relatedForDraft(q)
          setRelated(result.ok ? (result.related ?? []) : 'unavailable')
        } finally {
          inFlight.current = false
          // Only the last text typed during the call is worth a second one.
          const next = pending.current
          pending.current = null
          if (next !== null) void lookup(next)
        }
      }
      if (inFlight.current) pending.current = trimmed
      else void lookup(trimmed)
    }, 1000)
    return () => clearTimeout(timer)
  }, [trimmed, wantRelated])

  const submit = async () => {
    if (!trimmed || running) return
    setRunning(true)
    try {
      if (isUrl) {
        const result = await ingestFromUrl(trimmed)
        if (!result.ok) return toast(result.error)
        toast(result.note ? result.note : 'Drafted. It is waiting in the inbox.')
        setParams({ folder: null, note: result.slug ?? null })
      } else {
        const result = await captureText({ text: trimmed, worked })
        if (!result.ok) return toast(result.error)
        toast('Saved')
        setParams({ folder: worked ? 'daily' : 'note', note: result.slug ?? null })
      }
      setText('')
      setWorked(false)
    } finally {
      setRunning(false)
    }
  }

  const hubNames = (id: string) =>
    notes
      .find((n) => n.id === id)
      ?.hubs.map((h) => h.name)
      .join(' · ') ?? ''

  return (
    <form
      data-testid="brain-capture"
      className="flex flex-col gap-2 border-b border-rule bg-bg-elev px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        disabled={running}
        aria-label="Capture"
        placeholder="A thought, a link, what you worked on…"
        className="w-full resize-y border border-rule-2 bg-bg px-3 py-[9px] text-[13px] leading-[1.6] text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className={cn('flex min-h-11 items-center gap-2 text-[12px] text-ink-3 md:min-h-0', isUrl && 'invisible')}>
          <input type="checkbox" checked={worked} onChange={(e) => setWorked(e.target.checked)} className="accent-brand" />
          Worked on
        </label>
        <ActionButton
          variant="solid"
          className="h-11 gap-2 px-3.5 text-[13px] md:h-9"
          disabled={!trimmed || running}
          onClick={() => void submit()}
        >
          {isUrl ? 'Ingest' : 'Save'} <span aria-hidden="true">&rarr;</span>
        </ActionButton>
      </div>

      {wantRelated && related !== null && (
        <div className="mt-1 flex flex-col">
          <Eyebrow>Related</Eyebrow>
          {related === 'unavailable' ? (
            <span className="mt-1.5 text-[12px] text-ink-4">Related notes unavailable</span>
          ) : related.length === 0 ? (
            <span className="mt-1.5 text-[12px] text-ink-4">Nothing close yet</span>
          ) : (
            related.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setParams({ note: r.slug })}
                className="flex min-h-11 items-baseline justify-between gap-2 border-b border-rule py-1.5 text-left text-[12px] text-ink-2 transition-colors duration-150 hover:text-ok md:min-h-0"
              >
                <span className="min-w-0 truncate">{r.title}</span>
                <span className="label shrink-0 text-[9px] tracking-[0.08em] text-ink-4">{hubNames(r.id)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </form>
  )
}
