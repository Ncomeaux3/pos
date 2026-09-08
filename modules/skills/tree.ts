import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { db } from '@/core/db'

// The tree is skills.yaml merged with the owner's edits in skills.override.
//
// The yaml stays generic and committed: this repo is a fork and fill template
// and holds nothing personal. Every real skill Nick adds or renames is a row,
// which is also what makes the tree editable on Vercel, where the filesystem is
// read only at runtime. Reset to the default is a delete of every row.

export type SkillNode = {
  id: string
  parent?: string
  name: string
  description?: string
  keywords?: string[]
}

let yamlNodes: SkillNode[] | undefined

/** The committed default, with no overrides applied. */
export function loadYaml(): SkillNode[] {
  yamlNodes ??=
    parse(readFileSync(join(process.cwd(), 'modules/skills/skills.yaml'), 'utf8')).nodes ?? []
  return yamlNodes!
}

type Override = {
  kind: 'custom' | 'rename' | 'delete'
  skill_id: string
  name: string | null
  parent: string | null
  keywords: string[]
}

/** Applied in kind order so a rename of a custom node works in one pass. */
export function applyOverrides(base: SkillNode[], overrides: Override[]): SkillNode[] {
  const byId = new Map(base.map((n) => [n.id, { ...n }]))

  for (const o of overrides.filter((o) => o.kind === 'custom')) {
    byId.set(o.skill_id, {
      id: o.skill_id,
      name: o.name ?? o.skill_id,
      parent: o.parent ?? undefined,
      keywords: o.keywords,
    })
  }

  for (const o of overrides.filter((o) => o.kind === 'rename')) {
    const node = byId.get(o.skill_id)
    if (!node) continue
    if (o.name) node.name = o.name
    if (o.keywords.length > 0) node.keywords = o.keywords
  }

  // A deleted parent takes its descendants with it. Leaving them behind would
  // put orphans in the tree that no view can place and no XP can roll up.
  const deleted = new Set(overrides.filter((o) => o.kind === 'delete').map((o) => o.skill_id))
  let grew = true
  while (grew) {
    grew = false
    for (const node of byId.values()) {
      if (node.parent && deleted.has(node.parent) && !deleted.has(node.id)) {
        deleted.add(node.id)
        grew = true
      }
    }
  }

  return [...byId.values()].filter((n) => !deleted.has(n.id))
}

/**
 * The tree as the owner sees it. Read by classify(), the Skill Tree screen and
 * the Settings Skills tab, so all three agree on what a skill is.
 */
export async function loadTree(): Promise<SkillNode[]> {
  const { rows } = await db().query<Override>(
    `select kind, skill_id, name, parent, keywords from skills.override`,
  )
  return rows.length === 0 ? loadYaml() : applyOverrides(loadYaml(), rows)
}
