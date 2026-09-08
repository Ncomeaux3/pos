import { redirect } from 'next/navigation'
import { serverClient } from './db'
import { ownerVerdict } from './owner'

// The rule itself lives in core/owner.ts so the proxy can import it without
// dragging next/headers into that runtime. Re-exported here because this is
// where callers look for it.
export { ownerVerdict, isPublicPath, type OwnerVerdict } from './owner'

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
