'use client'

import { useTransition } from 'react'
import { ActionButton, BandSearch, SearchButton, useToast } from '@/components/pos'
import { BackControl } from '@/components/pos/BackControl'
import { useSearchState } from '@/components/pos/searchState'
import { cn } from '@/lib/utils'
import { KINDS, ago, finishedOn, folderLabel, subLine } from '../shape'
import type { ActionResult } from './actions'
import { CaptureBox } from './CaptureBox'
import { HubDrawer } from './HubDrawer'
import { IngestDrawer } from './IngestDrawer'
import { NotePane } from './NotePane'

// POS Second Brain.dc.html: the band, the folder row, the list and the note
// pane. The folder, the open note and the ingest drawer live in the URL, so a
// note can be linked to and all three survive a refresh.

export type BrainNote = {
  id: string
  title: string
  body: string
  slug: string
  kind: string
  status: string
  sourceUrl: string
  sourceText: string
  sourceMeta: string
  source: string
  externalId: string | null
  vaultSha: string
  filePath: string
  updatedAt: string
  backlinks: { id: string; title: string; slug: string }[]
  unresolved: string[]
  skills: { id: string; name: string; confidence: number; by: 'rule' | 'model' | 'manual' }[]
  hubs: { id: string; name: string; by: 'rule' | 'model' | 'manual' }[]
}

export type BrainHub = { id: string; name: string; slug: string; keywords: string[] }

export type BrainData = { notes: BrainNote[]; hubs: BrainHub[] }

export type SetParams = (next: Record<string, string | null>) => void

/** A book or an article is finished by being here (decision 2026-09-11). */
export const isFinished = (n: BrainNote) =>
  n.status === 'published' && (n.kind === 'book' || n.kind === 'article')

export function Brain({ data }: { data: BrainData }) {
  const { params, set: setParams } = useSearchState()
  const toast = useToast()
  const [, start] = useTransition()

  const folder = params.get('folder') ?? 'inbox'
  const ingestOpen = params.get('ingest') === '1'
  // `hub=new` opens an empty form; `hub=<slug>` edits that hub.
  const hubParam = params.get('hub')
  const hubEditing = hubParam ? (data.hubs.find((h) => h.slug === hubParam) ?? null) : null
  const hubOpen = hubParam === 'new' || hubEditing !== null

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  const notes = [...data.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const drafts = notes.filter((n) => n.status === 'draft')
  const published = notes.filter((n) => n.status === 'published')
  const reading = notes.filter((n) => n.kind === 'article' || n.kind === 'book')

  // A hub is a grouping across folders, and Unfiled is what no hub has claimed.
  const hubFolder = folder.startsWith('hub:') ? data.hubs.find((h) => h.slug === folder.slice(4)) : undefined
  const shown =
    folder === 'inbox'
      ? drafts
      : folder === 'reading'
        ? reading
        : folder === 'unfiled'
          ? published.filter((n) => n.hubs.length === 0)
          : hubFolder
            ? published.filter((n) => n.hubs.some((h) => h.id === hubFolder.id))
            : published.filter((n) => n.kind === folder)

  // The note in the URL wherever it lives, else the first row: the artboard
  // never shows an empty pane while the list has something in it.
  const open = notes.find((n) => n.slug === params.get('note')) ?? shown[0] ?? null

  const name =
    folder === 'unfiled' ? 'Unfiled' : hubFolder ? hubFolder.name : folder.startsWith('hub:') ? 'No such hub' : folderLabel(folder)
  const crumb = folder === 'inbox' ? 'Inbox' : folder === 'reading' ? 'Reading list' : name
  const listTitle = folder === 'inbox' ? 'Inbox · drafts' : folder === 'reading' ? 'Reading list' : name
  const listMeta =
    folder === 'inbox'
      ? `${shown.length} awaiting`
      : folder === 'reading'
        ? `${shown.filter(isFinished).length} finished`
        : `${shown.length} ${shown.length === 1 ? 'note' : 'notes'}`

  const folders: { id: string; label: string; count: number; hot?: boolean }[] = [
    { id: 'inbox', label: 'Inbox', count: drafts.length, hot: true },
    { id: 'reading', label: 'Reading list', count: reading.length },
    ...KINDS.map((k) => ({
      id: k,
      label: folderLabel(k),
      count: published.filter((n) => n.kind === k).length,
    })),
  ]

  return (
    <>
      <header className="-mx-[18px] -mt-[18px] flex min-h-14 flex-wrap items-center justify-between gap-4 border-b border-rule px-[18px] py-2 md:-mx-7 md:-mt-7 md:h-14 md:flex-nowrap md:px-7 md:py-0">
        <BackControl />
        <span className="eyebrow shrink-0 whitespace-nowrap text-ink-3">
          Second Brain <span className="text-ink-4">/</span> {crumb}
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
          <SearchButton className="md:hidden" />
          <BandSearch className="hidden min-w-[220px] flex-1 md:flex" placeholder="Search second brain" />
          <span className="eyebrow hidden shrink-0 whitespace-nowrap text-ink-3 md:inline-flex">
            <span className="status-dot" aria-hidden />
            {published.length} notes
          </span>
          <ActionButton
            variant="solid"
            size="xl"
            className="h-11 gap-2 px-3.5 text-[13px] md:h-[51px] md:px-[22px] md:text-[15px]"
            onClick={() => setParams({ ingest: '1' }, { push: true })}
          >
            Ingest <span aria-hidden="true">&rarr;</span>
          </ActionButton>
        </div>
      </header>

      {/* The folder row: filled chips, Inbox and Reading list apart from the
        * seven folders, and the line that says why nothing here is the truth. */}
      <div
        data-testid="brain-folders"
        className="-mx-[18px] flex flex-wrap items-center gap-1 border-b border-rule bg-bg-elev px-5 py-2.5 md:-mx-7"
      >
        {folders.map((f, i) => {
          const on = folder === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setParams({ folder: f.id === 'inbox' ? null : f.id, note: null })}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 border px-2.5 py-[5px] text-[12px] transition-colors duration-150 md:min-h-0',
                on ? 'border-ink bg-ink text-bg' : 'border-rule-2 text-ink-3 hover:border-ink hover:text-ink',
                i === 2 && 'ml-2.5',
              )}
            >
              <span className="whitespace-nowrap">{f.label}</span>
              <span className={cn('num text-[10px]', f.hot && f.count > 0 ? 'text-warn' : 'text-ink-4')}>
                {f.count}
              </span>
            </button>
          )
        })}
        <span className="ml-auto whitespace-nowrap text-[11px] text-ink-4">
          Vault in git is the source of truth
        </span>
      </div>

      {/* Hubs: the owner's own groupings, one note in as many as fit. The chip
        * shape is the folder row's; the row is its own so the folder row's
        * order is untouched. */}
      <div
        data-testid="brain-hubs"
        className="-mx-[18px] flex flex-wrap items-center gap-1 border-b border-rule bg-bg-elev px-5 py-2.5 md:-mx-7"
      >
        {[
          // Counted over published notes, the same rows the folder lists.
          ...data.hubs.map((h) => ({
            id: `hub:${h.slug}`,
            label: h.name,
            count: published.filter((n) => n.hubs.some((x) => x.id === h.id)).length,
          })),
          { id: 'unfiled', label: 'Unfiled', count: published.filter((n) => n.hubs.length === 0).length },
        ].map((h) => {
          const on = folder === h.id
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => setParams({ folder: h.id, note: null })}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 border px-2.5 py-[5px] text-[12px] transition-colors duration-150 md:min-h-0',
                on ? 'border-ink bg-ink text-bg' : 'border-rule-2 text-ink-3 hover:border-ink hover:text-ink',
              )}
            >
              <span className="whitespace-nowrap">{h.label}</span>
              <span className="num text-[10px] text-ink-4">{h.count}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setParams({ hub: 'new' }, { push: true })}
          className="inline-flex min-h-11 items-center gap-2 border border-dashed border-rule-2 px-2.5 py-[5px] text-[12px] text-ink-3 transition-colors duration-150 hover:border-ink hover:text-ink md:min-h-0"
        >
          + Hub
        </button>
      </div>

      <div className="-mx-[18px] -mb-[18px] flex flex-wrap items-stretch md:-mx-7 md:-mb-7 md:min-h-[calc(100dvh-106px)]">
        <section className="flex min-w-0 flex-[1_1_280px] flex-col border-b border-rule md:max-w-[380px] md:border-b-0 md:border-r">
          <div className="flex items-baseline justify-between gap-2.5 border-b border-rule px-4 pb-2.5 pt-3.5">
            <span className="truncate text-[14px] text-ink">{listTitle}</span>
            <span className="num whitespace-nowrap text-[11px] text-ink-3">
              {listMeta}
              {hubFolder && (
                <button
                  type="button"
                  onClick={() => setParams({ hub: hubFolder.slug }, { push: true })}
                  className="ml-2.5 text-ink-3 underline-offset-2 hover:text-ink hover:underline"
                >
                  Edit hub
                </button>
              )}
            </span>
          </div>
          <CaptureBox notes={notes} setParams={setParams} />
          {shown.length === 0 ? (
            <p className="px-4 py-6 text-[12px] text-ink-4">
              {folder === 'inbox' ? 'Inbox clear. Ingest something to draft a note.' : 'Nothing here'}
            </p>
          ) : (
            shown.map((n) => {
              const selected = open?.id === n.id
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setParams({ note: n.slug })}
                  className={cn(
                    'block w-full border-b border-l-2 border-b-rule py-[11px] pl-3.5 pr-4 text-left transition-colors duration-150 hover:bg-brand-soft',
                    selected ? 'border-l-brand bg-brand-soft' : 'border-l-transparent',
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-[13px] leading-[1.3] text-ink">{n.title}</span>
                    <span className="num shrink-0 text-[10px] text-ink-4">{ago(n.updatedAt)}</span>
                  </span>
                  <span className="mt-[3px] block truncate text-[11px] text-ink-3">{subLine(n)}</span>
                  <span className="mt-[5px] flex items-center gap-1.5">
                    <span
                      className={cn(
                        'label text-[9px] tracking-[0.08em]',
                        n.status === 'draft' ? 'text-warn' : 'text-ink-4',
                      )}
                    >
                      {n.kind}
                    </span>
                    {n.status === 'draft' && (
                      <span className="label border border-warn px-1 text-[9px] tracking-[0.08em] text-warn">
                        draft
                      </span>
                    )}
                    {isFinished(n) && (
                      <span className="label text-[9px] tracking-[0.08em] text-ok">
                        FINISHED · {finishedOn(n.updatedAt)}
                      </span>
                    )}
                  </span>
                </button>
              )
            })
          )}
        </section>

        <section className="flex min-w-0 flex-[3_1_300px] flex-col">
          {open ? (
            <NotePane key={open.id} note={open} hubs={data.hubs} setParams={setParams} run={run} />
          ) : (
            <p className="flex flex-1 items-center justify-center py-16 text-[13px] text-ink-4">
              Select a note
            </p>
          )}
        </section>
      </div>

      {ingestOpen && <IngestDrawer setParams={setParams} />}
      {hubOpen && <HubDrawer key={hubParam} hub={hubEditing} setParams={setParams} />}
    </>
  )
}
