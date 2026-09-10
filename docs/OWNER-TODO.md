# Owner to-do

Things only Nick can do: accounts, credentials, money, and calls that need a
judgement I should not make alone. Claude Code appends here rather than
blocking, and clears items once they are done and verified.

Format: `[ ]` waiting on you, `[x]` done, with the date and what unblocked.

## Blocking now

- [ ] **Finish the Voyage rotation by deleting the old key.** 2026-09-09: a new
      Voyage key was generated, and a new Anthropic one alongside it. Verified
      the same evening that all three local connections still test green, which
      means **the old keys were not revoked and are still live**. Generating a
      replacement does not rotate anything on its own: the exposed key keeps
      working until it is deleted at dash.voyageai.com. Do the same for the old
      Anthropic key at console.anthropic.com if replacing it was deliberate.
      Then re-test on Settings > Connections, local and production.

- [ ] **Add a payment method to Voyage, or accept three searches a minute.**
      Verified 2026-09-08: without a card on file the account is limited to
      3 RPM and 10K TPM, and every search that uses meaning costs one request.
      Adding a card does not start charging, the 200M token free allowance
      still applies; it lifts the rate limit. Until then the Search page tells
      you when it fell back to word matches, repeated queries come from an
      in-process cache, and the command palette never embeds at all. Nightly
      indexing is one batched request, so it is unaffected either way.

- [ ] **Confirm one deviation from "no monospace anywhere".** Literal secrets
      and shell commands render in the system monospace stack: the webhook
      shared secret, the inbound URL, the cron expression. No webfont is
      downloaded, so the one-family rule still holds for anything that is type,
      but a base64 secret in Manrope is genuinely harder to check character by
      character. Say the word and I will move them to Manrope.

Step 7's code is built, tested, and committed. Its done condition is the one
thing I cannot do: it needs your real keys.

- [ ] **Paste three provider keys at http://localhost:3000/settings/connections.**
      Type the key, press Connect, and the card runs Test on save. All three
      should turn Connected with a green dot.
      - **Anthropic** (`sk-ant-...`): console.anthropic.com > API keys. Test
        lists models, which costs nothing. Until this is connected,
        classification falls back to `unclassified` whenever the keyword rules
        miss, which is why one of the five demo notes is unclassified today.
      - **Voyage** (`pa-...`): dash.voyageai.com > API keys. Test embeds the
        single word "ping", a few tokens against a 200M free allowance, and
        checks the result really is 1024 dimensions.
      - **Resend** (`re_...`): resend.com/api-keys. Test lists keys and sends
        nothing. No domain needed: the digest only ever emails your own signup
        address.
      The other four (SimpleFIN, Strava, Health Auto Export, Obsidian vault)
      should stay Not connected with their forms visible. That is the expected
      end state for Phase 1.

## Decisions I would like from you

- [x] **2026-09-09. Strava and the Obsidian vault have real Test buttons now**,
      and clients behind them. Strava also has a nightly `fitness.sync_strava`
      job. SimpleFIN and Health Auto Export are still stubs, by your choice:
      SimpleFIN costs about $1.50 a month and Health Auto Export needs the paid
      iOS app. Say the word on either and they are a similar amount of work.
- [ ] **Strava needs an app registration.** `STRAVA_CLIENT_ID` and
      `STRAVA_CLIENT_SECRET` are still blank in `.env`, so Connect redirects
      back with a message saying so. Free, about five minutes, and the sync job
      is built and waiting. Step by step in docs/SETUP-INTEGRATIONS.md.

- [ ] **The Obsidian vault needs a private repo and a fine grained token.**
      Contents: Read-only on one repository is the whole permission set. This is
      the biggest single unlock left: Second Brain has the review step built and
      nothing to review. docs/SETUP-INTEGRATIONS.md.

- [ ] **Create the hosted Supabase project.** Full walkthrough in
      docs/SETUP-SUPABASE.md. Two settings in it are the ones the security
      review flagged and neither can be enforced from the repo: signup must be
      disabled, and exposed schemas must stay `public, graphql_public`. Every
      RLS policy in the app trusts `authenticated`, so those two settings are
      what make that trust reasonable.
- [ ] **`RESEND_FROM` is unset, so the digest will send from
      `onboarding@resend.dev`.** That works and needs no domain. If you would
      rather it come from your own domain, verify one in Resend and set the
      variable; I would then also want to re-check the free tier assumption,
      since sending to addresses other than your own changes what is allowed.

## Step 15, deploy. This is what is left.

Nothing in the codebase blocks it. Full walkthrough with the exact commands is
in **docs/SETUP-SUPABASE.md**; this is the checklist.

- [ ] **Create the Supabase project**, then `supabase link --project-ref <ref>`
      and `supabase db push`. 24 migrations. Never `db reset` against it.
- [ ] **Disable email signups**, and confirm **exposed schemas** stays
      `public, graphql_public`. These two are the whole of the security review's
      top finding: every RLS policy trusts `authenticated`, and neither setting
      can be enforced from the repo. Do not skip them.
- [ ] **Set the hosted email OTP expiry to 900 seconds**, so the 15 minute
      countdown on the login screen is true.
- [ ] **Create the Vercel project** and set every `.env` key.
      **Generate a fresh `ENCRYPTION_KEY` for production.** An earlier version
      of this file said to reuse the local one; that was wrong. The two
      databases hold different rows, the production one starts with none, and
      reusing the key spreads one secret across two places for no benefit. Put
      it in your password manager: losing it makes every stored credential
      unreadable with no recovery. Generate fresh `CRON_SECRET` and `MCP_TOKEN`
      too. Confirm the cron registers after the first deploy.
- [ ] **Set Supabase's Site URL** to the Vercel domain once you have it, or the
      magic link comes back to the wrong place.
- [ ] **Add two GitHub repo secrets** for the backup workflow:
      `BACKUP_DATABASE_URL`, the Supabase session mode pooler URL on port 5432,
      and `BACKUP_REPO_TOKEN`, a fine-grained token with contents write on
      `pos-backups` only.
- [ ] **Run `pnpm setup` against production**, then paste the three provider
      keys again on the deployed Connections page. They are encrypted per
      environment and do not travel.
- [ ] **Set your timezone** on Settings > General. Every date question goes
      through `core.today()`, and the database runs in UTC.
- [ ] **Turn Attack Mode on** in the Vercel firewall, and check whether the Bot
      Protection managed ruleset is offered on Hobby. The docs do not state a
      plan gate, so I did not assert one either way.

## Integrations. All three are built and waiting on your accounts.

Step by step for each in **docs/SETUP-INTEGRATIONS.md**. Every one has a real
Test button now, so you get a clear yes or no rather than "not verified".

- [ ] **Strava**, free, about 5 minutes. Register an app at
      strava.com/settings/api, put the client id and secret in `.env` and in
      Vercel. The callback domain is the bare host with no scheme and no path;
      a mismatch there is the usual reason Connect fails. Unlocks a nightly
      workout sync into Fitness.
- [ ] **Obsidian vault**, free, about 5 minutes. A private repo plus a
      fine-grained token with **Contents: Read-only** on that one repo. The
      client has no write path, so a write scope would be pure downside.
      Unlocks the nightly vault pull, which is what makes Second Brain hold
      your actual notes.
- [ ] **SimpleFIN**, about $1.50 a month. Subscribe at bridge.simplefin.org,
      connect your banks there, paste the setup token. **The token is claimed
      once and cannot be reclaimed**, which is why the claim happens on save;
      pressing Test afterwards only reads and is safe to repeat. Unlocks
      balances and transactions in Finance, which SPEC calls the highest daily
      value module.
- [ ] **Health Auto Export** is the one integration still a stub. It needs the
      paid iOS app. Worth doing after Strava, since it is the better source for
      sleep and resting heart rate.

## Decisions I would like from you

- [ ] **Three tables were renamed or collapsed without a spec amendment.**
      `finance.budget_lines` folded into `finance.budget`, `travel.bookings`
      into `itinerary_item`, `meals.meal_log` into `plan_entry`. All three read
      as reasonable simplifications. Amend SPEC to match the code, or change the
      code to match SPEC?
- [ ] **The Skill Tree's third digest bullet cannot be computed.** SPEC asks for
      "skills with high goal weight but low activity", and nothing anywhere
      stores a goal weight. Either goals grow a per-skill weight, or that bullet
      comes out of SPEC. It is currently hardcoded empty with a stale comment.

## Later phases

- [ ] **Push the soltreya-ops branch.** `fix/code-review-2026-07` has no
      upstream, so commit `a3b195d`, which comments out the five leadgen cron
      schedules, exists only on your laptop. The deploy is live either way.
      `git push -u origin fix/code-review-2026-07`.
- [ ] **Check the Trigger.dev Schedules page** for soltreya-ops: the five
      `leadgen-*` entries should be gone after that deploy, the other nine
      still there. I have no access to verify it.
- [ ] **Decide about `refresh-industry-signals`.** It still commits to
      soltreya-web daily, which redeploys a site whose database is paused.
      Harmless, but it is deploying a broken app once a day.

## Done

- [x] 2026-09-08 Created the private `pos-backups` repo. Verified: it exists
      under `Ncomeaux3`.

- [x] 2026-09-08 Pasted the Anthropic, Resend and Voyage keys, and widened the
      Resend key to full access so its Test passes. All three connected.
- [x] 2026-09-08 Registered the MCP server with Claude Code. The first attempt
      sent an empty bearer token because $MCP_TOKEN is in .env and not in the
      shell; re-registered sourcing the file.
- [x] 2026-09-08 Chose nicholascomeaux00@gmail.com as the digest recipient,
      which is what Resend will deliver to without a verified domain. Stored as
      the `digest_email` setting, separate from OWNER_EMAIL.
- [x] 2026-09-08 Pasted the Voyage key. Tested (voyage-4-lite, 1024 dimensions),
      stored encrypted in `core.connections`, five notes embedded. Semantic
      search verified: "barbell technique" finds "Deadlift form check" and
      "somewhere warm for a holiday" finds the Lisbon note, neither sharing a
      word with what it found.
- [x] 2026-09-08 Confirmed the ComeauxVerse logo. `brand/` was read only; the
      mark's path data is copied into `components/pos/Logo.tsx`, nothing in
      that repo was modified.
- [x] 2026-09-05 Created `.env` from the local Supabase values, which unblocked
      Steps 3 onward.
- [x] 2026-09-05 Chose Node 22 over the installed 24, corepack + brew for
      tooling, and let me start Docker Desktop.
- [x] 2026-09-05 Narrowed the `.env` deny rule so I can maintain `.env.example`
      while `.env` itself stays out of my reach.
- [x] 2026-09-05 Chose 1024-dimension embeddings and `mcp-handler` for MCP.
- [x] 2026-09-05 Chose direct pg for core over exposing schemas to PostgREST.
