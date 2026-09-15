# Push notifications

The rules table has stored a `push` channel since the notifications step and the
sender ignored it, by decision, until 2026-09-09. This is that step.

## What it needs from you

A VAPID key pair in `.env`. Generate one:

```
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Until both are set, Settings >
Notifications says push is not configured and the sender skips it. Nothing else
changes: email and the alert centre are unaffected, and a rule set to push alone
is still recorded.

Changing the keys invalidates every subscribed device, which then has to press
the button again.

## How it works

`public/sw.js` is the service worker. It caches nothing and intercepts no
fetches, so it cannot serve a stale page: offline support is a separate decision
nobody has taken. It exists because a notification cannot be delivered to a page
that is closed, and a service worker is the only thing a browser will wake.

Settings > Notifications has a Devices card. Pressing the button asks the
browser for permission, registers the worker, subscribes, and posts the
browser's own keys to a server action. One row per browser: the same person on a
laptop and a phone is two subscriptions that expire independently.

The sender pushes once per send, not once per item, for the same reason the
digest is one email. The push leads with the most urgent item and counts the
rest, because a lock screen notification listing six things is one nobody reads.

## What it will not do

Push only fires when a rule that raised something asks for it. A notification
with no rule behind it is raised by a job rather than chosen by the owner, and
pushing those would make the one channel nobody can ignore the one channel
nobody chose.

Quiet hours still apply: `pending()` gates the whole send, so a push cannot
arrive at 3am that an email would not have.

A subscription the push service reports as gone (404 or 410) is deleted on the
next send rather than retried forever. Any other failure is counted and left
alone, because a push service having a bad minute is not a reason to lose a
device.

## Why enabling failed

Diagnosed 2026-09-14 (v1.1 Phase 1), in the plan's order.

(a) Uncookied, `GET /sw.js` on production answers `307 -> /login`, text/plain:
the auth proxy matcher excluded `icons/` and `manifest.webmanifest` but not
`sw.js`. A worker script fetched through a redirect is rejected by the browser,
so any registration whose fetch lands without a valid session cookie fails
before `pushManager.subscribe` runs. The logged-in fetch is the decision point
and is recorded below when the owner has pressed the button with the Network
tab open.

(b) Vercel Production has `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and
`VAPID_SUBJECT` set (names read with `vercel env ls production`; values not
pulled). The public key's length is checked in the page during (a), since the
client needs it to subscribe.

(c) and (d) not reached.

## On an iPhone

Safari only offers push to an installed PWA, so the app has to be added to the
home screen first. The card says so rather than showing a button that cannot
work.
