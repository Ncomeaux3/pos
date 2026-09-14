import { db } from '@/core/db'
import { register } from '@/core/entities'
import { embedChanged } from '@/core/search'
import { resolveDanglingLinks, syncLinks, uniqueSlug } from './data'
import { fileByRules } from './hubs'

// One capture box, no title field. The first line is the title because that
// is what people write first anyway; asking for a title separately is the
// friction that keeps a thought out of the vault.

export type Captured = { id: string; slug: string; status: 'draft' | 'published' }

/**
 * Save typed text as a note. A "worked on" entry is kind `daily`, not a new
 * kind: a log line and a daily note are the same thing at different lengths.
 *
 * The status rule is the one `write` applies: an agent drafts, the owner
 * publishes.
 */
export async function captureText(
  { text, worked = false }: { text: string; worked?: boolean },
  source: 'manual' | 'agent' = 'manual',
): Promise<Captured> {
  const trimmed = text.trim()
  const newline = trimmed.indexOf('\n')
  const first = (newline === -1 ? trimmed : trimmed.slice(0, newline)).trim()
  const title = first.slice(0, 120) || 'Untitled'
  // One line is both the title and the body, so the note is not empty.
  const body = newline === -1 ? trimmed : trimmed.slice(newline + 1).trim()

  const status = source === 'agent' ? 'draft' : 'published'
  const slug = await uniqueSlug(title)

  const { rows } = await db().query<{ id: string }>(
    `insert into brain.note (title, body, slug, kind, status, source)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [title, body, slug, worked ? 'daily' : 'note', status, source],
  )
  const id = rows[0].id

  await syncLinks(id, body)
  await resolveDanglingLinks(slug, id)
  await register({
    module: 'brain',
    entityType: 'note',
    entityId: id,
    title,
    text: body,
    eventType: status === 'draft' ? 'note_ingested' : undefined,
  })
  await fileByRules(id, title, body)
  // Now rather than at the nightly run, so the note can show up as related
  // to the next thing typed.
  await embedChanged()

  return { id, slug, status }
}
