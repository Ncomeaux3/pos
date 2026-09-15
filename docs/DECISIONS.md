# Open decisions

Claude Code must ask about every unresolved item here before scaffolding. Record the answer, date, and reason in decisions/log.md, then mark it resolved.

(none open)

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

## Production readiness

From the prod-auditor report of 2026-09-14 (8 present, 5 partial, 0 absent, no critical findings). Every row is decided, scheduled to a phase of docs/plans/pos-v1-1.md, or not needed with a reason.

| Layer | Decision | Phase | Notes |
|---|---|---|---|
| 1. Frontend | Present | | `pnpm build` and a served /login check in CI; tokens in app/globals.css; Playwright at 1440 and 402 |
| 2. APIs and backend logic | Present | | zod on every route, `{ error }` JSON, refusal tests in core/*.test.ts |
| 3. Database and storage | Present | | 30 migrations, replayed into pos_test by CI |
| 4. Auth and permissions | Present | | proxy.ts, requireOwner(), bearer on /api/mcp and /api/cron, passkeys |
| 5. Hosting and deployment | Present | | Vercel git integration, previews per branch, rollback in docs/SETUP-SUPABASE.md section 7 |
| 6. Cloud and compute | Partial | 12 | maxDuration only on the cron; add to MCP, webhook, OAuth routes |
| 7. CI/CD and version control | Partial | 12 | CI runs but is not a merge gate; repo is public now so branch protection should be available |
| 8. Security and data access | Partial | 12 | .env gitignored, CSP, dependabot; add `pnpm audit` to CI |
| 9. Rate limiting | Present | | core/ratelimit.ts, 60 per minute per IP, 429 with retry-after |
| 10. Caching and CDN | Present | | Request-scoped React cache() on settings, today and skill names since Phase 3; no TTL caches by decision, single user and freshness wins |
| 11. Load balancing and scaling | Present | | Pooler in transaction mode; pool max 8 per instance, measured against 4 on 2026-09-15 |
| 12. Observability and logs | Partial | 12 | core.request_log, core.jobs, digest email on failure. Add error.tsx and global-error.tsx. Not needed: Sentry or another error tracker, by the cost cap and single user |
| 13. Availability and recovery | Present | 12 | Nightly pg_dump to pos-backups, restore drilled 2026-09-08; add the storage bucket to the dump |
| Cost ceiling | $0 to $10 a month, llm_soft_cap_cents 1000 enforced in core/llm.ts | 11 | Health Auto Export Premium adds $1.99 a month |
| Secrets rotation | Absent | 12 | One paragraph in docs/SETUP-SUPABASE.md: who rotates each secret, where, and what it breaks |
