import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getIntegration, saveCredentials, stateMatches } from '@/core/integrations'
import { type TokenResponse, expiryFrom, oauthStateCookie } from '@/core/oauth'

const back = (origin: string, error?: string) =>
  NextResponse.redirect(
    `${origin}/settings/connections${error ? `?error=${encodeURIComponent(error)}` : '?connected=1'}`,
  )

/**
 * Where every oauth2 provider returns to. Generic: the token exchange uses the
 * manifest's tokenUrl, so adding a provider adds no route.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(request.url)
  const origin = url.origin

  const manifest = getIntegration(id)
  if (!manifest || manifest.auth.type !== 'oauth2') {
    return NextResponse.json({ error: 'Not an OAuth integration' }, { status: 404 })
  }

  const jar = await cookies()
  const cookieName = oauthStateCookie(id)
  const expected = jar.get(cookieName)?.value ?? null
  jar.delete(cookieName)

  // CSRF gate first, before anything is exchanged or stored. A missing state on
  // either side is a failure, never a match.
  if (!stateMatches(url.searchParams.get('state'), expected)) {
    return back(origin, 'Sign in state did not match. Start the connection again.')
  }

  if (url.searchParams.get('error')) {
    return back(origin, url.searchParams.get('error') ?? 'Provider refused')
  }

  const code = url.searchParams.get('code')
  if (!code) return back(origin, 'Provider returned no code')

  try {
    const res = await fetch(manifest.auth.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env[`${id.toUpperCase()}_CLIENT_ID`],
        client_secret: process.env[`${id.toUpperCase()}_CLIENT_SECRET`],
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${origin}/api/integrations/${id}/oauth/callback`,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return back(origin, `Token exchange failed: ${res.status}`)

    const token = (await res.json()) as TokenResponse
    if (!token.access_token) return back(origin, 'Token exchange returned no access token')

    await saveCredentials(
      id,
      {
        access_token: token.access_token,
        ...(token.refresh_token ? { refresh_token: token.refresh_token } : {}),
      },
      { expiresAt: expiryFrom(token) ?? undefined },
    )
    return back(origin)
  } catch (error) {
    return back(origin, error instanceof Error ? error.message : 'Token exchange failed')
  }
}
