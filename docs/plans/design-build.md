# Build POS against the Omelette design handoff

## Context

The repo is a working Phase 1 core at **step 7 of 16** ([docs/plans/phase-1-core.md](docs/plans/phase-1-core.md)): scaffold, core migration, auth, crypto/settings/llm, module registry with the `notes` stub, entities/events/xp/classify, and the integration registry with a Connections page. Everything after that (search, proposals, query, MCP, cron, notify, orchestrator, setup, CI, deploy) is unbuilt, and the UI is stock shadcn placeholder: Geist fonts, neutral oklch palette, `--radius: 0.625rem`, light-first.

`/Users/ncomeaux/Downloads/design_handoff_pos/` now supplies 22 high-fidelity screen prototypes plus a backend integration document. The design is the visual and functional spec from here on. It is more specific than the handoff document implied, and it contradicts parts of [docs/SPEC.md](docs/SPEC.md) and of [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)'s "Not planned" list.

**Outcome:** finish Phase 1 with every screen built to the design, then ship modules in order, each against its prototype. Nothing in the module or integration contract changes shape; the additions are a design token layer, a shared primitive set, four new core tables, two new modules, and two small extensions to the module manifest.

---

## Decisions taken this session

Fourteen, to be appended to [decisions/log.md](decisions/log.md) as step 0 of execution. Four supersede decisions logged earlier the same day, before the prototypes were read.

| # | Decision | Note |
|---|---|---|
| 1 | Finish Phase 1 steps 8 to 16 before the new core tables, folding those tables into steps 9 and 12 | |
| 2 | Push notifications get built, last: rules table and every control ship now, the sender is email plus in-app until a dedicated push step | **supersedes** the earlier email-only decision |
| 3 | `modules.enabled` exists and means visible: nav, Onboarding toggles, greyed rows, connector categories. Jobs, tools and direct URLs still work | **supersedes** the earlier no-toggle decision |
| 4 | `config/skills.yaml` seeds, `core.skill_overrides` holds edits (custom, renames, deleted). `classify()` reads the merged tree | **supersedes** the earlier read-only decision |
| 5 | Insurance gets discrete deductible, limits, agent and documents fields. SPEC's real rule stands: nothing analyses them, no gap analysis, no adequacy scoring | **amends** SPEC section 8 |
| 6 | Cross-module reads go through `core.digests` plus a named metric registry on the manifest. No cross-schema SQL | |
| 7 | Build order stays ARCHITECTURE's: Skill Tree, then Tasks and Goals, then Finance | |
| 8 | Charts are hand-rolled inline SVG. d3-geo, topojson and world-atlas arrive only with Travel | |
| 9 | SPEC features the designs omit (Ideas research rubric, Meals cook mode, Travel cents-per-point, Fitness plans and coach) stay in SPEC as a follow-on pass per module | |
| 10 | Mobile is responsive first: every screen reflows to 402px, sidebar becomes a bottom tab bar, drawers become sheets. The four gestures land in one later pass | |
| 11 | Verification is a Playwright smoke test per screen with 1440px and 402px screenshots against seeded demo data | |
| 12 | Autonomy (`observe` / `propose` / `act`) is one settings key read by the guard dispatcher in step 9 | |
| 13 | Phase 1A builds the tokens, shell and all twenty primitives in one step before any new screen | |
| 14 | Second Brain's schema id is `brain`, not `second_brain` | **amends** SPEC |
| 15 | The ComeauxVerse brand guide governs the app: Manrope one family, no monospace, radius 12px and 8px, the brand type scale | **supersedes** decision 13's token layer |
| 16 | Teal #2FB8A6 added for accent text under about 14px, because the green is 3.80:1 | accessibility |
| 17 | The ComeauxVerse mark and lockup replace the CMX Logic logo | |

### Smaller calls I am making, stated so you can overrule them

- **`data-theme` goes on `<html>`**, written server-side from a cookie so there is no flash. The prototypes put it on a page wrapper, which is an artifact of them being standalone files.
- **The `blueprint` theme is skipped.** It exists in the token file; no screen uses it.
- **Three prototype elements get dropped**: mobile Finance "Share with partner" (contradicts single-owner auth), mobile Finance "Round-up saving" (outbound money movement, nothing in the schema moves money), and the Login page footer's `NIGHTLY JOB OK · 04:02` (leaks system status pre-auth).
- **Settings keys use underscores** and extend the typed `Settings` union in [core/settings.ts](core/settings.ts). `owner.name` and `day_start` from the handoff document are dropped as duplicates of `owner_name` and `digest_hour`.
- **The `notes` module stays** as the template's worked example, and drops out of your nav via `modules.enabled` once Skill Tree lands.
- **One switch size**, 34x20 square. The prototypes have two.
- Magic link expiry: the Login screen counts down from 15 minutes. Supabase's default OTP expiry needs checking before that number is hardcoded. **verify**

---

## Phase 1A: design foundation

New step, inserted before step 8. Nothing else can be built to the design until this exists.

### Tokens and type

**Amended 2026-09-08 by decisions 15 to 17.** The palettes of the POS bundle and the ComeauxVerse brand guide are identical, so the colour layer was unaffected; type and shape now come from the brand guide instead of the bundle. Manrope is the one family, `.label` and `.num` replace the monospace layer, the brand type scale ships as `t-display` through `t-caption`, radius is 12px standard and 8px on small controls, and teal joins the palette for small accent text. What follows describes the colour work, which still holds.

- `:root` carries all 14 (dark is the default theme). `[data-theme="light"]` overrides 9; accent, green, amber and red are identical in both themes.
- `@theme inline` maps them to Tailwind colour utilities. Every `--radius-*` goes to `0`; `.chip` uses a literal `999px`.
- `@custom-variant light ([data-theme="light"] &)` replaces the stock `dark` variant, which matches neither selector.
- `--accent-soft` stays the baked `rgba(3,122,104,0.14)` rather than `color-mix`, so it matches the design system exactly.
- `--rule` and `--rule-2` are alpha-on-different-inks per theme, not one colour at two opacities. They stay two tokens.
- Base layer, hand-written: `font-feature-settings: "ss01","ss02"` on body and `"zero"` on mono, `::selection` in accent, the 10px square-thumb scrollbar, `.grid-bg` (two 64px gradients), `.corner` crosshair pseudo-elements, and the `pulseDot` keyframe with its `prefers-reduced-motion` override.
- Keep `@import "shadcn/tailwind.css"`: it supplies Base UI `data-*` variants and keyframes, no colours, so it does not fight the token swap.

Fonts in [app/layout.tsx](app/layout.tsx): swap Geist for `Space_Grotesk` (300-700) and `JetBrains_Mono` (300-600) via `next/font/google`, self-hosted, replacing the design system's Google Fonts `@import`. Instrument Serif is unused by any screen; skip it.

### Shell

- `components/pos/Sidebar.tsx`: 232px, collapsible to 64px over 250ms, two-character mono index per item, 2px accent active bar, `--accent-soft` fill. Nav items come from `getModules()` filtered by `modules.enabled`, in the design's order. Footer: Search, Weekly review, Notifications, Agent log, Settings, theme toggle, collapse. Review carries a pending-proposal badge.
- Collapse state and theme in a cookie, so the server renders the right width and theme on first paint.
- Below 720px the sidebar becomes the bottom tab bar (Home, Finance, Tasks, Fitness, More) with a combined warnings-plus-proposals badge, and `More` opens a sheet of the remaining modules.

### Primitives

`components/pos/`, each token-styled, each reflowing to 300px. Every one of these appears on three or more screens.

`PageHeader` (eyebrow with status dot, title, one grey sentence, mono outline actions) · `Eyebrow` · `Card` and `CardHead` · `Row` · `Chip` and `StatusChip` · `PillGroup` (single and multi select, these write) · `FilterChips` · `TabBar` (underlined, with counts) · `Drawer` (right, `min(440px, 92vw)`, 260ms, scrim, Escape) · `Sheet` (mobile, `translateY`, 74% max, grab handle) · `EmptyState` (dashed box, mono headline, one sentence, optional CTA) · `Toast` · `Switch` · `InlineEdit` (Enter saves, Escape cancels) · `ConfirmButton` (two-press, 3s revert; there is no modal anywhere in the bundle) · `SecretField` and `CopyBlock` · `MetricTile` · `DiffRow` · `SnoozeControl` · `WizardShell` (step rail, 2px progress bar, Back / Skip / primary with a changing label).

Charts arrive with the screen that needs them, all hand-rolled SVG: `Sparkline`, `Radar`, `TimelineAxis`, `HeatStrip`, `PaceBar` with the Dashboard; `MonthStrip` with Home; `WeeklyBars` and `Constellation` with Skill Tree; the globe with Travel.

The `Constellation` is **not** a force simulation. The prototype places nodes deterministically: root at centre, five attributes on a 150x120 ellipse, leaves fanned on an arc at r 330-364 inside each attribute's wedge, categories at the midpoint. No `d3-force` dependency.

### Rebuild what already exists

[app/(auth)/login/page.tsx](app/(auth)/login/page.tsx), [app/(app)/settings/page.tsx](app/(app)/settings/page.tsx), [app/(app)/settings/connections/page.tsx](app/(app)/settings/connections/page.tsx) and [modules/notes/ui/NotesPage.tsx](modules/notes/ui/NotesPage.tsx) get rebuilt on the primitives. Settings gains its five designed tabs: General, Connections, Agents and MCP, Notifications, Skills.

**Done when:** login, settings, connections and notes render against the prototypes at 1440px and 402px in both themes, and Playwright screenshots for each are in the step's evidence.

---

## Phase 1B: revised steps 8 to 16

Each step keeps its original plan contents and gains its designed screen.

| Step | Original scope | Design work added |
|---|---|---|
| 8 search | `core/search.ts`, embeddings, search page | Full Search page (rising search box, scope chips with counts, results grouped by module with relative score bars, entity drawer with related items), the embeddable `PosSearch` combobox used by six module headers, and the ⌘K palette with its Go-to command list. Zero results never shows a bare empty state: it falls back to closest matches. |
| 9 proposals and review | `core/proposals.ts`, guard in the dispatcher, review page | Review screen: three tabs with counts, left list plus **sticky right detail panel** (not a drawer), Why / Proposed change before-and-after / Confidence / Evidence / Affects, inline edit of the after value, Approve, Dismiss, Undo, Approve all non-guarded. Guard reads the `agent_autonomy` setting here. |
| 10 query, ratelimit, log, files | unchanged | Storage buckets get created here, one private bucket per module, since Health, Home, Insurance and Second Brain all attach files. |
| 11 MCP | unchanged | Settings "Agents and MCP" tab: live tool count, copyable `claude mcp add` command, token reveal and rotate, guarded-tool table. |
| 12 jobs, notify, orchestrator | `core/jobs.ts`, `core/notify.ts`, `core/orchestrator.ts`, cron route, dashboard | Dashboard with all nine bento tiles, arrange mode with persisted order, prose headline with inline links, and the `core.job_runs` plus `core.write_log` tables written by the runner as it goes. |
| 13 setup and demo seed | unchanged | Demo seed must produce enough rows for every tile and every screenshot to be meaningful. |
| 14 CI and backups | unchanged | CI gains the Playwright job. |
| 15 deploy | unchanged | |
| 16 docs and merge | unchanged | SPEC amended for decisions 5 and 9; ARCHITECTURE's "Not planned" list amended for decisions 2 and 3. |

### Core additions migration

One migration, `<ts>_core_platform.sql`, landing with step 9 (`job_runs`, `write_log`, `skill_overrides`) and step 12 (`notification_rules`, `reviews`, the `notifications` columns).

Tables from the handoff document, **with the boilerplate it omits**. [supabase/migrations/20260905220732_core_init.sql](supabase/migrations/20260905220732_core_init.sql) configures core tables in a `do $$` loop over `pg_tables` that a later migration does not re-run, so every new core table needs its own five statements: the `set_updated_at` trigger, `enable row level security`, the `owner_all` policy, the `readonly_select` policy for `pos_readonly`, and the three grants. Without them `job_runs`, `write_log` and `reviews` are unreadable by `authenticated`.

Also fixed against the handoff document's DDL:

- `updated_at` added to `write_log` and `reviews` (the handoff gives them `created_at` only).
- `notifications.digest_run_id` becomes `uuid references core.job_runs(id) on delete set null`; it referenced nothing.
- `notifications` gains `snooze_until`. The handoff routes dashboard snooze to `notification_rules.snooze_until`, but a job-failure notification has a null `rule_id` and would silently not snooze.
- `connections.status` check constraint extends to allow `'requested'`, for Onboarding's providers that have no manifest.
- New: `core.skill_overrides (kind, skill_id, name, parent, keywords, created_at, updated_at)` holding custom, renamed and deleted skills. Reset to `skills.yaml` is a delete of every row.

### Core module changes

- **`core/entities.ts`**: [register()](core/entities.ts#L31) currently upserts then unconditionally emits `<type>_created`, so editing a row a second time awards XP twice. The designs edit in place on nearly every screen. Add `update()` alongside `register()`, sharing the upsert but emitting nothing, and give both an `actor` and optional `runId` so `write_log` can be populated.
- **`core/writelog.ts` and `core/undo.ts`**: undo is TypeScript, not the SQL function the handoff document proposes. A SQL function cannot call a module's `write` tool, which is a closure in a manifest. Undo applies the diff in reverse through a required `revert` input on guarded tools, stamps `undone_at`, and pauses the originating notification rule for seven days when there is one.
- **`core/digests.ts`**: `getDigest(module)` returning the latest `core.digests` payload. This is the entire cross-module read mechanism for display numbers.
- **`core/modules.ts`**: `ModuleManifest` gains two optional fields. `metrics?: Record<string, { label, unit, get(): Promise<number> }>` is what Goals' metric-source picker enumerates instead of parsing `finance.net_worth latest` strings. `upcoming?(): Promise<UpcomingItem[]>` replaces the handoff document's `core.upcoming` view: the dashboard timeline unions these in TypeScript, so no core object references a module schema and deleting a folder still works.
- **`core/skills.ts`**: merged tree from `config/skills.yaml` plus `core.skill_overrides`, read by `classify()` and by the Settings Skills tab.
- **`core/settings.ts`**: widen the `Settings` union with `modules_enabled`, `dashboard_tile_order`, `agent_autonomy`, `theme`, `sidebar_collapsed`, `digest_morning_hour`, `digest_evening_hour`, `digest_evening_enabled`, `quiet_from`, `quiet_to`, `quiet_urgent_override`, `notifications_paused`, `onboarding_completed_at`.
- **Classification opt-out**: `register()` always calls `classify()`, so every `home.service` row and every `health.vital` row would miss the keyword rules and burn a Haiku call against a tree that has no home-maintenance or medical node. Add `classify: false` to `RegisterArgs` and set it on those entity types.
- **`config/xp.yaml`** gains weights for the new event types, or explicitly zero. Anything absent contributes nothing, which is the right default for Health and Home but should be a decision, not an accident.

---

## Phase 1C: platform screens

Two screens that need only core, built after step 16 merges.

- **Notifications**: schedule card, module filter chips, rules table with the full inline expander (channels, timing, per-module lead-time presets, urgency, snooze and mute), alert centre with unread and history, and both preview mocks. Seeded from a migration with the design's fourteen rules. The push channel renders and stores; the sender ignores it until the push step.
- **Agent Log**: run accordion over `core.job_runs`, entry rows with kind chips and before-and-after diffs, Undo and Redo, failed-job card with the raw error and Retry now, right rail with run KPIs, job list, undo history and the autonomy selector.

---

## Phase 2 onward: modules

Each module is one step: migration, manifest, tools, jobs, UI to its prototype, seed, README, Playwright screenshots. Order per decision 7.

1. **Skill Tree** (`skills`): constellation, radar, character panel, 90-day XP bars, event list with drag-to-reassign setting `is_manual`. Mostly UI: `classify()`, `core.skill_xp` and `core.skill_links` already exist.
2. **Tasks** (`tasks`): six views, kanban with column-patch drops, month calendar, quick-add parser (`!p1`, `#project`, `@day`, `30m`), skill chips with inline creation, reminders.
3. **Goals** (`goals`): life-area grouping, pace marks, two projection models, check-ins, history chart, the metric-source picker reading the manifest registry.
4. **Onboarding** and **Weekly Review**: both need Tasks and Goals to exist. They share the `WizardShell`. The connector catalogue is a committed config file; providers without a manifest save as `status = 'requested'`.
5. **Finance** (`finance`): SimpleFIN, four KPIs, accounts table with share bars, 31-point net worth chart, upcoming charges, budgets with a month pace mark, three drawer kinds, configurable alert threshold.
6. **Second Brain** (`brain`) · 7. **Insurance** (`insurance`) · 8. **Ideas** (`ideas`) · 9. **Fitness** (`fitness`) · 10. **Health** (`health`) · 11. **Home** (`home`) · 12. **Meals** (`meals`) · 13. **Travel** (`travel`).

Health and Home schemas come from the handoff document with the same corrections applied: every table gains `created_at`, `updated_at`, `source`, `external_id` and a `unique (source, external_id)` for idempotent imports; each migration repeats the `notes` module's grant and RLS block including `alter default privileges ... to pos_readonly`; and `health.digest` and `home.digest` are deleted, because `core.digests` already holds every module's digest. Home's `guarded: ['write'] when it changes value_cents` cannot be expressed by a manifest, so revaluation becomes its own guarded `home.revalue` tool.

Two late passes: **push** (service worker, VAPID, subscription table, quiet-hours scheduler) and **mobile gestures** (swipe to complete, pull to sync, long-press arrange, segment swipe).

---

## Platform concerns map

| Area | How this build handles it |
|---|---|
| Frontend | Next 16 App Router, Tailwind v4 CSS-first, shadcn v4 on Base UI. 14 colour tokens, no other token layer. ~20 primitives in `components/pos/`, charts hand-rolled SVG. Module pages stay server components loading data, with client subtrees for drawers, tabs and drag. |
| Routing | Unchanged. Every module screen is one page with in-page tabs, so `pages: { '': XPage }` and the existing catch-all keep working. No module adds a file under `app/`. |
| State | Server state in Postgres. Theme, sidebar collapse and tile order in `core.settings` plus a cookie for first paint. Nothing important in localStorage; the prototypes' `localStorage` stores become `core.skill_overrides` and settings. |
| Auth | Unchanged: Supabase magic link, signups disabled, `requireOwner()` in the layout and independently in every server action. The design's single-seat denied state is already the repo's behaviour. |
| APIs | Server actions for UI writes, route handlers for cron, MCP, OAuth and webhooks. `withLog` and the rate limiter on every route in step 10. |
| Database | One schema per module plus `core`. Four new core tables plus `skill_overrides`. No cross-schema foreign keys and no cross-schema reads: digests and the metric registry instead. |
| Storage | One private bucket per module, created in step 10, signed URLs only. Health records, insurance PDFs, home warranties and service receipts all land there. |
| Jobs | One Vercel cron, `maxDuration = 300`, chunked with cursors. `core.job_runs` gets one row per invocation, `core.jobs` stays per-job current state, `core.write_log` rows carry the run id. |
| Notifications | Rules table with channels, timing, lead days, urgency, mute and snooze. Sender does email plus in-app now, push in its own late step. Quiet hours and urgent override are rule properties, evaluated by the sender. |
| Agents | Guard dispatcher reads `agent_autonomy` plus the manifest `guarded` list. Guarded agent calls write `core.proposals`. Every agent and job write also writes `core.write_log` with a before image, which is what makes Undo possible. UI writes are not logged: undo for those is the edit form. |
| Search | pgvector plus tsvector merged by reciprocal rank, one SQL statement. Powers the full page, the scoped combobox and ⌘K. |
| Mobile | Same routes and queries, responsive to 402px. Sidebar becomes a bottom tab bar, drawers become sheets. Gestures in a later pass. |
| Performance | Server components with the digest tables as the read cache. Sparklines and charts render server-side as SVG where the data is static. No chart library, no d3 until Travel. |
| Accessibility | 44px hit targets on mobile, 30-40px on desktop. `prefers-reduced-motion` disables the tap scale, the dot pulse and the constellation animation. Greyed items keep full opacity and use `--ink-3`, per the design, so text and buttons inside stay readable. Accent contrast is 3.8:1 on dark and 4.7:1 on light by the design system's own measurement, so accent is never the only carrier of meaning. |
| Security | Infra secrets in `.env`, account credentials encrypted in `core.connections`. Masked values decrypt server-side on an explicit reveal action and never appear in list payloads. Health records rely on RLS and bucket privacy, not field encryption, since the digest has to read them. |
| Cost | Classification is rules first. New entity types that cannot classify are opted out rather than falling through to the model. Model spend is visible on the dashboard tile and in Settings, capped by `llm_soft_cap_cents`. No new paid services. |
| Observability | `core.jobs`, `core.job_runs`, `core.write_log`, `core.request_log`, `core.llm_calls`, all surfaced on the Dashboard system and spend tiles and on Agent Log. |
| CI | typecheck, lint, vitest, plus Playwright against a local Supabase with the demo seed. |
| Recovery | Unchanged: nightly `pg_dump`, 30 days, restore drilled once. |

---

## Verification

Per step, and each one produces evidence pasted into the step's commit or the reply:

```
pnpm typecheck && pnpm lint && pnpm test
supabase db reset && pnpm setup --demo
pnpm test:e2e                      # new: Playwright, per-screen smoke + screenshots
```

Each Playwright spec logs in, loads one screen against seeded demo data, asserts its key elements and empty states exist, and captures 1440px and 402px shots in both themes. I compare each against its prototype and report the differences rather than claiming a match.

Phase 1 end-to-end, unchanged from the existing plan:

```
curl -s -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/nightly
psql "$LOCAL_DB_URL" -c "select name, last_status from core.jobs order by last_run desc limit 12"
psql "$LOCAL_DB_URL" -c "select count(*) from core.embeddings"
psql "$LOCAL_DB_URL" -c "select headline from core.dashboard_summary order by run_at desc limit 1"
psql "$LOCAL_DB_URL" -c "select status, count(*) from core.job_runs group by status"
```

Expected: every job `ok`, embeddings equal the seeded entity count, a headline exists, one email in the inbox, `tools/list` from Claude Code showing the module tools, CI green.

---

## Risks and open items

1. **Phase 1A is the long pole, accepted deliberately (decision 13).** Twenty primitives and a token swap before any new feature. It pays back across 22 screens, but the first step will feel slow and produces four rebuilt screens rather than new capability. Mitigation: it is verified against four screens that already exist, so it is reviewable the moment it lands.
2. **Onboarding step 4 seeds goals through `goals.write`**, so it cannot ship before Goals. Until then first run is `pnpm setup` plus the Settings page, which is what you use today anyway.
3. **The prototypes' inline `style-hover` attributes and per-screen keyframes are not in the design system.** Treat every `.dc.html` as layout and copy reference, never as markup to port.
4. **Weekly Review's close is described as one transaction** across `brain.write`, `tasks.reschedule`, goal check-ins and the `core.reviews` insert. Those are four tool calls on separate connections. It ships as a best-effort sequence with the review row written last, unless you want a transaction helper in `core/db.ts`.
5. **Undo of a create has nothing to redo against.** Deletes are hard and `write_log.entity_ref` goes null, so Redo would insert a new row with a new id. Redo will be offered for updates only.
6. **Blocking on you, unchanged from [docs/OWNER-TODO.md](docs/OWNER-TODO.md):** three provider keys pasted at Settings > Connections. Step 8 needs Voyage, step 12 needs Anthropic and Resend.
