import { z } from 'zod'
import { db } from '@/core/db'
import { defineModule, defineTool } from '@/core/module-contract'
import SkillTreePage from './ui/SkillTreePage'
import { classify } from './classify'
import { nightlyDigest } from './jobs/nightly-digest'

// The Skill Tree. It owns the tree, the XP weights and the level function, and
// it is the module that supplies core with a classifier: core/entities.ts calls
// whatever module declares one, for every row every module creates.
//
// Delete this folder and the app still runs. Entities still register, events
// still emit, nothing classifies. That is the seam working.
export default defineModule({
  id: 'skills',
  nav: { label: 'Skill Tree', icon: 'sparkles', order: 20 },
  pages: { '': SkillTreePage },

  classifier: classify,

  tools: {
    get_digest: defineTool({
      description: 'Attribute levels, character level, skills gaining fastest and skills stagnant.',
      input: z.object({}),
      run: () => nightlyDigest(),
    }),

    // The tree is skills.yaml merged with these rows. There is no node table:
    // the committed yaml stays the fork default and every edit is an override.
    write: defineTool({
      description: 'Add, rename or delete a skill. Edits sit on top of the committed tree.',
      input: z.object({
        kind: z.enum(['custom', 'rename', 'delete']),
        skillId: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[a-z0-9_]+$/, 'Lowercase letters, digits and underscores.'),
        name: z.string().min(1).max(80).optional(),
        parent: z.string().max(64).optional(),
        keywords: z.array(z.string().min(1).max(40)).max(40).default([]),
      }),
      run: async ({ kind, skillId, name, parent, keywords }) => {
        await db().query(
          `insert into skills.override (kind, skill_id, name, parent, keywords)
           values ($1, $2, $3, $4, $5)
           on conflict (kind, skill_id) do update
             set name = excluded.name, parent = excluded.parent, keywords = excluded.keywords`,
          [kind, skillId, name ?? null, parent ?? null, keywords],
        )
        return { kind, skillId }
      },
    }),

    // Dragging an event onto another skill on the Skill Tree screen. This is
    // the one write that sets is_manual, and nothing overwrites it afterwards:
    // classify() only ever updates rows where is_manual = false.
    reassign: defineTool({
      description: 'Move an entity\'s skill link to a different skill, by hand.',
      input: z.object({
        entityRef: z.string().uuid(),
        fromSkillId: z.string().min(1),
        toSkillId: z.string().min(1),
      }),
      run: async ({ entityRef, fromSkillId, toSkillId }) => {
        await db().query(
          `delete from core.skill_links where entity_ref = $1 and skill_id = $2`,
          [entityRef, fromSkillId],
        )
        await db().query(
          `insert into core.skill_links (entity_ref, skill_id, confidence, classified_by, is_manual)
           values ($1, $2, 1, 'human', true)
           on conflict (entity_ref, skill_id) do update
             set confidence = 1, classified_by = 'human', is_manual = true`,
          [entityRef, toSkillId],
        )
        return { entityRef, toSkillId }
      },
    }),
  },

  // Nothing here costs money or changes a policy. Editing the tree is the
  // owner's own judgement, and reassigning is what manual override means.
  guarded: [],
  requires: [],

  jobs: [{ name: 'nightly_digest', run: nightlyDigest }],
  // Skills are not entities: a skill is what an entity links to. Nothing here
  // registers, so there is nothing to search or embed.
  entityTypes: [],
})
