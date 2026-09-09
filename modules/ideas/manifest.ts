import { z } from 'zod'
import { db } from '@/core/db'
import { register } from '@/core/entities'
import { defineModule, defineTool } from '@/core/module-contract'
import { nightlyDigest } from './jobs/nightly-digest'
import IdeasPage from './ui/IdeasPage'

const level = z.number().int().min(1).max(3)

export default defineModule({
  id: 'ideas',
  nav: { label: 'Ideas', icon: 'lightbulb', order: 80 },
  pages: { '': IdeasPage },

  tools: {
    get_digest: defineTool({
      description: 'How many ideas are at each stage, the quick wins, and what has gone stale.',
      input: z.object({}),
      run: () => nightlyDigest(),
    }),

    write: defineTool({
      description: 'Capture an idea, or move one along.',
      input: z.object({
        id: z.uuid().optional(),
        title: z.string().min(1).max(300).optional(),
        pitch: z.string().max(2000).optional(),
        notes: z.string().max(10_000).optional(),
        stage: z.enum(['exploring', 'validated', 'building', 'killed']).optional(),
        effort: level.optional(),
        impact: level.optional(),
        killed_reason: z.string().max(1000).optional(),
        goal_ref: z.uuid().nullable().optional(),
      }),
      run: async (input) => {
        if (input.id) {
          const fields = Object.entries(input).filter(([key]) => key !== 'id')
          if (fields.length > 0) {
            // Every key is a literal from the zod schema above, a closed set.
            const set = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ')
            await db().query(`update ideas.idea set ${set} where id = $1`, [
              input.id,
              ...fields.map(([, value]) => value),
            ])
          }

          // Starting to build is the event worth anything. Capturing and
          // killing are both free, or the board would pay better than the work.
          if (input.stage === 'building') {
            const { rows } = await db().query<{ title: string }>(
              `select title from ideas.idea where id = $1`,
              [input.id],
            )
            if (rows[0]) {
              await register({
                module: 'ideas',
                entityType: 'idea',
                entityId: input.id,
                title: rows[0].title,
                eventType: 'idea_building',
              })
            }
          }
          return { id: input.id }
        }

        if (!input.title) throw new Error('An idea needs a title')

        const { rows } = await db().query<{ id: string }>(
          `insert into ideas.idea (title, pitch, notes, stage, effort, impact, goal_ref)
           values ($1, $2, $3, $4, $5, $6, $7)
           returning id`,
          [
            input.title,
            input.pitch ?? '',
            input.notes ?? '',
            input.stage ?? 'exploring',
            input.effort ?? 2,
            input.impact ?? 2,
            input.goal_ref ?? null,
          ],
        )

        await register({
          module: 'ideas',
          entityType: 'idea',
          entityId: rows[0].id,
          title: input.title,
          text: input.pitch,
          eventType: 'idea_captured',
        })

        return { id: rows[0].id }
      },
    }),
  },

  /**
   * Nothing is guarded.
   *
   * An idea is a note about something that does not exist. Nothing here spends
   * money, changes a commitment or touches anything outside this table, and a
   * killed idea is kept rather than deleted, so even the destructive sounding
   * action is reversible.
   */
  guarded: [],
  requires: [],

  metrics: {
    ideas_building: {
      label: 'Ideas being built',
      unit: 'ideas',
      get: async () => {
        const { rows } = await db().query<{ n: string }>(
          `select count(*)::text as n from ideas.idea where stage = 'building'`,
        )
        return Number(rows[0].n)
      },
    },
  },

  jobs: [{ name: 'nightly_digest', run: nightlyDigest }],
  entityTypes: ['idea'],
})
