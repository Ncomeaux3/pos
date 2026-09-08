import { z } from 'zod'
import { defineIntegration } from '@/core/integration-contract'

// Health Auto Export posts Apple Health data on a schedule. Inbound only:
// there is nothing to authenticate against, so the card shows a URL and a
// generated secret to paste into the iOS app.
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
  description: 'Apple Health metrics and workouts, posted from the iOS app on a schedule.',
  docsUrl: 'https://www.healthyapps.dev/',

  auth: { type: 'webhook' },

  test: async () => ({
    ok: false,
    detail:
      'Nothing to call: this provider pushes to us. It reports ok once the Fitness module ships and a payload has arrived.',
  }),

  webhookSchema: payloadSchema,

  // Honest stub: validated and accepted, but nothing consumes it until the
  // Fitness module ships. Returning 200 keeps the sender from retrying forever.
  webhook: async () => {},
})
