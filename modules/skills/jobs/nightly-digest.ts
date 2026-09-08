import { db } from '@/core/db'
import { loadTree } from '../tree'
import { level } from '../xp'

export type SkillsDigest = {
  /** The character sheet's top line. */
  attributes: { skillId: string; name: string; level: number; xp: number }[]
  totalXp: number
  characterLevel: number
  /** Most XP gained in the last 30 days. */
  gaining: { skillId: string; name: string; gained: number }[]
  /** Linked at some point, nothing in 60 days. */
  stagnant: { skillId: string; name: string; lastEventAt: string | null }[]
  /**
   * SPEC also asks for skills with high goal weight and low activity. Goals
   * does not exist yet and nothing else supplies a goal weight, so this stays
   * empty rather than carrying a number nobody computed.
   */
  underGoalPressure: never[]
}

type Row = {
  skill_id: string
  xp: string
  gained_30d: string
  last_event_at: string | null
}

const DAY = 24 * 60 * 60 * 1000

/**
 * Written to core.digests nightly. Everything outside this module reads these
 * numbers from there, the Dashboard tile included: no other screen reaches into
 * the skills schema.
 */
export async function nightlyDigest(): Promise<SkillsDigest> {
  const nodes = await loadTree()
  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.name ?? id

  const { rows } = await db().query<Row>(
    `select
       x.skill_id,
       x.xp::text,
       x.last_event_at::text,
       coalesce(sum(w.weight * sl.weight * sl.confidence)
         filter (where e.occurred_at >= now() - interval '30 days'), 0)::text as gained_30d
     from skills.xp x
     join core.skill_links sl on sl.skill_id = x.skill_id
     join core.events e on e.entity_ref = sl.entity_ref
     join skills.xp_weight w on w.event_type = e.event_type
     group by x.skill_id, x.xp, x.last_event_at`,
  )

  // A parent's XP is the sum of its children, rolled up here rather than in
  // SQL: the tree shape lives in the yaml and the overrides table, so there is
  // no parent column in the database to recurse over.
  const own = new Map(rows.map((r) => [r.skill_id, Number(r.xp)]))
  const childrenOf = new Map<string, string[]>()
  for (const node of nodes) {
    if (!node.parent) continue
    childrenOf.set(node.parent, [...(childrenOf.get(node.parent) ?? []), node.id])
  }
  const rollUp = (id: string): number =>
    (own.get(id) ?? 0) + (childrenOf.get(id) ?? []).reduce((sum, child) => sum + rollUp(child), 0)

  const attributes = nodes
    .filter((n) => !n.parent)
    .map((n) => {
      const xp = rollUp(n.id)
      return { skillId: n.id, name: n.name, level: level(xp), xp }
    })

  const totalXp = attributes.reduce((sum, a) => sum + a.xp, 0)
  const stagnantBefore = Date.now() - 60 * DAY

  return {
    attributes,
    totalXp,
    characterLevel: level(totalXp),
    gaining: rows
      .filter((r) => Number(r.gained_30d) > 0)
      .sort((a, b) => Number(b.gained_30d) - Number(a.gained_30d))
      .slice(0, 5)
      .map((r) => ({ skillId: r.skill_id, name: nameOf(r.skill_id), gained: Number(r.gained_30d) })),
    stagnant: rows
      .filter((r) => r.last_event_at !== null && Date.parse(r.last_event_at) < stagnantBefore)
      .sort((a, b) => Date.parse(a.last_event_at!) - Date.parse(b.last_event_at!))
      .slice(0, 5)
      .map((r) => ({ skillId: r.skill_id, name: nameOf(r.skill_id), lastEventAt: r.last_event_at })),
    underGoalPressure: [],
  }
}
