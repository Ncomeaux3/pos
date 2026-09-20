# Open decisions

Claude Code must ask about every unresolved item here before scaffolding. Record the answer, date, and reason in decisions/log.md, then mark it resolved.

(none open, for v1.1 or for v2)

## Resolved
All eleven original items plus the architecture, platform, and template decisions were resolved on 2026-09-05. See decisions/log.md for each choice, its reason, and what was rejected. See docs/ARCHITECTURE.md for how they fit together.

- Orchestrator is a fresh build. The owner's existing multi-agent framework is not reused. (2026-09-05)
- Notion POS stays live until each module replaces it. Notion data is provided by the owner as an export, not pulled via MCP in phase 1. (2026-09-05)
- Claude Max plan. Auto permission mode is the default; settings.json allowlist is a backstop. (2026-09-05)
- Hosting: Supabase + Vercel. (2026-09-05)
- Stack: TypeScript, Next.js full stack, pnpm, Node 22. (2026-09-05)
- Bank provider: SimpleFIN Bridge, 4 to 7 accounts. (2026-09-05)
- Cost cap: $0 to $10 per month. (2026-09-05)
- Mobile: PWA. (2026-09-05)
- Fitness source: Strava plus Apple Health via Health Auto Export. (2026-09-05)
- Obsidian sync: private git repo, app pulls and proposes commits. (2026-09-05)
- Idea research depth: quick by default. (2026-09-05)
- Notification channel: email via Resend. (2026-09-05)
- MCP layout: one server, namespaced tools. (2026-09-05)
- Job runner: one Vercel cron. (2026-09-05)

v1.1, all 2026-09-14, from the /adopt-repo interview; reasons in decisions/log.md, plan in docs/plans/pos-v1-1.md:

- Delivery order: bugs, then speed, then features, fitness last, one hardening phase.
- Workouts source: Health Auto Export Premium ($1.99 a month). Strava API apps need a paid subscription; the free Shortcut cannot read workouts.
- Dashboard editing: show, hide and order, one layout saved in core.settings for both widths. No per-device layouts, no named views.
- Dashboard freshness: a module's digest is recomputed by callTool after every write; tiles read the latest digests. The headline stays nightly.
- Travel: trips gain destinations with their own dates; a guarded merge_trip folds one trip into another. No script migration of the four existing trips.
- Goals > projects > tasks: a task inherits its project's goal unless it names its own.
- Skill picker on every entity drawer through one shared component and link/unlink tools.
- The phase-1 notes stub module is deleted; Second Brain is the notes module.
- Fitness scope: Trends, history filters, plan form, Apple arrival on the Sync band. Full app parity (per-workout screens, PRs) is not in v1.1.
- Prod-audit gaps get one hardening phase (Phase 12).
- Existing tests are trusted as the regression net.
- The digest email goes out every night, "Nothing needs you today" included.
- Phone for the iOS splash image: iPhone 16 Pro Max (440 x 956 points at 3x).
- Date inputs stay native `<input type="date">` everywhere; no picker library.
- Vercel functions stay in iad1 beside the owner; pdx1 measured slower on the whole. The database region is the remaining lever and is an owner decision. (2026-09-15)
- Branch protection requires `migrations` as well as `check` and `screens`, so the db push gate blocks a merge rather than advising. Enforced for admins; no required reviews, no up-to-date rule (solo). (2026-09-15)
- The storage buckets are mirrored by the backup workflow, not only documented: the readiness row said add them to the dump. Two more repo secrets, `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF`. (2026-09-15)

v2, all 2026-09-14, from the spec review; the sixteen entries are in decisions/log.md, the spec in docs/SPEC-v2.md and the plan in docs/plans/v2-agent-layer.md:

- Runner topology, ledger shape, integration extension, cost cap, plan location, no in-app chat, first integrations, voice out, secret store and queue, the default permission level, sync scope, start order, Gmail's scope and OAuth posture, and an empty auto-approve table. Fourteen answers from the owner.
- Two corrections made after them: phase 0's three outbound clients are SimpleFIN, the vault and Strava (Apple Health is inbound), and phase 1 adds `integrations/fixture/` so the ledger has a write verb to prove itself against.

v1.2, all 2026-09-20, from the post-Holon interview; the fifteen entries are in decisions/log.md, the amendments in docs/SPEC.md and the plan in docs/plans/pos-v1-2.md:

- Order (bugs, look and forms, Finance data, Calendar and integrations, features, release); read-only feeds; Calendar as a module with a manifest seam; category kinds with transfers out and credits netted; trip spend from linked transactions; USDA and paste-to-draft for Meals; Apple Health as the fitness source; recurrence as a rule on the task; semver with tags and GitHub Releases; the look stays Holon behind a mockup gate; an Errors tab and no Sentry; three Finance corner views; Home add and edit over existing tools; Health keeps its tab with health-type policies only; required-field errors and Enter to submit everywhere.

## Production readiness

From the prod-auditor report of 2026-09-14 (8 present, 5 partial, 0 absent, no critical findings); the five partial rows and the rotation row closed by v1.1 phase 12 on 2026-09-15. Every row is decided, scheduled to a phase of docs/plans/pos-v1-1.md, or not needed with a reason.

| Layer | Decision | Phase | Notes |
|---|---|---|---|
| 1. Frontend | Present | | `pnpm build` and a served /login check in CI; the Holon token set in app/globals.css with `light-dark()`, Geist self-hosted under app/fonts (OFL, 40 KB), theme in the `pos_theme` cookie (lax, one year, not httpOnly, a display preference); Playwright at 1440 and 402; client JS 1668 kB on 2026-09-19 against the 1704 kB pre-redesign baseline |
| 2. APIs and backend logic | Present | | zod on every route, `{ error }` JSON, refusal tests in core/*.test.ts |
| 3. Database and storage | Present | | 30 migrations, replayed into pos_test by CI |
| 4. Auth and permissions | Present | | proxy.ts (matcher excludes `brand/`, the icons moved there from `icons/`), requireOwner(), bearer on /api/mcp and /api/cron, passkeys |
| 5. Hosting and deployment | Present | | Vercel git integration, previews per branch, rollback in docs/SETUP-SUPABASE.md section 7 |
| 6. Cloud and compute | Present | 12 | maxDuration on the cron (300), MCP (60), webhook and both OAuth routes (30) |
| 7. CI/CD and version control | Present | 12 | Branch protection on main requires `check`, `screens` and `migrations`, enforced for admins, since 2026-09-15; the served-login smoke grep in ci.yml reads the input's `w-full rounded-xl` class and moves with it |
| 8. Security and data access | Present | 12 | .env gitignored, CSP, dependabot, `pnpm audit --prod --audit-level=high` in the check job |
| 9. Rate limiting | Present | | core/ratelimit.ts, 60 per minute per IP, 429 with retry-after |
| 10. Caching and CDN | Present | | Request-scoped React cache() on settings, today and skill names since Phase 3; no TTL caches by decision, single user and freshness wins |
| 11. Load balancing and scaling | Present | | Pooler in transaction mode; pool max 8 per instance, measured against 4 on 2026-09-15 |
| 12. Observability and logs | Present | 12 | core.request_log, core.jobs, digest email on failure, error.tsx and global-error.tsx showing the digest. Not needed: Sentry or another error tracker, by the cost cap and single user |
| 13. Availability and recovery | Present | 12 | Nightly pg_dump to pos-backups, restore drilled 2026-09-08; every storage bucket mirrored beside the dumps since 2026-09-15, restore drilled locally |
| Cost ceiling | $0 to $10 a month, llm_soft_cap_cents 1000 enforced in core/llm.ts | 11 | Health Auto Export Premium adds $1.99 a month |
| Secrets rotation | Present | 12 | docs/SETUP-SUPABASE.md, Rotating a secret: each secret, where it is set, what rotating it breaks |
