import { revalidatePath } from 'next/cache'
import {
  Card,
  CardHead,
  Eyebrow,
  ActionButton,
  PageHeader,
  Row,
  RowList,
  TabLinks,
  fieldClass,
} from '@/components/pos'
import { requireOwner } from '@/core/auth'
import { db } from '@/core/db'
import { getConnectionStatuses, getIntegrations } from '@/core/integrations'
import { getSettings, setSetting } from '@/core/settings'
import { settingsTabs } from './tabs'

async function save(formData: FormData) {
  'use server'
  // Server actions are standalone POST endpoints addressed by id. The (app)
  // layout does not run for them, so each one authenticates independently.
  await requireOwner()

  const hour = Number(formData.get('digest_hour'))
  const capDollars = Number(formData.get('llm_soft_cap_dollars'))

  await setSetting('timezone', String(formData.get('timezone') ?? '').trim())
  await setSetting('owner_name', String(formData.get('owner_name') ?? '').trim())
  // Clamp rather than trust the browser: these land in jobs and money maths.
  await setSetting('digest_hour', Math.min(23, Math.max(0, Math.round(hour || 0))))
  await setSetting('llm_soft_cap_cents', Math.max(0, Math.round(capDollars * 100)))

  revalidatePath('/settings')
}

/** Month to date model spend, which is what the soft cap is measured against. */
async function spendThisMonthCents(): Promise<number> {
  const { rows } = await db().query<{ cents: string }>(
    `select coalesce(sum(cost_cents), 0)::text as cents
       from core.llm_calls
      where occurred_at >= date_trunc('month', now())`,
  )
  return Number(rows[0].cents)
}

async function nightlyJobState() {
  const { rows } = await db().query<{ last_run: Date | null; last_status: string | null; n: string }>(
    `select max(last_run) as last_run,
            min(last_status) filter (where last_status = 'failed') as last_status,
            count(*)::text as n
       from core.jobs`,
  )
  return rows[0]
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

export default async function SettingsPage() {
  const [settings, statuses, spendCents, job] = await Promise.all([
    getSettings(),
    getConnectionStatuses(),
    spendThisMonthCents(),
    nightlyJobState(),
  ])

  const connected = getIntegrations().filter((m) => statuses[m.id]?.connected).length
  const capCents = settings.llm_soft_cap_cents
  const usedPct = capCents > 0 ? Math.min(100, Math.round((spendCents / capCents) * 100)) : 0

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Settings / General"
        dot={connected > 0 ? 'brand' : 'idle'}
        title="Settings"
        lede="Owner preferences and every external account the system can reach. Credentials are encrypted at rest and never live in the repo."
        actions={
          <Eyebrow dot={connected > 0 ? 'ok' : 'idle'}>
            {connected} of {getIntegrations().length} connected
          </Eyebrow>
        }
      />

      <TabLinks tabs={settingsTabs(getIntegrations().length)} current="/settings" label="Settings sections" />

      {/* Two columns at width, one on a phone. The artboard's settings panes
        * run the full page rather than sitting in a narrow measure: these are
        * forms, not prose. */}
      <form action={save} className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <CardHead label="Owner" meta="core.settings" />

          <Field label="Name" htmlFor="owner_name">
            <input id="owner_name" name="owner_name" defaultValue={settings.owner_name} className={fieldClass} />
          </Field>

          <Field label="Owner email" hint="The only login allowed. Set in .env as OWNER_EMAIL.">
            <p className="rounded-md border border-rule bg-bg-deep px-2.5 py-2 text-xs text-ink-3">
              Read only
            </p>
          </Field>

          <Field label="Timezone" htmlFor="timezone" hint="An IANA name, for example America/Chicago.">
            <input id="timezone" name="timezone" defaultValue={settings.timezone} className={fieldClass} />
          </Field>

          <Field
            label="Digest hour, local"
            htmlFor="digest_hour"
            hint="The local hour the digest covers. The cron runs at 09:00 UTC and Vercel Hobby fires it within the hour."
          >
            <select
              id="digest_hour"
              name="digest_hour"
              defaultValue={String(settings.digest_hour)}
              className={fieldClass}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </Field>
        </Card>

        <Card className="space-y-4">
          <CardHead label="Model spend, soft cap" meta={`month to date ${money(spendCents)}`} />

          <div className="h-1 w-full rounded-full bg-rule">
            <div
              className={`h-full rounded-full ${usedPct >= 100 ? 'bg-bad' : usedPct >= 80 ? 'bg-warn' : 'bg-brand'}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>

          <Field
            label="Cap per month"
            htmlFor="llm_soft_cap_dollars"
            hint="Past the cap, research runs are refused and logged. Classification and headlines continue."
          >
            <input
              id="llm_soft_cap_dollars"
              name="llm_soft_cap_dollars"
              type="number"
              min={0}
              step="0.01"
              defaultValue={(capCents / 100).toFixed(2)}
              className={fieldClass}
            />
          </Field>
        </Card>

        <div className="flex items-center gap-3 lg:col-span-2">
          <ActionButton variant="solid" type="submit">
            Save
          </ActionButton>
          <span className="label text-[10px] tracking-[0.1em] text-ink-3">
            Writes core.settings
          </span>
        </div>
      </form>

      <Card className="space-y-1">
        <CardHead label="Nightly job" meta="read only" />
        <RowList>
          <Row title="Schedule" right={<span className="code text-xs text-ink-3">0 9 * * * UTC</span>} />
          <Row
            title="Last run"
            right={
              <span className="num text-xs text-ink-3">
                {job.last_run ? new Date(job.last_run).toLocaleString() : 'never'}
                {job.last_status === 'failed' && ' · failed'}
              </span>
            }
          />
          <Row
            title="Jobs registered"
            meta="Every module job plus the core ones."
            right={<span className="num text-xs text-ink-3">{job.n}</span>}
          />
        </RowList>
      </Card>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="label block text-[10px] tracking-[0.1em] text-ink-3">
        {label}
      </label>
      {children}
      {hint && <p className="t-caption text-ink-3">{hint}</p>}
    </div>
  )
}
