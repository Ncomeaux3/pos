import { db } from './db'
import type { Rule, RulePatch } from './notification-rules'

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

/**
 * Quiet hours wrap midnight, so "inside" is a union of two ranges when from is
 * later than to. 22:00 to 06:30 is the overnight window, not an empty one.
 */
export function inQuietHours(now: Date, from: string, to: string): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes()
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  const start = at(from)
  const end = at(to)
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

/**
 * Due, unsent, not snoozed, and allowed out right now.
 *
 * Three gates, in order of bluntness: the global pause, then the rule's own
 * mute or snooze, then quiet hours. A row held by any of them stays queued and
 * goes out on a later run, which is what makes snooze mean "later" rather than
 * "never".
 */
export async function pending(): Promise<Pending[]> {
  const { getSettings } = await import('./settings')
  const settings = await getSettings()
  if (settings.notifications_paused) return []

  const { rows } = await db().query<Pending>(
    `select n.id, n.title, n.body, n.urgency
       from core.notifications n
       left join core.notification_rules r on r.id = n.rule_id
      where n.sent_at is null
        and n.due_at <= now()
        and (n.snooze_until is null or n.snooze_until < now())
        and coalesce(r.muted, false) = false
        and (r.snooze_until is null or r.snooze_until < now())
      order by (n.urgency = 'urgent') desc, n.due_at`,
  )

  if (!inQuietHours(new Date(), settings.quiet_from, settings.quiet_to)) return rows

  // Inside quiet hours only urgent gets through, and only if the override is
  // on. Everything else waits for morning.
  return settings.quiet_urgent_override ? rows.filter((r) => r.urgency === 'urgent') : []
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

// The alert centre ----------------------------------------------------------

export type Alert = {
  id: string
  title: string
  body: string
  channel: string
  urgency: string
  module: string | null
  rule_label: string | null
  due_at: Date
  read_at: Date | null
}

/**
 * Everything that has been raised, newest first, with the rule that raised it.
 * The screen splits this into unread and history rather than asking twice.
 */
export async function listAlerts(limit = 60): Promise<Alert[]> {
  const { rows } = await db().query<Alert>(
    `select n.id, n.title, n.body, n.channel, n.urgency, n.due_at, n.read_at,
            r.module, r.label as rule_label
       from core.notifications n
       left join core.notification_rules r on r.id = n.rule_id
      where n.due_at <= now()
      order by n.due_at desc
      limit $1`,
    [limit],
  )
  return rows
}

export async function markRead(id: string): Promise<void> {
  await db().query(`update core.notifications set read_at = now() where id = $1`, [id])
}

export async function markAllRead(): Promise<void> {
  await db().query(`update core.notifications set read_at = now() where read_at is null`)
}

// The rules behind the sends ------------------------------------------------
//
// core/notification-rules.ts holds the shape and the derived state, because the
// Notifications screen is a client component and cannot reach `pg`. These are
// the queries over that shape, and they stay here on the server side of the
// line.

export async function listRules(): Promise<Rule[]> {
  const { rows } = await db().query<Rule & { lead_days: string }>(
    `select id, module, key, label, trigger_text, channels, timing, lead_days,
            urgent, muted, snooze_until, sample_title, sample_body, position
       from core.notification_rules
      order by position, module, key`,
  )
  return rows.map((r) => ({ ...r, lead_days: Number(r.lead_days) }))
}

export async function patchRule(id: string, patch: RulePatch): Promise<void> {
  const fields = Object.keys(patch) as (keyof RulePatch)[]
  if (fields.length === 0) return

  const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  await db().query(`update core.notification_rules set ${set} where id = $1`, [
    id,
    ...fields.map((f) => patch[f]),
  ])
}

/**
 * Undo pauses the rule that produced a write for seven days, so the same
 * decision is not made again tomorrow night.
 */
export async function snoozeRule(id: string, days: number): Promise<void> {
  await db().query(
    `update core.notification_rules
        set snooze_until = now() + make_interval(days => $2), muted = false
      where id = $1`,
    [id, days],
  )
}
