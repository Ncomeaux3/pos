import { db } from '@/core/db'

type Note = { id: string; title: string; body: string; created_at: Date }

export default async function NotesPage() {
  const { rows } = await db().query<Note>(
    'select id, title, body, created_at from notes.note order by created_at desc limit 50',
  )

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="text-sm text-muted-foreground">
          The worked example module. Its page, nav entry, and route all come from
          modules/notes/manifest.ts.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          No notes yet. Run <code className="font-mono">pnpm setup --demo</code> to seed five.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((note) => (
            <li key={note.id} className="space-y-1 p-4">
              <p className="text-sm font-medium">{note.title}</p>
              {note.body && <p className="text-sm text-muted-foreground">{note.body}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(note.created_at).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
