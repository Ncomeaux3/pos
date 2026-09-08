import { NextResponse } from 'next/server'
import { getCredentials, getIntegration, secretMatches } from '@/core/integrations'
import { withLog } from '@/core/log'

export const SECRET_HEADER = 'x-pos-secret'

/**
 * Inbound only. Unauthenticated by session on purpose: the caller is a phone
 * app or a provider, so the shared secret from the Connections card is the
 * whole gate. Generic across every webhook manifest.
 */
async function handle(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const manifest = getIntegration(id)
  if (!manifest || manifest.auth.type !== 'webhook') {
    return NextResponse.json({ error: 'Not a webhook integration' }, { status: 404 })
  }

  // Same 401 whether the provider is unconnected or the secret is wrong, so
  // this endpoint does not report which integrations exist.
  const secret = (await getCredentials(id))?.secret ?? null
  if (!secretMatches(request.headers.get(SECRET_HEADER), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body is not JSON' }, { status: 400 })
  }

  const parsed = manifest.webhookSchema?.safeParse(body)
  if (parsed && !parsed.success) {
    return NextResponse.json(
      { error: 'Payload does not match the expected shape', issues: parsed.error.issues.slice(0, 5) },
      { status: 400 },
    )
  }

  await manifest.webhook?.(parsed?.data ?? body)
  return NextResponse.json({ ok: true })
}

// Rate limited and logged like every route under app/api. The limiter is the
// backstop behind the edge; the log is what survives Vercel's short retention.
export const POST = withLog(handle)
