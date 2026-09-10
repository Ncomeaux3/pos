import { PageHeader } from '@/components/pos'
import type { DotTone } from '@/components/pos'
import { getModule } from '@/core/modules'
import { isLive } from '@/core/notification-rules'
import { listAlerts, listRules, type Alert } from '@/core/notify'
import { getSettings } from '@/core/settings'
import { nightlyRunAt } from '@/core/today'
import { AlertCentre, type AlertItem } from './AlertCentre'
import { Notifications } from './Rules'
import { PauseAll } from './PauseAll'

/** Relative, because "yesterday 20:00" is what you need, not a timestamp. */
function when(at: Date): string {
  const date = new Date(at)
  const time = date.toTimeString().slice(0, 5)
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days < 1 && date.getDate() === new Date().getDate()) return time
  if (days < 2) return `Yest ${time}`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()
}

function toItem(alert: Alert): AlertItem {
  const tone: DotTone = alert.urgency === 'urgent' ? 'bad' : alert.read_at ? 'idle' : 'warn'
  return {
    id: alert.id,
    title: alert.title,
    body: alert.body,
    module: (alert.module ?? 'system').toUpperCase(),
    via: alert.channel.replace('inapp', 'in-app').toUpperCase(),
    time: when(alert.due_at),
    tone,
    read: alert.read_at !== null,
  }
}

export default async function NotificationsPage() {
  const [rules, settings, alerts] = await Promise.all([listRules(), getSettings(), listAlerts()])

  const schedule = {
    morningAt: nightlyRunAt(settings.timezone),
    morningEnabled: settings.digest_morning_enabled,
    eveningAt: settings.digest_evening_at,
    eveningEnabled: settings.digest_evening_enabled,
    quietFrom: settings.quiet_from,
    quietTo: settings.quiet_to,
    urgentOverride: settings.quiet_urgent_override,
    paused: settings.notifications_paused,
  }

  // 'system' has no manifest and never will: the runner's own alerts belong to
  // no module. Everything else takes its name from the registry, so a renamed
  // module renames here too.
  const moduleLabels = Object.fromEntries(
    [...new Set(rules.map((r) => r.module))].map((id) => [
      id,
      id === 'system' ? 'System' : (getModule(id)?.nav.label ?? id[0].toUpperCase() + id.slice(1)),
    ]),
  )

  const active = rules.filter((r) => isLive(r, schedule.paused)).length
  const held = rules.length - active

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`Notifications / ${active} rules active / ${held} held`}
        dot={schedule.paused ? 'warn' : 'brand'}
        title="What reaches you, and when"
        lede="Every rule belongs to a module. Digests batch the quiet ones; only urgent rules break quiet hours."
        actions={<PauseAll paused={schedule.paused} />}
      />

      <Notifications rules={rules} schedule={schedule} moduleLabels={moduleLabels}>
        <AlertCentre alerts={alerts.map(toItem)} />
      </Notifications>
    </div>
  )
}
