import { categoriesForModules, supportedProviders } from '@/core/connectors'
import { db } from '@/core/db'
import { getModules } from '@/core/modules'
import { listMetrics } from '@/core/metrics'
import { getSettings } from '@/core/settings'
import { nightlyRunAt, ownerToday } from '@/core/today'
import { Onboarding, type SetupData } from './Onboarding'

export default async function OnboardingPage() {
  const [settings, todayIso] = await Promise.all([getSettings(), ownerToday()])

  const modules = getModules()
  const enabled = settings.modules_enabled ?? modules.map((m) => m.id)

  // Requested providers only. A real connection is made at Settings, where a
  // secret can be handled properly, and is never touched from here.
  const { rows: requested } = await db().query<{ integration_id: string }>(
    `select integration_id from core.connections where status = 'requested'`,
  )

  const data: SetupData = {
    ownerName: settings.owner_name,
    timezone: settings.timezone,
    modules: modules.map((m) => ({
      id: m.id,
      label: m.nav.label,
      // The one line the toggle is decided on. Falls back to the id rather than
      // inventing a description for a module this screen has never heard of.
      note: m.nav.icon ? `${m.nav.label} module` : m.id,
      enabled: enabled.includes(m.id),
    })),
    categories: categoriesForModules(enabled),
    supported: [...supportedProviders()],
    requested: requested.map((r) => r.integration_id),
    // Enumerated from the manifests, so a seeded goal can point at something
    // that will actually compute rather than at a string someone typed.
    metrics: listMetrics(),
    hasGoals: modules.some((m) => m.id === 'goals'),
    todayIso,
    // The real hour, not a hardcoded "04:00": the cron fires at a fixed UTC
    // hour, which lands at a different local time in Chicago's summer and
    // winter, same as the Review pass computes it.
    nightlyAt: nightlyRunAt(settings.timezone),
    schedule: {
      morningAt: settings.digest_morning_at,
      morningEnabled: settings.digest_morning_enabled,
      eveningAt: settings.digest_evening_at,
      eveningEnabled: settings.digest_evening_enabled,
      quietFrom: settings.quiet_from,
      quietTo: settings.quiet_to,
      urgentOverride: settings.quiet_urgent_override,
    },
    completedAt: settings.onboarding_completed_at,
  }

  return <Onboarding data={data} />
}
