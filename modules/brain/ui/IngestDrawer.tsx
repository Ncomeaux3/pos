'use client'

import { useState } from 'react'
import { ActionButton, Eyebrow, Overlay, useToast } from '@/components/pos'
import { cn } from '@/lib/utils'
import { KINDS, folderLabel } from '../shape'
import { ingestFromUrl, saveNote } from './actions'
import type { SetParams } from './Brain'

// The Ingest drawer of POS Second Brain.dc.html, at 480px. URL and YouTube
// spend one Haiku call and land in the inbox as a draft; Book and Note are the
// owner's own words and save straight to their folder. PDF is not built: there
// is no extractor and the Node runtime cannot run one.

const FIELD =
  'w-full border border-rule-2 bg-bg px-3 py-[9px] text-[13px] text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand rounded-xl'

type Kind = 'url' | 'youtube' | 'book' | 'note'

const KIND_LABEL: Record<Kind, string> = { url: 'URL', youtube: 'YouTube', book: 'Book', note: 'Note' }
const DEFAULT_FOLDER: Record<Kind, string> = { url: 'article', youtube: 'video', book: 'book', note: 'note' }

export function IngestDrawer({ setParams }: { setParams: SetParams }) {
  const toast = useToast()
  const [kind, setKind] = useState<Kind>('url')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [folder, setFolder] = useState('article')
  // Separate from a transition: fetching a page and summarising it takes
  // seconds, and a button that looks idle for that long gets pressed twice.
  const [running, setRunning] = useState(false)

  const fromUrl = kind === 'url' || kind === 'youtube'
  const ready = fromUrl ? url.trim() !== '' : title.trim() !== ''
  const close = () => setParams({ ingest: null })

  const pick = (next: Kind) => {
    setKind(next)
    setFolder(DEFAULT_FOLDER[next])
  }

  const submit = async () => {
    if (!ready || running) return
    setRunning(true)
    try {
      if (fromUrl) {
        const result = await ingestFromUrl(url.trim(), folder)
        if (!result.ok) return toast(result.error)
        toast(result.note ? result.note : 'Drafted. It is waiting in the inbox.')
        setParams({ ingest: null, folder: null, note: result.slug ?? null })
      } else {
        const result = await saveNote({ title: title.trim(), body: notes, kind: folder })
        if (!result.ok) return toast(result.error)
        toast('Saved')
        setParams({ ingest: null, folder, note: result.slug ?? null })
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <Overlay
      open
      narrow
      onClose={close}
      eyebrow={
        <>
          Second Brain <span className="text-ink-4">/</span> Ingest
        </>
      }
      footer={
        <>
          <span className="text-[11px] text-ink-3">
            {fromUrl
              ? 'Lands in the inbox as a draft. Nothing reaches the vault.'
              : 'Saved as a note of yours. Nothing reaches the vault.'}
          </span>
          <ActionButton
            variant="solid"
            className="h-[38px] gap-2 px-3.5 text-[13px]"
            disabled={!ready || running}
            onClick={() => void submit()}
          >
            {fromUrl ? 'Draft summary' : 'Save note'} <span aria-hidden="true">&rarr;</span>
          </ActionButton>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div data-testid="brain-ingest-kinds" className="grid grid-cols-4 gap-px border border-rule bg-rule rounded-[18px]">
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => pick(k)}
              className={cn(
                'min-h-11 px-1.5 py-[9px] text-[12px] transition-colors duration-150 md:min-h-0',
                kind === k ? 'bg-ink text-bg' : 'bg-bg text-ink-3 hover:text-ink',
              )}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        {fromUrl ? (
          <>
            <label className="flex flex-col gap-1.5">
              <Eyebrow>{kind === 'youtube' ? 'YouTube link' : 'URL'}</Eyebrow>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={running}
                placeholder={kind === 'youtube' ? 'https://youtube.com/watch?v=…' : 'https://…'}
                className={cn(FIELD, 'code')}
              />
            </label>
            <p className="text-[12px] leading-[1.5] text-ink-3">
              {kind === 'youtube'
                ? 'Captions off the watch page, automatic ones when no written track exists; a video with no captions says so. A summary is drafted, then you approve it in the inbox.'
                : 'Readable text out of the page. A summary is drafted, then you approve it in the inbox.'}
            </p>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1.5">
              <Eyebrow>{kind === 'book' ? 'Title · author' : 'Title'}</Eyebrow>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={kind === 'book' ? 'Designing Data-Intensive Applications · Kleppmann' : 'What is it about?'}
                className={FIELD}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <Eyebrow>Your notes</Eyebrow>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                placeholder="Key ideas, quotes, what changed your mind…"
                className={cn(FIELD, 'resize-y leading-[1.6]')}
              />
            </label>
          </>
        )}

        <label className="flex flex-col gap-1.5 sm:w-[calc(50%-6px)]">
          <Eyebrow>Folder</Eyebrow>
          <select value={folder} onChange={(e) => setFolder(e.target.value)} className={FIELD}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {folderLabel(k)}
              </option>
            ))}
          </select>
        </label>

        {running && (
          <div className="flex items-center gap-2.5 border border-brand px-3.5 py-3 text-[12px] text-ink rounded-[18px]">
            <span className="status-dot" aria-hidden />
            Reading, drafting, classifying · a few seconds
          </div>
        )}
      </form>
    </Overlay>
  )
}
