import { createHash } from 'node:crypto'
import { embed, VOYAGE_DIMENSIONS } from '@/integrations/voyage/client'
import { db } from './db'

// Hybrid search over core.entities: a vector query and a full text query merged
// by reciprocal rank. Exposed as the core.search MCP tool and the Search page.
//
// Nothing here reaches into a module's own tables. core.entities carries the
// title and the indexable body, which is what lets one index cover every module
// without core knowing any of them.

export type Ranked = { id: string; rank: number }
export type Fused = { id: string; score: number }

/**
 * Reciprocal rank fusion. The constant damps the difference between the top
 * ranks, so a result both retrievers agree on outranks one that only the
 * stronger retriever found. 60 is the value the original paper uses and the one
 * every implementation since has kept.
 */
const RRF_K = 60

export function fuseByRank(vector: Ranked[], text: Ranked[]): Fused[] {
  const scores = new Map<string, number>()

  for (const list of [vector, text]) {
    for (const { id, rank } of list) {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + rank))
    }
  }

  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
}

/**
 * What decides whether a row needs re-embedding. The length prefix means moving
 * the split between title and body changes the hash, which a plain join would
 * not: "ab" + "c" and "a" + "bc" are different rows and must hash differently.
 */
export function contentHash(title: string, body: string | null): string {
  const b = body ?? ''
  return createHash('sha256').update(`${title.length}:${title}${b}`).digest('hex')
}

/** The text that gets embedded and indexed for one entity. */
function indexText(title: string, body: string | null): string {
  return body ? `${title}\n${body}` : title
}

export type EmbedResult = { scanned: number; indexed: number; embedded: number }

/**
 * The nightly indexing pass, in two halves.
 *
 * Full text costs nothing, so it runs unconditionally for every row whose hash
 * moved: `tsv` lives on core.embeddings, and without this pass a search finds
 * nothing at all until Voyage is connected. The vector half then fills in the
 * rows that have no embedding yet, and is skipped entirely when Voyage is not
 * connected rather than failing the whole job.
 *
 * `content_hash` tracks the indexed text. Embedding freshness is a separate
 * question answered by `embedding is null`, so a row indexed before Voyage
 * arrived is still picked up on the first run after it does.
 */
export async function embedChanged(limit = 256): Promise<EmbedResult> {
  const { rows } = await db().query<{
    id: string
    title: string
    body: string | null
    stored_hash: string | null
    has_vector: boolean
  }>(
    `select e.id, e.title, e.body,
            em.content_hash as stored_hash,
            (em.embedding is not null) as has_vector
       from core.entities e
       left join core.embeddings em on em.entity_id = e.id
      order by e.updated_at desc
      limit $1`,
    [limit],
  )

  const withHash = rows.map((r) => ({ ...r, hash: contentHash(r.title, r.body) }))
  const staleText = withHash.filter((r) => r.hash !== r.stored_hash)

  for (const row of staleText) {
    await db().query(
      `insert into core.embeddings (entity_id, content_hash, tsv)
       values ($1, $2, to_tsvector('english', $3))
       on conflict (entity_id) do update
         set content_hash = excluded.content_hash, tsv = excluded.tsv`,
      [row.id, row.hash, indexText(row.title, row.body)],
    )
  }

  // Anything whose text just changed needs a new vector, and so does anything
  // that never got one.
  const staleVector = withHash.filter((r) => !r.has_vector || r.hash !== r.stored_hash)
  if (staleVector.length === 0) {
    return { scanned: rows.length, indexed: staleText.length, embedded: 0 }
  }

  let vectors: number[][]
  try {
    vectors = await embed(staleVector.map((r) => indexText(r.title, r.body)))
  } catch {
    // Not connected, or the call failed. The text index is already written, so
    // search still works; the vectors arrive on the next run.
    return { scanned: rows.length, indexed: staleText.length, embedded: 0 }
  }

  for (const [i, row] of staleVector.entries()) {
    const vector = vectors[i]
    if (!vector || vector.length !== VOYAGE_DIMENSIONS) {
      throw new Error(`Voyage returned ${vector?.length ?? 0} dimensions, expected ${VOYAGE_DIMENSIONS}`)
    }

    await db().query(
      `update core.embeddings
          set embedding = $2::vector, embedded_at = now()
        where entity_id = $1`,
      [row.id, JSON.stringify(vector)],
    )
  }

  return { scanned: rows.length, indexed: staleText.length, embedded: staleVector.length }
}

export type SearchHit = {
  id: string
  module: string
  entityType: string
  entityId: string
  title: string
  snippet: string | null
  score: number
}

export type SearchOptions = { module?: string; limit?: number }

/**
 * One statement, two retrievers, merged in SQL so the ranks come back already
 * fused. Doing the merge in Postgres rather than in TypeScript keeps the row
 * cap honest: without it both CTEs would have to be fully materialised here.
 *
 * The vector arm is skipped when the query cannot be embedded, which is the
 * case before Voyage is connected. Full text alone still answers exact terms.
 */
export async function search(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
  const q = query.trim()
  if (!q) return []

  const limit = Math.min(opts.limit ?? 20, 100)
  const pool = Math.max(limit * 3, 60)

  let vector: string | null = null
  try {
    const [embedded] = await embed([q], 'query')
    if (embedded) vector = JSON.stringify(embedded)
  } catch {
    // Not connected, or the call failed. Full text carries the query on its own
    // rather than the page returning an error the owner cannot act on.
    vector = null
  }

  const { rows } = await db().query<SearchHit & { score: string }>(
    `with scoped as (
       select e.id, e.module, e.entity_type, e.entity_id, e.title, e.body, em.embedding, em.tsv
         from core.entities e
         join core.embeddings em on em.entity_id = e.id
        where ($3::text is null or e.module = $3)
     ),
     vec as (
       select id, row_number() over (order by embedding <=> $1::vector) as rank
         from scoped
        where $1::vector is not null and embedding is not null
        limit $4
     ),
     txt as (
       select id, row_number() over (
                order by ts_rank(tsv, websearch_to_tsquery('english', $2)) desc
              ) as rank
         from scoped
        where tsv @@ websearch_to_tsquery('english', $2)
        limit $4
     ),
     fused as (
       select coalesce(vec.id, txt.id) as id,
              coalesce(1.0 / (60 + vec.rank), 0) + coalesce(1.0 / (60 + txt.rank), 0) as score
         from vec
         full outer join txt on txt.id = vec.id
     )
     select e.id, e.module, e.entity_type as "entityType", e.entity_id as "entityId",
            e.title, left(e.body, 200) as snippet, fused.score::text as score
       from fused
       join core.entities e on e.id = fused.id
      order by fused.score desc
      limit $5`,
    [vector, q, opts.module ?? null, pool, limit],
  )

  return rows.map((r) => ({ ...r, score: Number(r.score) }))
}

/**
 * The fallback the Search page shows instead of a bare zero state: anything
 * whose title shares a trigram with the query. Cheap, and it turns "nothing
 * matched" into "did you mean".
 */
export async function closest(query: string, limit = 5): Promise<SearchHit[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const { rows } = await db().query<SearchHit & { score: string }>(
    `select id, module, entity_type as "entityType", entity_id as "entityId",
            title, left(body, 200) as snippet, '0' as score
       from core.entities
      where title ilike '%' || $1 || '%' or body ilike '%' || $1 || '%'
      order by length(title)
      limit $2`,
    [q, limit],
  )

  return rows.map((r) => ({ ...r, score: 0 }))
}
