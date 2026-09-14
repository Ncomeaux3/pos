import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ActionButton, Eyebrow } from '@/components/pos'
import { requireOwner } from '@/core/auth'
import { db } from '@/core/db'
import { getSettings, setSetting } from '@/core/settings'
import { clockIn, zoneAbbrIn } from '@/core/today'
import { SettingsHeader } from './tabs'
import { CapSlider } from './CapSlider'
import { Passkeys } from './Passkeys'

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
  redirect('/settings?saved=1')
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

const ZONES = [
  'America/Chicago',
  'America/New_York',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
]

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

const field =
  'w-full min-w-0 border border-rule-2 bg-bg px-3 py-[9px] text-[13px] text-ink outline-none focus-visible:border-brand'
const card = 'border border-rule bg-bg-elev px-5 py-[18px]'
const cell = 'px-3 py-2.5'

export default async function SettingsPage({ searchParams }: PageProps<'/settings'>) {
  const [params, settings, spendCents, job] = await Promise.all([
    searchParams,
    getSettings(),
    spendThisMonthCents(),
    nightlyJobState(),
  ])

  const capCents = settings.llm_soft_cap_cents
  const zones = ZONES.includes(settings.timezone) ? ZONES : [settings.timezone, ...ZONES]
  // 09:00 UTC, printed on the owner's clock: "04:00 CDT".
  const cronAt = new Date()
  cronAt.setUTCHours(9, 0, 0, 0)
  const local = `${clockIn(cronAt, settings.timezone)} ${zoneAbbrIn(settings.timezone, cronAt)}`
  const lastRun = job.last_run ? clockIn(new Date(job.last_run), settings.timezone) : null

  return (
    <div className="space-y-[18px]">
      <SettingsHeader current="/settings" />

      <form action={save} className="flex max-w-[720px] flex-col gap-3.5">
        <div className={card}>
          <Eyebrow>Owner</Eyebrow>
          <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-ink-3">Name</span>
              <input name="owner_name" defaultValue={settings.owner_name} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-ink-3">Owner email · the only login allowed</span>
              <input
                value={process.env.OWNER_EMAIL ?? ''}
                readOnly
                aria-label="Owner email"
                className="num w-full min-w-0 border border-rule bg-bg-deep px-3 py-[9px] text-[13px] text-ink-3 outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-ink-3">Timezone</span>
              <select name="timezone" defaultValue={settings.timezone} className={field}>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-ink-3">Digest email hour · local</span>
              <select name="digest_hour" defaultValue={String(settings.digest_hour)} className={`${field} num`}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className={card}>
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow>Model spend · soft cap</Eyebrow>
            <span className="num text-[11px] text-ink-3">
              MONTH TO DATE <span className="text-ink">{money(spendCents)}</span>
            </span>
          </div>
          <CapSlider initialDollars={Math.round(capCents / 100)} spendCents={spendCents} />
          <p className="mt-2.5 text-[12px] text-ink-3">
            Past the cap, research runs are refused and logged. Classification and headlines continue.
          </p>
        </div>

        <div className={card}>
          <Eyebrow>Nightly job</Eyebrow>
          <div className="mt-3 grid border border-rule sm:grid-cols-3">
            <div className={`${cell} border-b border-rule sm:border-b-0 sm:border-r`}>
              <Eyebrow>Schedule</Eyebrow>
              <div className="num mt-1.5 text-[12px] text-ink">0 9 * * * UTC · {local}</div>
            </div>
            <div className={`${cell} border-b border-rule sm:border-b-0 sm:border-r`}>
              <Eyebrow>Last run</Eyebrow>
              <div className={`num mt-1.5 text-[12px] ${job.last_status === 'failed' ? 'text-bad' : lastRun ? 'text-ok' : 'text-ink-3'}`}>
                {lastRun ? `${job.last_status === 'failed' ? 'failed' : 'ok'} · ${lastRun} · ${job.n} jobs` : 'never'}
              </div>
            </div>
            <div className={cell}>
              <Eyebrow>Jobs registered</Eyebrow>
              <div className="num mt-1.5 text-[12px] text-ink">{job.n} · every module plus core</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          {params.saved === '1' && <span className="num text-[11px] text-ink-3">SAVED · core.settings</span>}
          <ActionButton type="submit" variant="solid" className="h-9 gap-2 px-3.5 text-[13px]">
            Save <span aria-hidden="true">&rarr;</span>
          </ActionButton>
        </div>
      </form>

      {/* Outside the form on purpose. Adding and removing a passkey happen the
        * moment they are clicked, against Supabase Auth rather than
        * core.settings, so they have nothing to do with Save. */}
      <Passkeys />
    </div>
  )
}
