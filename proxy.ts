import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * Refreshes the Supabase session cookie before any route handler runs. Server
 * Components cannot write cookies, so without this a session would expire and
 * never renew. The actual access decision is requireOwner() in core/auth.ts.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.cookies.toString())
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  await supabase.auth.getClaims()

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest).*)'],
}
