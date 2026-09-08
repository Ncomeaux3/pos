# Owner to-do

Things only Nick can do: accounts, credentials, money, and calls that need a
judgement I should not make alone. Claude Code appends here rather than
blocking, and clears items once they are done and verified.

Format: `[ ]` waiting on you, `[x]` done, with the date and what unblocked.

## Blocking now

- [ ] **Paste the Voyage key so semantic search turns on.** Search already
      works on full text: five notes index and every probe query returns the
      right one. What is missing is meaning, so a search for "barbell" will not
      find "Deadlift form check" until Voyage is connected. The nightly index
      picks up every un-embedded row on the first run after the key lands, so
      nothing needs re-running by hand.

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

## Later phases

- [ ] **Step 14**: create the private `pos-backups` GitHub repo, and add the
      Supabase session-mode pooler URL (port 5432) as a repo secret.
- [ ] **Step 15**: Vercel project, Supabase prod project, every `.env` key set
      as an environment variable, signups disabled in prod, Attack Mode on.
- [ ] **Step 15**: set the email OTP expiry to 900 seconds in the hosted
      project's auth settings. `supabase/config.toml` sets it locally, and the
      login screen counts down from 15 minutes, so prod has to agree or the
      timer on screen is a lie.
- [ ] **Step 15**: confirm in the Vercel dashboard whether the Bot Protection
      managed ruleset is offered on Hobby. The docs do not state a plan gate, so
      I did not assert one either way.

## Done

- [x] 2026-09-05 Created `.env` from the local Supabase values, which unblocked
      Steps 3 onward.
- [x] 2026-09-05 Chose Node 22 over the installed 24, corepack + brew for
      tooling, and let me start Docker Desktop.
- [x] 2026-09-05 Narrowed the `.env` deny rule so I can maintain `.env.example`
      while `.env` itself stays out of my reach.
- [x] 2026-09-05 Chose 1024-dimension embeddings and `mcp-handler` for MCP.
- [x] 2026-09-05 Chose direct pg for core over exposing schemas to PostgREST.
