# Owner to-do

Things only Nick can do: accounts, credentials, money, and calls that need a
judgement I should not make alone. Claude Code appends here rather than
blocking, and clears items once they are done and verified.

Format: `[ ]` waiting on you, `[x]` done, with the date and what unblocked.
Rewritten 2026-09-12 around docs/plans/backend-live.md; each item names the
phase it unblocks. Walkthroughs: docs/SETUP-SUPABASE.md for production,
docs/SETUP-INTEGRATIONS.md for the providers.

## Before anything: security

- [x] **1. Delete the old Voyage and Anthropic keys.** Done 2026-09-13. 2026-09-09: replacements
      were generated and verified, which means the old ones were not revoked
      and still work. Delete the old Voyage key at dash.voyageai.com and the
      old Anthropic key at console.anthropic.com, then re-test on Settings >
      Connections, local and (once it exists) production.

## Phase 2: production live

What was verified 2026-09-12: the Vercel project `pos` already exists and
deploys every push; production is `https://pos-gilt-rho.vercel.app`. The
hosted Supabase project exists but nothing has been pushed to it.

- [x] **2. Confirm the hosted Supabase project ref** Done 2026-09-13: linked to `qmpeikzicfxvahueghtc`. (`supabase/.temp/project-ref`
      or the dashboard URL) and that `supabase link` points at it.
- [x] **3. `supabase db push`**, Done 2026-09-13: 24 were already there from 2026-09-09, the last 3 applied, 27 match. Then `supabase migration list --linked`: local
      and remote columns match, 27 rows. Never `db reset` against the linked
      project.
- [x] **4. Supabase dashboard, four settings.** Done 2026-09-13, owner confirmed all four. Allow new users to sign up: off.
      Exposed schemas: `public, graphql_public` only. Email OTP expiry: 900
      seconds. Site URL: `https://pos-gilt-rho.vercel.app`, also in redirect
      URLs. The first two are the security review's top finding: every RLS
      policy trusts `authenticated`, and neither setting can be enforced from
      the repo.
- [x] **5. Vercel project settings.** Done 2026-09-13: Node 22.x, Standard Protection (production open, previews gated), 13 production env vars, redeploy READY at `e857a7b`, `/login` serves the real class. Node.js version 22.x (it is on 24;
      CI tests 22). Deployment Protection: Vercel Authentication for previews
      only, off for production (decision 2026-09-12; the app's own gate is
      OWNER_EMAIL plus disabled signup plus RLS). Every key from `.env.example`
      in the Production environment: **generate a fresh `ENCRYPTION_KEY`** and
      put it in your password manager first (losing it makes every stored
      credential unreadable, no recovery); fresh `CRON_SECRET` and `MCP_TOKEN`;
      a VAPID pair. `RESEND_FROM` may stay unset (sends from
      onboarding@resend.dev). Then redeploy `main` and confirm Settings > Cron
      Jobs lists `/api/cron/nightly` at `0 9 * * *`.
- [x] **6. `pnpm setup` against production**, Done 2026-09-13 as `pnpm tsx --env-file=.env.production scripts/setup.ts`: 5 steps, owner exists. Session pooler URL for DATABASE_URL (the direct host is IPv6 only) and the legacy service_role JWT. From the laptop with the
      production values loaded. Never `setup:demo` against production.
- [x] **7. First run.** Done 2026-09-13: login on the phone, timezone set, three connections green, one run with every job ok. No digest, and none expected: the orchestrator queues one only when there is an alert, and the database is empty. Email delivery is unproven until the first alert; the Resend signup address must match the digest recipient. Push not yet enabled. Log in on the phone. Settings > General: timezone.
      Settings > Connections: paste Anthropic, Voyage, Resend; all three green
      (new rows, encrypted with the new key). Dashboard: Run now. Agent Log:
      one run, no failed job. Inbox: one digest. Share > Add to Home Screen,
      then Settings > Notifications > Devices, enable push. Tell me the date
      and what Agent Log showed.
- [x] **8. Two GitHub repo secrets for the backup workflow:** Done 2026-09-13: run 34779333979 green, dump `pos-2026-09-13.sql.gz` committed to pos-backups, cron check counted 4 runs.
      `BACKUP_DATABASE_URL` (the session mode pooler URL, port 5432) and
      `BACKUP_REPO_TOKEN` (fine-grained, contents write on `pos-backups`
      only). Run the Backup workflow once by hand and check the dump landed.
      Phase 5's cron check rides on the same secret.
- [x] **9. Vercel firewall:** Done 2026-09-13: Bot Protection on in Log mode.
      Attack Challenge Mode stays **off**: tested on, it answered 429 to every
      non-browser request, which blocks the Health Auto Export webhook,
      `/api/mcp` and possibly the cron. Vercel documents it as a temporary
      under-attack switch (1h to 24h), not a setting.
- [ ] **10. Optional: a card on Voyage.** Verified 2026-09-08: without one the
      account is limited to 3 requests a minute; the 200M token free allowance
      still applies with a card. Until then Search says when it fell back to
      word matches.

## Phase 3: integrations

Each has a client, a real Test button and a nightly sync job. None is
connected, because each needs an account only you have.

- [ ] **11. Strava.** Deferred by you 2026-09-13. Since June 2026 Strava
      requires an active subscription ($11.99 a month) to create an API app,
      so it is no longer free. Apple Watch workouts reach Apple Health without
      it. If you ever subscribe: register at strava.com/settings/api with the
      callback domain `pos-gilt-rho.vercel.app` (bare host), put
      `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` in Vercel and
      `.env.production`, redeploy, Connect on Settings.
- [ ] **12. Obsidian vault**, free, about 5 minutes. A private repo and a
      fine-grained token with Contents: Read-only on that one repo. The client
      has no write path, so a write scope would be pure downside. Connect on
      Settings; Test names the repo and its markdown count.
- [x] **13. SimpleFIN**, about $1.50 a month. Connected by you before 2026-09-20 (verify: the date is not recorded; the Connections card shows it). Subscribe at bridge.simplefin.org,
      connect your banks there, paste the setup token. The token is claimed
      once and cannot be reclaimed, so the claim happens on save; Test only
      reads and is safe to repeat.

## Phase 4: Apple Health

Two sources are built and live in production (PRs #17, #18, #19, all
2026-09-13). Both write the same Fitness rows.

- [ ] **14. Build the readings Shortcut**, free, about 20 minutes once. The
      tap-by-tap recipe is docs/SETUP-INTEGRATIONS.md, section "Apple Health
      (Shortcuts)". Start with weight and steps, run it, see them on Fitness >
      Body, then add the rest of the keys. Then the daily 7:00 AM automation.
      Tell me what the run returns; the one place the recipe may not match
      your iOS is the Request Body control in Get Contents of URL.
- [x] **15. Workouts.** Connected 2026-09-18 and 90 days backfilled the same day (docs/SETUP-INTEGRATIONS.md, Backfill history). Native Shortcuts cannot read them (checked on your
      phone 2026-09-13: Find Health Samples has no Workouts type). When you
      want workouts in POS: Health Auto Export, Premium for one month ($1.99),
      its webhook is already built and tested. Copy the URL and secret from
      its Connections card into the app's REST automation as the
      `x-pos-secret` header, enable Workouts (export version 2), run once,
      cancel the subscription after if you like. Also export the same payload
      to a file (the app's share sheet) and drop it in the chat: the request
      log keeps no body, and that JSON is the fixture Phase 11 left open for
      `integrations/health_auto_export/client.test.ts`. Or say the word and I
      plan a native iOS companion app (exact, but a new codebase and a $99 a
      year developer account).

## Left over from the first run

- [ ] **16. Enable push on the phone.** Add POS to the Home Screen, open it
      from there, Settings > Notifications > Devices, enable. First use of
      the VAPID pair you generated for step 5.
- [x] **17. Digest email recipient.** Moot, settled 2026-09-14. Everything at
      `cmxlogic.com` forwards to `nicholascomeaux00@gmail.com`, which is also
      `OWNER_EMAIL` and the address the Resend account was created with. So
      Resend's "delivers only to the signup address" limit costs nothing:
      there is no second address to reach. The `digest_email` setting already
      points there. Verifying a domain in Resend buys cosmetics and a little
      deliverability, nothing functional.
- [x] **18. `DATABASE_URL` to transaction mode.** Done 2026-09-14. Session
      mode caps clients at the dashboard Pool Size of 15, and four warm
      functions at 4 connections each hit it, so every module page 500ed with
      `EMAXCONNSESSION` (31 in 7 days). Production moved to the transaction
      pooler on 6543. Confirmed from Vercel: zero runtime errors in the three
      hours after, against nine before. `BACKUP_DATABASE_URL` and the laptop's
      `.env.production` stay on 5432, because pg_dump and the setup scripts are
      one long session each.
- [x] **19. Sign in email through Resend.** Done 2026-09-14. Supabase custom
      SMTP through `smtp.resend.com`, sender `onboarding@resend.dev`. The first
      attempt set the sender to a `@gmail.com` address and Resend refused every
      send with `550 "The gmail.com domain is not verified"`, which surfaced as
      `/auth/v1/otp` returning 500 and no email at all. Delivery proved by a
      successful sign in at 19:01 UTC.
      Worth revisiting only if codes start landing in spam:
      `onboarding@resend.dev` is Resend's shared sandbox sender, so its
      reputation is not yours. The fix then is a verified domain in Resend, on
      a subdomain like `send.cmxlogic.com` rather than the root, so the SPF
      record cannot collide with the root's existing mail.
- [x] **20. Sign in email template and OTP length.** Done 2026-09-14. The
      Magic Link template carries `{{ .Token }}`, so the email holds both a
      code and a link. Email OTP Length is 6, matching `otp_length` in
      `supabase/config.toml`; the two disagreeing (8 in production, 6 locally)
      is how a login screen that assumed 6 truncated every code and reported
      the owner's correct code as wrong. The screen no longer assumes a length,
      but keep the two the same.
- [x] **21. Turn on passkeys.** Done 2026-09-14, against
      `pos-gilt-rho.vercel.app` rather than waiting for a custom domain, which
      was the owner's call. Enabled in Authentication > Passkeys with Relying
      Party Display Name `POS`. One credential registered at 20:04 from Apple
      Passwords and used to sign in at 20:30, both confirmed in
      `auth.webauthn_credentials`. It is `backed_up`, so it lives in iCloud
      Keychain and survives losing the phone rather than being tied to one
      device.
      **A passkey is bound to the relying party ID it was created against.**
      Moving POS to a custom domain makes this one stop working, and it will
      look like a broken login rather than a config change. When that happens:
      update the RP ID and origins in the dashboard, delete the old passkey in
      Settings > General, and add a new one. The emailed code is the way in
      meanwhile.

## v1.2 Phase 7a: Google Calendar

- [ ] **22. Google Cloud OAuth client**, free, about 15 minutes, needed to use
      Phase 7a (nothing breaks without it). The exact clicks are in
      docs/SETUP-INTEGRATIONS.md, Google, step 1: a `Holon` project and app name, a home page and a privacy policy link on Branding, the Google
      Calendar API enabled, an External consent screen with the
      `calendar.readonly` scope, publishing status **In production** (not
      Testing: Testing expires the refresh token after 7 days), a Web
      application client with both redirect URIs, and `GOOGLE_CLIENT_ID` and
      `GOOGLE_CLIENT_SECRET` in Vercel and `.env`. Then Settings >
      Connections > Google > Connect, click through the unverified app
      warning, pick calendars under the card, and press Sync on the Calendar
      screen. Tell me the count the toast shows ("N events from M calendars")
      so it goes in STATUS.md. Phase 7c later enables the Gmail API on the
      same project, adds `gmail.readonly`, and asks for one more Connect.

## Holon release, on your phone (after the `holon` to `main` merge)

- [ ] **23. Check the installed app on the phone**, about 10 minutes, once. The
      redesign was verified in a desktop browser at phone width, not on the
      device, so these are the checks only a phone can make. Open the Home
      Screen app (or reinstall it if the icon or name did not update): the
      icon is the Holon knot on charcoal and the splash the kit one; the app follows the
      phone's light or dark setting until you pick one in the rail footer;
      the tab bar clears the home indicator; a drawer's footer stays above
      the keyboard when a field inside it is focused (Tasks, new task; Meals,
      log a meal); the Today page, the tasks board and a task drawer scroll
      without a sideways wobble; a pull on a sheet's handle closes it. If
      the old icon shows after a reinstall, the phone cached the manifest:
      remove the app, clear the site in Safari settings, add it again.

## v1.2, in the order the phases need them (docs/plans/pos-v1-2.md)

- [ ] **24. Publish the iCloud calendars and paste their URLs**, free,
      5 minutes, now that Phase 7b has shipped. Calendar.app, right click a
      calendar, **Share Calendar**, tick **Public Calendar**, **Copy Link**
      (on iPhone: Calendar > Calendars > the (i) > Public Calendar > Share
      Link). Paste the first into **Settings > Connections > iCloud and other
      calendars > Calendar URL**, Save & test; add the rest under the card.
      A published calendar is readable by anyone with the URL, so publish the
      ones you would put on a shared screen and skip the rest. Then tell me
      how many events the card reports per calendar, so the count goes in
      STATUS.md the way the Google one will. Full steps:
      docs/SETUP-INTEGRATIONS.md, "iCloud and other calendars".
- [ ] **25. Build the Reminders Shortcut**, free, 10 minutes, now that Phase
      7b has shipped. **Settings > Connections > Apple Reminders > Enable
      webhook**, then build `POS Reminders` tap by tap from
      docs/SETUP-INTEGRATIONS.md, "Apple Reminders": Find Reminders (not
      completed), a dictionary per reminder, POST to the inbound URL with the
      `x-pos-secret` header, and a 7:05 AM daily automation. Two things to
      know: it must post **every** open reminder each run (a reminder missing
      for two days is treated as done), and nothing travels back to Apple, so
      completing a task in POS leaves the reminder standing.
- [ ] **26. USDA FoodData Central key**, free, 2 minutes, before Phase 12.
      api.data.gov, request a key with your email, paste it into the USDA
      card in Settings > Connections.
- [ ] **27. Run "Pull 90 days" on Finance** after Phase 5a deploys and
      compare one account's transaction count with the bank's own list for
      the same window. Tell me the two numbers.
- [ ] **28. Label three emails `POS` in Gmail** after Phase 7c deploys (a
      reservation, a bill, an invite) and check the proposals on Review.

## Decisions I would like from you

- [ ] **Confirm one deviation from "no monospace anywhere".** Literal secrets
      and shell commands render in the system monospace stack: the webhook
      shared secret, the inbound URL, the cron expression. No webfont is
      downloaded, so the one-family rule holds for anything that is type, but
      a base64 secret in Manrope is harder to check character by character.
      Say the word and I will move them to Manrope.

Resolved 2026-09-12, in decisions/log.md: `digest_morning_at` becomes a label
(Phase 1); the three table simplifications are amended into SPEC; Vercel
Authentication off for production; Vercel on Node 22; a red CI check is a
manual gate.

## Not this repo

Parked here from an earlier session; they belong to soltreya-ops.

- [ ] Push the soltreya-ops branch `fix/code-review-2026-07` (commit `a3b195d`,
      which comments out the five leadgen cron schedules, exists only on your
      laptop): `git push -u origin fix/code-review-2026-07`.
- [ ] Check the Trigger.dev Schedules page for soltreya-ops: the five
      `leadgen-*` entries should be gone after that deploy, the other nine
      still there.
- [ ] Decide about `refresh-industry-signals`, which still commits to
      soltreya-web daily and redeploys a site whose database is paused.

## Done

- [x] 2026-09-12 The Skill Tree's third digest bullet is computed
      (`modules/skills/pressure.ts`). No SPEC change.
- [x] 2026-09-09 Strava and the Obsidian vault have real Test buttons and
      clients; Strava has a nightly `fitness.sync_strava` job. SimpleFIN
      followed the same day.
- [x] 2026-09-09 The Vercel project `pos` was created and connected to the
      GitHub repo (found 2026-09-12 through the Vercel connector; the earlier
      checklist still said to create it).
- [x] 2026-09-08 Created the private `pos-backups` repo under `Ncomeaux3`.
- [x] 2026-09-08 Pasted the Anthropic, Resend and Voyage keys locally, and
      widened the Resend key to full access so its Test passes.
- [x] 2026-09-08 Registered the MCP server with Claude Code (the first attempt
      sent an empty bearer token because $MCP_TOKEN was in .env, not the shell).
- [x] 2026-09-08 Chose nicholascomeaux00@gmail.com as the digest recipient,
      stored as the `digest_email` setting, separate from OWNER_EMAIL.
- [x] 2026-09-08 Pasted the Voyage key; semantic search verified.
- [x] 2026-09-08 Confirmed the ComeauxVerse logo; `brand/` read only.
- [x] 2026-09-05 Created `.env` from the local Supabase values.
- [x] 2026-09-05 Chose Node 22 over the installed 24, corepack + brew for
      tooling, and let me start Docker Desktop.
- [x] 2026-09-05 Narrowed the `.env` deny rule so I can maintain `.env.example`.
- [x] 2026-09-05 Chose 1024-dimension embeddings and `mcp-handler` for MCP.
- [x] 2026-09-05 Chose direct pg for core over exposing schemas to PostgREST.
