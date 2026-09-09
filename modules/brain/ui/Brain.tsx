'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  Row,
  RowList,
  StatusChip,
  TabBar,
  fieldClass,
  useToast,
} from '@/components/pos'
import { cn } from '@/lib/utils'
import { renderPreview } from '../wikilinks'
import { publishNote, saveNote, startFromLink, type ActionResult } from './actions'

// Folder rail, list, and a reading pane. The folder and the open note live in
// the URL, so a note can be linked to and both survive a refresh.

export type BrainData = {
  notes: {
    id: string
    title: string
    body: string
    slug: string
    kind: string
    status: string
    sourceUrl: string
    sourceText: string
    sourceMeta: string
    committed: boolean
    updatedAt: string
    backlinks: { id: string; title: string }[]
    unresolved: string[]
  }[]
}

const KINDS = ['article', 'book', 'video', 'note', 'project', 'person', 'daily'] as const

export function Brain({ data }: { data: BrainData }) {
  const router = useRouter()
  const params = useSearchParams()

  const folder = params.get('folder') ?? 'inbox'
  const openNote = data.notes.find((n) => n.slug === params.get('note')) ?? null

  const setParams = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
    const query = search.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }

  const [draft, setDraft] = useState('')
  const [, start] = useTransition()
  const toast = useToast()

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  const inbox = data.notes.filter((n) => n.status === 'draft')
  const published = data.notes.filter((n) => n.status === 'published')

  const shown =
    folder === 'inbox' ? inbox : published.filter((n) => n.kind === folder)

  const counts: Record<string, number> = { inbox: inbox.length }
  for (const k of KINDS) counts[k] = published.filter((n) => n.kind === k).length

  // Every link nothing has been written for yet, deduplicated. The most useful
  // backlog in the app: each one is a note the vault is already asking for.
  const wanted = [...new Set(data.notes.flatMap((n) => n.unresolved))].filter(
    (slug) => !data.notes.some((n) => n.slug === slug),
  )

  return (
    <div className="space-y-5">
      <TabBar
        label="Folders"
        value={folder}
        onChange={(next) => setParams({ folder: next === 'inbox' ? null : next, note: null })}
        tabs={[
          { value: 'inbox', label: 'Inbox', count: counts.inbox },
          ...KINDS.filter((k) => counts[k] > 0 || k === 'note').map((k) => ({
            value: k,
            label: k === 'daily' ? 'Daily' : `${k[0].toUpperCase()}${k.slice(1)}s`,
            count: counts[k],
          })),
        ]}
      />

      <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
        <div className="min-w-0 flex-[1_1_420px] space-y-4">
          {folder === 'note' && (
            <div className="flex flex-wrap gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && draft.trim()) {
                    e.preventDefault()
                    run(() => saveNote({ title: draft.trim() }), 'Note started')
                    setDraft('')
                  }
                }}
                aria-label="New note title"
                placeholder="A title, then Enter"
                className={cn(fieldClass, 'min-w-0 flex-1 basis-[240px]')}
              />
              <ActionButton
                variant="brand"
                disabled={!draft.trim()}
                onClick={() => {
                  run(() => saveNote({ title: draft.trim() }), 'Note started')
                  setDraft('')
                }}
              >
                New note
              </ActionButton>
            </div>
          )}

          {shown.length === 0 ? (
            <EmptyState headline={folder === 'inbox' ? 'Inbox zero' : 'Nothing here'}>
              {folder === 'inbox'
                ? 'Nothing waiting. An ingested draft lands here beside the text it was drawn from, and stays out of the vault until you accept it.'
                : 'No notes of this kind yet.'}
            </EmptyState>
          ) : (
            <RowList>
              {shown.map((note) => (
                <Row
                  key={note.id}
                  title={note.title}
                  meta={`${note.kind}${note.sourceMeta ? ` / ${note.sourceMeta}` : ''}`}
                  selected={openNote?.id === note.id}
                  onClick={() => setParams({ note: note.slug })}
                  right={
                    <>
                      {note.status === 'draft' && <StatusChip tone="warn">Draft</StatusChip>}
                      {note.backlinks.length > 0 && (
                        <Chip tone="quiet">{note.backlinks.length} in</Chip>
                      )}
                    </>
                  }
                />
              ))}
            </RowList>
          )}

          {wanted.length > 0 && (
            <Card className="space-y-3">
              <CardHead label="Links with nothing behind them" meta={`${wanted.length}`} />
              <p className="t-caption text-ink-3">
                Notes you have linked to but not written. Kept rather than dropped, because an
                unresolved link is usually the best idea of what to write next.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {wanted.map((slug) => (
                  <ActionButton
                    key={slug}
                    onClick={() => run(() => startFromLink(slug), `Started ${slug}`)}
                  >
                    {slug.replace(/-/g, ' ')}
                  </ActionButton>
                ))}
              </div>
            </Card>
          )}
        </div>

        {openNote && (
          <aside className="min-w-0 flex-[1_1_380px] space-y-4 md:max-w-[520px]">
            <Card className="space-y-3">
              <CardHead
                label={openNote.kind}
                meta={openNote.committed ? 'in the vault' : 'not committed'}
              />
              <h2 className="t-title text-ink">{openNote.title}</h2>

              {openNote.status === 'draft' ? (
                <div className="space-y-3">
                  <StatusChip tone="warn">Waiting on you</StatusChip>
                  <p className="t-caption text-ink-3">
                    Drafted from the source below. Nothing reaches the vault until you accept it.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      variant="brand"
                      onClick={() => run(() => publishNote(openNote.id, true), 'Accepted')}
                    >
                      Accept
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <ActionButton onClick={() => run(() => publishNote(openNote.id, false), 'Back to the inbox')}>
                  Send back to the inbox
                </ActionButton>
              )}

              <label className="block space-y-1.5">
                <Eyebrow>Body</Eyebrow>
                <textarea
                  key={openNote.id}
                  defaultValue={openNote.body}
                  rows={12}
                  aria-label={`Body of ${openNote.title}`}
                  onBlur={(e) =>
                    e.target.value !== openNote.body &&
                    run(() => saveNote({ id: openNote.id, body: e.target.value }), 'Saved')
                  }
                  className={cn(fieldClass, 'w-full resize-y font-normal')}
                />
                <p className="t-caption text-ink-3">
                  Markdown, the vault&apos;s own format. Double brackets make a link, and a link to a
                  note you have not written yet is fine.
                </p>
              </label>

              {openNote.body.includes('[[') && (
                <div className="space-y-1.5">
                  <Eyebrow>As prose</Eyebrow>
                  <p className="t-caption whitespace-pre-wrap text-ink-2">
                    {renderPreview(openNote.body)}
                  </p>
                </div>
              )}
            </Card>

            {openNote.sourceText && (
              <Card className="space-y-2">
                <CardHead label="Source" meta={openNote.sourceMeta} />
                {/* Beside the summary, not behind it. A draft is judged against
                    what it was drawn from, not taken on trust. */}
                <p className="t-caption max-h-56 overflow-y-auto whitespace-pre-wrap text-ink-3">
                  {openNote.sourceText}
                </p>
                {openNote.sourceUrl && (
                  <a
                    href={openNote.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="label text-[10px] text-teal underline underline-offset-4"
                  >
                    Open the original
                  </a>
                )}
              </Card>
            )}

            {(openNote.backlinks.length > 0 || openNote.unresolved.length > 0) && (
              <Card className="space-y-3">
                <CardHead label="Links" meta={`${openNote.backlinks.length} in`} />
                {openNote.backlinks.length > 0 && (
                  <div className="space-y-1.5">
                    <Eyebrow className="text-[10px]">Pointing here</Eyebrow>
                    {openNote.backlinks.map((b) => (
                      <p key={b.id} className="t-caption text-ink-2">
                        {b.title}
                      </p>
                    ))}
                  </div>
                )}
                {openNote.unresolved.length > 0 && (
                  <div className="space-y-1.5">
                    <Eyebrow className="text-[10px]">Pointing at nothing yet</Eyebrow>
                    <div className="flex flex-wrap gap-1.5">
                      {openNote.unresolved.map((slug) => (
                        <Chip key={slug} tone="warn">
                          {slug.replace(/-/g, ' ')}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
