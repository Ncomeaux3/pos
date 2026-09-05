import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { Button } from '@/components/ui/button'
import { requireOwner } from '@/core/auth'
import {
  type IntegrationManifest,
  deleteCredentials,
  getConnectionStatuses,
  getCredentials,
  getIntegration,
  getIntegrations,
  saveCredentials,
} from '@/core/integrations'

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
  // Server actions are standalone POST endpoints addressed by id. The (app)
  // layout does not run for them, so each one authenticates independently.
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
  // Server actions are standalone POST endpoints addressed by id. The (app)
  // layout does not run for them, so each one authenticates independently.
  await requireOwner()
  await deleteCredentials(String(formData.get('id')))
  revalidatePath('/settings/connections')
}

async function generateSecret(formData: FormData) {
  'use server'
  // Server actions are standalone POST endpoints addressed by id. The (app)
  // layout does not run for them, so each one authenticates independently.
  await requireOwner()
  const id = String(formData.get('id'))
  await saveCredentials(id, { secret: randomBytes(24).toString('base64url') })
  revalidatePath('/settings/connections')
}

const field =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

function Status({ connected, detail }: { connected: boolean; detail: string | null }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${connected ? 'text-foreground' : 'text-muted-foreground'}`}
      title={detail ?? undefined}
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
      />
      {connected ? 'Connected' : 'Not connected'}
    </span>
  )
}

export default async function ConnectionsPage({ searchParams }: PageProps<'/settings/connections'>) {
  const params = await searchParams
  const error = typeof params.error === 'string' ? params.error : null

  const manifests = getIntegrations()
  const statuses = await getConnectionStatuses()
  const origin = (await headers()).get('origin') ?? ''

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
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Every provider the system knows about. Keys are encrypted before they are stored and are
          never written to .env.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {manifests.map((manifest) => (
          <Card
            key={manifest.id}
            manifest={manifest}
            connected={Boolean(statuses[manifest.id]?.connected)}
            detail={statuses[manifest.id]?.lastTestDetail ?? null}
            testedAt={statuses[manifest.id]?.lastTestedAt ?? null}
            secret={webhookSecrets[manifest.id] ?? null}
            origin={origin}
          />
        ))}
      </div>
    </div>
  )
}

function Card({
  manifest,
  connected,
  detail,
  testedAt,
  secret,
  origin,
}: {
  manifest: IntegrationManifest
  connected: boolean
  detail: string | null
  testedAt: Date | null
  secret: string | null
  origin: string
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-sm font-medium">{manifest.label}</h2>
          <p className="text-xs text-muted-foreground">{manifest.description}</p>
        </div>
        <Status connected={connected} detail={detail} />
      </div>

      {detail && (
        <p className="text-xs text-muted-foreground">
          {detail}
          {testedAt && ` (tested ${new Date(testedAt).toLocaleString()})`}
        </p>
      )}

      {manifest.auth.type === 'token' && (
        <form action={save} className="space-y-2">
          <input type="hidden" name="id" value={manifest.id} />
          {manifest.auth.fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <label htmlFor={`${manifest.id}-${f.key}`} className="block text-xs font-medium">
                {f.label}
              </label>
              <input
                id={`${manifest.id}-${f.key}`}
                name={f.key}
                type={f.secret ? 'password' : 'text'}
                placeholder={f.secret && connected ? 'Saved. Type to replace.' : f.placeholder}
                autoComplete="off"
                className={field}
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm">
              {connected ? 'Update' : 'Connect'}
            </Button>
          </div>
        </form>
      )}

      {manifest.auth.type === 'oauth2' && (
        <a
          href={`/api/integrations/${manifest.id}/oauth/start`}
          className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm"
        >
          {connected ? `Reconnect ${manifest.label}` : `Connect ${manifest.label}`}
        </a>
      )}

      {manifest.auth.type === 'webhook' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-xs font-medium">Post to</p>
            <code className="block overflow-x-auto rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
              {origin}/api/integrations/{manifest.id}/webhook
            </code>
          </div>
          {secret ? (
            <div className="space-y-1">
              <p className="text-xs font-medium">Header x-pos-secret</p>
              <code className="block overflow-x-auto rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
                {secret}
              </code>
            </div>
          ) : (
            <form action={generateSecret}>
              <input type="hidden" name="id" value={manifest.id} />
              <Button type="submit" size="sm">
                Generate secret
              </Button>
            </form>
          )}
        </div>
      )}

      {connected && (
        <div className="flex gap-2 border-t border-border pt-3">
          <form action={test}>
            <input type="hidden" name="id" value={manifest.id} />
            <Button type="submit" size="sm" variant="outline">
              Test
            </Button>
          </form>
          <form action={disconnect}>
            <input type="hidden" name="id" value={manifest.id} />
            <Button type="submit" size="sm" variant="ghost">
              Disconnect
            </Button>
          </form>
        </div>
      )}
    </section>
  )
}
