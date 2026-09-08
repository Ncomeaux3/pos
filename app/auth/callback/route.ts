import { NextResponse } from 'next/server'
import { serverClient } from '@/core/db'

/**
 * Where the magic link lands. Exchanges the one time code for a session
 * cookie, then hands off to the app, which gates on requireOwner().
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await serverClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=expired`)
  }

  return NextResponse.redirect(origin)
}
