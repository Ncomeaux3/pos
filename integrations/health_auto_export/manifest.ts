import { z } from 'zod'
import { db } from '@/core/db'
import { defineIntegration } from '@/core/integration-contract'

// Health Auto Export posts Apple Health data on a schedule. Inbound only:
// there is nothing to authenticate against, so the card shows a URL and a
// generated secret to paste into the iOS app. The Fitness module consumes the
// payload through its inbound seam; client.ts holds the translation.
const payloadSchema = z.object({
  data: z.object({
    metrics: z
      .array(
        z.object({
          name: z.string(),
          units: z.string().optional(),
          data: z.array(z.record(z.string(), z.unknown())).optional(),
        }),
      )
      .optional(),
    workouts: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
})

export default defineIntegration({
  id: 'health_auto_export',
  label: 'Health Auto Export',
  description: 'Apple Health body metrics, posted from the iOS app on a schedule.',
  docsUrl: 'https://www.healthyapps.dev/',

  auth: { type: 'webhook' },

  // Nothing to call, so the test is whether anything has ever called us: the
  // request log keeps every hit on the webhook route, and a 200 is a payload
  // that passed the secret and the schema.
  test: async () => {
    // Shown to the owner, so in the owner's zone, the same source core.today() reads.
    const { rows } = await db().query<{ last: string | null }>(
      `select to_char(
         max(occurred_at) at time zone coalesce(
           (select value #>> '{}' from core.settings where key = 'timezone'), 'UTC'),
         'YYYY-MM-DD HH24:MI') as last
       from core.request_log
       where route = '/api/integrations/health_auto_export/webhook' and status = 200`,
    )
    const last = rows[0]?.last
    return last
      ? { ok: true, detail: `Last payload received ${last}.` }
      : { ok: false, detail: 'No payload yet. Paste the URL and secret into the app.' }
  },

  webhookSchema: payloadSchema,
})
