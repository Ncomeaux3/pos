import { db } from '@/core/db'
import { extractLinks, slugify } from './wikilinks'

// Reads and the two writes the module makes. The parsing lives in
// ./wikilinks.ts, which has no imports and can be pulled into a client.

export type NoteRow = {
  id: string
  title: string
  body: string
  slug: string
  kind: string
  status: string
  source_url: string
  source_text: string
  source_meta: string
  source: string
  external_id: string | null
  vault_sha: string
  committed_sha: string
  updated_at: Date
}

export async function listNotes(filter?: { status?: string; kind?: string }): Promise<NoteRow[]> {
  const { rows } = await db().query<NoteRow>(
    `select id, title, body, slug, kind, status, source_url, source_text, source_meta,
            source, external_id, vault_sha, committed_sha, updated_at
       from brain.note
      where ($1::text is null or status = $1)
        and ($2::text is null or kind = $2)
      order by updated_at desc
      limit 200`,
    [filter?.status ?? null, filter?.kind ?? null],
  )
  return rows
}

export type Backlink = { id: string; title: string; slug: string }

/** Who points at this note, and what it points at that does not exist yet. */
export async function linksFor(noteId: string): Promise<{
  backlinks: Backlink[]
  unresolved: string[]
}> {
  const { rows: backlinks } = await db().query<Backlink>(
    `select n.id, n.title, n.slug
       from brain.link l
       join brain.note n on n.id = l.from_note_id
      where l.to_note_id = $1
      order by n.title`,
    [noteId],
  )

  const { rows: unresolved } = await db().query<{ to_slug: string }>(
    `select to_slug from brain.link where from_note_id = $1 and to_note_id is null order by to_slug`,
    [noteId],
  )

  return { backlinks, unresolved: unresolved.map((u) => u.to_slug) }
}

/**
 * Rewrite one note's outgoing links.
 *
 * Delete then insert rather than diff: a note's links are small, the whole set
 * is known, and a diff would be more code for the same answer.
 *
 * Resolution is by slug against existing notes, and an unresolved link is kept
 * with a null target. A link to a note you have not written yet is a real thing
 * in a vault and is usually how the next note starts, so dropping it would lose
 * the most useful thing on the page.
 */
export async function syncLinks(noteId: string, body: string): Promise<number> {
  const slugs = extractLinks(body)

  await db().query(`delete from brain.link where from_note_id = $1`, [noteId])
  if (slugs.length === 0) return 0

  await db().query(
    `insert into brain.link (from_note_id, to_slug, to_note_id)
     select $1, s.slug, n.id
       from unnest($2::text[]) as s(slug)
       left join brain.note n on n.slug = s.slug
     on conflict (from_note_id, to_slug) do update set to_note_id = excluded.to_note_id`,
    [noteId, slugs],
  )

  return slugs.length
}

/**
 * Point every dangling link at a note that has just appeared.
 *
 * Called after a note is created, so writing the note someone linked to last
 * week connects the two without either being edited again. This is the reason
 * unresolved links are stored rather than discarded.
 */
export async function resolveDanglingLinks(slug: string, noteId: string): Promise<number> {
  const { rowCount } = await db().query(
    `update brain.link set to_note_id = $2 where to_slug = $1 and to_note_id is null`,
    [slug, noteId],
  )
  return rowCount ?? 0
}

/** A slug nothing else is using, by adding a number only when it has to. */
export async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title)

  const { rows } = await db().query<{ slug: string }>(
    `select slug from brain.note where slug = $1 or slug like $1 || '-%'`,
    [base],
  )
  const taken = new Set(rows.map((r) => r.slug))

  if (excludeId) {
    const { rows: mine } = await db().query<{ slug: string }>(
      `select slug from brain.note where id = $1`,
      [excludeId],
    )
    if (mine[0]) taken.delete(mine[0].slug)
  }

  if (!taken.has(base)) return base

  for (let n = 2; n < 1000; n++) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
  }
  return `${base}-${Date.now()}`
}

export type SkillLinkRow = {
  note_id: string
  skill_id: string
  confidence: string
  classified_by: string | null
  is_manual: boolean
}

/** Every skill link on a note, for the chips under a draft and beside a note. */
export async function listSkillLinks(): Promise<SkillLinkRow[]> {
  const { rows } = await db().query<SkillLinkRow>(
    `select en.entity_id as note_id, sl.skill_id, sl.confidence::text,
            sl.classified_by, sl.is_manual
       from core.skill_links sl
       join core.entities en on en.id = sl.entity_ref
      where en.module = 'brain' and en.entity_type = 'note'
        and sl.classified_by <> 'unclassified'
      order by sl.confidence desc, sl.skill_id`,
  )
  return rows
}

export async function deleteNote(id: string): Promise<void> {
  await db().query(`delete from brain.note where id = $1`, [id])
}
