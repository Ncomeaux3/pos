import { z } from 'zod'
import { db } from '@/core/db'
import { register } from '@/core/entities'
import { defineModule, defineTool } from '@/core/module-contract'
import { MIN_PATTERN_LENGTH, learnable, normalise } from './categorise'
import {
  listAccounts,
  setAlertThreshold,
  setBudget,
  setCashFlowAccounts,
  setChartMonths,
  setCountPending,
} from './data'
import { applyRule, refile, removeRule } from './rules'
import {
  categoriseNew,
  detectSubscriptions,
  learnRule,
  nightlyDigest,
  snapshotBalances,
} from './jobs/nightly-digest'
import { syncSimpleFin } from './jobs/sync-simplefin'
import { FinanceTile } from './ui/Tile'
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

        const pattern = learn ? await learnRule(rows[0].descriptor, category_id) : null
        // Writing a rule means the history it matches moves too.
        const moved = pattern === null ? 0 : await applyRule(pattern)

        // The event is the categorising, not the transaction: importing a month
        // of history is not a month of work, but teaching the rules is.
        await register({
          module: 'finance',
          entityType: 'transaction',
          entityId: id,
          title: rows[0].descriptor,
          eventType: 'transaction_categorised',
        })

        return { id, learned: pattern !== null, moved }
      },
    }),

    learn_rule: defineTool({
      description:
        'Always file this transaction’s merchant as this category: writes the rule the next sync applies before the model.',
      input: z.object({ transaction_id: z.uuid(), category_id: z.uuid() }),
      run: async ({ transaction_id, category_id }) => {
        const { rows } = await db().query<{ descriptor: string }>(
          `select descriptor from finance.transaction where id = $1`,
          [transaction_id],
        )
        if (rows.length === 0) throw new Error(`No transaction ${transaction_id}`)
        const pattern = await learnRule(rows[0].descriptor, category_id)
        return { learned: pattern !== null, moved: pattern === null ? 0 : await applyRule(pattern) }
      },
    }),

    write_rule: defineTool({
      description:
        'Create or change a rule that files a merchant into a category, and re-file the history it matches.',
      input: z.object({
        /** Present when an existing rule is being changed, absent for a new one. */
        id: z.uuid().optional(),
        pattern: z.string().min(1).max(200),
        category_id: z.uuid(),
      }),
      run: async ({ id, pattern, category_id }) => {
        const normalised = normalise(pattern)
        if (!learnable(normalised)) {
          throw new Error(
            `A rule needs at least ${MIN_PATTERN_LENGTH} letters: anything shorter matches half the ledger`,
          )
        }

        // (pattern, category_id) is unique, so moving a rule to another
        // category is an insert and a delete rather than an update. In that
        // order: a failed insert then leaves the rule the owner was editing
        // where it was, rather than deleting it and writing nothing.
        let previous: { pattern: string; category_id: string } | null = null
        if (id) {
          const { rows } = await db().query<{ pattern: string; category_id: string }>(
            `select pattern, category_id from finance.category_rule where id = $1`,
            [id],
          )
          previous = rows[0] ?? null
        }

        await db().query(
          `insert into finance.category_rule (category_id, pattern, is_manual, classified_by, confidence)
           values ($1, $2, true, 'human', null)
           on conflict (pattern, category_id) do update
             set is_manual = true, classified_by = 'human', confidence = null`,
          [category_id, normalised],
        )

        // Before the back-file, not after: two rules of the same length both
        // match, and the one being replaced could win its own replacement.
        // Nothing is deleted when the insert landed on that same row.
        const changed =
          previous !== null &&
          (previous.pattern !== normalised || previous.category_id !== category_id)
        if (changed) await db().query(`delete from finance.category_rule where id = $1`, [id])

        let moved = await applyRule(normalised)
        // An edited pattern leaves rows behind under the old one; they belong
        // to whatever matches now.
        if (changed && previous!.pattern !== normalised) moved += await refile(previous!.pattern)

        return { pattern: normalised, moved }
      },
    }),

    delete_rule: defineTool({
      description:
        'Remove a rule and re-file the rows it held, so a row another rule also matches is not orphaned.',
      input: z.object({ id: z.uuid() }),
      run: async ({ id }) => ({ moved: await removeRule(id) }),
    }),

    set_cash_flow_accounts: defineTool({
      description:
        'Which accounts the cash flow card counts: the listed ones on, every other open account off. Archived accounts are left alone.',
      input: z.object({ account_ids: z.array(z.uuid()) }),
      run: async ({ account_ids }) => {
        await setCashFlowAccounts(account_ids)
        return { on: account_ids.length }
      },
    }),

    set_count_pending: defineTool({
      description: 'Whether pending charges count toward a budget before they post.',
      input: z.object({ on: z.boolean() }),
      run: async ({ on }) => {
        await setCountPending(on)
        return { on }
      },
    }),

    set_chart_months: defineTool({
      description:
        'How many months the cash flow card and the category trend show: 3, 6, 12 or 24.',
      input: z.object({ months: z.union([z.literal(3), z.literal(6), z.literal(12), z.literal(24)]) }),
      run: async ({ months }) => {
        await setChartMonths(months)
        return { months }
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

    set_alert_threshold: defineTool({
      description:
        'Set the share of a budget, 50 to 100 percent, past which a category is flagged.',
      input: z.object({ percent: z.number().int().min(50).max(100) }),
      run: async ({ percent }) => {
        await setAlertThreshold(percent)
        return { percent }
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
  guarded: ['set_budget', 'set_alert_threshold', 'write_subscription'],
  requires: ['simplefin'],

  /** The module says how its own numbers read. See ModuleManifest.tile. */
  // What Finance puts on the week ahead: the charges it has detected, dated.
  // Nothing here is a decision to make, so there is no slipped or apply.
  review: {
    upcoming: async () => {
      const { rows } = await db().query<{
        id: string
        merchant: string
        amount_cents: string
        cadence: string
        next_charge_on: string
      }>(
        `select id, merchant, amount_cents::text, cadence, next_charge_on::text
           from finance.recurring
          where next_charge_on >= core.today()
            and next_charge_on < core.today() + 30
          order by next_charge_on
          limit 12`,
      )

      return rows.map((r) => ({
        id: r.id,
        title: r.merchant,
        meta: `$${(Number(r.amount_cents) / 100).toFixed(2)}, ${r.cadence}`,
        at: r.next_charge_on,
        href: '/finance?tab=subscriptions',
      }))
    },
  },

  tile: FinanceTile,
  tileHead: (payload) => {
    const over = Array.isArray(payload.overBudget) ? payload.overBudget.length : 0
    const net = typeof payload.netThisMonthCents === 'number' ? payload.netThisMonthCents : null
    // Net first: it is the one number that says whether the month is going
    // well. The flag count follows it, and a digest written before v1.2
    // phase 5b has no net, so the head falls back to what it used to say.
    const flags = `${over} budget${over === 1 ? '' : 's'} flagged`
    if (net === null) return { meta: flags }
    const dollars = `$${Math.round(Math.abs(net) / 100).toLocaleString('en-US')}`
    return { meta: `${net >= 0 ? '+' : '-'}${dollars} this month · ${flags}` }
  },

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
