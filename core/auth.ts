import { redirect } from 'next/navigation'
import { serverClient } from './db'

export type OwnerVerdict = { ok: true } | { ok: false; redirectTo: string }

/**
 * The whole access rule, kept pure so it can be tested without a session.
 * There is exactly one owner and no signup flow, so anything that is not an
 * exact match for OWNER_EMAIL is a stranger.
 */
export function ownerVerdict(
  sessionEmail: string | null | undefined,
  ownerEmail: string,
): OwnerVerdict {
  const visitor = sessionEmail?.trim().toLowerCase() ?? ''
  const owner = ownerEmail.trim().toLowerCase()

  if (!visitor) return { ok: false, redirectTo: '/login' }
  // An unset OWNER_EMAIL locks everyone out rather than letting everyone in.
  if (!owner || visitor !== owner) return { ok: false, redirectTo: '/not-owner' }
  return { ok: true }
}

/**
 * Gate for every page under app/(app). Returns the owner or does not return.
 */
export async function requireOwner() {
  const supabase = await serverClient()
  // getUser, not getSession: this verifies the token with the auth server
  // instead of trusting a cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const verdict = ownerVerdict(user?.email, process.env.OWNER_EMAIL ?? '')
  if (!verdict.ok) redirect(verdict.redirectTo)

  return user!
}
