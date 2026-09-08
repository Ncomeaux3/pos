import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { Pool } from 'pg'
import type { Database } from './database.types'

// Server side clients only. The browser client lives in core/db-browser.ts so
// that next/headers never reaches a client bundle.

function env(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`${key} is not set. Copy .env.example to .env and fill it in.`)
  return value
}

/**
 * The owner's own session, read from cookies. RLS applies. This is what page
 * and server action code should use.
 */
export async function serverClient() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env('NEXT_PUBLIC_SUPABASE_URL'),
    env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return parseCookieHeader(cookieStore.toString())
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component, where cookies are read only.
            // middleware.ts refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  )
}

/**
 * Bypasses RLS. For jobs and the cron route only, never for anything that
 * runs on behalf of a request from outside.
 */
export function serviceClient() {
  return createServerClient<Database>(
    env('NEXT_PUBLIC_SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY'),
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

let pool: Pool | undefined

/**
 * Direct Postgres, used where supabase-js cannot go: the pos_readonly query
 * tool and the migration tests. Pooled because Fluid compute reuses instances.
 */
export function db(): Pool {
  const connectionString = env('DATABASE_URL')

  // The suites delete from core.connections and core.settings. Run against the
  // development database that destroys the owner's real provider keys, which is
  // what happened on 2026-09-08. vitest.config.mts points DATABASE_URL at
  // pos_test; this refuses to open a pool anywhere else while tests are running,
  // so a mistake in the config cannot quietly wipe real data.
  if (process.env.VITEST && !connectionString.includes('/pos_test')) {
    throw new Error(
      `Tests may only connect to the pos_test database, not ${new URL(connectionString).pathname}. ` +
        'Check globalSetup and test.env in vitest.config.mts.',
    )
  }

  pool ??= new Pool({ connectionString, max: 4 })
  return pool
}

/**
 * Runs one statement as pos_readonly: SELECT on core and each module schema,
 * nothing else. The role change is transaction local, so it cannot leak.
 * core/query.ts adds the statement timeout and row cap on top of this.
 */
export async function readonlyQuery<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
) {
  const client = await db().connect()
  try {
    await client.query('begin')
    await client.query('set local role pos_readonly')
    return await client.query<T>(sql, params)
  } finally {
    await client.query('rollback')
    client.release()
  }
}
