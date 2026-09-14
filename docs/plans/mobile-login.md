# Mobile login: a code to type, a passkey to tap

The magic link is the only way in, and on the phone it fails three ways at
once. This replaces it as the primary path without removing it.

## What is actually broken

Reported by the owner on 2026-09-14, all three at the same time:

1. **The link bounces back to login.** `signInWithOtp` runs server side, so
   `@supabase/ssr` writes a PKCE code verifier cookie into the browser that
   asked. Tapping the link in Mail opens it somewhere else: an in-app webview,
   or Safari when the request came from the home screen app. That context has
   no verifier cookie, `exchangeCodeForSession` fails, and
   `app/auth/callback/route.ts` redirects to `/login?error=expired`. The link
   was fine. The browser was wrong.
2. **It signs Safari in, not the app.** `display: standalone` in the manifest
   gives the home screen app its own cookie jar on iOS. A session created in
   Safari is not a session the installed app can see, so the icon still opens
   the login screen after a successful sign in.
3. **The email is slow or missing.** Supabase's built-in SMTP is rate limited
   and shares sender reputation across every project on it.

One fix covers 1 and 2: never leave the window that asked. A six digit code
typed into the page already open creates the session in that exact context,
whatever context it is. Fix 3 is a mail sender change, not a code change.

Passkey is the speed on top. It is not the fix on its own: enrolling one needs
an existing session, and losing the phone needs a way back in.

## What gets built

**Email code, primary.** The same `signInWithOtp` call, the same email. The
template carries `{{ .Token }}` and `{{ .ConfirmationURL }}`, so one message
holds both the code and the link. The sent screen becomes a six digit field;
submitting calls `verifyOtp({ email, token, type: 'email' })` in a server
action, which returns a session directly and sets the cookie on the response.
No PKCE is involved in that path, verified against
`@supabase/auth-js@2.116.0` `GoTrueClient.verifyOtp`. The link keeps working
for the laptop, where it never broke.

**Passkey, fast path.** Supabase Auth has native passkeys as of
supabase-js 2.105.0; this repo is on 2.116.0 and the methods are present. It
is marked experimental by Supabase and needs an explicit client opt-in, so
`core/db-browser.ts` sets `auth.experimental.passkey`. The login screen gets a
button that calls `signInWithPasskey()` and a Settings card that registers,
lists and deletes them. Every one of those is a browser side ceremony, so all
of it is client code talking to the browser client, and none of it needs a
table, a migration or a server action.

The button only renders when `window.PublicKeyCredential` exists and only after
hydration, the same pattern `Devices.tsx` uses for push. If the project has
passkeys switched off, the call returns `passkey_disabled` and the screen says
so and points at the email field. Nothing about the email path depends on the
passkey path working.

**Auth mail through Resend.** A dashboard change, not code: OWNER-TODO carries
the settings.

## What is not built

- No new table. Supabase Auth stores the credentials.
- No passkey autofill on the email field (conditional UI). One button is
  honest about what it does, and the discoverable credential flow already
  resolves the account without an email typed.
- No account recovery beyond the email code. One owner, and the code is the
  recovery.

## Relying party, and why the enrolment waits

A passkey is bound to the domain it was created on. The relying party ID lives
in Supabase's own config, not in this repo, so no code changes when the domain
does. But every passkey registered against `pos-gilt-rho.vercel.app` stops
working the moment the RP ID moves to a custom domain. The owner is adding one
soon, so: ship this, sign in with the code, and enrol the passkey after the
custom domain is live.

## Risk

Supabase calls passkeys experimental and reserves the right to change the API.
The blast radius is one button and one settings card, and the email code path
underneath it is not experimental, so a breaking change costs a login that
falls back rather than an install locked out.

## Verification

- `core/otp.test.ts` covers code normalisation, which is the only pure logic
  added.
- `e2e/auth.setup.ts` signs in with the code rather than the link, so the suite
  exercises the new primary path on every run.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- The passkey ceremony cannot be tested headlessly without a virtual
  authenticator, and is not covered. It is owner-verified on the phone.
