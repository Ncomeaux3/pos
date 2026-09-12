# Backend live

Plan from /adopt-repo, 2026-09-12, approved the same day. Owner: Nick. The
app is built; this plan is what turns it from a working template running
against a demo seed into Nick's own system running in production, plus the
small amount of code that surfaced when the hosted state was checked.

Rules: one phase is one branch, one PR, one fresh session. A phase is Done
when its exit checks pass and its PR is merged. Tick boxes as they finish.

## Context

Twenty-one screens match the design handoff, thirteen modules have
migrations, tools, jobs, seeds and tests, and the nightly pipeline runs end
to end locally (docs/STATUS.md). Phase 1 of docs/plans/design-build.md has
one step left, step 15, deploy.

Done, as the owner defined it: he logs in on his phone at the production URL,
Run now succeeds with no failed job, the digest email arrives, and the cron
fires the next morning on its own. Then all four integrations.

## What the adoption pass verified

Through the Vercel and Supabase connectors, `gh`, and the repo, on 2026-09-12.

- A Vercel project `pos` exists (created 2026-09-09), deploys every push from
  GitHub, production alias `pos-gilt-rho.vercel.app` READY from `main`, no
  runtime errors in 7 days. The old owner checklist's "create the Vercel
  project" was stale.
- Vercel Authentication was on for every non-custom domain, so production sat
  behind a Vercel login as well as the app's owner login. Vercel built on
  Node 24; the repo, CI and the laptop run 22.
- A hosted Supabase project exists but migrations, `pnpm setup` and the
  Vercel environment were not done (owner's answer; the connector's account
  does not see the project, so the ref is his to confirm).
- Production defect: the login page's email input renders a thrown-error
  string as its class. `fieldClass` is a string exported from the
  `'use client'` module `components/pos/edit.tsx`, and the server-rendered
  `app/(auth)/login/page.tsx` interpolates it. In a production build a client
  module's exports are client references, so the string is a function. Dev
  does not show it and CI never ran `next build`.
- Production audit (thirteen layers): present 6, partial 7, absent 0. The
  readiness table below settles every row.
- `RESEND_FROM` is read by `integrations/resend/client.ts` and exempted by
  `scripts/setup.ts` but missing from `.env.example`.
- Integrations: Anthropic, Voyage, Resend, SimpleFIN, Strava and the GitHub
  vault have real clients and Test buttons. Health Auto Export is the one stub.

## Decisions

Logged in decisions/log.md under 2026-09-12. In short: planning files follow
the repo's layout; `AGENTS.md` is ignored; `digest_morning_at` becomes a
label; Vercel Authentication off for production; SPEC amended to the three
collapsed tables; Vercel on Node 22; a red CI check is a manual merge gate and
`pnpm build` joins CI; Apple Health readings land in `fitness.body_metric`
through a new optional `inbound` seam on the module contract; the cron-silence
check is one step in the backup workflow.

## Owner to-do, in order

The full list with the walkthrough pointers is docs/OWNER-TODO.md. Each step
names the phase it unblocks.

## Phases

| Phase | Goal | Complexity | Parallel-safe with | Status | PR |
|---|---|---|---|---|---|
| 0 | Planning files and owner checklist | low | | PR open | #12 |
| 1 | Hygiene and the production login fix | low | 4, 5, 6 | Not started | |
| 2 | Production live: first real nightly | low (code), owner-heavy | 4, 5, 6 | Blocked on owner steps 2 to 7 | |
| 3 | Strava, vault, SimpleFIN connected and syncing nightly | low | 4, 5, 6 | Blocked on 2 and owner steps 11 to 13 | |
| 4 | Health Auto Export webhook writes body metrics | medium | 1, 5, 6 | Not started | |
| 5 | Cron-silence check | low | 1, 4, 6 | Not started | |
| 6 | PR #10 skill tree zoom finished and merged | medium | 1, 4, 5 | #10 merged 2026-09-12; the re-checks continue on `fix/skill-tree-zoom` | #10 |

Parallel-safe means different files; 1, 4, 5 and 6 can run in separate
worktrees. 2 and 3 are mostly waiting on the owner.

---

### Phase 0: planning files

Tasks:
- [x] `docs/plans/backend-live.md` (this file)
- [x] `docs/OWNER-TODO.md` rewritten around the ordered list; the Vercel project marked as existing; soltreya-ops items moved under "Not this repo"
- [x] `docs/SPEC.md` amended for the three collapsed tables
- [x] `decisions/log.md` entries
- [x] `docs/STATUS.md` points here
- [x] `docs/SETUP-SUPABASE.md`: 27 migrations, Node 22, Deployment Protection, a rollback paragraph
- [x] `CLAUDE.md`: tools for this project; the red-check rule
- [x] `.gitignore`: `AGENTS.md`

Exit checks:
- PR on `docs/adopt-planning`, CI green. Result 2026-09-12: `check` green, `screens` red with the 7 pre-existing failures moved into Phase 1; merged as the one exception to the red-check rule, logged in decisions/log.md

Out of scope: any application code.

### Phase 1: hygiene and the production login fix

Goal: the production login input is styled, CI would have caught it, and the
two stale controls and the missing env line are fixed.

Tasks:
- [ ] Move `fieldClass` out of `components/pos/edit.tsx` into a leaf module with no `'use client'` and no imports (pattern: `core/owner.ts`); re-export from `components/pos/index.ts` so every importer keeps working; `edit.tsx` imports it back
- [ ] `.github/workflows/ci.yml`: `pnpm build` after `pnpm typecheck` in the `check` job. If the build needs a value the synthetic `.env` lacks, add it the way the VAPID keys were
- [ ] `.env.example`: `RESEND_FROM=` with its comment (optional, defaults to onboarding@resend.dev)
- [ ] The `screens` CI job goes green. The e2e suite first ran in CI on 2026-09-12 (every earlier run died at `setup:demo` for want of VAPID keys) and 7 of 185 fail because they assume the owner's laptop: `settings, connections` wants a CONNECTED card the CI database has none of; `settings notifications, push says what it needs` wants "Push is not configured" while CI now sets VAPID keys; `dashboard shell` wants the Finance, Tasks, Goals and Skill Tree tiles; `tasks, completing one emits the event` hits a strict-mode duplicate on mobile; `skill tree, a trackpad burst zooms smoothly` is a timing assertion on a slow runner. Each test asserts the state the CI seed and `.env` actually produce, or the seed produces the state; no assertion is loosened to pass
- [ ] `digest_morning_at`: the Notifications page schedule card (`app/(app)/notifications/page.tsx`, `Rules.tsx`) and the Onboarding step show the cron time in the owner's zone as a read-only line, reusing the helper `app/(app)/settings/page.tsx` has for "0 9 * * * UTC · 04:00 CDT". The key stays in `core/settings.ts` so stored rows still parse; nothing writes it; the two action allow-list entries go

Exit checks:
- `pnpm typecheck && pnpm lint && pnpm test` pass
- `pnpm build` succeeds locally, and a fetch of `/login` from `pnpm start` shows the input's class beginning `w-full rounded-md`
- CI green including the new build step and the `screens` job, the first fully green run on `main`
- `pnpm test:e2e --grep "login|onboarding"` green

Depends on: nothing. Out of scope: the cron-silence step, Apple Health.

### Phase 2: production live

Goal: the first real nightly in production, then one from the cron.

Tasks:
- [ ] After owner step 5: the Vercel connector shows the latest production deployment READY and no runtime errors
- [ ] After Phase 1 merges and redeploys: fetch `https://pos-gilt-rho.vercel.app/login` and confirm the input's class is the real string
- [ ] After owner step 7: the owner reports the Agent Log run (every job listed, none failed) and the digest email; record the date in docs/STATUS.md
- [ ] Next morning: a second run with trigger cron in Agent Log, and a second email
- [ ] Tick the owner steps in docs/OWNER-TODO.md with dates

Exit checks:
- Two consecutive production runs with no failed job, one by hand and one by cron
- Login from a phone with no Vercel login screen in front of the app

Depends on: owner steps 2 to 7. Out of scope: integrations.

### Phase 3: integrations connected

Goal: Strava, the vault and SimpleFIN sync nightly with the owner's rows.

Tasks:
- [ ] Strava: Test says "Connected as {name}"; the next Agent Log shows `fitness.sync_strava` ok with a count; Fitness lists real workouts
- [ ] Vault: Test names the repo and its markdown count; `brain.pull_vault` ok; Second Brain lists real notes (a large vault fills over several nights, 300 files each)
- [ ] SimpleFIN: Test lists accounts; `finance.sync_simplefin` ok; Finance shows balances; after the second night `categorise` and `detect_subscriptions` have rows
- [ ] docs/SETUP-INTEGRATIONS.md state table says Connected where true

Exit checks:
- One Agent Log run with all three sync jobs ok
- The owner confirms each module screen shows his own rows

Depends on: Phase 2, owner steps 11 to 13. Out of scope: Health Auto Export.

### Phase 4: Health Auto Export webhook

Goal: a payload from the iOS app lands as rows in `fitness.body_metric`, and
the Connections card's Test says when the last one arrived.

Shape, verified against the schema: `fitness.body_metric` has
`unique (kind, measured_on)`, a `source` column that already permits
`'health_auto_export'`, and no `is_manual` column; the manual guard on this
table is `source = 'manual'`, which is what `log_metric` stamps. No migration.

Direction, the same as Strava: the integration owns a pure translation and the
module owns the write and imports the integration's client. A push has no
module-side job to pull through, so the module manifest gains one optional
seam, `inbound`, keyed by integration id, and the generic webhook route
dispatches to it after the manifest's zod schema has validated. Core names no
module and no integration. Rejected: an integration-owned staging table with a
nightly drain (a new concept, a migration, readings a day late); the
integration calling `callTool` (an import cycle through the module index, and
a proposal for every scale reading at autonomy observe).

Tasks (tests first):
- [ ] `modules/fitness/inbound.test.ts`, DB-backed like `modules/goals/checkin.test.ts`: (1) 185.2 lb becomes `weight` 84005 g, 52 bpm becomes `resting_hr`, 7.5 h sleep becomes 450 `sleep_minutes`, 18.4 % becomes `body_fat` 184, `measured_on` is the date part; (2) a `source = 'manual'` row on the same `(kind, measured_on)` keeps its value and a `'health_auto_export'` row is corrected; (3) `step_count`, an unknown name and `data.workouts` write nothing; (4) a record whose date is not `yyyy-MM-dd HH:mm:ss Z` is skipped and the good record beside it lands
- [ ] `core/integration-routes.test.ts`: one case, a valid payload through POST with the secret lands a row (proves the dispatch line)
- [ ] `core/module-contract.ts`: `inbound?: Record<string, (payload: unknown) => Promise<void>>` with a doc comment
- [ ] `app/api/integrations/[id]/webhook/route.ts`: after the manifest's own `webhook`, `for (const m of getModules()) await m.inbound?.[id]?.(data)`. A throw is a logged 500 through `withLog` and the app retries, which is right for a database outage
- [ ] `integrations/health_auto_export/client.ts` (new, no imports): `toBodyMetrics(payload)` returning `{ kind, measuredOn, value }[]`. Mapping: `weight_body_mass` (lb or kg, `qty`) to `weight` in grams; `resting_heart_rate` (`qty`) to `resting_hr`; `heart_rate_variability` (`qty`, ms) to `hrv`; `body_fat_percentage` (`qty`) to `body_fat` in tenths; `sleep_analysis` (`totalSleep` else `asleep`, hours) to `sleep_minutes`, day from `sleepEnd` else `date`. Everything else skipped. Date regex `^(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2} [+-]\d{4}$`; the day is the first ten characters (the phone's local day). A bad record is skipped, not thrown. The metric identifier strings and the sleep field are verify against one real export from the app before the mapping is final; the shape (`data.metrics[] { name, units, data[] }`, `{ qty, date }`, sleep `{ asleep, inBed, totalSleep, sleepStart, sleepEnd }`) is from the app's export-format page
- [ ] `integrations/health_auto_export/manifest.ts`: drop the no-op `webhook`; `test()` reads `max(occurred_at)` from `core.request_log` for this route with status 200 and reports "Last payload received {date}" or "No payload yet. Paste the URL and secret into the app."
- [ ] `modules/fitness/manifest.ts`: `inbound.health_auto_export` upserts each metric `on conflict (kind, measured_on) do update ... where source <> 'manual'`, source `'health_auto_export'`, no `register()` (same as `log_metric`, XP weight zero). Not added to `requires`
- [ ] `config/connectors.yaml`: the Fitness provider becomes "Apple Health (Health Auto Export)" so Onboarding's supported-provider match finds the manifest
- [ ] Docs: the "webhook writes nothing" lines in docs/STATUS.md and the SetupCard comment; docs/SETUP-INTEGRATIONS.md gets its Health Auto Export section (URL and secret from the Connections card, header `x-pos-secret`, metrics to enable, daily schedule)

Exit checks:
- `pnpm test -- modules/fitness core/integration-routes` green, then `pnpm typecheck && pnpm lint`
- Locally: generate the secret on Connections, POST a sample payload with `x-pos-secret`, Fitness > Body shows the reading, the card's Test turns CONNECTED
- In production, after owner step 14: one real payload from the phone, the same three checks

Assumptions: only `source = 'manual'` rows are protected; several records for one day means the last in payload order wins. Verify in the app that its REST automation can send a custom header; if it can only send the secret in the body or query, the route needs a small addition.

Depends on: nothing in code; owner step 14 for the production check. Out of scope: Apple workouts, steps, any analysis of the numbers.

### Phase 5: cron-silence check

Goal: a nightly that never fires is noticed the next morning.

Design: one more step at the end of the `dump` job in
`.github/workflows/backup.yml`, which already runs daily at 04:10 UTC with
`BACKUP_DATABASE_URL` and installs the Postgres client. It counts
`core.job_runs` rows with `finished_at` in the last 36 hours and status
`clean` or `partial` and exits 1 when there are none; GitHub emails the owner
on a failed scheduled run (verify the notification setting once). At 04:10 UTC
the last 09:00 UTC run is 19 hours old and a missed one is 43, so 36 is the
line. `failed` is excluded on purpose: a run where every job failed sent no
digest either. `partial` counts as fired because the dashboard and the
orchestrator already surface single job failures. Nothing new is public, no
new secret, no new route.

Tasks:
- [ ] `.github/workflows/backup.yml`: the step, after the dump so the backup still lands when the check fails; it prints the count
- [ ] docs/SETUP-SUPABASE.md "What is not covered here": one sentence saying the backup workflow doubles as the cron check

Exit checks:
- `psql "$DATABASE_URL" -Atc` with the step's query against the local database returns the run count
- `gh workflow run backup.yml && gh run watch` after Phase 2's first run: green with a count of at least 1
- The red path proven once on a scratch branch with the interval set to `1 minute`, then the branch discarded

Depends on: owner step 8. Out of scope: an error tracker, a paid uptime service.

### Phase 6: finish PR #10

`fix/skill-tree-zoom` is mergeable. The owner's last notes list three
behaviours to re-check on the branch head: globe scroll direction (the globe
fix merged in #11 turned the directions round, so confirm it is settled), tree
zoom and double-click still slow, and the centre node opening no card.

Tasks:
- [ ] Reproduce each on `localhost:3010/skills` and `/travel` at the branch head; fix what reproduces, in `modules/skills/ui/` and `modules/travel/` only
- [ ] The branch's e2e wheel tests still pass
- [x] Merge when CI is green and the owner has tried it (merged 2026-09-12 17:05 CDT)

Exit checks:
- `pnpm test:e2e --grep "skill"` green; CI green; PR merged

Depends on: nothing. Out of scope: any other screen.

## Production readiness

| Layer | Decision | Phase | Notes |
|---|---|---|---|
| 1. Frontend | Built to the design bundle; `pnpm build` joins CI | 1 | The login defect is the proof a build step is needed |
| 2. APIs and backend logic | Present: server actions, cron, MCP, OAuth, webhook, zod at every boundary | done | |
| 3. Database and storage | Present: 27 migrations, one schema per module, private buckets | 2 pushes them | Buckets are not in the backup, accepted in docs/RESTORE.md |
| 4. Auth and permissions | Present: magic link, owner-only proxy, RLS to `authenticated`; two dashboard settings enforce it | 2 (owner step 4) | Vercel Authentication off for production |
| 5. Hosting and deployment | Vercel from git, hosted Supabase; rollback paragraph in docs/SETUP-SUPABASE.md | 0, 2 | Node 22 on Vercel |
| 6. Cloud and compute | Present: one cron, `maxDuration` 300, chunked jobs | done | Hobby allows one cron a day |
| 7. CI/CD and version control | typecheck, lint, vitest, e2e, plus build; a red check is a manual gate | 1 | Branch protection is unavailable on a private free repo |
| 8. Security and data access | Present: CSP and headers, secrets out of git, SSRF guard with DNS pinning, encrypted credentials; two old keys to revoke | owner step 1 | No `pnpm audit` in CI: not needed, Dependabot covers it weekly |
| 9. Rate limiting | Present: 60 a minute per hashed IP, per instance; the Vercel firewall is the real limit | owner step 9 | |
| 10. Caching and CDN | Not needed: one user, `revalidatePath` after writes | | |
| 11. Load balancing and scaling | Not needed: Vercel functions, a pool of 4 behind the transaction pooler | | |
| 12. Observability and logs | Present in-app (`job_runs`, `write_log`, `request_log`, `llm_calls`, Agent Log); cron silence added | 5 | No error tracker: not needed, Vercel runtime errors are readable through the connector |
| 13. Availability and recovery | Present: nightly `pg_dump` to a private repo, 30 days, restore drilled | owner step 8 | |
| Cost ceiling | $0 to $10 a month, soft LLM cap in `core/llm.ts`; SimpleFIN adds about $1.50 | | Health Auto Export is a one-time app purchase |
| Secrets rotation | Owner only. Provider keys: delete the connection, revoke, re-enter. `ENCRYPTION_KEY` rotation means re-entering every credential | | In docs/SETUP-INTEGRATIONS.md; nothing more needed |

## Platform concerns map

Unchanged from docs/plans/design-build.md except these rows.

| Area | This plan |
|---|---|
| Hosting | Production is `pos-gilt-rho.vercel.app`, Node 22, no Vercel Authentication on production. Rollback is promote-previous on Vercel; migrations are forward-only |
| Jobs | One Hobby cron at 09:00 UTC; the digest hour is a label. A GitHub schedule checks that the cron ran |
| Integrations | Apple Health is inbound over the existing webhook route, writes `fitness.body_metric`, and is the only integration that pushes to the app |
| CI | Adds `next build`. Red is a manual gate |
| Cost | About $1.50 a month more for SimpleFIN, inside the cap |

## Verification, whole plan

```
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm test:e2e
```

Production, after Phase 2: latest production deployment READY and no runtime
errors through the Vercel connector; `curl -s
https://pos-gilt-rho.vercel.app/login | grep -c "Attempted to call"` is 0;
two consecutive runs in Agent Log, one manual and one cron, no failed job;
two digest emails.

After Phase 3: one Agent Log run with `fitness.sync_strava`, `brain.pull_vault`
and `finance.sync_simplefin` all ok.

After Phase 4: a POST with the card's secret returns `{ ok: true }` and a
`fitness.body_metric` row appears with source `health_auto_export`; the card's
Test reports ok.

After Phase 5: the backup workflow passes the morning after a run with a
printed count of at least 1, and the red path was proven once.
