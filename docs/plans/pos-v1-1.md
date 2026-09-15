# POS v1.1 build plan

Rules: one phase is one branch, one PR, and one fresh session. A phase is Done only when its exit checks pass and its PR is merged. Tick task boxes as they finish so progress survives compaction. Written 2026-09-14 by /adopt-repo from the owner's v1.1 list and the code as it stood at main 4c142e9; the interview decisions are in decisions/log.md under that date.

Order: bugs first, then speed, then features, fitness, hardening. Phases marked parallel-safe touch disjoint files and may run in separate worktrees.

## Status

| Phase | Goal | Complexity | Parallel-safe with | Depends on | Status | PR |
|---|---|---|---|---|---|---|
| 1 Diagnose and small fixes | Push and email diagnosed with evidence; snooze, deep links, health corner, time clear, splash, nightly email fixed | medium | 3, 8, 9, 10 | none | Done 2026-09-14: push was a malformed VAPID key, email was the quiet-night skip; PR open | #53 |
| 2 Delete notes stub | modules/notes and every test and seed that leans on it gone | medium | 3, 8, 9, 10 | none | Done 2026-09-15: folder, schema and fixtures gone; tests and seed lean on ideas; PR open | |
| 3 Speed, server | Server time per screen measured and waterfalls removed | medium | 1, 2, 8, 9, 10 | none | Done 2026-09-15: `/` 43 percent off, `/tasks` shell-bound at the 250 ms floor; pdx1 tried and reverted; PR open | |
| 4 Speed, client | Task view switch is instant, no refetch | low | 8, 9, 10 | 3 | Not started | |
| 5 Dashboard | Layout saved server-side, live tiles, drill-ins, smaller tiles | high | 8, 9, 10 | 3, 4 | Not started | |
| 6 Goals, projects, tasks | Projects link to goals, tasks inherit, project UI, per-view plus, any due date | high | 8, 9, 10 | 4 | Not started | |
| 7a Skill picker, core | link/unlink tools, one reader, one component; tasks, goals, ideas, brain | medium | 8, 9, 10 | 6 | Not started | |
| 7b Skill picker, rest | Trip, policy, recipe, workout, home, health drawers | low | 8, 9, 10 | 7a | Not started | |
| 8 Skill tree gestures | Phone drag and pinch behave like the globe | medium | 1 to 7, 9, 10 | none | Not started | |
| 9 Travel destinations | Multi-destination trips, all pinned, merge into | high | 1 to 8, 10 | none | Not started | |
| 10 Finance chart | Net worth on a 30-day date axis with the average | low | 1 to 9 | none | Not started | |
| 11 Fitness | Trends, history filters, plan form, Apple arrival on Sync | high | none | 10, 7b | Not started | |
| 12 Hardening | error pages, audit step, branch protection, route limits, rotation doc | low | none | all | Not started | |

Every UI phase's exit checks include: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` pass; an e2e in `e2e/screens.spec.ts` for the flow (workers 1, never overridden); ui-verifier at 402 and 1440 px with no Must fix; spec-reviewer before the PR. Not repeated per phase.

## Phase 1: diagnose and small fixes

Goal: push enable and the nightly email are explained with evidence, and the small bugs are fixed.
Complexity: medium
Parallel-safe with: 3, 8, 9, 10
Files: `proxy.ts`, `next.config.ts`, `core/notify.ts`, `core/orchestrator.ts`, `app/(app)/notifications/actions.ts`, `app/(app)/Inbox.tsx`, `app/(app)/page.tsx`, `app/(app)/DashboardTiles.tsx`, `core/module-contract.ts`, five manifests' `review.upcoming`, `modules/tasks/ui/TaskDrawer.tsx`, `app/layout.tsx`, `public/splash/`, `docs/PUSH.md`, `docs/STATUS.md`.

- [x] Push diagnosis, in order, stop at the first hit. (a) Logged in, on desktop, Network tab while pressing "Turn on push for this device": the `/sw.js` response status and content-type. Verified already: uncookied `/sw.js` is `307 -> /login` because `proxy.ts:52` excludes `icons/` and `manifest.webmanifest` but not `sw.js`; a worker script fetched through a redirect is rejected by the browser. If the logged-in fetch also redirects or returns HTML: add `sw.js` to the matcher exclusion (one token, the script is static and public) and re-test on both devices. (b) Vercel Production env: `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` both present, public key 87 chars base64url (a malformed key throws from `pushManager.subscribe`). (c) On a branch, split the four awaits in `Devices.tsx` `enable()` into four catches with distinct toast prefixes so the toast names the failing step. (d) Add `worker-src 'self'` to the CSP in `next.config.ts` only if the console shows a CSP report. Decision point after (a) to (c): fix the one that failed; write the cause into `docs/PUSH.md`.
- [x] Email diagnosis. Method: (1) Agent Log or `select last_status, log from core.jobs where module = 'core' and name = 'notify'`; (2) `select count(*) filter (where sent_at is null), max(sent_at) from core.notifications`; (3) Vercel Crons tab and runtime logs for `/api/cron/nightly` at 09:00 UTC, last 7 days; (4) Resend dashboard Emails list. Expected finding: quiet nights queued nothing (by design until now). `Digest email refused` in the log means recipient or sandbox sender; no cron hits means the cron is not attached to the production deployment.
- [x] Nightly email every night (decided): in `assembleSummary` (`core/orchestrator.ts:263`) drop the early return; when `alerts.length === 0` the body opens "Nothing needs you today" followed by the headline numbers. `sendPending` unchanged. Unit test in `core/orchestrator.test.ts` style: zero alerts still queues one `digest` row.
- [x] Snooze no-op: add `snoozeNotification(id, days)` in `core/notify.ts` writing the unused `core.notifications.snooze_until`; action `snoozeAlert` in `notifications/actions.ts`; `Inbox.tsx` calls it; `unreadWarnings()` in `page.tsx` adds `and (snooze_until is null or snooze_until < now())`. `pending()` already honours the column. `snooze` (rules) stays for the Notifications screen. Unit test for the gate.
- [x] Next 7 days deep link: `href?: string` on `ReviewItem` in `core/module-contract.ts` (as `LinkedItem` has). Tasks sets `/tasks?task=<id>` (the drawer already opens from `?task=`, `Board.tsx:97`); travel `/travel?trip=<id>`; finance, insurance, home set their own drawer param (read each Page for the name). `SevenDays` in `DashboardTiles.tsx` uses `item.href ?? '/' + item.module` in both Links.
- [x] System health corner: remove the `jobs` tile from `ORDER` and the tiles array in `page.tsx`; the existing status-dot eyebrow (`page.tsx:402`) becomes a Link to `/agent-log` reading "Last run 04:02 CDT · ok · Agent Log". Delete `JobRows` from `DashboardTiles.tsx`; delete `HeatStrip` from `components/pos/charts.tsx` and `index.ts` if `grep -rn HeatStrip` finds no other caller.
- [x] Task time clear: in `TaskDrawer.tsx` next to the `type="time"` input (line 204) a small "clear" button when `draft.time` is set that sets it to `''`. Save already sends null for empty.
- [x] Goal deadline repro on Chrome on Mac: open `/goals`, New goal, click the month segment, type `1 2 2 0 2 6`. If the segments refuse input, `grep -n onKeyDown components/pos/Overlay.tsx modules/goals/ui/*.tsx` for a handler swallowing keys, and check `min={todayIso}` on `GoalList.tsx:359`. Native `<input type="date">` stays everywhere (types in Chrome, wheel on iOS; ladder rung 4). Record the result for Phase 6.
- [x] iOS splash: `app/layout.tsx` metadata `appleWebApp: { capable: true, title: 'POS', statusBarStyle: 'black-translucent', startupImage: [{ url: '/splash/iphone-16-pro-max.png', media: '(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)' }] }`. One 1320 x 2868 PNG, ground `#07080A`, the logo from `public/icons/icon.svg` centred, made once locally, committed under `public/splash/`. A link tag: zero load cost. iOS caches it at install; verify by removing and re-adding the app. Android already shows the manifest splash.
- [x] e2e: a Next 7 days row's href contains `?task=`; Snooze 1d row disappears and stays gone after reload.

Exit checks: suites green; push cause in `docs/PUSH.md`; email finding in `docs/STATUS.md`.
Depends on: none. Out of scope: any push or email code change beyond what the diagnosis names.
Notes: the proxy candidate explains both devices failing at once, which a browser-specific cause would not. Bugs with an unknown cause get a method and a decision point, not a guessed fix.
Done 2026-09-14. The proxy was not it: signed in, `/sw.js` is 200. The shared cause was the `VAPID_PUBLIC_KEY` value in Vercel failing `atob`; regenerated and set again, the desktop subscribed. The email was the quiet-night skip, now removed. For later phases: Phase 2 leaves the bento at 16 tiles in 3 columns (one trailing empty cell at 1440, already one at 17), Phase 5 owns that layout. Phase 6: Chrome's date input takes typed dates once hydrated; a two-digit year gives year 0026 and `min` blocks the submit with the browser's message, and keys typed before hydration are dropped. The dashboard Warnings tile now shows the quiet-night digest row until read. Local typecheck and build fail on macOS from the tracked `Passkeys.tsx`/`passkeys.ts` and `Session.tsx`/`session.ts` casing pairs (since #41); CI on Linux passes; a rename belongs in Phase 12 or a small fix PR.

## Phase 2: delete the notes stub

Goal: `modules/notes` is gone and nothing in core, tests or seed depends on it.
Complexity: medium
Parallel-safe with: 3, 8, 9, 10
Files: `modules/notes/` (delete), migration `supabase/migrations/2026091500xxxx_notes_drop.sql`, `core/events.test.ts`, `core/entities.test.ts`, `core/classifier-seam.test.ts`, `core/proposals.test.ts`, `core/mcp.test.ts`, `core/reviews.ts`, `e2e/seed.mts`, `e2e/screens.spec.ts`, `docs/ARCHITECTURE.md`, `docs/SPEC.md`, `docs/STATUS.md`.

- [x] Migration: delete `core.entities` rows where `module = 'notes'` (skill_links cascade), then `drop schema notes cascade`. The shipped `20260905223936_notes_init.sql` stays.
- [x] `rm -r modules/notes`; `pnpm gen:index` rewrites `modules/_index.ts`. Fix `core/reviews.ts` reference.
- [x] Core tests that only need a module string keep `'notes'` as a fake id; `proposals.test.ts` and `mcp.test.ts` that write `notes.note` through `callTool('notes','write')` switch to `ideas.write` (unguarded, one table, registers) and assert against `ideas.idea`.
- [x] `e2e/seed.mts`: replace the notes seed with ideas rows for the classified entities and the two proposals with `ideas.write` payloads; keep agent names so Agent Log tests keep their rows.
- [x] `e2e/screens.spec.ts`: delete the notes page test; retarget the palette, review approve, agent log and dashboard assertions to Ideas; fix the "3 notes" skill tree copy.
- [x] Docs: ARCHITECTURE and SPEC point "copy this folder to start a module" at `modules/ideas`.

Exit checks: `pnpm test` green (822 minus the deleted); `pnpm test:e2e` green; `pnpm setup:demo` on a fresh local database succeeds.
Depends on: none. Out of scope: any other module.
Notes: its own PR because six test files and the seed lean on notes.

## Phase 3: speed, server

Goal: the server half of every screen is measured and the waterfalls are gone.
Complexity: medium
Parallel-safe with: 1, 2, 8, 9, 10
Files: `core/settings.ts`, `core/today.ts`, `core/modules.ts`, `core/review-registry.ts`, `core/db.ts`, `app/(app)/page.tsx`, `app/(app)/[module]/[[...path]]/page.tsx`, `vercel.json`, `docs/plans/pos-v1-1.md` (numbers).

- [x] Measure first and write the numbers into the plan: `curl -o /dev/null -w '%{time_starttransfer}\n' -H "cookie: $SESSION"` five times each for `/`, `/tasks`, `/goals`, `/fitness`, `/travel` on production; the same routes' durations from Vercel runtime logs; a local `pnpm build && pnpm start` run so compile time is out.
- [x] Region check (pdx1 tried on the preview and reverted, see the table's notes): Vercel function region versus the Supabase project region. A page does 6 to 13 round trips across that gap. If they differ, set `regions` in `vercel.json` to the Supabase region (verify Hobby allows it) and re-measure.
- [x] Dedupe per request with React `cache()` (native, request scoped, no staleness): wrap `getSettings`, `getSetting`, `ownerToday`, `getSkillNames`. Layout and page both read settings; `getNav` and `getOffRailNav` each call `getSetting('modules_enabled')`; Goals calls `ownerToday` once per goal through Tasks' `linked`.
- [x] `page.tsx:120`: move `ownerToday()` into the `Promise.all`.
- [x] `core/review-registry.ts` `gather()`: `Promise.all` over modules with the try/catch inside the map.
- [x] Module catch-all: render `<Page />` immediately; the Not syncing banner becomes a small async server component under `<Suspense fallback={null}>` so `missingConnections()` streams in.
- [x] `core/db.ts:92` pool `max: 4` to `8`: the transaction pooler multiplexes and a dashboard render fires eight queries at once. Re-measure; revert if the pooler reports pressure.
- [x] Tasks `listSkillLinks` (`modules/tasks/data.ts:162`): join `tasks.task` with the same window `listTasks` uses. Skip if under 20 ms. Skipped: 1 ms for 51 rows over 415 links locally (2026-09-15).

Exit checks: before and after table in the plan doc, at least 30 percent off TTFB on `/` and `/tasks`; suites green; e2e unchanged.

Measured 2026-09-15 from the owner's logged-in Chrome tab: `fetch(route, { cache: 'no-store' })`, 12 runs after a warm-up, median. "Done" is time to the end of the response body; "shell" is time to headers, which under `app/(app)/loading.tsx` is only the layout, so shell alone understates a page. Before is production `pos-gilt-rho.vercel.app` at main 10fa287; after is this branch's preview, same database, functions in `iad1` and pool max 8. Queries are `pg_stat_statements` calls for one render of a local `next build` and `next start`, of which five are the session refresh in the auth schema.

| Route | Done before (ms) | Done after (ms) | Change | Shell before | Shell after | Queries before | Queries after |
|---|---|---|---|---|---|---|---|
| `/` | 661 | 377 | -43% | 276 | 374 | 24 | 20 |
| `/tasks` | 268 | 255 | -5% | 266 | 254 | 16 | 15 |
| `/goals` | 323 | 254 | -21% | 283 | 252 | 32 | 23 |
| `/fitness` | 467 | 267 | -43% | 460 | 265 | 26 | 25 |
| `/travel` | 332 | 279 | -16% | 331 | 271 | 18 | 18 |
| `/review` | not measured | not measured | | | | 13 | 11 |

The exit check holds on `/` and not on `/tasks`. Every route now sits on the same floor, about 250 ms, which is the fixed cost per request: a function that touches no database (`/api/cron/nightly` unauthenticated, 401) answers in 150 ms, and the layout then runs `requireOwner()` (an HTTP call to Supabase Auth in us-west-2) followed by its six queries, two serial hops of about 55 ms each. `/tasks` was already one batch of queries behind that floor, so nothing in this phase's files could move it.

What was tried and reverted: `regions: ["pdx1"]` (Hobby honours it; the preview's functions ran in pdx1). The owner's nearest edge is iad1, and the edge to pdx1 hop cost about 100 ms on every request (the 401 route went from 150 to 256 ms), which cancelled the saving on `/` and made `/tasks` slower. Functions stay in iad1 beside the owner. The move that would take the floor down is the database beside the function: a Supabase project in us-east-1, which is a data migration and an owner decision, not a config line. Pool max 4 was also re-measured on the preview and was slower than 8 on every route (`/` 387, `/goals` 322, `/fitness` 379 done), because a dashboard render now fires its queries at once and queued behind the layout's.

Vercel runtime logs could not supply durations: on this plan they keep only requests that write output, and a page render writes none (one cron line in three days). Local TTFB was 23 to 40 ms before and after on every route: the database is on the same machine there, so round trips cost nothing and the gain does not show locally.
Depends on: none. Out of scope: TTL caches, `unstable_cache`, ISR.
Notes: removing repeated reads and serial awaits is safe and measurable; a TTL cache would hide the freshness work Phase 5 needs.

## Phase 4: speed, client

Goal: switching a task view changes the columns in the same frame with no server round trip.
Complexity: low
Parallel-safe with: 8, 9, 10
Files: `components/pos/searchState.ts`, `modules/tasks/ui/Board.tsx`, `modules/fitness/ui/Fitness.tsx`, `modules/finance/ui/Finance.tsx`, `e2e/screens.spec.ts`.

- [ ] `searchState.ts` `set()` gains `{ local?: boolean }`: when set, `window.history.replaceState(null, '', url)` instead of `router.replace`. Next's app router syncs `useSearchParams` from native `replaceState` (verify on Next 16 with context7 before building). The file's ponytail note is about drawers racing a server action; a view switch has no action.
- [ ] `Board.tsx:185` Segments `onChange`, the filter pills, and `setExpanded` pass `local: true`. Drawers keep `push`. `columnsFor` is already pure client bucketing.
- [ ] Fitness tabs and Finance segments pass `local: true` too.
- [ ] `next/dynamic` for `Calendar` and `TaskDrawer` in `Board.tsx` (rendered only when `month=1` or a drawer is open). Leave `Constellation` static: it is the skills page's content.
- [ ] Measure: Playwright, click each of the six view tabs, count requests whose URL contains `_rsc` (before one per click, after zero) and time from click to column heading change; `pnpm build` route size table before and after.

Exit checks: e2e "tasks, the six views" asserts zero `_rsc` requests; the finance segments swipe test still sees the URL follow.
Depends on: 3. Out of scope: prefetching, optimistic drawers.

## Phase 5: dashboard

Goal: the dashboard shows this minute's numbers, remembers one layout on the server, every row goes somewhere, and tiles are as tall as their content.
Complexity: high
Parallel-safe with: 8, 9, 10
Files: `core/settings.ts`, `app/(app)/shell-actions.ts`, `app/(app)/Bento.tsx`, `app/(app)/page.tsx`, `app/(app)/Inbox.tsx`, `core/notify.ts`, `core/orchestrator.ts`, `modules/insurance/jobs/nightly-digest.ts`, `core/tools.ts`, `core/digests.ts`, `core/jobs.ts`, migration `2026091500xxxx_core_notification_href.sql`, `e2e/screens.spec.ts`.

- [ ] Layout setting: `dashboard_layout: { order: string[]; hidden: string[] } | null` in `Settings` and `DEFAULT_SETTINGS` (`core.settings` is key/value jsonb, no migration). Server action `saveDashboardLayout` in `shell-actions.ts`: `requireOwner`, zod `array(string().regex(/^[a-z0-9_-]{1,40}$/)).max(40)` for both lists, `setSetting`. The key is fixed in the action.
- [ ] `Bento.tsx`: take `layout` as a prop from `page.tsx`, delete the localStorage store and `useSyncExternalStore`; arrange mode adds Hide/Show beside the arrows and a hidden list at the foot; Reset saves null. One layout for both widths; `PHONE_TILES` stays the phone subset.
- [ ] Shrink: `[grid-auto-rows:minmax(200px,auto)]` to `auto` and drop `h-full` from `tileClass` so a tile is as tall as its content; ui-verifier judges `content-start`.
- [ ] Notification href: migration adds `href text` to `core.notifications` (existing core table: a column add restates nothing). `queue()` takes `href?`; insurance `nightly-digest.ts:29` passes `/insurance`; `assembleSummary` passes `/notifications`. `WarningList` row title becomes a Link to `href ?? '/notifications'`.
- [ ] Freshness, write side: in `core/tools.ts` after `const result = await tool.run(...)` (line 139) and before the write log: `if (toolName !== 'get_digest') await writeDigest(manifest)` in a try/catch that logs and never fails the write. `query` returned at line 98; `get_digest` is the one read a manifest names; everything else is a write by contract. `writeDigest(manifest)` is the loop body of `writeDigests()` extracted in `core/digests.ts`.
- [ ] Freshness, read side: `page.tsx` module tiles map over `await latestDigests()` (`core/digests.ts:39`) filtered to enabled modules, instead of `summary.modules`. `latestSummary()` still supplies the headline, alerts and Last run. The Finance tile therefore appears whenever finance has any digest, which is the "finance graph missing" fix.
- [ ] Prune: `core.digests` grows one row per write. Nightly `prune` keeps every row from the last 2 days and past that only the newest per module per day, so `digestsBefore(7)` still finds last week.
- [ ] Desktop reload and pull-to-refresh already re-render (every action calls `revalidatePath('/', 'layout')`; `PullToRefresh` calls `router.refresh`); assert, do not change.
- [ ] e2e: complete a task on `/tasks`, go to `/`, the Tasks tile moved without Run now; hide a tile, reload, still hidden; a warning row is a link.

Exit checks: `core/tools.test.ts` gains a test that a write tool leaves a newer `core.digests` row and `get_digest` does not; suites green.
Depends on: 3, 4. Out of scope: per-device layouts, tile resizing.
Notes: the sync recompute costs one `get_digest` per UI write. If a write feels slower after measuring, move it into the server actions' `after()`; `callTool` also runs from cron and MCP where `after()` has no request scope, so the sync call is the correct first version.

## Phase 6: goals, projects, tasks

Goal: a project can point at a goal, its tasks count toward that goal unless they say otherwise, projects can be made and edited, a task can take any due date, and every view has a prefilled plus.
Complexity: high
Parallel-safe with: 8, 9, 10
Files: migration `2026091500xxxx_tasks_project_goal.sql`, `modules/tasks/data.ts`, `modules/tasks/manifest.ts`, `modules/tasks/shape.ts`, `modules/tasks/ui/Board.tsx`, `modules/tasks/ui/TaskDrawer.tsx`, new `modules/tasks/ui/ProjectsDrawer.tsx`, `modules/tasks/ui/actions.ts`, `modules/tasks/ui/TasksPage.tsx`, new `modules/tasks/data.test.ts`, `modules/tasks/shape.test.ts`, `modules/goals/ui/GoalDrawer.tsx` (only if Phase 1 found a bug), `e2e/screens.spec.ts`.

- [ ] Migration: `alter table tasks.project add column goal_ref uuid references core.entities (id) on delete set null` (through core, as `tasks.task.goal_ref` is). Backfill: a project whose open tasks all carry the same non-null `goal_ref` gets it; anything else stays null.
- [ ] Test first (`modules/tasks/data.test.ts` against `pos_test`, like `core/proposals.test.ts`): a task with no goal in a project linked to goal G is returned for G; a task in that project with its own goal H is returned for H, not G.
- [ ] `data.ts` SELECT: `coalesce(t.goal_ref, p.goal_ref) as goal_ref`, plus `t.goal_ref as own_goal_ref`, `p.goal_ref as project_goal_ref`; the `linked` seam and `listByGoal` read the coalesce. `listProjects` returns `goal_ref`. `Task` gains `ownGoalRef`, `projectGoalRef`.
- [ ] Tools: `write_project { id?, name, goal_ref?, archived? }` reusing `findOrCreateProject`; a `PATCHABLE` whitelist like `patchTask`. `write` keeps taking `project` by name.
- [ ] `ProjectsDrawer.tsx`: opened from a "Projects" button in the By project view; rows with name (`InlineEdit` from `components/pos/edit.tsx`), goal select, archive; a New project input. Action `writeProject` through `callTool('tasks','write_project')`.
- [ ] `TaskDrawer`: goal select binds `ownGoalRef`; when empty and `projectGoalRef` is set the caption reads "inherits <goal> from the project".
- [ ] Any due date: keep the preset select and add option `date` that reveals a native `<input type="date">` beside it (`fieldClass`, no library); an existing arbitrary date opens with `date` selected. Replaces the prepended-option trick at line 175.
- [ ] Per-view plus: each column header gets a plus that opens the drawer with `prefill` built by the existing `dropPatch(column.drop)` (`Board.tsx:136`), which already yields `due_on`, `goal_ref` or `project`. The band plus uses the first column of the current view. `TaskDrawer` takes `prefill?: Partial<WriteInput>`.
- [ ] Goals side: nothing reads tasks directly; Goals gets inherited tasks through `linked` for free. Apply the Phase 1 deadline finding if it was a code bug.
- [ ] e2e: create a project with a goal, quick-add a task with `#project`, the goal on `/goals` lists it; the By goal plus opens the drawer with that goal preselected; a typed date shows.

Exit checks: `shape.test.ts` green (bucketing unchanged); new data test green; suites green.
Depends on: 4. Out of scope: goal hierarchy on the Goals screen, project archive views.
Notes: inheritance is one SQL expression both the board and the `linked` seam read, so they cannot disagree.

## Phase 7a: skill picker, core and the four chip sites

Goal: every entity drawer can add a skill link by hand with one shared component.
Complexity: medium
Parallel-safe with: 8, 9, 10
Files: new `core/skill-links.ts`, `modules/skills/manifest.ts`, `modules/skills/classify.test.ts`, `app/(app)/settings/skills/actions.ts`, new `components/pos/SkillPicker.tsx`, `components/pos/index.ts`, `modules/{tasks,goals,ideas,brain}/data.ts` and their page and drawer files.

- [ ] Test first in `classify.test.ts`: after `link` runs, `classify()` on the same entity leaves the manual row; `unlink` removes it.
- [ ] Tools in `modules/skills/manifest.ts`: `link { entityRef, skillId }` upserts `confidence 1, classified_by 'human', is_manual true` (the statement `reassign` uses at line 96); `unlink` deletes the row. `guarded` stays `[]`.
- [ ] `core/skill-links.ts`: `listSkillLinks(module, entityType)` (core's own table, allowed). Delete the five copies in `modules/{tasks,goals,brain,ideas,fitness}/data.ts`.
- [ ] Server actions `linkSkill`, `unlinkSkill` in `app/(app)/settings/skills/actions.ts` (already calls `callTool('skills', ...)`), zod uuid and the skill id regex from `write`; `revalidatePath('/', 'layout')`.
- [ ] `components/pos/SkillPicker.tsx` (client): props `{ entityRef, links: { id, name, by, confidence }[], skills: { id, name }[] }`. Chips with TaskDrawer's MANUAL / RULES / MODEL badge, each a link to `/skills?skill=<id>` with an x calling `unlinkSkill`, and a plus revealing a native select of unlinked skills calling `linkSkill`. `useOptimistic`. Imports only the action file and `components/pos`.
- [ ] Skill list source: pages already call `getSkillNames()` (`core/modules.ts:52`); pass `Object.entries(names)` down as a prop. The client never imports the registry.
- [ ] Entity refs: tasks SELECT joins `core.entities` for `entity_ref`; goals already has `entityRefs()`; ideas and brain the same way.
- [ ] Replace chip markup in `TaskDrawer.tsx:250`, `GoalDrawer.tsx:270`, `IdeaDrawer.tsx:211`, `NotePane.tsx:296` with `<SkillPicker />`.
- [ ] e2e: press plus on a task, pick a skill, the chip shows MANUAL; reload, still there; the Skill Tree lists the entity under it.

Exit checks: suites green; `grep -rn "from core.skill_links" modules` shows only `modules/skills`.
Depends on: 6. Out of scope: editing confidence, reassign UI changes.

## Phase 7b: skill picker, remaining drawers

Goal: trips, policies, recipes, workouts, home assets and health records get the same picker.
Complexity: low
Parallel-safe with: 8, 9, 10
Files: `modules/travel/ui/TripDrawer.tsx`, `modules/insurance/ui/PolicyDrawer.tsx`, `modules/meals/ui/*Drawer.tsx`, `modules/fitness/ui/Fitness.tsx`, `modules/home/ui/Drawers.tsx`, `modules/health/ui/HealthDrawer.tsx`, their `data.ts` and page files.

- [ ] Each: page calls `listSkillLinks(module, type)` and `getSkillNames()`, the row query exposes `entity_ref`, the drawer renders `<SkillPicker />` in a "Linked skills" block.
- [ ] Fitness: the workout row expands to hold the picker; the table column keeps the first name.
- [ ] e2e: one drawer per module shows the block; one link added on a trip.

Exit checks: suites green. Depends on: 7a. Out of scope: entity types with no drawer (list them in STATUS).

## Phase 8: skill tree gestures

Goal: on the phone, dragging the constellation pans it and pinching zooms it, with no page scroll, refresh or back navigation firing.
Complexity: medium
Parallel-safe with: 1 to 7, 9, 10
Files: `modules/skills/ui/Constellation.tsx`, `modules/skills/view.ts` and `view.test.ts`, `components/pos/PullToRefresh.tsx`, `components/pos/gestures.ts` (`useEdgeBack`), `modules/travel/ui/Globe.tsx` (attribute only), `e2e/screens.spec.ts`.

- [ ] Diagnosis first at 402 with `hasTouch`: drag down on the sky at `scrollY` 0 and watch for "Release to refresh"; drag right from the left 20 px and watch for a back navigation; second finger mid-pan and watch the jump. Three candidates the globe does not suffer: `PullToRefresh` listens on `document` (`PullToRefresh.tsx:49`) and fires on a downward drag from the top (the sky sits at the top on a phone, the globe does not); `useEdgeBack` listens on `window`; `Constellation` keeps one `drag.current`, so a second pointer overwrites the start and there is no pinch.
- [ ] Test first in `view.test.ts`: pure `pinch(view, before, after, midpoint)` scales zoom by `after / before` about the midpoint, clamped.
- [ ] Port the globe's pointer model (`Globe.tsx:72-143`) into `Constellation.tsx`: `pointers` Map by `pointerId`, one pointer pans, two pinch about the midpoint, `onPointerLeave` lifts, 4 px slop, no capture (the `panned` ref already guards clicks). Keep the wheel listener and the fly.
- [ ] Mark the sky `data-gesture-surface`; `PullToRefresh` `down()` and `useEdgeBack` `down()` ignore a target inside it, the same `closest()` clause `PullToRefresh` already uses for `[role="dialog"]`. The globe gets the attribute too.
- [ ] e2e mobile: a touch drag on the sky changes the group transform, no "Release to refresh", URL unchanged; a drag from x 8 to x 120 stays on `/skills`.

Exit checks: `view.test.ts` green; owner confirms pinch on the phone (Playwright cannot dispatch two touches; say so in the PR).
Depends on: none. Out of scope: momentum, double-tap zoom.

## Phase 9: travel destinations and merge

Goal: a trip holds several destinations with their own dates, every one is pinned, and four trips can be folded into one.
Complexity: high
Parallel-safe with: 1 to 8, 10
Files: migration `2026091500xxxx_travel_destinations.sql`, `modules/travel/data.ts`, `modules/travel/manifest.ts`, `modules/travel/ui/actions.ts`, `modules/travel/ui/TripDrawer.tsx`, `modules/travel/ui/Travel.tsx`, `modules/travel/ui/TravelPage.tsx`, `modules/travel/jobs/nightly-digest.ts`, `modules/travel/README.md`, `e2e/seed.mts`, `e2e/screens.spec.ts`.

- [ ] Migration: `travel.destination (id, trip_id not null references travel.trip on delete cascade, name not null, lat, lon numeric(8,5), starts_on, ends_on, position int default 0, created_at, updated_at, check (ends_on >= starts_on))` with the trigger, RLS, policies and grants block copied from `20260911230000_travel_budget_lines.sql`. Backfill: one row per trip where `destination <> '' or lat is not null`, copying `destination, lat, lon, starts_on, ends_on`. Copy rather than fall back: pins, the digest and `completeFinishedTrips` then read one table.
- [ ] Trip columns stay and mean the summary: `write_trip` takes `destinations: [{ id?, name, lat, lon, starts_on, ends_on }]`, replaces the set, and writes `trip.starts_on / ends_on` as min and max and `trip.destination / lat / lon` from the first row. Every existing reader keeps working untouched.
- [ ] `data.ts` `listDestinations()`; `TravelPage` maps them into `data.destinations`.
- [ ] `TripForm`: destination, lat, lon, depart, return become one row of a list; a plus under the rows adds another; each row keeps the `suggestPlaces` datalist logic and gets a remove. Wishlist mode keeps one row.
- [ ] Pins (`Travel.tsx:136`): one upcoming pin per destination with coordinates; a trip with no rows falls back to its own lat/lon.
- [ ] `completeFinishedTrips`: one `place_visited` per destination with coordinates, `external_id 'dest-<id>'`, `visited_on` the destination's `ends_on`; keep `'trip-<id>'` for a trip with none.
- [ ] Merge: tool `merge_trip { id, into }`, guarded. Every row pointing at A (`itinerary_item`, `packing_item`, `budget_line`, `destination`, `place_visited`) is re-pointed at B, A's own place and dates become one more destination of B, B's span is recomputed, A and its `core.entities` row are deleted. Nothing summed except the span. Drawer: "Merge into" select of other trips with a confirm. Action `mergeTrip`.
- [ ] Digest: span unchanged; destination count added to the payload.
- [ ] e2e: seed one trip with two destinations, both pins render; add a third in the form; merge a second trip in, pin count grows by one, old trip gone.

Exit checks: a unit test for the span recompute (pure); suites green.
Depends on: none. Out of scope: per-destination itineraries and budgets.

## Phase 10: finance net worth chart

Goal: the 30-day chart draws two days of data as two points on a 30-day axis and shows the average.
Complexity: low
Parallel-safe with: 1 to 9
Files: new `modules/finance/series.ts` and `series.test.ts`, `modules/finance/data.ts`, `modules/finance/ui/Finance.tsx`, `modules/finance/ui/Tile.tsx`, `modules/finance/jobs/nightly-digest.ts`, `components/pos/charts.tsx`.

- [ ] Test first: `spine(points, days, todayIso)` returns `days` entries back from today, known values in place, earlier days null, gaps after the first point filled forward; average over known points only.
- [ ] `netWorthSeries` stays the raw read; `FinancePage` and the digest call `spine()`; the digest's `netWorthSeries` becomes the spined dollars (nulls kept); `changeCents` compares against the first known point.
- [ ] `NetWorthChart`: x by day index over 30; nulls break the line; y padded 5 percent each side, a flat series drawn mid-height; `EmptyState` only under 1 known point; High, Low, Avg from known points; an average line.
- [ ] Extract axis and line into `LineChart` in `components/pos/charts.tsx` (dates, values with nulls, unit formatter, height) so Phase 11 reuses it; `NetWorthChart` becomes a thin wrapper.
- [ ] `Tile.tsx`: `Sparkline` takes the spined series with nulls skipped; hidden only with no known point.
- [ ] e2e: seed two `balance_daily` days; the polyline has two points at x 28/29 and 29/29 of the width.

Depends on: none. Out of scope: account-level lines.

## Phase 11: fitness

Goal: Fitness shows trends per metric, a filterable history, a plan form, and Sync now says when Apple data last arrived.
Complexity: high
Parallel-safe with: none
Files: `integrations/health_auto_export/client.ts` and test, `modules/fitness/data.ts`, `modules/fitness/manifest.ts`, `modules/fitness/ui/FitnessPage.tsx`, `modules/fitness/ui/Fitness.tsx`, new `modules/fitness/ui/PlanDrawer.tsx`, `modules/fitness/ui/sync.ts`, `modules/fitness/ui/actions.ts`, `modules/health/ui/HealthPage.tsx` (assert only), `e2e/seed.mts`, `e2e/screens.spec.ts`.

- [ ] Owner step (OWNER-TODO 15): Health Auto Export Premium, one export to the webhook. Read the body from `core.request_log` through the integration's Test view; save it as the fixture for `client.test.ts` (written before the field-name fixes); correct the names marked verify in `client.ts`.
- [ ] `data.ts`: `metricSeries(kind, days)` over `fitness.body_metric`; `listWorkouts` gains `{ kind?, source?, from?, to?, limit }`; `lastArrived()` = max `created_at` over `body_metric` and `workout` where `source = 'health_auto_export'`.
- [ ] Trends tab: select of kinds present, `PillGroup` 30 / 90 / 365, `LineChart` from Phase 10 with the unit formatter from `units.ts`. 30 days rendered server side; 90 and 365 through a `readMetricSeries` server action.
- [ ] Workouts tab: filter row (kind, source, two native date inputs), state in the URL through `useSearchState` with `local: true`.
- [ ] Plan: `PlanDrawer.tsx` creating or editing `fitness.plan` and items (day label, exercise, sets, reps, target weight) through `callTool('fitness','write_plan')` (UI source is never guarded); read the tool's input shape at `manifest.ts:127` first.
- [ ] Sync now: `SyncBand` `at` becomes the later of the Strava job and `lastArrived()`, with a second line "Apple data last arrived <when>".
- [ ] Health: `HealthPage.tsx:41` reads `readMetric('fitness.body_weight')` live; add the e2e assertion that a new weight shows on `/health` after a webhook post; no code change expected.
- [ ] e2e: seed 40 days of weight, Trends draws it; the filter narrows the list; the plan drawer saves a two-day plan.

Exit checks: `client.test.ts` against the real fixture green; suites green.
Depends on: 10, 7b. Out of scope: Strava changes, coach rule changes.

## Phase 12: hardening

Goal: the prod-audit gaps are closed.
Complexity: low
Parallel-safe with: none
Files: new `app/error.tsx`, `app/global-error.tsx`, `.github/workflows/ci.yml`, `app/api/mcp/route.ts`, `app/api/integrations/[id]/webhook/route.ts`, `app/api/integrations/[id]/oauth/*/route.ts`, `docs/RESTORE.md`, `docs/SETUP-SUPABASE.md`, `CLAUDE.md`.

- [ ] `app/error.tsx` and `app/global-error.tsx`: client components, headline, the digest, retry; imports from `components/pos` only.
- [ ] `ci.yml` check job: `pnpm audit --prod --audit-level=high` after install.
- [ ] Backup: `docs/RESTORE.md` adds the storage bucket to the backup and restore steps (verify the `supabase storage` CLI subcommands).
- [ ] Branch protection: repo is public, so free allows it. `gh api -X PUT repos/<owner>/pos/branches/main/protection` requiring `check` and `screens`; update the CLAUDE.md sentence.
- [ ] `export const maxDuration`: MCP 60, webhook 30, OAuth start and callback 30.
- [ ] Secret rotation paragraph in `docs/SETUP-SUPABASE.md`: each secret, where it is set, what rotating breaks (VAPID invalidates every device; `ENCRYPTION_KEY` orphans every `core.connections` row; `CRON_SECRET` and `MCP_TOKEN` are free).

Exit checks: prod-auditor reports the gaps closed; CI green with the audit step. Depends on: all.

## Platform concerns

- Phase 1: iOS caches the startup image at install and shows it only for an exact size match (440 x 956 at 3x, 1320 x 2868 px); the proxy matcher change must not open any page route; the Hobby cron fires within the hour, so a 09:00 check reads the whole hour.
- Phase 2: `drop schema` runs on production through `supabase db push`; the transaction pooler runs each statement in its own transaction, nothing to hold.
- Phase 3: `regions` in `vercel.json` may be Pro-only (verify); pool `max 8` per instance against the pooler's client limit (four warm functions hit the session cap at 15 before; transaction mode lifts that but re-measure); React `cache()` is request scoped.
- Phase 4: native `replaceState` sync is an app-router feature, verify on Next 16 with context7; e2e counts `_rsc` requests, workers stay at 1.
- Phase 5: `after()` is unavailable in the cron and MCP paths, hence the synchronous recompute; `core.digests` growth is bounded by the prune step.
- Phase 7a: `SkillPicker` lives in `components/pos` and imports only the action file, or Turbopack reports a missing build manifest.
- Phase 8: iOS PWA has no browser edge swipe, so `useEdgeBack` must keep working everywhere except on the two gesture surfaces; Playwright touch has no pinch.
- Phase 9: `merge_trip` deletes a `core.entities` row; its skill_links cascade and its events keep their title snapshot.
- Phase 11: the webhook route runs at Vercel's default duration until Phase 12; one export can be hundreds of points, `writeReadings` batching stays.

## Open decisions

None. Two were closed in the interview (nightly email every night; iPhone 16 Pro Max).

