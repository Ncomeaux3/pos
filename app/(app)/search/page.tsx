import Link from 'next/link'
import { Chip, EmptyState, PageHeader, Row, RowList } from '@/components/pos'
import { db } from '@/core/db'
import { getModule, getModules } from '@/core/modules'
import { closest, search, type SearchHit } from '@/core/search'
import { cn } from '@/lib/utils'
import { Results, type Hit } from './Results'
import { SearchBox } from './SearchBox'

/**
 * What else is linked to the same skills, for the artboard's Related list.
 *
 * Through core.skill_links and core.entities, so it works across every module
 * without knowing what any of them hold: two things are related here when the
 * classifier put them under the same skill.
 */
async function relatedFor(ids: string[]): Promise<Map<string, { id: string; title: string; module: string }[]>> {
  if (ids.length === 0) return new Map()

  const { rows } = await db().query<{
    source: string
    id: string
    title: string
    module: string
  }>(
    `select mine.entity_ref as source, en.id, en.title, en.module
       from core.skill_links mine
       join core.skill_links theirs
         on theirs.skill_id = mine.skill_id and theirs.entity_ref <> mine.entity_ref
       join core.entities en on en.id = theirs.entity_ref
      where mine.entity_ref = any($1)
        and mine.classified_by <> 'unclassified'
      group by mine.entity_ref, en.id, en.title, en.module
      order by max(theirs.confidence) desc
      limit 200`,
    [ids],
  )

  const out = new Map<string, { id: string; title: string; module: string }[]>()
  for (const r of rows) {
    const seen = out.get(r.source) ?? []
    if (seen.length < 5 && !seen.some((x) => x.id === r.id)) {
      out.set(r.source, [...seen, { id: r.id, title: r.title, module: r.module }])
    }
  }
  return out
}

/** Skill names per entity, fetched for the page of hits rather than joined in. */
async function skillsFor(ids: string[]): Promise<Map<string, string[]>> {
  if (ids.length === 0) return new Map()

  const { rows } = await db().query<{ entity_ref: string; skill_id: string }>(
    `select entity_ref, skill_id from core.skill_links
      where entity_ref = any($1) and classified_by <> 'unclassified'
      order by confidence desc`,
    [ids],
  )

  const out = new Map<string, string[]>()
  for (const r of rows) out.set(r.entity_ref, [...(out.get(r.entity_ref) ?? []), r.skill_id])
  return out
}

function decorate(
  hits: SearchHit[],
  skills: Map<string, string[]>,
  related: Map<string, { id: string; title: string; module: string }[]>,
): Hit[] {
  return hits.map((h) => ({
    id: h.id,
    module: h.module,
    moduleLabel: getModule(h.module)?.nav.label ?? h.module,
    entityType: h.entityType,
    title: h.title,
    snippet: h.snippet,
    score: h.score,
    skills: skills.get(h.id) ?? [],
    related: (related.get(h.id) ?? []).map((r) => ({
      ...r,
      moduleLabel: getModule(r.module)?.nav.label ?? r.module,
    })),
  }))
}

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q : ''
  const scope = typeof params.module === 'string' ? params.module : undefined

  // Scope counts come from an unscoped search, so the chips can show what each
  // module holds for this query rather than only the scope you are already in.
  const result = query ? await search(query, { limit: 100 }) : { hits: [], mode: 'text' as const }
  const all = result.hits
  const scoped = scope ? all.filter((h) => h.module === scope) : all
  const fallback = query && all.length === 0 ? await closest(query) : []

  // A guessed answer is presented as a guess, whatever it found. The words
  // matched nothing, so these are nearest neighbours, and rendering them as
  // results claims a match that was never made.
  const guessing = result.mode === 'guessed' || (scoped.length === 0 && fallback.length > 0)

  const shown = scoped.length > 0 ? scoped : fallback
  const [skills, related] = await Promise.all([
    skillsFor(shown.map((h) => h.id)),
    relatedFor(shown.map((h) => h.id)),
  ])
  const hits = decorate(shown, skills, related)
  const top = hits[0]?.score || 1

  const counts = new Map<string, number>()
  for (const h of all) counts.set(h.module, (counts.get(h.module) ?? 0) + 1)

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <PageHeader
        eyebrow="Search"
        dot={query ? 'brand' : 'idle'}
        title="Search"
        lede="Every entity every module has registered, ranked by full text and meaning together. Command K opens this from anywhere."
      />

      <SearchBox initial={query} />

      {query && result.mode === 'degraded' && (
        <p className="t-caption rounded-md border border-warn/40 px-3 py-2 text-warn">
          Word matches only. Meaning was worth checking here but Voyage was out of requests,
          which is three a minute on the free tier. Try again in a moment.
        </p>
      )}

      {query && counts.size > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <ScopeChip href={`/search?q=${encodeURIComponent(query)}`} active={!scope}>
            Everything <span className="text-ink-3">{all.length}</span>
          </ScopeChip>
          {getModules()
            .filter((m) => counts.has(m.id))
            .map((m) => (
              <ScopeChip
                key={m.id}
                href={`/search?q=${encodeURIComponent(query)}&module=${m.id}`}
                active={scope === m.id}
              >
                {m.nav.label} <span className="text-ink-3">{counts.get(m.id)}</span>
              </ScopeChip>
            ))}
        </div>
      )}

      {!query ? (
        <EmptyState headline="Nothing searched">
          Type anything. Search reads core.entities, so it covers every module at once and
          finds a note by what it means as well as by what it says.
        </EmptyState>
      ) : guessing && hits.length > 0 ? (
        <div className="space-y-3">
          <p className="t-caption text-ink-3">
            Nothing matched {`"${query}"`}
            {scope ? ` in ${getModule(scope)?.nav.label ?? scope}` : ''}. Closest matches:
          </p>
          <RowList>
            {hits.map((h) => (
              <Row
                key={h.id}
                title={h.title}
                meta={h.snippet ?? undefined}
                right={<Chip tone="quiet">{h.entityType}</Chip>}
              />
            ))}
          </RowList>
        </div>
      ) : (
        <Results hits={hits} query={query} top={top} />
      )}
    </div>
  )
}

function ScopeChip({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'label inline-flex h-11 items-center gap-2 rounded-full border px-3.5 text-[11px] leading-none tracking-[0.1em] transition-colors duration-150 sm:h-[30px]',
        active ? 'border-brand bg-brand-soft text-ink' : 'border-rule-2 text-ink-3 hover:text-ink',
      )}
    >
      {children}
    </Link>
  )
}
