'use client'

import { useState } from 'react'
import { ActionButton, Eyebrow } from '@/components/pos'
import { cn } from '@/lib/utils'
import { ago, byLine, finishedOn, folderLabel, sourceMeta, subLine, wordCount } from '../shape'
import { blocks } from '../wikilinks'
import { deleteNote, publishNote, saveNote, startFromLink, type ActionResult } from './actions'
import { isFinished, type BrainNote, type SetParams } from './Brain'

// The right pane of POS Second Brain.dc.html: a draft beside the text it was
// drawn from, or a note with its skills, backlinks and vault cell.

const MINI =
  'whitespace-nowrap border border-rule-2 px-2.5 py-[5px] text-[11px] text-ink-3 transition-colors duration-150'
const CELL = 'border border-rule px-3.5 py-3'
const CHIP =
  'label inline-flex items-center gap-1.5 border border-rule-2 px-[7px] py-[2px] text-[10px] tracking-[0.08em] text-ink-2'

type Run = (action: () => Promise<ActionResult>, ok?: string) => void

export function NotePane({ note, setParams, run }: { note: BrainNote; setParams: SetParams; run: Run }) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(note.body)

  const toggleEdit = () => {
    setBody(note.body)
    setEditing((e) => !e)
  }
  const editLabel = editing ? 'Cancel edit' : 'Edit'

  const skills = (
    <>
      {note.skills.length === 0 && <span className="text-[11px] text-ink-4">Nothing matched yet.</span>}
      {note.skills.map((s) => (
        <a key={s.id} href={`/skills?skill=${encodeURIComponent(s.id)}`} className={CHIP}>
          {s.name} <span className="num text-ink-3">{Math.round(s.confidence * 100)}%</span>
        </a>
      ))}
    </>
  )

  if (note.status === 'draft') {
    const accept = () => {
      const save = editing && body !== note.body ? () => saveNote({ id: note.id, body }) : null
      run(async () => {
        if (save) {
          const saved = await save()
          if (!saved.ok) return saved
        }
        return publishNote(note.id, true)
      }, 'Accepted')
      setEditing(false)
    }
    const discard = () => {
      if (!confirm('Discard this draft?')) return
      run(() => deleteNote(note.id), 'Discarded')
      setParams({ note: null })
    }

    return (
      <>
        <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-[18px]">
          <div className="min-w-0">
            <Eyebrow className="text-warn">Draft · awaiting your approval</Eyebrow>
            <h2 className="mt-2 text-[22px] font-normal leading-[1.2] tracking-[-0.03em] text-ink">{note.title}</h2>
            <p className="mt-1.5 text-[12px] text-ink-3">
              {subLine(note)} · will file under{' '}
              <span className="num">
                {folderLabel(note.kind)} / {note.slug}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={discard} className={cn(MINI, 'hover:border-bad hover:text-bad')}>
              Discard
            </button>
            <button type="button" onClick={toggleEdit} className={cn(MINI, 'hover:border-ink hover:text-ink')}>
              {editLabel}
            </button>
            <ActionButton variant="solid" className="h-9 gap-2 px-3.5 text-[13px]" onClick={accept}>
              Accept <span aria-hidden="true">&rarr;</span>
            </ActionButton>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-3.5 px-6 pb-6 pt-4">
          <div className="flex min-h-[280px] flex-col border border-rule bg-bg-elev">
            <div className="flex justify-between gap-2 border-b border-rule px-3.5 py-2.5">
              <Eyebrow>Source</Eyebrow>
              <span className="num text-[10px] text-ink-3">{sourceMeta(note)}</span>
            </div>
            <p className="overflow-auto whitespace-pre-wrap p-3.5 text-[13px] leading-[1.65] text-ink-2">
              {note.sourceText || 'No source text was kept for this draft.'}
            </p>
          </div>
          <div className="flex min-h-[280px] flex-col border border-brand bg-bg-elev">
            <div className="flex justify-between gap-2 border-b border-rule px-3.5 py-2.5">
              <Eyebrow>Draft summary</Eyebrow>
              <span className="num text-[10px] text-ink-3">
                {note.sourceUrl && note.body ? 'HAIKU · ' : ''}
                {wordCount(note.body)} WORDS
              </span>
            </div>
            {editing ? (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                aria-label={`Draft of ${note.title}`}
                className="flex-1 resize-none bg-bg p-3.5 text-[13px] leading-[1.65] text-ink outline-none"
              />
            ) : note.body ? (
              <p className="flex-1 overflow-auto whitespace-pre-wrap p-3.5 text-[13px] leading-[1.65] text-ink">
                {note.body}
              </p>
            ) : (
              // The summary the cap stopped: the ingest's own note says why.
              <p className="flex-1 p-3.5 text-[13px] leading-[1.65] text-ink-4">
                {note.sourceMeta || 'No summary was drafted.'}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-rule px-3.5 py-2.5">
              <Eyebrow className="mr-1">Skills</Eyebrow>
              {skills}
              <span className="label ml-auto text-[9px] tracking-[0.08em] text-ink-4">{byLine(note.skills)}</span>
            </div>
          </div>
        </div>
      </>
    )
  }

  const inVault = note.source === 'vault'
  const save = () => {
    run(() => saveNote({ id: note.id, body }), 'Saved')
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-4 px-6 pb-6 pt-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>
            {folderLabel(note.kind)} <span className="text-ink-4">/</span> {note.slug}.md
          </Eyebrow>
          <h2 className="mt-2 text-[24px] font-normal leading-[1.2] tracking-[-0.03em] text-ink">{note.title}</h2>
          <p className="mt-1.5 text-[12px] text-ink-3">{subLine(note)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isFinished(note) && (
            <span className="label text-[10px] tracking-[0.08em] text-ok">FINISHED · {finishedOn(note.updatedAt)}</span>
          )}
          {inVault ? (
            <span className="text-[11px] text-ink-4">A file in the vault. Edit it there.</span>
          ) : (
            <button type="button" onClick={toggleEdit} className={cn(MINI, 'hover:border-ink hover:text-ink')}>
              {editLabel}
            </button>
          )}
          {editing && (
            <button
              type="button"
              onClick={save}
              className={cn(MINI, 'border-brand text-ink hover:bg-brand hover:text-bg')}
            >
              Save
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          aria-label={`Body of ${note.title}`}
          className="w-full resize-y border border-brand bg-bg-elev p-4 text-[14px] leading-[1.7] text-ink outline-none"
        />
      ) : (
        <div className="flex max-w-[720px] flex-col gap-2.5 text-[14px] leading-[1.7] text-ink">
          {blocks(note.body).map((b, i) =>
            b.kind === 'ul' ? (
              <ul key={i} className="flex list-disc flex-col gap-1 pl-[18px]">
                {b.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            ) : (
              <p key={i}>
                {b.parts.map((part, j) =>
                  typeof part === 'string' ? (
                    part
                  ) : (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setParams({ note: part.link })}
                      className="border-b border-brand text-ok"
                    >
                      {part.label}
                    </button>
                  ),
                )}
              </p>
            ),
          )}
        </div>
      )}

      <div className="grid max-w-[720px] grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3.5">
        <div className={CELL}>
          <Eyebrow>Linked skills</Eyebrow>
          <div className="mt-2 flex flex-wrap gap-1.5">{skills}</div>
          {note.skills.length > 0 && (
            <p className="label mt-2 text-[9px] tracking-[0.06em] text-ink-4">{byLine(note.skills)}</p>
          )}
        </div>
        <div className={CELL}>
          <Eyebrow>Backlinks</Eyebrow>
          <div className="mt-1.5 flex flex-col">
            {note.backlinks.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setParams({ note: b.slug })}
                className="border-b border-rule py-1.5 text-left text-[12px] text-ink-2 transition-colors duration-150 hover:text-ok"
              >
                [[{b.title}]]
              </button>
            ))}
            {note.backlinks.length === 0 && <span className="text-[12px] text-ink-4">None yet</span>}
          </div>
        </div>
        <div className={CELL}>
          <Eyebrow>Vault</Eyebrow>
          <div className="mt-1.5">
            {inVault ? (
              <div className="flex justify-between gap-2 border-b border-rule py-1.5 text-[12px] text-ink">
                <span className="min-w-0 truncate">{note.externalId}</span>
                <span className="num shrink-0 text-[10px] text-ink-4">
                  {note.vaultSha.slice(0, 7)} · {ago(note.updatedAt)}
                </span>
              </div>
            ) : (
              <span className="text-[12px] text-ink-4">Not in the vault. Nothing here writes to it.</span>
            )}
          </div>
        </div>
        {note.unresolved.length > 0 && (
          <div className={CELL}>
            <Eyebrow>Links to write</Eyebrow>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {note.unresolved.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => run(() => startFromLink(slug), `Started ${slug}`)}
                  className={cn(MINI, 'hover:border-ink hover:text-ink')}
                >
                  {slug.replace(/-/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
