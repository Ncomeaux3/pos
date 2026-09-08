import { timingSafeEqual } from 'node:crypto'
import type { z } from 'zod'
import { integrations } from '../integrations/_index'
import { decrypt, encrypt } from './crypto'
import { db } from './db'

// One folder, one manifest, per external account. The Connections page, the
// OAuth callback, and the webhook route are all generic and read the manifest.
// See docs/ARCHITECTURE.md "Integration contract".

export type Credentials = Record<string, string>

export type TokenField = {
  key: string
  label: string
  /** Rendered as a password field and masked once saved. */
  secret?: boolean
  placeholder?: string
}

export type IntegrationAuth =
  | { type: 'token'; fields: TokenField[] }
  | { type: 'oauth2'; authorizeUrl: string; tokenUrl: string; scopes: string[] }
  | { type: 'webhook' }

export type TestResult = { ok: boolean; detail: string }

export type IntegrationManifest = {
  id: string
  label: string
  /** One line on the card saying what connecting this buys. */
  description: string
  auth: IntegrationAuth
  /** Runs on save and on the Test button. Must not throw. */
  test: (creds: Credentials) => Promise<TestResult>
  /** oauth2 only. Runs nightly before module syncs. */
  refresh?: (creds: Credentials) => Promise<Credentials>
  /** webhook only. */
  webhookSchema?: z.ZodTypeAny
  webhook?: (payload: unknown) => Promise<void>
  docsUrl?: string
}

export function defineIntegration(manifest: IntegrationManifest): IntegrationManifest {
  return manifest
}

export function getIntegrations(): IntegrationManifest[] {
  return [...integrations].sort((a, b) => a.label.localeCompare(b.label))
}

export function getIntegration(id: string): IntegrationManifest | undefined {
  return integrations.find((i) => i.id === id)
}

/**
 * The only way anything reads a provider secret. Nothing in a module reads a
 * provider key from .env.
 */
export async function getCredentials(id: string): Promise<Credentials | null> {
  const { rows } = await db().query<{ credentials_encrypted: string }>(
    'select credentials_encrypted from core.connections where integration_id = $1',
    [id],
  )
  if (rows.length === 0) return null
  // Throws if ENCRYPTION_KEY changed or the row was tampered with. Loud is right.
  return JSON.parse(decrypt(rows[0].credentials_encrypted))
}

export async function saveCredentials(
  id: string,
  creds: Credentials,
  extra: { status?: string; expiresAt?: Date; testDetail?: string } = {},
): Promise<void> {
  await db().query(
    `insert into core.connections
       (integration_id, credentials_encrypted, status, expires_at, last_tested_at, last_test_detail)
     values ($1, $2, $3, $4, case when $5::text is null then null else now() end, $5)
     on conflict (integration_id) do update set
       credentials_encrypted = excluded.credentials_encrypted,
       status = excluded.status,
       expires_at = excluded.expires_at,
       last_tested_at = excluded.last_tested_at,
       last_test_detail = excluded.last_test_detail`,
    [
      id,
      encrypt(JSON.stringify(creds)),
      extra.status ?? 'connected',
      extra.expiresAt ?? null,
      extra.testDetail ?? null,
    ],
  )
}

/** Disconnect deletes the row. Nothing else changes. */
export async function deleteCredentials(id: string): Promise<void> {
  await db().query('delete from core.connections where integration_id = $1', [id])
}

export type ConnectionStatus = {
  connected: boolean
  status: string | null
  lastTestedAt: Date | null
  lastTestDetail: string | null
  expiresAt: Date | null
}

export async function getConnectionStatuses(): Promise<Record<string, ConnectionStatus>> {
  const { rows } = await db().query<{
    integration_id: string
    status: string
    last_tested_at: Date | null
    last_test_detail: string | null
    expires_at: Date | null
  }>('select integration_id, status, last_tested_at, last_test_detail, expires_at from core.connections')

  return Object.fromEntries(
    rows.map((r) => [
      r.integration_id,
      {
        // A row exists for anything that has ever been saved, including a key
        // the provider rejected. Only 'connected' means the credentials
        // actually worked on the last test.
        connected: r.status === 'connected',
        status: r.status,
        lastTestedAt: r.last_tested_at,
        lastTestDetail: r.last_test_detail,
        expiresAt: r.expires_at,
      },
    ]),
  )
}

/**
 * OAuth CSRF check. Separate and pure because "both are missing" must not read
 * as a match, which is the classic way this check gets written wrong.
 */
export function stateMatches(fromQuery: string | null, fromCookie: string | null): boolean {
  if (!fromQuery || !fromCookie) return false
  const a = Buffer.from(fromQuery)
  const b = Buffer.from(fromCookie)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Same shape of comparison for the webhook shared secret. */
export function secretMatches(provided: string | null, expected: string | null): boolean {
  return stateMatches(provided, expected)
}
