import { db } from '@/core/db'

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
    await db().query(
      `insert into notes.note (title, body, external_id, source)
       values ($1, $2, $3, 'demo')
       on conflict (source, external_id) do update
         set title = excluded.title, body = excluded.body`,
      [note.title, note.body, note.external_id],
    )
  }
  return NOTES.length
}
