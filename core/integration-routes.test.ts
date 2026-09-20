import { randomBytes } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// The routes read the state cookie through next/headers.
let cookieJar = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}))

const { db } = await import('./db')
const { saveCredentials } = await import('./integrations')
const { expiryFrom, oauthStateCookie } = await import('./oauth')
const { GET: oauthCallback } = await import('../app/api/integrations/[id]/oauth/callback/route')
const { POST: webhook } = await import('../app/api/integrations/[id]/webhook/route')

const SECRET_HEADER = 'x-pos-secret'

const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  cookieJar = new Map()
  process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64')
})
afterEach(async () => {
  await db().query('delete from core.connections')
  await db().query('delete from fitness.body_metric')
})
afterAll(async () => {
  await db().end()
})

describe('oauth callback', () => {
  const url = (qs: string) => `https://pos.example.com/api/integrations/strava/oauth/callback?${qs}`

  it('refuses when the callback carries no state at all', async () => {
    cookieJar.set(oauthStateCookie('strava'), 'the-expected-state')
    const res = await oauthCallback(new Request(url('code=abc')), params('strava'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('error=')
  })

  it('refuses when no state cookie was ever set', async () => {
    const res = await oauthCallback(new Request(url('code=abc&state=anything')), params('strava'))
    expect(res.headers.get('location')).toContain('error=')
  })

  it('refuses when the states differ', async () => {
    cookieJar.set(oauthStateCookie('strava'), 'expected')
    const res = await oauthCallback(new Request(url('code=abc&state=attacker')), params('strava'))
    expect(res.headers.get('location')).toContain('error=')
  })

  it('clears the state cookie so a callback cannot be replayed', async () => {
    cookieJar.set(oauthStateCookie('strava'), 'expected')
    await oauthCallback(new Request(url('code=abc&state=attacker')), params('strava'))
    expect(cookieJar.has(oauthStateCookie('strava'))).toBe(false)
  })

  it('404s for an integration that does not use oauth', async () => {
    const res = await oauthCallback(
      new Request('https://pos.example.com/api/integrations/anthropic/oauth/callback?state=x'),
      params('anthropic'),
    )
    expect(res.status).toBe(404)
  })

  it('reports the provider error rather than exchanging a code', async () => {
    cookieJar.set(oauthStateCookie('strava'), 'matching')
    const res = await oauthCallback(new Request(url('state=matching&error=access_denied')), params('strava'))
    expect(decodeURIComponent(res.headers.get('location') ?? '')).toContain('access_denied')
  })
})

describe('expiryFrom', () => {
  it('reads an absolute expires_at in seconds', () => {
    expect(expiryFrom({ access_token: 'a', expires_at: 1_800_000_000 })?.toISOString()).toBe(
      new Date(1_800_000_000_000).toISOString(),
    )
  })

  it('turns a relative expires_in into an absolute time', () => {
    const now = Date.parse('2026-09-05T00:00:00Z')
    expect(expiryFrom({ access_token: 'a', expires_in: 3600 }, now)?.toISOString()).toBe(
      '2026-09-05T01:00:00.000Z',
    )
  })

  it('returns null when the provider says nothing about expiry', () => {
    expect(expiryFrom({ access_token: 'a' })).toBeNull()
  })
})

describe('webhook route', () => {
  const url = 'https://pos.example.com/api/integrations/health_auto_export/webhook'
  const valid = { data: { metrics: [{ name: 'weight_body_mass', units: 'lb' }] } }

  const post = (body: unknown, secret?: string) =>
    webhook(
      new Request(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(secret ? { [SECRET_HEADER]: secret } : {}),
        },
        body: JSON.stringify(body),
      }),
      params('health_auto_export'),
    )

  it('401s with no secret header', async () => {
    await saveCredentials('health_auto_export', { secret: 'the-real-secret' })
    expect((await post(valid)).status).toBe(401)
  })

  it('401s with the wrong secret', async () => {
    await saveCredentials('health_auto_export', { secret: 'the-real-secret' })
    expect((await post(valid, 'guessed')).status).toBe(401)
  })

  it('401s when the integration is not connected, giving nothing away', async () => {
    expect((await post(valid, 'anything')).status).toBe(401)
  })

  it('400s on a payload that does not match the schema', async () => {
    await saveCredentials('health_auto_export', { secret: 'the-real-secret' })
    const res = await post({ nonsense: true }, 'the-real-secret')
    expect(res.status).toBe(400)
  })

  it('400s on a body that is not JSON', async () => {
    await saveCredentials('health_auto_export', { secret: 'the-real-secret' })
    const res = await webhook(
      new Request(url, {
        method: 'POST',
        headers: { [SECRET_HEADER]: 'the-real-secret' },
        body: 'not json at all',
      }),
      params('health_auto_export'),
    )
    expect(res.status).toBe(400)
  })

  it('accepts a valid payload with the right secret', async () => {
    await saveCredentials('health_auto_export', { secret: 'the-real-secret' })
    const res = await post(valid, 'the-real-secret')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('404s for an integration that is not a webhook', async () => {
    const res = await webhook(
      new Request(url, { method: 'POST', body: '{}' }),
      params('anthropic'),
    )
    expect(res.status).toBe(404)
  })

  // The dispatch line: a validated payload reaches the module that declared
  // an inbound handler for this integration id, and lands as a row.
  it('hands a valid payload to the module inbound seam', async () => {
    await saveCredentials('health_auto_export', { secret: 'the-real-secret' })
    const res = await post(
      {
        data: {
          metrics: [
            { name: 'weight_body_mass', units: 'kg', data: [{ qty: 84.5, date: '2026-09-11 07:30:00 -0500' }] },
          ],
        },
      },
      'the-real-secret',
    )
    expect(res.status).toBe(200)

    const { rows } = await db().query<{ value: string; source: string }>(
      `select value, source from fitness.body_metric where kind = 'weight' and measured_on = '2026-09-11'`,
    )
    expect(rows).toEqual([{ value: '84500', source: 'health_auto_export' }])
  })
})
