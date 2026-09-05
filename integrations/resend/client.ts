import { getCredentials } from '@/core/integrations'

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
  const key = (await getCredentials('resend'))?.api_key
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
