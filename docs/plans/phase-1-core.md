# Phase 1: core

Build item 1 of the build order. When this is done, the app runs on Vercel, one owner can log in, the Connections page connects Anthropic, Voyage, and Resend, a stub module shows up through the manifest system, the nightly job runs end to end and sends one email, Claude Code can call the MCP endpoint, and a fork can bootstrap with `pnpm setup`.

Read docs/ARCHITECTURE.md first. Every step lists the files, the test that proves it, and the done condition. Tests come before code. Commit after each step. Work on branch `phase-1-core`, merge to main at the end.

## Prerequisites (owner does these by hand)

- Accounts: Supabase project (prod), Vercel, GitHub repo `pos` (created by the architecture session), Resend, Anthropic API key, Voyage AI key.
- Local: Docker Desktop running, `pnpm`, Node 22, Supabase CLI, `gh` logged in.
- Supabase project settings: disable email signups. Note the project ref, anon key, service role key, and DB connection string.

## Step 0: verify the vendor facts marked "verify"

Run `/research` on each and log the result in decisions/log.md before touching code:
1. Vercel Hobby: cron frequency limit, function max duration, fluid compute availability, Firewall features on Hobby.
2. Voyage AI: current lite model name, dimensions, free monthly allowance, price per million tokens.
3. Resend free tier: daily and monthly send limits, whether a verified domain is required to send to your own address.
4. Supabase free tier: storage quota, project pause policy on inactivity, pgvector availability, connection pooler URL for GitHub Actions.
5. MCP: current TypeScript SDK package and the recommended way to serve streamable HTTP from a Next.js route handler.
6. SimpleFIN Bridge: price and access URL format (needed only for the manifest fields, not connected in Phase 1).

Done when: each item has a dated line in decisions/log.md and any plan step below that depends on it is adjusted.

**Resolved 2026-09-05.** Ten lines appended to decisions/log.md. What changed below: Step 1 installs `mcp-handler` and `@modelcontextprotocol/server` and zod is v4; Step 2 uses `vector(1024)`; Step 11 uses `createMcpHandler` with `withMcpAuth`; Step 12 sets `maxDuration = 300` and needs no verified Resend domain; Step 14 dumps over the session mode pooler on port 5432; Step 15 treats Attack Mode as the free lever and checks bot protection in the dashboard.

## Step 1: scaffold

Files: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`, `.env.example`, `.gitignore` (add `.env*`, `!.env.example`, `imports/*`, `!imports/.gitkeep`, `supabase/.temp`), `vercel.json` (one cron: `0 9 * * *` to `/api/cron/nightly`), `app/manifest.ts` (PWA), `public/icons/`.

Commands: `pnpm create next-app@latest . --ts --tailwind --app --src-dir=false --eslint`, `pnpm dlx shadcn@latest init`, `pnpm add -D vitest @vitejs/plugin-react`, `pnpm add zod yaml @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk resend mcp-handler @modelcontextprotocol/server`, `supabase init`. zod resolves to v4, which `mcp-handler` 2.x requires.

Security headers in `next.config.ts`: `Content-Security-Policy` (self plus Supabase and Vercel domains), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal. Enable Dependabot with `.github/dependabot.yml` for npm weekly.

Test: `pnpm typecheck && pnpm lint && pnpm test` all pass with one placeholder test.

Done when: `pnpm dev` serves a blank page and `supabase start` boots locally.

## Step 2: core migration

File: `supabase/migrations/<ts>_core_init.sql`.

Contents: `create extension if not exists vector; create extension if not exists pgcrypto; create schema core;` then every table in ARCHITECTURE.md "Core schema" with `created_at`/`updated_at` defaults and an `updated_at` trigger. RLS enabled on every table with policies for `authenticated` (all) and grants for `service_role`. Role `pos_readonly` with `nologin` is created here; each module migration later grants it `usage` and `select` on that module's schema. Function `core.level(xp int) returns int` as `least(99, floor(sqrt(xp / 100.0)))::int`. View `core.skill_xp` joining events to skill_links to a weights table `core.xp_weights` (seeded from `config/xp.yaml` by setup). `core.embeddings.embedding` is `vector(1024)`, the voyage-4-lite default. HNSW index on it. GIN index on `tsv`.

Tests (`core/db.test.ts`, run against local Supabase): migration applies cleanly on a fresh `supabase db reset`; anon role cannot select from `core.settings`; `core.level(0)=0`, `core.level(100)=1`, `core.level(2500)=5`, `core.level(10000000)=99`.

Done when: `supabase db reset` succeeds and the tests pass. Run `supabase gen types typescript --local > core/database.types.ts`.

## Step 3: auth and shell

Files: `core/db.ts` (browser client, server client from cookies, service client, readonly client), `core/auth.ts` (`requireOwner()` reads session, compares to `OWNER_EMAIL`, redirects otherwise), `middleware.ts`, `app/(auth)/login/page.tsx` (email field, magic link), `app/(app)/layout.tsx` (sidebar shell, nav placeholder), `app/(app)/page.tsx` (dashboard placeholder).

Test: `core/auth.test.ts` with a mocked session: owner email passes, another email is rejected, no session redirects.

Done when: you receive a magic link locally (Inbucket at the Supabase local URL), log in, see the shell. A second email address gets a rejection page.

## Step 4: crypto, settings, llm

Files: `core/crypto.ts` (AES-256-GCM, key from `ENCRYPTION_KEY` base64, output `iv:tag:ciphertext`), `core/settings.ts` (typed keys: `timezone`, `owner_name`, `digest_hour`, `llm_soft_cap_cents`), `app/(app)/settings/page.tsx` (form over those keys), `core/llm.ts` (`complete({ model, purpose, module, system, messages })` wraps the Anthropic SDK, inserts one `core.llm_calls` row with estimated cost from a price table in the same file marked with the verify date, throws `SoftCapExceeded` for `purpose='research'` when month to date passes the cap).

Tests: crypto round trip, tamper detection (flip one byte, expect throw), wrong key throws. Settings get returns default when the row is missing. llm with a mocked SDK: writes a ledger row, refuses research past the cap, allows classification past the cap.

Done when: tests pass and Settings page saves and reloads a timezone.

## Step 5: module registry and stub module

Files: `core/modules.ts` (`defineModule()` returning the typed manifest, `getModules()` reading `modules/_index.ts`), `scripts/gen-index.ts` (globs `modules/*/manifest.ts` and `integrations/*/manifest.ts`, writes both index files, wired as `prebuild` and `predev`), `app/(app)/[module]/[[...path]]/page.tsx` (looks up the module, picks the page by path, 404 otherwise, renders a "Connect <provider>" card when a `requires` entry is not connected), nav built from `getModules()` sorted by `nav.order`.

Stub module: `modules/notes/` with a `notes.note` table (title, body), one migration, `manifest.ts` (id `notes`, one page, tools `get_digest` and `write`, `guarded: []`, one job `nightly_digest` that counts notes created in the last 7 days), `seed.ts` (five notes), `README.md`. It is the smallest real module and stays in the template as the worked example.

Tests: `core/modules.test.ts` loads the index, asserts every manifest has a unique id, tool names are valid identifiers, pages keys have no leading slash. gen-index produces deterministic output (sorted).

Done when: `/notes` renders the stub page from the manifest with no route file of its own, and the nav shows Notes.

## Step 6: entities, events, xp, classify

Files: `config/skills.yaml` (the SPEC starting tree with keywords), `config/xp.yaml` (weights per event type), `core/events.ts` (`emit()`), `core/xp.ts` (`level()` mirroring SQL, `loadWeights()`), `core/classify.ts`, `core/entities.ts` (`register({ module, entityType, entityId, title, text })` doing entity insert, classify, emit).

Tests first: `core/xp.test.ts` (level formula matches the SQL function on 20 sample values by querying the DB), `core/classify.test.ts` (keyword hit writes rule link with confidence 1; no hit calls the mocked model and writes `model:` link; `is_manual` rows untouched; model failure twice writes `unclassified`). `core/events.test.ts` (emit stores `title_snapshot`).

Done when: creating a note in the stub module produces one entity, at least one skill link, and one event.

## Step 7: integration registry and Connections page

Files: `core/integrations.ts` (`defineIntegration()`, `getIntegrations()`, `getCredentials(id)` decrypts from `core.connections`, `saveCredentials`, `deleteCredentials`), `app/(app)/settings/connections/page.tsx` (one card per manifest: status, form for token type, Connect button for oauth2, URL plus secret for webhook, Test button, Disconnect), `app/api/integrations/[id]/oauth/callback/route.ts` (exchange code using manifest `tokenUrl`, store, redirect back), `app/api/integrations/[id]/webhook/route.ts` (check shared secret header, zod validate through manifest, call `manifest.webhook`).

Manifests: `integrations/anthropic`, `integrations/voyage`, `integrations/resend` (each token type with a real `test()` that makes one cheap call), `integrations/simplefin`, `integrations/strava`, `integrations/health_auto_export`, `integrations/github_vault` (defined with fields and a `test()` that is honest about being a stub until its module ships).

Refactor: `core/llm.ts` now reads the Anthropic key through `getCredentials('anthropic')`. Nothing reads a provider key from `.env` after this step.

Tests: every manifest has a unique id and a valid auth block; save then `getCredentials` round trips through encryption; callback route rejects a missing state; webhook route rejects a bad secret with 401 and a bad payload with 400.

Done when: on the Connections page you paste real keys for Anthropic, Voyage, and Resend, each Test shows ok, and the other four show Not connected with their forms visible.

## Step 8: search

Files: `core/search.ts` (`embedChanged()` batches entities whose `content_hash` differs, calls Voyage via `integrations/voyage/client.ts`, upserts; `search(query, opts)` runs one SQL statement with a vector CTE and a tsvector CTE merged by reciprocal rank), `app/(app)/search/page.tsx`.

Tests: RRF merge unit test on fixed rank lists; `content_hash` unchanged means no Voyage call (mocked client asserts zero calls); changed title means one call.

Done when: after seeding notes and running `embedChanged()`, a search for a word in a note title returns it, and a semantically related phrase returns it too.

## Step 9: proposals and review

Files: `core/proposals.ts` (`propose()`, `approve()` calls the module tool with `source='agent'`, `reject()`), `app/(app)/review/page.tsx`, guard logic in the tool dispatcher: when the caller is an agent and the tool is in `manifest.guarded`, write a proposal instead.

Tests: guarded tool via agent path creates a pending row and does not write the target; approve writes the target and marks approved; UI path bypasses the guard.

Done when: mark the stub module's `write` as guarded temporarily, call it through the MCP endpoint (Step 11), see it on Review, approve it, see the note. Revert the guard.

## Step 10: query tool, rate limit, request log, files

Files: `core/query.ts` (runs SQL through the readonly client with `set local statement_timeout = '5s'`, appends `limit 500` when absent, rejects anything that is not a single SELECT before sending), `core/ratelimit.ts` (Map of ip hash to timestamps, 60 per minute, `429` helper), `core/log.ts` (`withLog(handler)` wrapper writing `core.request_log`), `core/files.ts` (`upload(module, path, file)` to bucket `<module>`, `signedUrl()`). Apply `withLog` and the limiter to every route under `app/api/`.

Tests: query rejects `insert`, `delete`, multiple statements, and a table in another module's schema (role has no grant, expect a Postgres permission error); limiter allows 60 then returns 429; withLog writes a row with status and duration.

Done when: `notes.query` returns rows through MCP and an attempted `update` returns the Postgres error text.

## Step 11: MCP endpoint

File: `app/api/mcp/route.ts` using `createMcpHandler` from `mcp-handler`, wrapped in `withMcpAuth`, exported as both GET and POST. Registers `<id>.<tool>` for every module tool, `<id>.query`, and `core.search`. Bearer token check against `MCP_TOKEN`.

Tests: request without bearer gets 401; `tools/list` includes `notes.get_digest`, `notes.query`, `core.search`; calling `notes.get_digest` returns the digest payload.

Done when: `claude mcp add --transport http pos http://localhost:3000/api/mcp --header "Authorization: Bearer ..."` connects and `/mcp` inside Claude Code lists the tools.

## Step 12: jobs, notifications, orchestrator

Files: `core/jobs.ts` (`runNightly()` in the ARCHITECTURE order, each job wrapped in try/catch, result to `core.jobs`, cursor support via `log.cursor`), `core/notify.ts` (`queue()`, `sendPending()` bundling into one plain text email via `integrations/resend/client.ts`), `core/orchestrator.ts` (reads `core.digests`, assembles summary by rules: top 3 alerts, upcoming items, failed jobs, month to date spend; asks Haiku for a two sentence headline through `core/llm.ts`), `app/api/cron/nightly/route.ts` (checks `CRON_SECRET`, calls `runNightly`, `export const maxDuration = 300`), a Run now button on the dashboard, dashboard rendering `core.dashboard_summary`.

Tests: a job that throws is recorded as failed and the next job still runs; `sendPending` sends exactly one email for N notifications; orchestrator with fixture digests produces the expected summary JSON with the headline mocked.

Done when: hitting the cron route locally runs everything, the dashboard shows a summary with a headline, and one email arrives in your inbox. No Resend domain is needed: send from `onboarding@resend.dev` to the address the Resend account was created with.

## Step 13: setup script and demo seed

Files: `scripts/setup.ts` (checks every `.env.example` key exists in `.env`, runs `supabase db push`, seeds `core.settings` defaults and `core.xp_weights` from `config/xp.yaml`, creates the owner user via the admin API, prints next steps; `--demo` runs every module's `seed.ts`), `package.json` scripts: `setup`, `gen:index`, `gen:types`.

Test: setup against a fresh local stack completes; a second run is a no-op (idempotent); `--demo` twice does not duplicate rows (seeds upsert on `external_id`).

Done when: `supabase db reset && pnpm setup --demo` on a clean checkout yields a working app with five notes.

## Step 14: CI, backups, restore drill

Files: `.github/workflows/ci.yml` (pnpm install, typecheck, lint, `supabase start`, vitest), `.github/workflows/backup.yml` (nightly `pg_dump` over the session mode pooler on port 5432, stored as a secret; runners are IPv4 only and transaction mode on 6543 breaks `pg_dump`), gzip, commit to the private repo `pos-backups`, delete files older than 30 days), `docs/RESTORE.md` (the psql command and the drill).

Drill: take one dump from local, `supabase db reset`, restore with `psql`, confirm row counts match. Record the date in `docs/RESTORE.md`.

Done when: CI is green on the branch, the backup workflow has run once manually and a dump exists in `pos-backups`, and the drill is recorded.

## Step 15: deploy

- Vercel: import the GitHub repo, set every `.env` key as an environment variable, confirm the cron is registered. Attack Mode is free on Hobby; check whether the Bot Protection managed ruleset is offered on this plan in the dashboard and enable it if so.
- Supabase prod: `supabase link`, `supabase db push`, disable signups, run `pnpm setup` against prod.
- Log in on the deployed URL from your phone, add to home screen.
- Connect Anthropic, Voyage, Resend on the deployed Connections page.
- Press Run now. Confirm the email.
- Point Claude Code at the deployed MCP URL.

Done when: the next morning's 09:00 UTC run has a `core.jobs` row and an email.

## Step 16: docs and merge

Update `modules/notes/README.md`, `connections.md` statuses, `README.md` quickstart for forks, and CLAUDE.md Commands if any command changed. Run `/review phase-1-core`. Merge to main.

## Verification

Run and paste the output of each:

```
pnpm typecheck && pnpm lint && pnpm test
supabase db reset && pnpm setup --demo
curl -s -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/nightly
psql "$LOCAL_DB_URL" -c "select name, last_status from core.jobs order by last_run desc limit 10"
psql "$LOCAL_DB_URL" -c "select count(*) from core.embeddings"
psql "$LOCAL_DB_URL" -c "select headline from core.dashboard_summary order by run_at desc limit 1"
```

Expected: all tests pass; setup completes with five notes; cron returns 200; every job row shows `ok`; embeddings count equals five; a headline exists. Plus one email in the inbox, one MCP `tools/list` from Claude Code showing `notes.get_digest`, and CI green on GitHub.
