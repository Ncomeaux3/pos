import { db } from './db'

// Everything that wants your attention becomes a row here, and the nightly
// sender bundles the lot into one plain text email. One email a day, never a
// flood: that is the whole design.

export type Urgency = 'normal' | 'urgent'

export async function queue(args: {
  title: string
  body: string
  channel?: string
  urgency?: Urgency
  dueAt?: Date
}): Promise<void> {
  await db().query(
    `insert into core.notifications (channel, title, body, due_at, urgency)
     values ($1, $2, $3, coalesce($4, now()), $5)`,
    [args.channel ?? 'email', args.title, args.body, args.dueAt ?? null, args.urgency ?? 'normal'],
  )
}

export type Pending = { id: string; title: string; body: string; urgency: string }

/** Due, unsent, and not snoozed past now. */
export async function pending(): Promise<Pending[]> {
  const { rows } = await db().query<Pending>(
    `select id, title, body, urgency
       from core.notifications
      where sent_at is null
        and due_at <= now()
        and (snooze_until is null or snooze_until < now())
      order by (urgency = 'urgent') desc, due_at`,
  )
  return rows
}

/**
 * The digest email. Plain text on purpose: it reads in two seconds on a phone
 * and there is nothing in it worth a layout.
 */
export function renderEmail(headline: string | null, items: Pending[], spendCents: number): string {
  const lines: string[] = []

  if (headline) lines.push(headline, '')

  if (items.length === 0) {
    lines.push('Nothing needs you today.')
  } else {
    for (const item of items.slice(0, 3)) {
      lines.push(`${item.urgency === 'urgent' ? '! ' : ''}${item.title}`)
      if (item.body) lines.push(`  ${item.body}`)
    }
    if (items.length > 3) lines.push('', `and ${items.length - 3} more.`)
  }

  lines.push('', `Model spend this month: $${(spendCents / 100).toFixed(2)}`)
  return lines.join('\n')
}

async function spendThisMonthCents(): Promise<number> {
  const { rows } = await db().query<{ cents: string }>(
    `select coalesce(sum(cost_cents), 0)::text as cents
       from core.llm_calls where occurred_at >= date_trunc('month', now())`,
  )
  return Number(rows[0].cents)
}

export type SendResult = { sent: number; emails: number; skipped?: string }

/**
 * Sends one email for however many notifications are waiting, then marks them
 * all. Bundling is the point: N alerts is still one email.
 *
 * Two different outcomes, deliberately:
 *
 * Not configured is a skip. No Resend key, no OWNER_EMAIL: the rows stay unsent
 * and go out on the next run once it is set up. Nothing is lost and nothing is
 * wrong yet.
 *
 * A send that was attempted and refused is a failure, and it throws. The job
 * runner records it, the orchestrator raises it as an alert, and it shows on
 * the dashboard. A digest that silently stopped arriving is the one failure
 * mode this system cannot afford, because you would not notice.
 */
export async function sendPending(): Promise<SendResult> {
  const items = await pending()
  if (items.length === 0) return { sent: 0, emails: 0 }

  const [{ getDashboardHeadline }, { sendEmail }] = await Promise.all([
    import('./orchestrator'),
    import('@/integrations/resend/client'),
  ])

  const { getSetting } = await import('./settings')
  const to = (await getSetting('digest_email')) || process.env.OWNER_EMAIL
  if (!to) {
    return { sent: 0, emails: 0, skipped: 'No digest_email setting and no OWNER_EMAIL' }
  }

  const headline = await getDashboardHeadline()
  const body = renderEmail(headline, items, await spendThisMonthCents())

  try {
    await sendEmail({ to, subject: headline ?? 'Your daily digest', text: body })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'send failed'
    // Not connected yet is not a failure; anything else is.
    if (/not connected/i.test(message)) return { sent: 0, emails: 0, skipped: message }
    throw new Error(`Digest email refused: ${message}`)
  }

  await db().query(`update core.notifications set sent_at = now() where id = any($1)`, [
    items.map((i) => i.id),
  ])

  return { sent: items.length, emails: 1 }
}
