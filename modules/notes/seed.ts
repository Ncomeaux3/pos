import { db } from '@/core/db'
import { register } from '@/core/entities'

// Synthetic rows for `pnpm setup --demo`. Upserts on external_id so running it
// twice does not duplicate. Nothing here is personal; this ships in the template.
const NOTES = [
  { external_id: 'demo-1', title: 'Read Designing Data-Intensive Applications', body: 'Chapter 5 on replication was the useful part.' },
  { external_id: 'demo-2', title: 'Sharpen the kitchen knives', body: '' },
  { external_id: 'demo-3', title: 'Postgres full text search notes', body: 'tsvector plus GIN covers the exact match cases vectors miss.' },
  { external_id: 'demo-4', title: 'Trip idea: Lisbon in the spring', body: 'Cheapest weeks look like late March.' },
  { external_id: 'demo-5', title: 'Deadlift form check', body: 'Bar drifting forward off the floor. Slow the first inch.' },
]

export async function seed(): Promise<number> {
  for (const note of NOTES) {
    const { rows } = await db().query<{ id: string }>(
      `insert into notes.note (title, body, external_id, source)
       values ($1, $2, $3, 'demo')
       on conflict (source, external_id) do update
         set title = excluded.title, body = excluded.body
       returning id`,
      [note.title, note.body, note.external_id],
    )
    // Same path as a real write, so the demo data exercises classification and
    // the event log rather than sitting inert.
    await register({
      module: 'notes',
      entityType: 'note',
      entityId: rows[0].id,
      title: note.title,
      text: note.body,
    })
  }
  return NOTES.length
}
