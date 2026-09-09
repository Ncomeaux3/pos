'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { ActionButton, Card, CardHead, Row, RowList, useToast } from '@/components/pos'
import { forgetDevice, subscribeDevice } from './actions'

// Turning push on is three things a page cannot do on the server: ask
// permission, register a service worker, and hand the browser's own keys back.
// So this part is a client component and everything it produces goes straight
// to a server action.

export type Device = { id: string; label: string; lastSentAt: string | null; failures: number }

/** Nothing to subscribe to: the value only differs between server and client. */
const subscribeToNothing = () => () => {}

/**
 * The browser gives the VAPID public key as bytes, not as the base64url string
 * it is stored as, so it has to be converted on the way in. Twelve lines and no
 * dependency.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  // Backed by a plain ArrayBuffer rather than the SharedArrayBuffer the wider
  // Uint8Array type allows, which is what applicationServerKey requires.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export function Devices({
  devices,
  vapidPublicKey,
}: {
  devices: Device[]
  vapidPublicKey: string | null
}) {
  const [, start] = useTransition()
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  // Push needs a service worker and a Notification API. Deciding that on the
  // server would be a guess about a browser we cannot see, so the button is
  // rendered after hydration and the server and client agree on the first pass.
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false)
  const supported =
    mounted && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window

  const enable = async () => {
    if (!vapidPublicKey) return
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast('The browser refused. Notifications are blocked for this site.')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        // Required by every browser that implements push: a notification the
        // owner never sees is not something this app has any use for.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      const result = await subscribeDevice(
        JSON.parse(JSON.stringify(subscription)),
        navigator.userAgent,
      )
      toast(result.ok ? 'This device will get push now.' : result.error)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not subscribe')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <CardHead label="Devices" meta={`${devices.length} subscribed`} />

      {vapidPublicKey === null ? (
        <p className="t-caption text-ink-3">
          Push is not configured. Generate a VAPID key pair and set VAPID_PUBLIC_KEY and
          VAPID_PRIVATE_KEY in .env, then this becomes a button. Everything else about push already
          works: rules store the channel and the sender honours it the moment a device is here.
        </p>
      ) : (
        <>
          {devices.length === 0 ? (
            <p className="t-caption text-ink-3">
              No device is subscribed, so nothing is pushed. Email and the alert centre are
              unaffected.
            </p>
          ) : (
            <RowList>
              {devices.map((device) => (
                <Row
                  key={device.id}
                  title={device.label || 'This browser'}
                  meta={
                    device.lastSentAt
                      ? `last push ${device.lastSentAt}`
                      : 'subscribed, nothing sent yet'
                  }
                  right={
                    <>
                      {device.failures > 0 && (
                        <span className="num text-[11px] text-warn">
                          {device.failures} failed
                        </span>
                      )}
                      <ActionButton
                        onClick={() =>
                          start(async () => {
                            const result = await forgetDevice(device.id)
                            toast(result.ok ? 'Device forgotten.' : result.error)
                          })
                        }
                      >
                        Forget
                      </ActionButton>
                    </>
                  }
                />
              ))}
            </RowList>
          )}

          {supported ? (
            <ActionButton variant="brand" disabled={busy} onClick={enable}>
              {busy ? 'Asking the browser' : 'Turn on push for this device'}
            </ActionButton>
          ) : (
            mounted && (
              <p className="t-caption text-ink-3">
                This browser has no push support. On an iPhone that means adding the app to the
                home screen first.
              </p>
            )
          )}
        </>
      )}

      <p className="t-caption text-ink-3">
        One row per browser, because the same person on a laptop and a phone is two subscriptions
        that expire independently. A subscription the push service says is gone is deleted on the
        next send rather than retried forever.
      </p>
    </Card>
  )
}
