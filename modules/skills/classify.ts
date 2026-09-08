import { db } from '@/core/db'
import { complete } from '@/core/llm'
import { loadTree, type SkillNode } from './tree'

// Rules first, model second. See docs/ARCHITECTURE.md "Classification".
//
// This is the function the manifest hands to core as its `classifier`, so it is
// what runs on every row every module creates.

const CLASSIFIER_MODEL = 'claude-haiku-4-5' as const

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Deterministic pass. Word boundary matched so "ran" does not fire on "branch".
 * Pure, because this is the half that has to be right every time.
 */
export function matchByRules(text: string, nodes: SkillNode[]): string[] {
  const hits = new Set<string>()
  for (const node of nodes) {
    for (const keyword of node.keywords ?? []) {
      if (new RegExp(`\\b${escape(keyword)}\\b`, 'i').test(text)) {
        hits.add(node.id)
        break
      }
    }
  }
  return [...hits]
}

type ModelLink = { skill_id: string; confidence: number }

/** One retry, then give up. A failed classification must not fail the write. */
async function askModel(
  text: string,
  nodes: SkillNode[],
  module?: string,
): Promise<ModelLink[] | null> {
  const tree = nodes
    .filter((n) => n.parent)
    .map((n) => `${n.id}: ${n.name}`)
    .join('\n')

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const answer = await complete({
        model: CLASSIFIER_MODEL,
        purpose: 'classification',
        module,
        system:
          'Link the text to skills from the list. Reply with JSON only: an array of ' +
          '{"skill_id","confidence"} using ids from the list, confidence between 0 and 1. ' +
          'Return [] when nothing fits. Do not invent ids.',
        messages: [{ role: 'user', content: `Skills:\n${tree}\n\nText:\n${text}` }],
        maxTokens: 512,
      })
      const parsed = JSON.parse(answer.slice(answer.indexOf('['), answer.lastIndexOf(']') + 1))
      if (Array.isArray(parsed)) return parsed
    } catch {
      // Fall through to the retry, then to unclassified.
    }
  }
  return null
}

async function link(
  entityRef: string,
  skillId: string,
  confidence: number,
  classifiedBy: string,
): Promise<void> {
  // The where clause is the manual override rule: a human decision is never
  // overwritten by a job.
  await db().query(
    `insert into core.skill_links (entity_ref, skill_id, confidence, classified_by)
     values ($1, $2, $3, $4)
     on conflict (entity_ref, skill_id) do update
       set confidence = excluded.confidence, classified_by = excluded.classified_by
       where core.skill_links.is_manual = false`,
    [entityRef, skillId, confidence, classifiedBy],
  )
}

/**
 * Clears the unclassified marker once a real skill is found.
 *
 * It is a parking space, not a skill, so it must not survive alongside real
 * links: it would otherwise sit in the tree forever and carry XP of its own.
 * This is what happens to every row classified while Anthropic was
 * disconnected, once the nightly batch reaches it.
 */
async function clearUnclassified(entityRef: string): Promise<void> {
  await db().query(
    `delete from core.skill_links
      where entity_ref = $1 and skill_id = 'unclassified' and is_manual = false`,
    [entityRef],
  )
}

/**
 * Links one entity to skills. Rules first; only the leftovers cost a model
 * call. Never throws: a note that cannot be classified is still a note.
 */
export async function classify(entityRef: string, text: string, module?: string): Promise<void> {
  const nodes = await loadTree()

  const ruleHits = matchByRules(text, nodes)
  if (ruleHits.length > 0) {
    for (const skillId of ruleHits) await link(entityRef, skillId, 1, 'rule')
    await clearUnclassified(entityRef)
    return
  }

  const known = new Set(nodes.map((n) => n.id))
  const guesses = (await askModel(text, nodes, module))?.filter((g) => known.has(g.skill_id)) ?? []

  if (guesses.length === 0) {
    // Parked for manual review rather than silently dropped.
    await link(entityRef, 'unclassified', 0, 'unclassified')
    return
  }

  await clearUnclassified(entityRef)

  for (const guess of guesses) {
    await link(
      entityRef,
      guess.skill_id,
      Math.min(1, Math.max(0, guess.confidence ?? 0)),
      `model:${CLASSIFIER_MODEL}`,
    )
  }
}
