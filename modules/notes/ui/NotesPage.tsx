import { Chip, EmptyState, PageHeader, Row, RowList } from '@/components/pos'
import { db } from '@/core/db'

type Note = { id: string; title: string; body: string; created_at: Date }

export default async function NotesPage() {
  const { rows } = await db().query<Note>(
    'select id, title, body, created_at from notes.note order by created_at desc limit 50',
  )

  return (
    <div className="max-w-3xl space-y-7">
      <PageHeader
        eyebrow="Notes / All"
        dot={rows.length > 0 ? 'brand' : 'idle'}
        title="Notes"
        lede="The worked example module. Its page, nav entry, and route all come from modules/notes/manifest.ts, and every note registers an entity, classifies to skills, and emits an event."
        actions={<Chip tone="quiet">{rows.length} notes</Chip>}
      />

      {rows.length === 0 ? (
        <EmptyState headline="Nothing written">
          No notes yet. Run <span className="mono">pnpm setup --demo</span> to seed five, or call the
          notes.write tool.
        </EmptyState>
      ) : (
        <RowList>
          {rows.map((note) => (
            <Row
              key={note.id}
              title={note.title}
              meta={note.body || undefined}
              right={
                <span className="mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
              }
            />
          ))}
        </RowList>
      )}
    </div>
  )
}
