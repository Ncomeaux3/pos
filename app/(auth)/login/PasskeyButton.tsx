'use client'

import { useRouter } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'
import { ActionButton } from '@/components/pos'
import { browserClient } from '@/core/db-browser'

// Signing in with a passkey is three things a server cannot do: fetch a
// challenge, run the browser's credential ceremony, and hand the signed result
// back. So this is client code, and the session it creates is written into the
// cookies of the browser that ran the ceremony, which is the same reason the
// code path works where the link does not.

/** Nothing to subscribe to: the value only differs between server and client. */
const subscribeToNothing = () => () => {}

function messageFor(error: unknown): string | null {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : ''

  // The owner dismissed the sheet, or it timed out. Not a failure to report.
  if (name === 'NotAllowedError' || name === 'AbortError') return null

  if (code === 'passkey_disabled') {
    return 'Passkeys are not switched on for this install yet. Use the code.'
  }
  if (code === 'webauthn_credential_not_found') {
    return 'This device has no passkey for POS. Sign in with the code, then add one in Settings.'
  }
  return error instanceof Error ? error.message : 'That did not work. Use the code.'
}

export function PasskeyButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Whether this browser can do WebAuthn is not knowable on the server, so the
  // button renders after hydration and the first pass agrees on both sides.
  // Same pattern as the push Devices card.
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false)
  const supported = mounted && typeof window !== 'undefined' && 'PublicKeyCredential' in window

  if (!supported) return null

  const signIn = async () => {
    setBusy(true)
    setError(null)
    try {
      const { error } = await browserClient().auth.signInWithPasskey()
      if (error) {
        setError(messageFor(error))
        return
      }
      // refresh before replace: the session is a cookie the proxy reads on the
      // way in, and the router cache still holds the signed out /login it was
      // handed a moment ago. Refreshing drops that, then the navigation is a
      // real request carrying the new cookie.
      router.refresh()
      router.replace('/')
    } catch (thrown) {
      setError(messageFor(thrown))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <ActionButton
        type="button"
        size="lg"
        variant="accent"
        disabled={busy}
        onClick={signIn}
        className="w-full justify-center"
      >
        {busy ? 'Waiting for the passkey' : 'Sign in with a passkey'}
      </ActionButton>
      {error && <p className="label text-[10px] tracking-[0.1em] text-bad">{error}</p>}
    </div>
  )
}
