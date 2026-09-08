// getCredentials is imported lazily inside the call rather than at module
// scope. This module is imported by its own manifest, and the manifest is
// reached through core/integrations, so a static import here is a cycle. Next's
// bundler hoists around it; plain Node does not, which broke every entry point
// that is not the app: the cron route, scripts/setup.ts, and CI.
async function credentials(id: string) {
  const { getCredentials } = await import('@/core/integrations')
  return getCredentials(id)
}


/**
 * The one thing that sends email. Everything queues into core.notifications
 * and leaves as a single plain text digest.
 *
 * An unverified Resend account can only send from onboarding@resend.dev and
 * only to its own signup address (verified 2026-09-05). That is exactly the
 * digest, so Phase 1 needs no domain. Set RESEND_FROM once you verify one.
 */
export const DEFAULT_FROM = 'POS <onboarding@resend.dev>'

export async function sendEmail(args: {
  to: string
  subject: string
  text: string
}): Promise<{ id: string }> {
  const key = (await credentials('resend'))?.api_key
  if (!key) throw new Error('Resend is not connected. Connect it on Settings > Connections.')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || DEFAULT_FROM,
      to: [args.to],
      subject: args.subject,
      text: args.text,
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  return (await res.json()) as { id: string }
}
