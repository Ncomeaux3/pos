import { PageHeader } from '@/components/pos'
import { db } from '@/core/db'
import { listNotes } from '../data'
import { Brain, type BrainData } from './Brain'

export default async function BrainPage() {
  const notes = await listNotes()

  // Backlinks and dangling targets for every note in one pass. Two queries
  // rather than one per note: the panel needs them for whichever note is
  // opened, and opening one should not cost a round trip.
  const { rows: links } = await db().query<{
    from_note_id: string
    to_note_id: string | null
    to_slug: string
  }>(`select from_note_id, to_note_id, to_slug from brain.link`)

  const titleById = new Map(notes.map((n) => [n.id, n.title]))

  const data: BrainData = {
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      slug: n.slug,
      kind: n.kind,
      status: n.status,
      sourceUrl: n.source_url,
      sourceText: n.source_text,
      sourceMeta: n.source_meta,
      committed: n.committed_sha !== '',
      updatedAt: new Date(n.updated_at).toISOString(),
      backlinks: links
        .filter((l) => l.to_note_id === n.id)
        .map((l) => ({ id: l.from_note_id, title: titleById.get(l.from_note_id) ?? 'a note' })),
      // A link to a note that does not exist yet. Kept and shown, because it is
      // usually the best idea of what to write next.
      unresolved: links
        .filter((l) => l.from_note_id === n.id && l.to_note_id === null)
        .map((l) => l.to_slug),
    })),
  }

  const inbox = data.notes.filter((n) => n.status === 'draft').length
  const dangling = new Set(data.notes.flatMap((n) => n.unresolved)).size

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`Second Brain / ${data.notes.length - inbox} notes / ${inbox} in the inbox`}
        dot={inbox > 0 ? 'warn' : 'brand'}
        title="Second Brain"
        lede="The vault is the source of truth and nothing reaches it without you. An ingested draft sits in the inbox next to the text it was drawn from until you accept it."
        actions={
          <span className="num text-[11px] text-ink-3">
            {dangling} link{dangling === 1 ? '' : 's'} to write
          </span>
        }
      />
      <Brain data={data} />
    </div>
  )
}
