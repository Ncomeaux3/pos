import { defineIntegration } from '@/core/integration-contract'

export default defineIntegration({
  id: 'strava',
  label: 'Strava',
  description: 'Workouts for the Fitness module, which feed Health skills and fitness goals.',
  docsUrl: 'https://www.strava.com/settings/api',

  auth: {
    type: 'oauth2',
    authorizeUrl: 'https://www.strava.com/oauth/authorize',
    tokenUrl: 'https://www.strava.com/oauth/token',
    scopes: ['activity:read_all', 'profile:read_all'],
  },

  // Honest stub: the Fitness module has not shipped. The OAuth flow itself is
  // generic and lives in app/api/integrations/[id]/oauth/callback.
  test: async () => ({
    ok: false,
    detail: 'Not verified. The Fitness module ships in a later phase and will add a real check.',
  }),

  // Strava access tokens last six hours, so the nightly job refreshes before
  // any module sync. Written now because the generic refresh pass calls it.
  refresh: async (creds) => {
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: creds.refresh_token,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Strava refresh ${res.status}: ${await res.text()}`)

    const body = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_at: number
    }
    return {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: String(body.expires_at),
    }
  },
})
