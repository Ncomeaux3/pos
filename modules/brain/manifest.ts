import { z } from 'zod'
import { db } from '@/core/db'
import { register } from '@/core/entities'
import { defineModule, defineTool } from '@/core/module-contract'
import { resolveDanglingLinks, syncLinks, uniqueSlug } from './data'
import { nightlyDigest, resolveLinks } from './jobs/nightly-digest'
import BrainPage from './ui/BrainPage'

const kind = z.enum(['article', 'book', 'video', 'note', 'project', 'person', 'daily'])

export default defineModule({
  id: 'brain',
  nav: { label: 'Second Brain', icon: 'brain', order: 40 },
  pages: { '': BrainPage },

  tools: {
    get_digest: defineTool({
      description: 'Inbox depth, what was written this week, and how many links point at nothing.',
      input: z.object({}),
      run: () => nightlyDigest(),
    }),

    write: defineTool({
      description:
        'Create or update a note. An agent writes a draft; only the owner publishes one.',
      input: z.object({
        id: z.uuid().optional(),
        title: z.string().min(1).max(300).optional(),
        body: z.string().max(200_000).optional(),
        kind: kind.optional(),
        source_url: z.string().max(2000).optional(),
        source_text: z.string().max(500_000).optional(),
        source_meta: z.string().max(300).optional(),
      }),
      run: async (input, ctx) => {
        if (input.id) {
          const fields = Object.entries(input).filter(([key]) => key !== 'id')
          if (fields.length > 0) {
            // Every key is a literal from the zod schema above, a closed set.
            const set = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ')
            await db().query(`update brain.note set ${set} where id = $1`, [
              input.id,
              ...fields.map(([, value]) => value),
            ])
          }

          if (input.body !== undefined) await syncLinks(input.id, input.body)
          // No register() on an update: it emits the creation event, and a note
          // edited twice would award its XP twice.
          return { id: input.id }
        }

        if (!input.title) throw new Error('A new note needs a title')

        // An agent writes a draft. The vault is the source of truth and the app
        // never adds to it without a review step, so `published` is a state
        // only the owner can put a note into.
        const status = ctx.source === 'agent' ? 'draft' : 'published'
        const slug = await uniqueSlug(input.title)

        const { rows } = await db().query<{ id: string }>(
          `insert into brain.note
             (title, body, slug, kind, status, source_url, source_text, source_meta, source)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           returning id`,
          [
            input.title,
            input.body ?? '',
            slug,
            input.kind ?? 'note',
            status,
            input.source_url ?? '',
            input.source_text ?? '',
            input.source_meta ?? '',
            ctx.source === 'agent' ? 'agent' : 'manual',
          ],
        )

        await syncLinks(rows[0].id, input.body ?? '')
        // Anything that was already linking to this title now points at it.
        await resolveDanglingLinks(slug, rows[0].id)

        await register({
          module: 'brain',
          entityType: 'note',
          entityId: rows[0].id,
          title: input.title,
          text: input.body,
          // A draft is a proposal about a note, not a note. It earns nothing
          // until the owner accepts it.
          eventType: status === 'draft' ? 'note_ingested' : undefined,
        })

        return { id: rows[0].id, slug, status }
      },
    }),

    publish: defineTool({
      description: 'Accept a draft into the vault, or send a published note back to the inbox.',
      input: z.object({ id: z.uuid(), publish: z.boolean().default(true) }),
      run: async ({ id, publish }) => {
        const { rows } = await db().query<{ title: string; kind: string }>(
          `update brain.note set status = $2 where id = $1 returning title, kind`,
          [id, publish ? 'published' : 'draft'],
        )
        if (rows.length === 0) throw new Error(`No note ${id}`)

        if (publish) {
          await register({
            module: 'brain',
            entityType: 'note',
            entityId: id,
            title: rows[0].title,
            // Finishing a book is the medium weight SPEC names, and it is worth
            // more than approving any other draft.
            eventType: rows[0].kind === 'book' ? 'book_finished' : 'note_approved',
          })
        }

        return { id, status: publish ? 'published' : 'draft' }
      },
    }),
  },

  /**
   * Nothing is guarded, because the draft state already is the guard.
   *
   * An agent cannot publish: `write` from an agent produces a draft whatever it
   * asks for, and `publish` is reached from the inbox. Guarding on top of that
   * would put the same decision behind two approvals.
   */
  guarded: [],
  requires: ['github_vault'],

  metrics: {
    notes_written: {
      label: 'Notes written',
      unit: 'notes',
      get: async () => {
        const { rows } = await db().query<{ n: string }>(
          `select count(*)::text as n from brain.note where status = 'published'`,
        )
        return Number(rows[0].n)
      },
    },
    books_finished: {
      label: 'Books finished',
      unit: 'books',
      get: async () => {
        const { rows } = await db().query<{ n: string }>(
          `select count(*)::text as n from brain.note
            where status = 'published' and kind = 'book'`,
        )
        return Number(rows[0].n)
      },
    },
  },

  jobs: [
    { name: 'resolve_links', run: resolveLinks },
    { name: 'nightly_digest', run: nightlyDigest },
  ],
  entityTypes: ['note'],
})
