import { db } from '@/core/db'

export type NotesDigest = {
  total: number
  createdLast7Days: number
  recentTitles: string[]
}

/**
 * Written to core.digests nightly. The orchestrator reads this, never the
 * notes table itself.
 */
export async function nightlyDigest(): Promise<NotesDigest> {
  const { rows } = await db().query<{ total: string; recent: string; titles: string[] | null }>(
    `select
       count(*)::text as total,
       count(*) filter (where created_at >= now() - interval '7 days')::text as recent,
       (array_agg(title order by created_at desc))[1:3] as titles
     from notes.note`,
  )

  return {
    total: Number(rows[0].total),
    createdLast7Days: Number(rows[0].recent),
    recentTitles: rows[0].titles ?? [],
  }
}
