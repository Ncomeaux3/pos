import Link from 'next/link'
import { Card, CardHead, Eyebrow, PageHeader, TabLinks } from '@/components/pos'
import { getIntegrations } from '@/core/integrations'
import { getModule } from '@/core/modules'
import { isLive, type Channel, type Rule } from '@/core/notification-rules'
import { listRules } from '@/core/notify'
import { getSettings } from '@/core/settings'
import { settingsTabs } from '../tabs'
import { listSubscriptions, publicKey } from '@/core/push'
import { ChannelGrid, type ModuleRow } from './ChannelGrid'
import { Devices } from './Devices'
import { QuietHours } from './QuietHours'

// The coarse view of the same rules the Notifications screen edits one at a
// time. A switch here writes every rule in that module, which is the thing you
// want when a whole module has gone noisy and the thing the rules table makes
// tedious.

const CHANNELS: { value: Channel; label: string; sub: string }[] = [
  { value: 'push', label: 'Push', sub: 'Lock screen, when the PWA is installed' },
  { value: 'email', label: 'Email', sub: 'Batched into the morning and evening digests' },
  { value: 'inapp', label: 'In-app', sub: 'The alert centre, always kept as a record' },
]

function label(id: string): string {
  if (id === 'system') return 'System'
  return getModule(id)?.nav.label ?? id[0].toUpperCase() + id.slice(1)
}

export default async function NotificationSettingsPage() {
  const [rules, settings, devices] = await Promise.all([
    listRules(),
    getSettings(),
    listSubscriptions(),
  ])
  const paused = settings.notifications_paused

  const modules = [...new Set(rules.map((r) => r.module))]

  const rows: ModuleRow[] = modules.map((id) => {
    const mine = rules.filter((r) => r.module === id)
    const live = mine.filter((r) => isLive(r, paused))

    // A column is on when every rule in the module has it, and the grid shows
    // the in between state rather than rounding it to on or off.
    const state = (has: (r: Rule) => boolean) => {
      const on = mine.filter(has).length
      return on === 0 ? 'off' : on === mine.length ? 'on' : 'some'
    }

    return {
      id,
      label: label(id),
      digest: state((r) => r.timing !== 'immediate'),
      push: state((r) => r.channels.includes('push')),
      inapp: state((r) => r.channels.includes('inapp')),
      triggers: mine
        .map((r) => r.label.toLowerCase())
        .slice(0, 3)
        .join(', '),
      liveCount: live.length,
      ruleCount: mine.length,
    }
  })

  const channelUse = Object.fromEntries(
    CHANNELS.map((c) => [c.value, rules.filter((r) => r.channels.includes(c.value)).length]),
  ) as Record<Channel, number>

  return (
    <div className="max-w-4xl space-y-7">
      <PageHeader
        eyebrow="Settings / Notifications"
        dot={paused ? 'warn' : 'brand'}
        title="Notifications"
        lede="Which modules are allowed to reach you, and how. This is the whole-module switch; the rule by rule version lives on the Notifications screen."
        actions={
          <Eyebrow dot={paused ? 'warn' : 'ok'}>
            {rules.filter((r) => isLive(r, paused)).length} of {rules.length} rules live
          </Eyebrow>
        }
      />

      <TabLinks
        tabs={settingsTabs(getIntegrations().length)}
        current="/settings/notifications"
        label="Settings sections"
      />

      <Card className="space-y-4">
        <CardHead label="Channels" meta={`${rules.length} rules use them`} />
        {/* One hairline grid, so the three read as one control rather than as
            three cards that happen to sit together. */}
        <div className="grid gap-px bg-rule sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          {CHANNELS.map((c) => (
            <div
              key={c.value}
              className="flex items-center justify-between gap-3 bg-bg-elev px-3.5 py-3"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="t-caption text-ink">{c.label}</p>
                <p className="t-caption text-ink-3">{c.sub}</p>
              </div>
              <span className="label shrink-0 text-[10px] text-ink-3">
                {channelUse[c.value]} rules
              </span>
            </div>
          ))}
        </div>
        <p className="t-caption text-ink-3">
          The sender delivers email, in-app, and now push: one notification per send to every
          subscribed device, and only when a rule that raised something asks for push. A rule set
          to push alone is still recorded in the alert centre, so nothing is lost when no device
          is subscribed.
        </p>
      </Card>

      <Devices
        vapidPublicKey={publicKey()}
        devices={devices.map((d) => ({
          id: d.id,
          label: d.label,
          lastSentAt: d.last_sent_at ? d.last_sent_at.toISOString().slice(0, 10) : null,
          failures: d.failure_count,
        }))}
      />

      <Card className="space-y-4">
        <CardHead label="Per module" meta="Writes every rule in the row" />
        <ChannelGrid rows={rows} paused={paused} />
        <p className="t-caption text-ink-3">
          <Link href="/notifications" className="text-teal underline underline-offset-4">
            The Notifications screen
          </Link>{' '}
          edits one rule at a time, with lead times, urgency and per-rule snooze.
        </p>
      </Card>

      <Card className="space-y-4">
        <CardHead label="Quiet hours" meta={settings.quiet_urgent_override ? 'urgent overrides' : 'no overrides'} />
        <QuietHours
          from={settings.quiet_from}
          to={settings.quiet_to}
          urgentOverride={settings.quiet_urgent_override}
        />
      </Card>
    </div>
  )
}
