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

- [ ] **11. Strava**, free, about 5 minutes. Register an app at
      strava.com/settings/api with the callback domain `pos-gilt-rho.vercel.app`
      (bare host, no scheme, no path; `localhost` for local). `STRAVA_CLIENT_ID`
      and `STRAVA_CLIENT_SECRET` into `.env` and Vercel. Connect on Settings.
- [ ] **12. Obsidian vault**, free, about 5 minutes. A private repo and a
      fine-grained token with Contents: Read-only on that one repo. The client
      has no write path, so a write scope would be pure downside. Connect on
      Settings; Test names the repo and its markdown count.
- [ ] **13. SimpleFIN**, about $1.50 a month. Subscribe at bridge.simplefin.org,
      connect your banks there, paste the setup token. The token is claimed
      once and cannot be reclaimed, so the claim happens on save; Test only
      reads and is safe to repeat.

## Phase 4: Apple Health

- [ ] **14. Buy Health Auto Export on iOS**, and send me one real export (or
      its metric identifier strings) so the mapping is verified rather than
      guessed. After the code ships: copy the inbound URL and secret from the
      Connections card into the app's REST automation as the `x-pos-secret`
      header; enable weight, resting heart rate, HRV, body fat and sleep; daily
      schedule. Readings land in `fitness.body_metric`; a value you typed by
      hand is never overwritten.

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
