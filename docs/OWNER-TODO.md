# Owner to-do

Things only Nick can do: accounts, credentials, money, and calls that need a
judgement I should not make alone. Claude Code appends here rather than
blocking, and clears items once they are done and verified.

Format: `[ ]` waiting on you, `[x]` done, with the date and what unblocked.

## Blocking now

- [ ] **Rotate the Voyage key when convenient.** It was pasted into a chat
      message, so it lives in that transcript as well as in the encrypted row.
      Nothing urgent: it is scoped to embeddings against a free allowance, and
      the stored copy is encrypted. Generate a new one at dash.voyageai.com and
      paste it on the Connections page whenever you want it clean.

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

- [ ] **SimpleFIN, Strava, Health Auto Export, and the Obsidian vault have stub
      Test buttons.** The plan specified this: their modules have not shipped, so
      their Test returns "Not verified" rather than pretending. The consequence
      is that a wrong SimpleFIN access URL or GitHub token would not be caught
      until that module gets built, possibly months later. SimpleFIN's real check
      is a single GET and I could write it now. Want me to, or leave it as the
      plan specified?
- [ ] **Strava OAuth needs an app registration before its Connect button can
      work.** `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are blank in `.env`,
      so the button currently redirects back with a message saying so. Nothing
      needs it until the Fitness module, so this is only worth doing if you want
      the flow proven end to end now.
- [ ] **`RESEND_FROM` is unset, so the digest will send from
      `onboarding@resend.dev`.** That works and needs no domain. If you would
      rather it come from your own domain, verify one in Resend and set the
      variable; I would then also want to re-check the free tier assumption,
      since sending to addresses other than your own changes what is allowed.

## Step 15, deploy. This is what is left.

Nothing in the codebase blocks it. These are the accounts and secrets only you
can create, roughly in the order they are needed.

- [ ] **Create a Supabase project for production**, note the project ref, then
      `supabase link --project-ref <ref>` and `supabase db push`. Disable email
      signups in the dashboard: there is one owner and no signup flow.
- [ ] **Set the hosted email OTP expiry to 900 seconds**, so the 15 minute
      countdown on the login screen is true.
- [ ] **Create the Vercel project** from the GitHub repo and set every `.env`
      key as an environment variable. `ENCRYPTION_KEY` must be the same value
      as local or the stored provider keys cannot be decrypted; generate fresh
      values for `CRON_SECRET` and `MCP_TOKEN`. Confirm the cron shows as
      registered after the first deploy.
- [ ] **Add two GitHub repo secrets** for the backup workflow:
      `BACKUP_DATABASE_URL`, the Supabase session mode pooler URL on port 5432,
      and `BACKUP_REPO_TOKEN`, a fine-grained token with contents write on
      `pos-backups` only.
- [ ] **Run `pnpm setup` against production**, then paste the three provider
      keys again on the deployed Connections page. They are encrypted per
      environment and do not travel.
- [ ] **Turn Attack Mode on** in the Vercel firewall, and check whether the Bot
      Protection managed ruleset is offered on Hobby. The docs do not state a
      plan gate, so I did not assert one either way.

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
