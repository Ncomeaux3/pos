# Decision log (append only)

Format: date | decision | reason | alternatives rejected

2026-09-05 | Orchestrator is a fresh build inside the POS | keeps the POS self-contained and the agent surface small | reusing the owner's multi-agent framework
2026-09-05 | Notion POS stays live until each module replaces it | avoids a big-bang migration; Notion is the fallback | migrate everything in phase 1
2026-09-05 | Notion data comes in as an owner-provided export per module | one import script per module, tested against the export | live Notion MCP sync
2026-09-05 | Hosting: Supabase + Vercel | near zero ops, free tiers cover one user | self-hosted VPS behind Tailscale; local machine only
2026-09-05 | Stack: TypeScript, Next.js full stack | one language, one deploy, matches jobtracker and soltreya-web | Python backend with separate frontend; Next.js UI with Python jobs
2026-09-05 | Bank provider: SimpleFIN Bridge, 4 to 7 accounts | about $1.50/mo (verify), token API, no OAuth flow to build | Teller; Plaid; manual CSV
2026-09-05 | Cost cap: $0 to $10 per month | free tiers plus SimpleFIN plus small model spend | $10 to $30; $30 to $75
2026-09-05 | Mobile: PWA | one codebase, home screen install, email covers alerts | responsive only; native later
2026-09-05 | Fitness source: Strava plus Apple Health via Health Auto Export webhook | covers weight, sleep, heart rate; price verify | manual entry; Garmin/Whoop/Oura; defer
2026-09-05 | Obsidian sync: vault is a private git repo, app pulls and proposes commits | matches the rule that the app never edits the vault without review | Obsidian Sync plus local watcher; defer
2026-09-05 | Idea research depth: quick by default, deep on demand | cents per run, protects cost cap | deep by default
2026-09-05 | Notifications: email via Resend | free tier, no app, searchable | ntfy/Pushover; Telegram/Discord bot; in-app only
2026-09-05 | MCP layout: one server, namespaced tools | one process, one auth, add a module by adding a folder | one server per module; no MCP
2026-09-05 | Job runner: one Vercel cron hitting one API route | zero extra infra, daily cadence matches the digest pattern | pg_cron plus Edge Functions; in-repo scheduler; n8n
2026-09-05 | Template model: fork and fill | code holds nothing personal; data lives in DB, .env, imports/ | core plus pick-your-modules; build for owner then strip
2026-09-05 | Auth: Supabase Auth magic link, signups disabled, one owner user | no password, RLS backstop | email and password; passkey or Google OAuth
2026-09-05 | Models: Anthropic API, Haiku for classification, Sonnet for research, one wrapper function | cheapest capable, swappable | one model everywhere; provider-agnostic SDK from day one
2026-09-05 | Module plug-in: manifest file per module in modules/<name>/, discovered at build | the mechanism that makes the system adaptable | central registry file; database-driven registry
2026-09-05 | Integrations UX: Settings > Connections page with token forms and OAuth Connect buttons | plug and play accounts, no redeploy to add one | tokens only; keep credentials in .env
2026-09-05 | Integration plug-in: manifest file per provider in integrations/<name>/ | add a provider by adding a folder | hardcode the providers we use
2026-09-05 | Day one integrations: every planned provider defined, none connected | template ships empty and shows the full platform shape | only what Phase 1 needs
2026-09-05 | DB layer: supabase-js plus generated types, hand-written SQL migrations, no ORM | RLS applies automatically, least machinery | Drizzle; Kysely
2026-09-05 | Local DB: supabase start in Docker for dev and tests, one hosted project for prod | migrations and RLS proven before push | hosted only with a branch; one hosted project for everything
2026-09-05 | UI base: Tailwind plus shadcn/ui | owned components, restyled in the design pass without a library swap | Tailwind only; pick a kit during the design pass
2026-09-05 | Tooling: pnpm, Node 22 LTS | fast, strict, Vercel native | npm; Bun
2026-09-05 | Chat: Claude Code or Claude app via /api/mcp, no in-app chat | zero build, covered by the Max plan | in-app chat page; both
2026-09-05 | Template upgrades: forks add this repo as a git remote and merge | works because personal state is outside code | publish core as an npm package; no upgrade path
2026-09-05 | Notion import: every module except Skill Tree has Notion data to import | import scripts and fixtures are required per module | none
2026-09-05 | Git: init, first commit, private GitHub repo pos via gh | matches SETUP.md | init only; owner does it by hand
2026-09-05 | Schedule: one nightly run at 09:00 UTC (4 AM Central in summer, 3 AM in winter) | before wake, one cron entry fits the Hobby plan | separate sync and digest crons; evening summary
2026-09-05 | CI: GitHub Actions running typecheck, lint, vitest on every push | catches broken rule tests before deploy | Vercel build only; none
2026-09-05 | Deploys: Vercel Git integration, main to prod, branches to previews, branch per module | default behavior, no scripts | main only; manual CLI deploys
2026-09-05 | Skill tree edits: config/skills.yaml is the source, no edit UI | rare changes, version controlled | seed then edit in app; file plus form that commits
2026-09-05 | Backups: nightly pg_dump from GitHub Actions to a private backup repo, 30 days kept | free, restore is one psql command | Supabase Pro; manual dumps
2026-09-05 | Errors: Vercel logs plus core.jobs, no third party | job failures surface in the digest | Sentry
2026-09-05 | Demo seed: pnpm setup --demo seeds synthetic rows per module, doubles as fixtures | forks and the design pass see populated screens | empty start
2026-09-05 | Money: integer cents, USD only | no float drift; currency column added only when needed | numeric with currency code
2026-09-05 | Vector store: pgvector in Supabase with HNSW index | already in the database, RLS applies, free | dedicated vector DB; pgvector behind a swap interface
2026-09-05 | Embeddings: Voyage AI lite model (verify name and free allowance) | Anthropic's partner, cents per million tokens | OpenAI text-embedding-3-small; local model; Supabase gte-small
2026-09-05 | Search scope: everything in core.entities via one core.embeddings table and one search tool | one search across every module for owner and orchestrator | Second Brain notes only; per-module opt-in
2026-09-05 | Dashboard summary: templated by rules, one Haiku call writes a two sentence headline | numbers never hallucinated, cheap | fully model written; fully templated
2026-09-05 | Agent writes: direct for low risk, core.proposals for money, policy, goals; manifest marks guarded tools | safety where mistakes cost money | everything in review; everything direct
2026-09-05 | Levels: level = min(99, floor(sqrt(xp / 100))) | one line, easy to show on the skill page | thresholds table; linear
2026-09-05 | Embed timing: nightly job embeds new or changed entities | batched, fits cron and cost cap | on write sync; on write queued plus sweep
2026-09-05 | Digest email: short plain text, headline plus top 3 plus link | reads in two seconds on a phone | full HTML digest
2026-09-05 | Review queue: one core.proposals table and one Review page | one inbox for everything the agent wants to do | per-module pending status
2026-09-05 | Keyword search: Postgres full text merged with vector results | exact merchant names and tags still win | semantic only
2026-09-05 | Distribution: this repo, private now, public with Use this template later | personal state is outside the code | separate public template repo
2026-09-05 | License: MIT, file added now | standard for templates | Apache 2.0; decide later
2026-09-05 | Query tool: read-only SQL as restricted Postgres role pos_readonly, SELECT on own schema plus core, 5s timeout, row cap | flexibility for chat, safety enforced by the DB | structured filters; named queries
2026-09-05 | Files: Supabase Storage, one private bucket per module, signed URLs via core/files.ts | same auth and project, 1 GB free (verify) | links only; defer
2026-09-05 | History: imports backdate events to original dates; rules classify on import, model handles leftovers nightly | skill tree reflects real history, cost stays batched | no events; manual XP seed
2026-09-05 | Spend: core.llm_calls ledger per call, month to date on dashboard, soft cap in settings pauses research | keeps the $10 cap visible and enforced | log without cap; provider dashboards only
2026-09-05 | Settings: core.settings key-value table for timezone, owner name, digest hour, llm soft cap | template users need these without touching .env | env vars
2026-09-05 | Deletes are hard; core.events keeps a title snapshot | soft delete doubles every query; the event log is the audit trail | soft delete
2026-09-05 | All alerts bundle into the one daily email via core.notifications | one email a day, never a flood | separate sends per alert
2026-09-05 | Migrations additive after ship; every module table carries external_id and source | idempotent imports, forks can merge upstream migrations | none
2026-09-05 | Rate limiting: Vercel Firewall at the edge plus per-route in-memory limiter, 60 per minute per IP | no new service, edge blocks floods | Upstash Redis; Postgres counter
2026-09-05 | Caching: Next.js cache with revalidate tags, digest tables as read cache, provider responses stored in DB, no Redis | nothing extra to run | Upstash Redis
2026-09-05 | Logs: core.jobs plus core.request_log for every API and webhook call, no drain | outcomes survive Vercel's short retention | log drain; core.jobs only
2026-09-05 | Recovery: RPO 24 hours, RTO a few hours, single region, restore drilled once in Phase 1 | matches nightly dump and cost cap | RPO 1 hour; rebuild from Notion
2026-09-05 | Convention change: migrations live in supabase/migrations, not db/migrations | Supabase CLI runs them natively | keep db/migrations
2026-09-05 | Convention change: modules/<name>/schema.sql dropped, migrations are the single source of schema | no duplicated schema definitions | keep schema.sql as documentation
2026-09-05 | Verified: Vercel Hobby cron minimum interval is once per day with per-hour precision (fires within 59 min of the hour), 100 crons per project | 0 9 * * * is legal; the digest arrives some time in the 09:00 UTC hour | more frequent schedules fail at deploy
2026-09-05 | Verified: Fluid compute is default on for new projects and available on Hobby, default and max function duration both 300s | the nightly job gets 5 minutes, not the legacy 10s/60s; set maxDuration 300 on the cron route | assuming the pre-April-2025 60s cap
2026-09-05 | Verified: Vercel DDoS mitigation and Attack Mode are free on all plans; the Bot Protection managed ruleset is off by default and its plan gate is not documented | Attack Mode is the guaranteed lever; confirm bot protection in the dashboard at deploy | claiming bot protection is available on Hobby without checking
2026-09-05 | Embeddings: voyage-4-lite at 1024 dimensions, 32k context, $0.02 per million tokens, 200M free tokens | default dimension, best recall, about 40 MB at 10k entities against a 500 MB free database | 512 or 256 via Matryoshka truncation
2026-09-05 | Verified: Resend free tier is 100 emails per day, 3000 per month, 3 domains, 30 day retention; an unverified account sends from onboarding@resend.dev only to the account signup address | Phase 1 needs no domain because the digest goes to the owner's own inbox | verifying a domain before Phase 1
2026-09-05 | Verified: Supabase free tier is 500 MB database, 1 GB file storage, 5 GB egress, 2 active projects, paused after 1 week of inactivity | the nightly cron keeps the project active; storage decision confirmed | none
2026-09-05 | Verified: pgvector ships on every Supabase plan including free and supports HNSW | no plan upgrade needed for search | dedicated vector service
2026-09-05 | Backups connect over the Supavisor session mode pooler on port 5432 | GitHub Actions runners are IPv4 only and the direct connection is IPv6 only; pg_dump needs session semantics that transaction mode on 6543 does not provide | direct connection; transaction mode pooler
2026-09-05 | MCP: mcp-handler 2.1.1 on @modelcontextprotocol/server 2.0.0 with zod 4, mounted as a Next.js route handler, bearer auth via withMcpAuth | serves the 2026-07-28 spec with stateless Streamable HTTP fallback, no hand-wired transport | raw @modelcontextprotocol/sdk 1.30.0 with a custom transport bridge
2026-09-05 | Verified: SimpleFIN Bridge costs $1.50 per month or $15 per year; a base64 setup token is claimed once for an access URL of the form https://user:pass@bridge.simplefin.org/simplefin | confirms the manifest stores access_url as the single token field | storing the setup token
2026-09-05 | DB layer refinement: core and module schemas stay unexposed to PostgREST; core/*.ts reads and writes over the pg pool, supabase-js is for auth only | one DB layer for module data, no per-module dashboard config to keep in sync, and nothing in core is reachable over REST from a browser; every path already runs server side behind requireOwner() or as service_role, which bypasses RLS regardless | expose core to PostgREST and use supabase-js with generated types; expose for reads and use pg for writes
