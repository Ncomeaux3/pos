import { z } from 'zod'
import { db } from '@/core/db'
import { register } from '@/core/entities'
import { defineModule, defineTool } from '@/core/module-contract'
import { listAccounts, setBudget } from './data'
import {
  categoriseNew,
  detectSubscriptions,
  learnRule,
  nightlyDigest,
  snapshotBalances,
} from './jobs/nightly-digest'
import { syncSimpleFin } from './jobs/sync-simplefin'
import FinancePage from './ui/FinancePage'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

export default defineModule({
  id: 'finance',
  nav: { label: 'Finance', icon: 'wallet', order: 5 },
  pages: { '': FinancePage },

  tools: {
    get_digest: defineTool({
      description: 'Net worth and its 30 day change, what is due, and which budgets are hot.',
      input: z.object({}),
      run: () => nightlyDigest(),
    }),

    categorise: defineTool({
      description:
        'Put a transaction in a category. Marks it manual, so no job touches it again, and learns a rule from it.',
      input: z.object({
        id: z.uuid(),
        category_id: z.uuid(),
        /** Learning is the point; only a bulk backfill turns it off. */
        learn: z.boolean().default(true),
      }),
      run: async ({ id, category_id, learn }) => {
        const { rows } = await db().query<{ descriptor: string }>(
          `update finance.transaction
              set category_id = $2, classified_by = 'manual', confidence = 1, is_manual = true
            where id = $1
            returning descriptor`,
          [id, category_id],
        )
        if (rows.length === 0) throw new Error(`No transaction ${id}`)

        const learned = learn ? await learnRule(rows[0].descriptor, category_id) : false

        // The event is the categorising, not the transaction: importing a month
        // of history is not a month of work, but teaching the rules is.
        await register({
          module: 'finance',
          entityType: 'transaction',
          entityId: id,
          title: rows[0].descriptor,
          eventType: 'transaction_categorised',
        })

        return { id, learned }
      },
    }),

    set_budget: defineTool({
      description: 'Set this month’s limit for a category, in cents.',
      input: z.object({
        category_id: z.uuid(),
        limit_cents: z.number().int().positive().max(100_000_000),
      }),
      run: async ({ category_id, limit_cents }) => {
        await setBudget(category_id, limit_cents)
        return { category_id, limit_cents }
      },
    }),

    write_subscription: defineTool({
      description: 'Create or update a subscription, including pausing or cancelling one.',
      input: z.object({
        id: z.uuid().optional(),
        name: z.string().min(1).max(200).optional(),
        vendor: z.string().max(200).optional(),
        amount_cents: z.number().int().positive().optional(),
        cadence: z.enum(['weekly', 'monthly', 'yearly']).optional(),
        next_charge_on: date.nullable().optional(),
        status: z.enum(['active', 'paused', 'cancelled']).optional(),
        cancel_url: z.string().max(500).optional(),
        notes: z.string().max(2000).optional(),
      }),
      run: async (input) => {
        if (input.id) {
          const fields = Object.entries(input).filter(([key]) => key !== 'id')
          if (fields.length > 0) {
            const set = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ')
            // Every key is a literal from the zod schema above, which is a
            // closed set: no caller supplied identifier reaches this string.
            await db().query(`update finance.subscription set ${set} where id = $1`, [
              input.id,
              ...fields.map(([, value]) => value),
            ])
          }

          if (input.status === 'cancelled') {
            await register({
              module: 'finance',
              entityType: 'subscription',
              entityId: input.id,
              title: input.name ?? 'Subscription',
              eventType: 'subscription_cancelled',
            })
          }
          return { id: input.id }
        }

        if (!input.name || input.amount_cents === undefined) {
          throw new Error('A new subscription needs a name and an amount')
        }

        const { rows } = await db().query<{ id: string }>(
          `insert into finance.subscription
             (name, vendor, amount_cents, cadence, next_charge_on, cancel_url, notes)
           values ($1, $2, $3, $4, $5, $6, $7)
           returning id`,
          [
            input.name,
            input.vendor ?? '',
            input.amount_cents,
            input.cadence ?? 'monthly',
            input.next_charge_on ?? null,
            input.cancel_url ?? '',
            input.notes ?? '',
          ],
        )

        await register({
          module: 'finance',
          entityType: 'subscription',
          entityId: rows[0].id,
          title: input.name,
        })

        return { id: rows[0].id }
      },
    }),
  },

  /**
   * Money is the module the guard exists for.
   *
   * A budget and a subscription are commitments, so an agent proposes changing
   * one. Categorising is not: it is bookkeeping, it is reversible from the row
   * itself, and putting hundreds of rows a month through the Review inbox would
   * make the inbox useless, which is the failure mode a guard has to avoid.
   */
  guarded: ['set_budget', 'write_subscription'],
  requires: ['simplefin'],

  metrics: {
    net_worth: {
      label: 'Net worth',
      unit: '$',
      get: async () => {
        const accounts = await listAccounts()
        // Dollars, not cents: a goal target is typed in dollars, and a metric
        // that silently returned cents would read as a hundredfold overshoot.
        return accounts.reduce((sum, a) => sum + Number(a.balance_cents), 0) / 100
      },
    },
    liquid: {
      label: 'Cash on hand',
      unit: '$',
      get: async () => {
        const { rows } = await db().query<{ cents: string }>(
          `select coalesce(sum(balance_cents), 0)::text as cents from finance.account
            where archived = false and kind in ('checking', 'savings')`,
        )
        return Number(rows[0].cents) / 100
      },
    },
  },

  jobs: [
    // First: categorise, detect_subscriptions and the digest all read what it
    // wrote, and a snapshot taken before the sync is a day stale.
    { name: 'sync_simplefin', run: syncSimpleFin },
    { name: 'snapshot_balances', run: snapshotBalances },
    { name: 'categorise', run: categoriseNew },
    { name: 'detect_subscriptions', run: detectSubscriptions },
    { name: 'nightly_digest', run: nightlyDigest },
  ],
  entityTypes: ['transaction', 'subscription'],
})
