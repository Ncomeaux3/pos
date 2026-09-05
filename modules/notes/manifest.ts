import { z } from 'zod'
import { defineModule, defineTool } from '@/core/modules'
import { db } from '@/core/db'
import NotesPage from './ui/NotesPage'
import { nightlyDigest } from './jobs/nightly-digest'

// The smallest module that still exercises every part of the contract: a page,
// a digest, a write tool, and a nightly job. Copy this folder to start a new one.
export default defineModule({
  id: 'notes',
  nav: { label: 'Notes', icon: 'notebook', order: 10 },
  pages: { '': NotesPage },

  tools: {
    get_digest: defineTool({
      description: 'Note counts and the most recent titles.',
      input: z.object({}),
      run: () => nightlyDigest(),
    }),

    write: defineTool({
      description: 'Create a note.',
      input: z.object({
        title: z.string().min(1).max(200),
        body: z.string().max(10_000).default(''),
      }),
      run: async ({ title, body }, ctx) => {
        // Step 6 routes this through entities.register() so the note also gets
        // an entity, skill links, and an event.
        const { rows } = await db().query<{ id: string }>(
          `insert into notes.note (title, body, source) values ($1, $2, $3) returning id`,
          [title, body, ctx.source === 'agent' ? 'agent' : 'manual'],
        )
        return { id: rows[0].id }
      },
    }),
  },

  // Nothing here costs money or changes a policy, so nothing needs review.
  guarded: [],
  requires: [],

  jobs: [{ name: 'nightly_digest', run: nightlyDigest }],
  entityTypes: ['note'],
})
