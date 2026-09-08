import { timingSafeEqual } from 'node:crypto'
import { decrypt, encrypt } from './crypto'
import { db } from './db'
import type { Credentials } from './integration-contract'

// Stored credentials and the two constant time comparisons, split out of the
// registry because none of it needs to know which providers exist.
//
// That matters: an integration's client.ts calls getCredentials, and the
// provider's manifest imports the client. Reaching this through the registry
// made manifest -> client -> registry -> _index -> manifest a cycle, which
// Next's bundler hoisted around and plain Node did not.

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
