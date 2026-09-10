import { z } from 'zod'
import { db } from '@/core/db'
import { register } from '@/core/entities'
import { defineModule, defineTool } from '@/core/module-contract'
import { completeFinishedTrips, nightlyDigest } from './jobs/nightly-digest'
import TravelPage from './ui/TravelPage'
import { TravelTile } from './ui/Tile'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const time = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM')

export default defineModule({
  id: 'travel',
  nav: { label: 'Travel', icon: 'globe', order: 60 },
  pages: { '': TravelPage },

  tools: {
    get_digest: defineTool({
      description: 'The next trip, what is waiting to be accepted, and any trip over budget.',
      input: z.object({}),
      run: () => nightlyDigest(),
    }),

    write_trip: defineTool({
      description: 'Create or update a trip.',
      input: z.object({
        id: z.uuid().optional(),
        name: z.string().min(1).max(200).optional(),
        destination: z.string().max(200).optional(),
        lat: z.number().min(-90).max(90).nullable().optional(),
        lon: z.number().min(-180).max(180).nullable().optional(),
        starts_on: date.nullable().optional(),
        ends_on: date.nullable().optional(),
        budget_cents: z.number().int().min(0).optional(),
        travellers: z.number().int().min(1).max(50).optional(),
        status: z.enum(['idea', 'planned', 'booked', 'done']).optional(),
        notes: z.string().max(5000).optional(),
      }),
      run: async (input) => {
        if (input.id) {
          const fields = Object.entries(input).filter(([key]) => key !== 'id')
          if (fields.length > 0) {
            // Every key is a literal from the zod schema above, a closed set.
            const set = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ')
            await db().query(`update travel.trip set ${set} where id = $1`, [
              input.id,
              ...fields.map(([, value]) => value),
            ])
          }
          return { id: input.id }
        }

        if (!input.name) throw new Error('A trip needs a name')

        const { rows } = await db().query<{ id: string }>(
          `insert into travel.trip
             (name, destination, lat, lon, starts_on, ends_on, budget_cents, travellers,
              status, notes)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           returning id`,
          [
            input.name,
            input.destination ?? '',
            input.lat ?? null,
            input.lon ?? null,
            input.starts_on ?? null,
            input.ends_on ?? null,
            input.budget_cents ?? 0,
            input.travellers ?? 1,
            input.status ?? 'idea',
            input.notes ?? '',
          ],
        )

        await register({
          module: 'travel',
          entityType: 'trip',
          entityId: rows[0].id,
          title: input.name,
          text: input.destination,
        })

        return { id: rows[0].id }
      },
    }),

    write_item: defineTool({
      description:
        'Add or update an itinerary item. An agent parsing a booking email adds it as pending.',
      input: z.object({
        id: z.uuid().optional(),
        trip_id: z.uuid().optional(),
        kind: z.enum(['flight', 'lodging', 'transit', 'activity', 'food']).optional(),
        title: z.string().min(1).max(300).optional(),
        detail: z.string().max(1000).optional(),
        occurs_on: date.nullable().optional(),
        occurs_at: time.nullable().optional(),
        amount_cents: z.number().int().min(0).optional(),
        confirmation: z.string().max(100).optional(),
        confidence: z.number().min(0).max(1).optional(),
      }),
      run: async (input, ctx) => {
        if (input.id) {
          const fields = Object.entries(input).filter(([key]) => key !== 'id')
          if (fields.length > 0) {
            const set = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ')
            await db().query(`update travel.itinerary_item set ${set} where id = $1`, [
              input.id,
              ...fields.map(([, value]) => value),
            ])
          }
          return { id: input.id }
        }

        if (!input.trip_id || !input.title) {
          throw new Error('A new itinerary item needs a trip and a title')
        }

        // A machine reading a confirmation email is proposing, not deciding.
        // Same shape as the Second Brain inbox, for the same reason.
        const status = ctx.source === 'agent' ? 'pending' : 'confirmed'

        const { rows } = await db().query<{ id: string }>(
          `insert into travel.itinerary_item
             (trip_id, kind, title, detail, occurs_on, occurs_at, amount_cents,
              confirmation, status, confidence, source)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           returning id`,
          [
            input.trip_id,
            input.kind ?? 'activity',
            input.title,
            input.detail ?? '',
            input.occurs_on ?? null,
            input.occurs_at ?? null,
            input.amount_cents ?? 0,
            input.confirmation ?? '',
            status,
            input.confidence ?? null,
            ctx.source === 'agent' ? 'agent' : 'manual',
          ],
        )

        return { id: rows[0].id, status }
      },
    }),

    accept_item: defineTool({
      description: 'Accept a parsed booking into the itinerary, or reject it.',
      input: z.object({ id: z.uuid(), accept: z.boolean().default(true) }),
      run: async ({ id, accept }) => {
        if (!accept) {
          await db().query(`delete from travel.itinerary_item where id = $1 and status = 'pending'`, [
            id,
          ])
          return { id, status: 'rejected' }
        }
        await db().query(
          `update travel.itinerary_item set status = 'confirmed' where id = $1`,
          [id],
        )
        return { id, status: 'confirmed' }
      },
    }),

    set_loyalty: defineTool({
      description:
        'Record a loyalty balance. Typed by the owner: no loyalty site is scraped, per SPEC.',
      input: z.object({
        name: z.string().min(1).max(120),
        kind: z.enum(['airline', 'hotel', 'card', 'rail']).default('airline'),
        balance: z.number().int().min(0),
        status_tier: z.string().max(60).optional(),
      }),
      run: async (input) => {
        await db().query(
          `insert into travel.loyalty_program (name, kind, balance, status_tier)
           values ($1, $2, $3, $4)
           on conflict (name) do update
             set balance = excluded.balance, kind = excluded.kind,
                 status_tier = excluded.status_tier`,
          [input.name, input.kind, input.balance, input.status_tier ?? ''],
        )
        return { name: input.name, balance: input.balance }
      },
    }),
  },

  /**
   * A trip is a commitment with a budget attached, so an agent proposes one.
   *
   * `write_item` is not guarded: an agent-added item is already `pending` and
   * waits in the inbox, which is this module's own version of the same gate.
   * `accept_item` is the owner acting on that, and `set_loyalty` is a number
   * they typed.
   */
  guarded: ['write_trip'],
  requires: [],

  metrics: {
    places_visited: {
      label: 'Places visited',
      unit: 'places',
      get: async () => {
        const { rows } = await db().query<{ n: string }>(
          `select count(*)::text as n from travel.place_visited`,
        )
        return Number(rows[0].n)
      },
    },
    countries_visited: {
      label: 'Countries visited',
      unit: 'countries',
      get: async () => {
        const { rows } = await db().query<{ n: string }>(
          `select count(distinct country)::text as n from travel.place_visited
            where country <> ''`,
        )
        return Number(rows[0].n)
      },
    },
  },

  /** See ModuleManifest.tile: the module says how its own numbers read. */
  tile: TravelTile,

  jobs: [
    { name: 'complete_trips', run: completeFinishedTrips },
    { name: 'nightly_digest', run: nightlyDigest },
  ],
  entityTypes: ['trip'],
})
