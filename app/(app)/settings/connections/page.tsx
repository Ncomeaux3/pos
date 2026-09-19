import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { ActionButton, ConfirmButton, Eyebrow, Row, RowList, StatusChip } from '@/components/pos'
import { requireOwner } from '@/core/auth'
import { db } from '@/core/db'
import {
  type ConnectionStatus,
  type IntegrationManifest,
  deleteCredentials,
  getConnectionStatuses,
  getCredentials,
  getIntegration,
  getIntegrations,
  saveCredentials,
} from '@/core/integrations'
import { getModules } from '@/core/modules'
import { getOrigin } from '@/core/origin'
import { getSetting } from '@/core/settings'
import { clockIn } from '@/core/today'
import { SettingsHeader } from '../tabs'
import { Copy } from './Copy'
import { Reveal } from './Reveal'

// One card per manifest. Adding a provider folder adds a card; nothing here
// knows any provider by name.

async function save(formData: FormData) {
  'use server'
  // Server actions are standalone POST endpoints addressed by id. The (app)
  // layout does not run for them, so each one authenticates independently.
  await requireOwner()
  const id = String(formData.get('id'))
  const manifest = getIntegration(id)
  if (!manifest || manifest.auth.type !== 'token') return

  const existing = (await getCredentials(id)) ?? {}
  const creds: Record<string, string> = { ...existing }
  for (const field of manifest.auth.fields) {
    const value = String(formData.get(field.key) ?? '').trim()
    // A blank secret means "leave the stored one alone", so re-saving a
    // repository name does not wipe the token next to it.
    if (value || !field.secret) creds[field.key] = value
  }

  // Before test, and only on save: a one-shot credential has to be exchanged
  // and the exchanged value is what gets stored. Test never runs this, because
  // pressing Test twice must not consume anything.
  let prepared = creds
  if (manifest.prepare) {
    try {
      prepared = await manifest.prepare(creds)
    } catch (error) {
      await saveCredentials(id, creds, {
        status: 'error',
        testDetail: error instanceof Error ? error.message : 'Could not prepare the credential.',
      })
      revalidatePath('/settings/connections')
      return
    }
  }

  const result = await manifest.test(prepared)
  await saveCredentials(id, prepared, {
    status: result.ok ? 'connected' : 'error',
    testDetail: result.detail,
  })
  revalidatePath('/settings/connections')
}

async function test(formData: FormData) {
  'use server'
  await requireOwner()
  const id = String(formData.get('id'))
  const manifest = getIntegration(id)
  const creds = await getCredentials(id)
  if (!manifest || !creds) return

  const result = await manifest.test(creds)
  await saveCredentials(id, creds, {
    status: result.ok ? 'connected' : 'error',
    testDetail: result.detail,
  })
  revalidatePath('/settings/connections')
}

async function disconnect(formData: FormData) {
  'use server'
  await requireOwner()
  await deleteCredentials(String(formData.get('id')))
  revalidatePath('/settings/connections')
}

async function generateSecret(formData: FormData) {
  'use server'
  await requireOwner()
  const id = String(formData.get('id'))
  await saveCredentials(id, { secret: randomBytes(24).toString('base64url') })
  revalidatePath('/settings/connections')
}

const AUTH_LABEL = { token: 'TOKEN', oauth2: 'OAUTH2', webhook: 'WEBHOOK' } as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Which modules named this provider in `requires`. Drives the "used by" line. */
function usedBy(id: string): string[] {
  return getModules()
    .filter((m) => (m.requires ?? []).includes(id))
    .map((m) => m.nav.label)
}

const btn =
  'inline-flex items-center gap-2 border border-rule-2 px-3.5 py-2 text-[13px] text-ink transition-colors duration-150 hover:border-ink hover:bg-ink hover:text-bg rounded-full'
const btnQuiet =
  'inline-flex items-center border border-rule-2 px-3.5 py-2 text-[13px] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink rounded-full'

export default async function ConnectionsPage({ searchParams }: PageProps<'/settings/connections'>) {
  const params = await searchParams
  const error = typeof params.error === 'string' ? params.error : null

  const manifests = getIntegrations()
  const [statuses, timezone] = await Promise.all([getConnectionStatuses(), getSetting('timezone')])

  // Providers the owner asked for during first run that no integration backs.
  // They have to appear somewhere or the wizard's promise, that a request is
  // recorded rather than pretended, is not kept. Excluded from the connected
  // count on purpose: a wish is not a connection.
  const { rows: requested } = await db().query<{ integration_id: string; detail: string | null }>(
    `select integration_id, last_test_detail as detail
       from core.connections where status = 'requested'
      order by integration_id`,
  )
  const unbacked = requested.filter((r) => !manifests.some((m) => m.id === r.integration_id))
  const origin = await getOrigin()
  // Read once here, outside render, so the card's arithmetic is pure.
  const now = new Date()

  // Only used to decide whether a webhook secret exists, never rendered raw
  // except for the webhook secret the owner has to paste into the sender.
  const webhookSecrets = Object.fromEntries(
    await Promise.all(
      manifests
        .filter((m) => m.auth.type === 'webhook')
        .map(async (m) => [m.id, (await getCredentials(m.id))?.secret ?? null] as const),
    ),
  )

  return (
    <div className="space-y-[18px]">
      <SettingsHeader current="/settings/connections" />

      {error && <p className="border border-bad/60 px-3 py-2.5 text-[13px] text-bad rounded-full">{error}</p>}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-stretch gap-3.5">
        {manifests.map((manifest) => (
          <ProviderCard
            key={manifest.id}
            manifest={manifest}
            status={statuses[manifest.id] ?? null}
            secret={webhookSecrets[manifest.id] ?? null}
            origin={origin}
            timezone={String(timezone)}
            now={now}
          />
        ))}
      </div>

      {unbacked.length > 0 && (
        <section className="max-w-3xl space-y-3">
          <Eyebrow dot="idle">Requested / {unbacked.length}</Eyebrow>
          <p className="t-caption text-ink-3">
            Asked for during first run. Nothing here syncs, because no integration in this build
            speaks to it yet. The request is kept so the intent is written down rather than
            forgotten, and so a fork knows what to build next.
          </p>
          <RowList>
            {unbacked.map((r) => (
              <Row
                key={r.integration_id}
                title={r.integration_id}
                meta={r.detail ?? 'Requested'}
                right={<StatusChip tone="quiet">No integration</StatusChip>}
              />
            ))}
          </RowList>
        </section>
      )}
    </div>
  )
}

function ProviderCard({
  manifest,
  status,
  secret,
  origin,
  timezone,
  now,
}: {
  manifest: IntegrationManifest
  /** null when nothing has ever been saved. */
  status: ConnectionStatus | null
  secret: string | null
  origin: string
  timezone: string
  now: Date
}) {
  const feeds = usedBy(manifest.id)
  const connected = Boolean(status?.connected)
  const rejected = status?.status === 'error'
  const since = status?.createdAt ? new Date(status.createdAt) : null
  const expires = status?.expiresAt ? new Date(status.expiresAt) : null
  const hoursLeft = expires ? Math.round((expires.getTime() - now.getTime()) / 3_600_000) : null

  return (
    <div className="flex flex-col border border-rule bg-bg-elev px-5 py-[18px] transition-colors duration-150 hover:border-rule-2 rounded-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[16px] text-ink">{manifest.label}</span>
            <span className="num border border-rule-2 px-2 py-[3px] text-[10px] tracking-[0.08em] text-ink-2 rounded-full">
              {AUTH_LABEL[manifest.auth.type]}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-3">
            {manifest.description.replace(/\.$/, '')}
            {feeds.length > 0 && (
              <>
                {' '}· used by <span className="text-ink-2">{feeds.join(', ')}</span>
              </>
            )}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap text-[11px] tracking-[0.08em] ${connected ? 'text-ok' : rejected ? 'text-bad' : 'text-ink-3'}`}
        >
          <span className={`size-1.5 rounded-full ${connected ? 'bg-ok' : rejected ? 'bg-bad' : 'bg-ink-3'}`} />
          {connected ? 'CONNECTED' : rejected ? 'REJECTED' : 'NOT CONNECTED'}
        </span>
      </div>

      {status ? (
        <>
          <div className="mt-3.5 grid border border-rule sm:grid-cols-2 rounded-[18px]">
            <div className="border-b border-rule px-3 py-2.5 sm:border-b-0 sm:border-r">
              <Eyebrow>Last test</Eyebrow>
              <div className={`num mt-1.5 break-words text-[12px] ${connected ? 'text-ok' : 'text-bad'}`}>
                {connected ? 'ok' : 'failed'}
                {status.lastTestedAt && ` · ${clockIn(new Date(status.lastTestedAt), timezone)}`}
                {status.lastTestDetail && ` · ${status.lastTestDetail}`}
              </div>
            </div>
            <div className="px-3 py-2.5">
              <Eyebrow>{expires ? 'Token expires' : 'Connected since'}</Eyebrow>
              <div className="num mt-1.5 text-[12px] text-ink">
                {expires && hoursLeft !== null
                  ? hoursLeft > 48
                    ? `in ${Math.round(hoursLeft / 24)} days${manifest.refresh ? ' · auto-refresh' : ''}`
                    : `in ${Math.max(0, hoursLeft)}h${manifest.refresh ? ' · auto-refresh' : ''}`
                  : since
                    ? `${since.getDate()} ${MONTHS[since.getMonth()]} ${since.getFullYear()}`
                    : ''}
              </div>
            </div>
          </div>

          {manifest.auth.type === 'webhook' && (
            <div className="mt-2.5 flex flex-col gap-2 border border-rule px-3 py-2.5 rounded-[18px]">
              {/* Wraps rather than truncates: the phone is where this gets read, and a
                  cut-off URL cannot be checked against the one pasted into the app. */}
              <div className="flex flex-col gap-1">
                <Eyebrow>Inbound URL</Eyebrow>
                <span className="flex items-center justify-between gap-2.5">
                  <span className="num min-w-0 break-all text-[11px] text-ink-2">{`${origin}/api/integrations/${manifest.id}/webhook`}</span>
                  <Copy value={`${origin}/api/integrations/${manifest.id}/webhook`} />
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <Eyebrow>Shared secret</Eyebrow>
                {secret ? (
                  <Reveal value={secret} />
                ) : (
                  <span className="num text-[11px] text-ink-3">none yet</span>
                )}
              </div>
            </div>
          )}

          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <form action={test}>
              <input type="hidden" name="id" value={manifest.id} />
              <button type="submit" className={btn}>
                Test
              </button>
            </form>
            {manifest.auth.type === 'oauth2' && (
              <a href={`/api/integrations/${manifest.id}/oauth/start`} className={btnQuiet}>
                Reauthorize
              </a>
            )}
            <form action={disconnect} className="ml-auto">
              <input type="hidden" name="id" value={manifest.id} />
              <ConfirmButton
                submit
                confirmLabel="Confirm disconnect"
                className="border-0 px-1 text-[13px] text-ink-3 hover:text-bad sm:h-auto"
              >
                Disconnect
              </ConfirmButton>
            </form>
          </div>
        </>
      ) : (
        <>
          {manifest.auth.type === 'token' && (
            <form action={save} className="mt-3.5 flex flex-col gap-3.5">
              <input type="hidden" name="id" value={manifest.id} />
              {manifest.auth.fields.map((f) => (
                <label key={f.key} className="flex flex-col gap-2">
                  <Eyebrow>{f.label}</Eyebrow>
                  <input
                    name={f.key}
                    type={f.secret ? 'password' : 'text'}
                    placeholder={f.placeholder}
                    autoComplete="off"
                    className="num w-full border border-rule-2 bg-bg px-3 py-[9px] text-[13px] text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand"
                  />
                </label>
              ))}
              <div className="flex flex-wrap items-center gap-2.5">
                <ActionButton type="submit" variant="solid" className="h-9 gap-2 px-3.5 text-[13px]">
                  Save &amp; test <span aria-hidden="true">&rarr;</span>
                </ActionButton>
                <span className="num text-[11px] text-ink-3">tests on save</span>
              </div>
            </form>
          )}
          {manifest.auth.type === 'oauth2' && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              <a
                href={`/api/integrations/${manifest.id}/oauth/start`}
                className="inline-flex h-9 items-center gap-2 border border-ink bg-ink px-3.5 text-[13px] text-bg transition-colors duration-150 hover:bg-ink-2 rounded-full"
              >
                Connect with {manifest.label} <span aria-hidden="true">&rarr;</span>
              </a>
              <span className="num text-[11px] text-ink-3">opens {manifest.label.toLowerCase()}</span>
            </div>
          )}
          {manifest.auth.type === 'webhook' && (
            <form action={generateSecret} className="mt-3.5 flex flex-wrap items-center gap-2.5">
              <input type="hidden" name="id" value={manifest.id} />
              <ActionButton type="submit" variant="solid" className="h-9 gap-2 px-3.5 text-[13px]">
                Enable webhook <span aria-hidden="true">&rarr;</span>
              </ActionButton>
              <span className="num text-[11px] text-ink-3">generates URL + shared secret</span>
            </form>
          )}
        </>
      )}
    </div>
  )
}
