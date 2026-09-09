import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import {
  Card,
  Chip,
  ConfirmButton,
  CopyBlock,
  Eyebrow,
  ActionButton,
  PageHeader,
  Row,
  RowList,
  StatusChip,
  TabLinks,
  fieldClass,
} from '@/components/pos'
import { requireOwner } from '@/core/auth'
import { db } from '@/core/db'
import {
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
import { settingsTabs } from '../tabs'

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

  const result = await manifest.test(creds)
  await saveCredentials(id, creds, {
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

const AUTH_LABEL = { token: 'Token', oauth2: 'OAuth2', webhook: 'Webhook' } as const

/** Which modules named this provider in `requires`. Drives the "feeds" line. */
function usedBy(id: string): string[] {
  return getModules()
    .filter((m) => (m.requires ?? []).includes(id))
    .map((m) => m.nav.label)
}

export default async function ConnectionsPage({ searchParams }: PageProps<'/settings/connections'>) {
  const params = await searchParams
  const error = typeof params.error === 'string' ? params.error : null

  const manifests = getIntegrations()
  const statuses = await getConnectionStatuses()

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
  const connected = manifests.filter((m) => statuses[m.id]?.connected).length

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
    <div className="max-w-3xl space-y-7">
      <PageHeader
        eyebrow="Settings / Connections"
        dot={connected > 0 ? 'brand' : 'idle'}
        title="Connections"
        lede="Every provider the system knows about. Keys are encrypted before they are stored and are never written to .env."
        actions={
          <Eyebrow dot={connected > 0 ? 'ok' : 'idle'}>
            {connected} of {manifests.length} connected
          </Eyebrow>
        }
      />

      <TabLinks
        tabs={settingsTabs(manifests.length)}
        current="/settings/connections"
        label="Settings sections"
      />

      {error && (
        <p className="rounded-md border border-bad/60 px-3 py-2.5 text-[13px] text-bad">{error}</p>
      )}

      <div className="space-y-3">
        {manifests.map((manifest) => (
          <ProviderCard
            key={manifest.id}
            manifest={manifest}
            connected={Boolean(statuses[manifest.id]?.connected)}
            status={statuses[manifest.id]?.status ?? null}
            detail={statuses[manifest.id]?.lastTestDetail ?? null}
            testedAt={statuses[manifest.id]?.lastTestedAt ?? null}
            secret={webhookSecrets[manifest.id] ?? null}
            origin={origin}
          />
        ))}
      </div>

      {unbacked.length > 0 && (
        <section className="space-y-3">
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
  connected,
  status,
  detail,
  testedAt,
  secret,
  origin,
}: {
  manifest: IntegrationManifest
  connected: boolean
  /** The stored status. null when nothing has ever been saved. */
  status: string | null
  detail: string | null
  testedAt: Date | null
  secret: string | null
  origin: string
}) {
  const feeds = usedBy(manifest.id)

  return (
    <Card className="space-y-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="t-title text-[19px] leading-none text-ink">{manifest.label}</h2>
            <Chip tone="quiet">{AUTH_LABEL[manifest.auth.type]}</Chip>
          </div>
          <p className="t-caption text-ink-3">
            {manifest.description}
            {feeds.length > 0 && ` Used by ${feeds.join(', ')}.`}
          </p>
        </div>
        <StatusChip tone={connected ? 'ok' : status ? 'bad' : 'quiet'}>
          {connected ? 'Connected' : status === 'error' ? 'Rejected' : status ?? 'Not connected'}
        </StatusChip>
      </div>

      {detail && (
        <p
          className={`label text-[10px] tracking-[0.1em] ${connected ? 'text-ink-3' : 'text-bad'}`}
        >
          Last test: {detail}
          {testedAt && ` · ${new Date(testedAt).toLocaleString()}`}
        </p>
      )}

      {manifest.auth.type === 'token' && (
        <form action={save} className="space-y-3">
          <input type="hidden" name="id" value={manifest.id} />
          {manifest.auth.fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label
                htmlFor={`${manifest.id}-${f.key}`}
                className="label block text-[10px] tracking-[0.1em] text-ink-3"
              >
                {f.label}
              </label>
              <input
                id={`${manifest.id}-${f.key}`}
                name={f.key}
                type={f.secret ? 'password' : 'text'}
                placeholder={f.secret && connected ? 'Saved. Type to replace.' : f.placeholder}
                autoComplete="off"
                className={fieldClass}
              />
            </div>
          ))}
          <ActionButton variant="solid" type="submit">
            {connected ? 'Save and test' : 'Connect'}
          </ActionButton>
        </form>
      )}

      {manifest.auth.type === 'oauth2' && (
        <a
          href={`/api/integrations/${manifest.id}/oauth/start`}
          className="label inline-flex h-11 items-center rounded-md border border-rule-2 px-3 text-[10px] tracking-[0.1em] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink sm:h-[30px]"
        >
          {connected ? `Reauthorize ${manifest.label}` : `Connect with ${manifest.label}`}
        </a>
      )}

      {manifest.auth.type === 'webhook' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Eyebrow>Inbound URL</Eyebrow>
            <CopyBlock value={`${origin}/api/integrations/${manifest.id}/webhook`} />
          </div>
          {secret ? (
            <div className="space-y-1.5">
              <Eyebrow>Header x-pos-secret</Eyebrow>
              <CopyBlock value={secret} />
            </div>
          ) : (
            <form action={generateSecret}>
              <input type="hidden" name="id" value={manifest.id} />
              <ActionButton variant="solid" type="submit">
                Enable webhook
              </ActionButton>
            </form>
          )}
        </div>
      )}

      {status && (
        <div className="flex flex-wrap gap-2 border-t border-rule pt-3">
          <form action={test}>
            <input type="hidden" name="id" value={manifest.id} />
            <ActionButton type="submit">Test</ActionButton>
          </form>
          <form action={disconnect}>
            <input type="hidden" name="id" value={manifest.id} />
            <ConfirmButton submit confirmLabel="Confirm disconnect">
              Disconnect
            </ConfirmButton>
          </form>
        </div>
      )}
    </Card>
  )
}
