# POS v1.2 build plan

> **For agentic workers:** one phase is one branch, one PR, one fresh session, run with `/build-phase`. A phase is Done only when its exit checks pass and its PR is merged. Tick task boxes as they finish. Every phase starts in its own worktree (v1.1 lesson). Written 2026-09-20 from the owner's v1.2 list after the Holon release (#95) and four interview rounds; the answers are recorded under "Decisions" below and go to decisions/log.md when this file lands.

**Goal:** the bugs from the first day on Holon fixed with evidence, the app readable and every control visibly clickable, Finance trusted (full pull, sane budgets, categories that fit a credit card), a Calendar module fed by every module and by Google, Apple and Gmail read-only, manual entry on every module, and a versioned GitHub release with notes.

**Architecture:** no new patterns. Cross-module reads stay on manifest seams (`review`, `metrics`, `linked`, `skillNames`) and gain one more, `calendar`. Cross-module links stay `*_ref` columns onto `core.entities` (the `goal_ref` pattern). New providers are `integrations/<name>/` folders with credentials in `core.connections`. Model calls stay behind `core/llm.ts` and the cap.

**Tech stack:** unchanged. Next 16, Tailwind v4, Supabase, Vercel cron, vitest, Playwright. New external: Google Calendar and Gmail REST (OAuth, free), iCloud `.ics` subscription URLs, USDA FoodData Central (free key).

**Spec:** this file plus docs/SPEC.md; a "v1.2 amendments" section is added to SPEC.md in Phase 0 from the Decisions list.

## Global constraints

- Rules first, model second; every model decision stores `confidence` and `classified_by`; `is_manual = true` is never overwritten.
- One schema per module; cross-module only through `core`.
- Credentials in `core.connections` via `getCredentials()`; `.env` holds infrastructure only (OAuth client id and secret are infrastructure, like VAPID).
- Cost cap $0 to $10 a month; `llm_soft_cap_cents` 1000 enforced in `core/llm.ts`.
- Holon design contract holds (docs/plans/holon-product-redesign.md section 4): Geist, `light-dark()` tokens, 18px cards, 12px controls, pills, sentence case, no em dashes, no tracked uppercase.
- Native `<input type="date">` everywhere.
- A PR with a migration carries `db push: done` or `db push: not needed`; branch protection requires `check`, `screens`, `migrations`.
- Never commit to main; conventional commit prefixes; no secrets.
- Exit checks for every UI phase: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`; an e2e in `e2e/screens.spec.ts` (workers 1); ui-verifier at 402 and 1440 in both themes with no Must fix; spec-reviewer before the PR. Not repeated per phase.

## Status

Order: bugs, then look and forms, then data pulls, then Calendar and integrations, then module features, then release. Phases marked parallel-safe touch disjoint files.

| Phase | Goal | Complexity | Parallel-safe with | Depends on | Status | PR |
|---|---|---|---|---|---|---|
| 0 Housekeeping and baseline tag | main pulled, branches pruned, STATUS rewritten, package.json 1.1.0 and tag v1.1.0, SPEC v1.2 amendments | low | all | none | Done 2026-09-20 | #100 |
| 1a Diagnose: nightly digest and passkey | Both explained with production evidence and fixed | medium | 1b, 2 | 0 | Done 2026-09-20: digest was a stale core.jobs row for the deleted notes module, pruned nightly now; passkey autofill, named passkeys, local CSP | #108 |
| 1b Reported module bugs | Budget percent and colours, 30d column, Health insurance by type, phantom skill event, travel date icon and suggestion re-pop, Projects select speed | medium | 1a, 2 | 0 | Done 2026-09-21: four causes re-diagnosed (net-credit month, renamed task, Chrome's glyph colour, the wait for a new project), all seven fixed with a check each | #110 |
| 2 Errors tab and diagnostics | Agent log Errors tab, client_errors table, Settings diagnostics card | medium | 1a, 1b | 0 | Done 2026-09-21: `/agent-log/errors` reads request_log, failed job runs and the new `core.client_errors` through one `core/errors.ts`, filters are links, Copy per row; both boundaries post to `/api/client-error`; Diagnostics card on Settings; four silent catches now write through `recordError` | #117 |
| 3a Look: mockup gate | Today and one drawer, before and after, light and dark, owner approves | low | 2 | 1b | Done 2026-09-21: tokens measured and left (ink-2 and ink-3 already pass), secondary border on a solid fill, ghost border on hover, pointer from one base rule, row and card chevron with a 6 percent hover tint; owner approved on the comparison page | #113 |
| 3b Apple shell | Floating glass capsule tab bar (Home, Tasks, Finance, Calendar, Browse) that shrinks on scroll down and scrubs between tabs; initials avatar on tab roots opening Settings, Notifications, Agent log, theme and Sign out; utilities out of Browse and the rail footer; system font first | medium | 2 | 3a, #112 | Done 2026-09-21: capsule, shrink, scrub, avatar menu through a shell context, Browse and rail trimmed, system font first | #114 |
| 3c Motion and row swipes | Phone push, pop and tab cross-fade through React `ViewTransition`, the stagger kept on desktop; one `SwipeRow` on Review, Notifications and Tasks (snooze) | medium | 2 | 3b | Done 2026-09-21: push and tab fade through React `ViewTransition`, pop through the browser API (a popstate transition is flushed synchronously and never animates in React), `SwipeRow` on the three screens; the shell offsets fixed in #116 | #115 |
| 3d Look: affordance and contrast rollout | Every button, row link and tile visibly clickable; ink tokens AA at every size; whole goal card opens | high | none | 3c | Done 2026-09-21 (merged): title targets stretched over the goal, budget, task and itinerary cards (`STRETCH` in Card.tsx), text-only buttons on the quiet and danger variants with a rest border on touch, one hover tint and chevron on every row and card, Today task rows link to the drawer; no ink token moved (measured) | #118 |
| 4 Forms: required fields and keyboard | Missing field highlighted with a message; Enter submits, Tab order, first field focused | medium | 5a | 3d | Done 2026-09-21: `Field` and `useFormErrors` in `components/pos/FormField.tsx`, `ToolInputError` from `callTool` with one message per field, footer Save as the form's submit control, Overlay focuses the first field and guards a dirty form; ten forms swept, Recipe waits for Phase 12 | #119 |
| 5a Finance: full pull, pending, categories | 90-day re-pull button, pending marked, transfers out of spending, credits net, new categories, rule offer on manual override | high | 4 | 1b | Done 2026-09-22 (merged): `kind` on categories with eleven new ones, budgets are the expense kind only and skip pending, built-in payment and credit rules plus refund matching, Pull 90 days with per-account counts, the rule offer under a filed row | #120 |
| 5b Finance: three new views | Cash flow by month, Upcoming 14 days, Category trend in the desktop corner | medium | 6a | 5a | Done 2026-09-22: cash flow and the category trend fill the corner, the existing Upcoming card gained a Balance after column and reads both sources, `netThisMonthCents` on the tile head; `compactMoney` and `signedMoney` fixed at the root | #122 |
| 5c Finance: rules, back-filing and the transfer fix | Rules drawer with provenance and back-filing, peer payments out of transfers, an Uncategorised filter | medium | 6a | 5b | Done 2026-09-22: `rules.ts` re-files history through the whole rule set plus the refund matcher, `Rule.priority` puts the peer patterns ahead of the transfer ones and the migration back-filed 9 rows out of `Account transfer`, Rules drawer with provenance and an uncapped Unfiled list, All/Uncategorised/Pending chips, sweep raised to 5000. Exit met the same day: the owner filed the Unfiled list by hand, 3 rows left (AMC Theatres, held for Entertainment); #126 and #128 made it findable | #124 |
| 5d Finance: the model arm | One batched Haiku call fills what the rules miss; at 0.8 it writes a rule, below it the merchant is listed unfiled | medium | 6a | 5c | Deferred 2026-09-22: the backlog was filed by hand, so the model arm has little to file. Revisit if Unfiled grows | |
| 6a Calendar module | `calendar` schema, the `calendar` manifest seam on nine modules, month grid with day list, recurring rules drawn | high | 5b | 4 | Built 2026-09-23: seam on nine modules (workouts for Fitness, module-root links for four until Phase 13), `calendar.event` and `calendar.settings`, shared `MonthGrid`, week strip on the phone, chips saved, Add event drawer; eleven owner answers in decisions/log.md | |
| 6b Recurring tasks | Repeat rule on a task, next instance on completion, Tasks calendar day list | medium | 7a | 6a | Built 2026-09-23: `repeat` and a unique `repeat_from` on `tasks.task`, `repeat.ts` walks the rule, complete and the review's Drop write the next instance, Repeat select in the drawer, day list and muted projections on the Tasks Calendar and the seam | |
| 7a Google: Calendar feed | One OAuth app, refresh token in connections, events pulled nightly and on demand | high | 6b | 6a | Built 2026-09-23: `integrations/google/`, `pull_google` as a full window each run (owner's choice over sync tokens), calendar picker panel on the Connections card, Sync band on Calendar once connected, `freshCredentials` for the hour-long token; count waits on OWNER-TODO 22 | |
| 7b Apple: .ics feeds and Reminders webhook | iCloud calendar by subscription URL, Reminders through a Shortcut posting to a webhook | medium | 7c | 6a | Built 2026-09-24: `integrations/ics/` parses published calendars with no dependency, `pull_ics` reads the same window as Google through a shared `jobs/feed.ts`, URLs added and removed on a card panel; `integrations/apple_reminders/` posts to the generic webhook and `modules/tasks/inbound.ts` writes the tasks, closing one missing for two days. Counts wait on OWNER-TODO 24 and 25 | |
| 7c Gmail to proposals | Labelled mail parsed by rules then Haiku into task and event proposals in review state | high | 7b | 7a | | |
| 8 Fitness: source band and manual forms | Strava off the band, Apple Health shown as the source, exercise, plan and goal forms; docs/plans/fitness-workout-detail.md Phases 1 and 2 run before this as their own PRs | medium | 9, 10a | 2 | | |
| 9 Home & Assets | Add and edit asset, Schedule service drawer, Log service prefilled, calendar seam | medium | 8, 10a | 4 | | |
| 10a Travel: itinerary by day and reservations | Per-day items with time and kind, place inferred from destinations, Add reservation, loyalty program linked to a card account | high | 8, 9 | 4 | | |
| 10b Travel: spend from Finance | `trip_ref` on transactions, pre-tag rule, Budget, Planned, Spent on the card | medium | 11 | 10a, 5a | | |
| 11 Insurance to Finance | Premium cadence posted as a recurring with the monthly equivalent set aside | low | 10b | 5a | | |
| 12 Meals | Own recipe form, USDA ingredient search, paste to draft through Haiku, import errors surfaced | high | 13 | 2 | | |
| 13 Skills: events drill through | Skill events link to their entity; deleted ones say so | low | 12 | 2 | | |
| 14 Weekly review settings | Review day and time, reminder, optional recurring task, week start day used everywhere | medium | none | 6b | | |
| 15 Manual entry audit | One add path per entity type in every module, the matrix in the README | low | none | 8 to 12 | | |
| 16 Release v1.2.0 | Version in Settings and Agent log, tag, GitHub Release with notes, docs/RELEASING.md | low | none | all | | |

## Decisions (interview 2026-09-20, to decisions/log.md)

- Integrations are read-only feeds this version. Writes back to Google or Apple wait for the v2 verb executor.
- Calendar is a new module with its own schema; every module exposes dated rows through a manifest seam; Tasks keeps its own Calendar view.
- Order: bugs, look and forms, data pulls, Calendar and integrations, features, release.
- Categories: Credit card payment and Account transfer are `transfer` and never spending; Refund and Statement credit are `credit` and net against the category they refund; add Fees and interest, Taxes, Insurance premiums, Medical, Gifts and donations, Education, Home maintenance, Pets.
- Trip spend = Finance transactions linked to the trip; confirmed itinerary amounts are Planned.
- Meals: USDA FoodData Central for ingredients; pasted text and Instagram captions go through one Haiku call to a draft. Instagram is paste only.
- Fitness: Apple Health is the source; Strava stays in Settings as optional with the subscription note.
- Recurrence: a rule on the task, the next instance written on completion, one open row at a time.
- Versioning: semver, package.json is the source, tags and GitHub Releases, v1.1.0 tagged retroactively on today's main, this plan ships v1.2.0.
- Look: keep Holon; an affordance and contrast pass with one mockup gate.
- Errors: an Errors tab on the Agent log and a diagnostics card in Settings; no Sentry.
- Finance corner: cash flow by month, upcoming 14 days, category trend.
- Home & Assets: add and edit flows over the existing tools, no new tables.
- Health: keeps the tab; Insurance card shows health-type policies only.
- Passkey: cause unknown, diagnosed first with Playwright's virtual authenticator.

## Phase 0: housekeeping and baseline tag

Goal: the repo reflects the Holon release and the version scheme starts.
Complexity: low. Files: `docs/STATUS.md`, `docs/plans/holon-product-redesign.md`, `docs/plans/phone-polish.md`, `docs/SPEC.md`, `docs/DECISIONS.md`, `decisions/log.md`, `docs/OWNER-TODO.md`, `package.json`, this plan as `docs/plans/pos-v1-2.md`.

- [ ] `git checkout main && git pull`; delete merged local branches (`git branch --merged main` minus `main`, `holon`, `docs-skills-v2`); remove stale worktrees (`git worktree prune`).
- [ ] STATUS.md top paragraph: Holon released 2026-09-20 (#95, edcb1ad), #97 to #99 after it; current plan docs/plans/pos-v1-2.md; the fitness plan runs inside its Phase 8 slot. Remove "One merge-commit PR takes holon to main". Tick the Holon Phase 7 merge box; leave the phone check (OWNER-TODO 23). Mark phone-polish done (all five items are in the code: `aria-labelledby` in Overlay, `phoneLimit` in Inbox, `md:min-w` in Calendar, `max-md:bottom` in Globe).
- [ ] OWNER-TODO: step 13 (SimpleFIN) is connected per the owner; mark done with date "verify".
- [ ] `package.json` version `1.1.0`; after merge, `git tag -a v1.1.0 -m "v1.1 and Holon" <merge sha> && git push origin v1.1.0` (tags are not protected by the branch rule).
- [ ] SPEC.md "v1.2 amendments (2026-09-20)" from the Decisions list; DECISIONS.md open items: none; decisions/log.md entries.
- [ ] Copy this file to `docs/plans/pos-v1-2.md`; open the docs PR from branch `docs-pos-v1-2`. Also open the long-parked `docs-skills-v2` PR so that plan is on main (its build waits until after v1.2).

Exit: PR merged; `git tag` lists v1.1.0; `grep -c "One merge-commit PR" docs/STATUS.md` is 0.

## Phase 1a: diagnose the nightly digest and the passkey

Goal: both failures named from evidence and fixed at the cause.
Complexity: medium. Files: `core/orchestrator.ts`, `core/jobs.ts`, the failing module's job, `app/(auth)/login/PasskeyButton.tsx`, `app/(auth)/login/page.tsx`, `app/(app)/settings/general/Passkeys.tsx`, `e2e/screens.spec.ts`, `docs/STATUS.md`.

- [x] Digest, in order, stop at the first hit. Vercel Hobby keeps runtime logs one hour and the cron runs 09:00 UTC, so the record is the database. (1) Owner opens Agent log > Jobs and reads the red row's module, job and log, or runs in the dashboard SQL editor `select module, name, last_run, last_status, log from core.jobs order by last_run desc limit 20` and `select * from core.job_runs order by started_at desc limit 5`. (2) `relation ... does not exist` means a migration behind the code: `supabase db push`, rerun with Run now, done. (3) A module job throwing: reproduce locally against a copy of the failing input, fix, unit test in that module's `*.test.ts`. (4) The run exceeding `maxDuration` 300: time each module job in the log (`core/jobs.ts` already stores per-job status; add `ms`) and move the slow one behind `Promise.allSettled` with a per-job timeout. Write the cause into STATUS.md.
- [x] A partial run must not read as "keeps failing" on the dashboard: the run line shows `ok`, `partial (2 failed)` or `failed`, and links to the Errors tab from Phase 2 (until then, Agent log > Jobs).
- [x] Passkey. Playwright test with `CDPSession` `WebAuthn.enable` and a virtual authenticator (internal, resident key, user verified) on `/login` in Chromium: assert the three paths the button handles (`passkey_disabled`, no credential, success). Then the real cause on the owner's Chrome: read `PasskeyButton.tsx`'s fallback text after the press (it renders the error message). Expected: the passkey was enrolled on the phone and is bound to `pos-gilt-rho.vercel.app`; Chrome on the Mac has no credential unless synced. Fix regardless of cause: `autocomplete="username webauthn"` on the email field with a conditional-mediation `navigator.credentials.get({ mediation: 'conditional' })` so a synced passkey is offered in the field, and Settings > General > Passkeys says on which device each was made (`aaguid` and the user agent at enrolment, stored in the existing table's metadata if Supabase exposes it, else the label the owner typed).
- [x] Keyboard on login: Enter in the email field submits; the code input submits on the sixth digit (check `CodeInput.tsx`; it may already).
- [x] e2e: virtual-authenticator sign-in passes; login form submits on Enter.

Exit: STATUS.md names the digest cause; Agent log shows green after Run now; passkey e2e green.

Found while building (2026-09-20): the cause was a `core.jobs` row that outlived its job, not a job failing; `pruneStaleJobs` in the `prune` stage (now before `orchestrate`) removes such rows. The CSP blocked the local GoTrue origin, so the passkey ceremony had never run against a dev server; fixed in next.config.ts. GoTrue answers an unknown credential with `webauthn_verification_failed`, not `webauthn_credential_not_found`. Chromium's virtual authenticator answers a conditional-mediation request on load, so button tests turn it off. Later phases: Phase 2's Errors tab should read `core.job_runs` (per run), never `core.jobs`, for the same reason; the owner's Mac passkey report is still owed and may change the passkey card copy.

## Phase 1b: reported module bugs

Goal: the seven visible bugs fixed with a test each.
Complexity: medium. Files: `modules/finance/ui/Finance.tsx` (BudgetRow around line 760, accounts table line 469), `modules/finance/jobs/nightly-digest.ts`, `modules/insurance/jobs/nightly-digest.ts`, `modules/health/ui/HealthPage.tsx`, `modules/skills/ui/SkillTree.tsx`, `modules/travel/ui/TripForm.tsx`, `modules/travel/ui/DestinationInput.tsx` (name: verify), `modules/tasks/ui/TaskDrawer.tsx`, `app/globals.css`.

- [x] Budget percent. `percent(spent, limit)` is right (436 of 200 is 218 percent); the minus sign the owner saw comes from a signed delta somewhere in the budgets drawer or MetricStrip: grep `signed` and `delta` in `Finance.tsx` and `MetricStrip` callers and remove the sign on a ratio. BudgetRow reads: under limit "62% used · $76 left" in `--good`; from `100 - alertThreshold` percent (default 80) "88% used · $24 left" in `--warn`; over "218% used · $236 over" in `--bad`. The colour goes on the number and the category name, not only the bar. Fixed costs keep the brand tone. Unit test on a pure `budgetTone(spent, limit, threshold, isFixed)` extracted for it.
- [x] Accounts table: head `30d` becomes `30d change`, the `new` cell becomes "no history yet" in `text-ink-3`; a title attribute explains both.
- [x] Health insurance card: the Insurance digest gains `byType: { [type]: { annualCents, active, expiring } }`; `HealthPage.tsx` reads `byType.health` (and `dental`, `vision` if present) and renders nothing when absent. Test in the insurance digest test file.
- [x] Phantom skill event: `deleteTask` removes the registry row and leaves the event with its title snapshot. In the skill events list (`SkillTree.tsx` line 158 area), an event whose `entity_ref` no longer resolves renders "POS Skills Version 1.3 (deleted)" with no link. The drill-through for live events is Phase 13.
- [x] Travel date pickers invisible: the native calendar icon takes the page `color-scheme`; set `color-scheme: light dark` on `:root` in `globals.css` and check the icon in both themes on `TripForm`. If the icon is clipped by the pill's padding instead, `[&::-webkit-calendar-picker-indicator]:opacity-100` on the shared input class.
- [x] Destination suggestion re-pops after a pick: the suggestions effect refetches when `value` changes, including the change the pick made. Keep a `pickedRef` set on select; skip the fetch while `value === pickedRef.current`. e2e: pick a suggestion, assert the list is gone after 500 ms.
- [x] Projects select slow: it fetches projects on open. Pass `projects` to the drawer with the page data (the board already loads them for By project) and render the select from props; creation stays optimistic. Measure before and after in Chrome (done-time from the click) and record the numbers.

Exit: seven tests; ui-verifier on Finance budgets, Health, Travel new trip form.

Found while building (2026-09-20): four of the seven causes above were guesses that did not survive the code. The minus sign was a net-credit month (`sum(amount_cents)` below zero reaching the raw ratio), not a signed delta; `percent` floors at 0. The "phantom" event was a task the owner had renamed: `core.entities.title` was only written at creation and `title_snapshot` froze the old name, so the events list showed a title no board row carried; a deleted task cannot appear there at all (`core.skill_links` cascades). `patchTask` now renames the registry row and the events query reads the live title first. The date glyph was visible in Chromium in both themes; the owner's Chrome on the Mac drew it dark on the dark field, so the indicator is now a CSS mask in `currentColor`, a fix that does not depend on which colour scheme the browser guesses. The Projects select already rendered from props (open 68 to 140 ms, change 32 to 42 ms on the dev server); what was slow was a new project reaching it only after the server's answer and a full `/tasks` re-render, so the board holds an optimistic project list (row visible 30 ms after Add, the server answered at 85 ms locally). Later phases: other modules' renames (goals, ideas, notes) leave `core.entities.title` stale the same way, a candidate for Phase 13 (skills events drill through) or Phase 15; the time input's `invert` trick in `timeFieldClass` could move to the same mask.

## Phase 2: Errors tab and diagnostics

Goal: one place to read what broke, including client-side, without Vercel logs.
Complexity: medium. Files: migration `core_client_errors`, `app/error.tsx`, `app/global-error.tsx`, `app/api/client-error/route.ts`, `app/(app)/agent-log/*`, `app/(app)/settings/general/*`, `core/request-log.ts` (name: verify), `docs/ARCHITECTURE.md`.

- [x] Migration: `core.client_errors (id, route, digest, message, stack text, user_agent, occurred_at)`; nightly prune past 30 days in the existing `prune_*` job.
- [x] `error.tsx` and `global-error.tsx` POST `{ route, digest, message, stack }` to `/api/client-error` (owner cookie required, zod, rate limited by the existing limiter, `maxDuration` 10). They keep rendering the digest and Try again.
- [x] Agent log gains an Errors tab: three sections, Requests (`core.request_log` rows with status 400 or more and their error text), Jobs (every `failed` or `partial` run with the log expanded), Client (`core.client_errors`). Filters: module, last 24h / 7d / 30d. A Copy button per row copies route, time and text as plain text. Existing Agent log layout and TabBar.
- [x] Settings > General Diagnostics card: app version (`package.json` through `next.config` env), last cron run and outcome (`core.jobs` core rows), database round trip in ms (one `select 1`), connections with a stored key (names only), Vercel region. Read only.
- [x] Every `catch` that swallows in a job or tool writes `error` to `core.request_log` or the job log: grep `catch {}` and `catch (e) {}` in `core/` and `modules/*/jobs/` and add the write.
- [x] e2e: the seed inserts one 500 request_log row, one failed job run and one client error; the tab shows all three and Copy puts text on the clipboard.

Exit: tab live; the Diagnostics card shows the version string.

## Phase 3a: look, the mockup gate

Goal: the owner approves the affordance and contrast treatment on two surfaces before it spreads.
Complexity: low. Files: `app/globals.css` (a scratch branch), `components/pos/Button.tsx`, `components/pos/Card.tsx`, `components/pos/Overlay.tsx`; screenshots under `e2e/.scratch/look/`.

- [x] Token pass on a branch: `--ink-2` and `--ink-3` measured with the existing contrast script (Holon Phase 7 has one under `e2e/.scratch/p7-*`) against `--bg`, `--bg-elev` and the glass surface in both themes; raise each until 4.5:1 at 11px; darken the dark wash one step if the glass surface fails.
- [x] Button treatment: primary filled; secondary 1px `--rule-2` border on a `--bg-elev` fill; ghost gets a border on hover and always a pointer; focus ring 2px `--accent`; disabled 50 percent with `cursor: not-allowed`. Row and card links: hover `--bg-elev`, a trailing `›` in `--ink-3`, pointer; the whole row is the link, not the title.
- [x] Four screenshots at 1440 (Today, a task drawer, light and dark) before and after, plus 402 for Today. Present to the owner in one message. Approval is the gate for 3d; changes requested are applied on this branch first.

Exit: owner's written approval in the PR; no merge until then (the PR carries only tokens and the three primitives).

## Phase 3b: Apple shell

Goal: the phone reads like Apple Music on iOS 26: a floating glass capsule for the tabs, an avatar top right on the tab roots that holds the utilities, and the system font. Decided 2026-09-20 in a four-round interview (decisions/log.md); this and 3c replace the earlier 3b, which is now 3d.
Complexity: medium. Files: `core/phone-tabs.ts`, `components/pos/Sidebar.tsx` (`MobileTabBar` and the rail footer), `components/pos/PageHeader.tsx`, new `components/pos/Avatar.tsx` and `components/pos/AvatarMenu.tsx`, `app/(app)/browse/page.tsx`, `app/globals.css`, `e2e/screens.spec.ts`. No migration; the PR carries `db push: not needed`. Branch from main after #112 (the standalone viewport fix) merges; the two touch the same bar.

- [x] Tabs: `PHONE_TABS` becomes `/`, `/tasks`, `/finance`, `/calendar`; `phoneTabs` returns the ones present in the nav plus Browse and no longer tops up from other modules, so the bar holds four until Phase 6a ships Calendar. Update the unit test.
- [x] Capsule: `MobileTabBar` is `fixed inset-x-4 bottom-[var(--inset-b)] rounded-full glass-panel`, 56px tall, a 1px `--glass-line` border and the `--pop` shadow, the active tab in `--action` on an `--accent-soft` pill. `aria-label="Sections"`, `aria-current` and the badge on the first tab stay. `--tabbar` becomes `calc(56px + 2 * var(--inset-b))`; check every `var(--tabbar)` reader.
- [x] Shrink: a passive scroll listener in `MobileTabBar` sets `data-tabbar="compact"` on `<html>` when scrolling down past 32px and clears it on any scroll up or at the top. Compact hides the labels and narrows the capsule to a centred 44px pill; 240ms `var(--ease)`, no transition under `prefers-reduced-motion`; a tap on the compact pill expands it. Direction based, so the `.statusbar` scroll timeline (position based) does not apply.
- [x] Scrub: `useSwipe` on the capsule; left and right push the neighbouring tab, bounded at both ends, the pattern `TabBar.tsx` uses. Page-body swipes stay with segments and rows.
- [x] Avatar: `Avatar.tsx` is a 32px `--accent-soft` circle with the initials of `settings.owner_name` (first letters of the first two words; one letter for one word; `?` when empty), `aria-label="Account"`. `AvatarMenu.tsx` opens the existing `Overlay` (sheet on the phone, drawer on desktop) holding Settings, Notifications with the unread count, Agent log, `ThemeSwitch`, and a Sign out form over the existing `signOut` server action.
- [x] Placement: `PageHeader` renders the menu at the end of the phone row on tab roots only (`PHONE_TAB_HREFS`, the same test `BackControl` uses) and at the far right of desktop band one on every page. `owner_name` comes from the request-scoped `getSettings()` in a server component, never a client read. Brain and Skill Tree draw their own headers and are not tab roots, so they need nothing.
- [x] Duplicates: Browse drops its Utilities group; the rail footer keeps Collapse only. Delete `ThemeSwitch`'s `compact` variant if nothing uses it.
- [x] Font: `--font-sans` puts `-apple-system, BlinkMacSystemFont` before Geist; `--font-brand` stays Geist. Check tabular figures on SF.
- [x] e2e: the dashboard shell, collapsed rail, Browse groups, tab bar bounding box and theme-group tests move with the shell; new checks for the avatar on `/` and not on a detail page, the menu contents, compact after a 200px scroll down and expanded after scroll up, and a capsule scrub that moves one tab while a mouse drag does not.

Exit: ui-verifier at 402 and 1440 on Home, Tasks, Finance and a task detail, both themes; owner check on the phone in standalone (capsule on the home indicator, shrink, scrub, menu, sign out).

## Phase 3c: motion and row swipes

Goal: pages push and pop like iOS on the phone, and the rows the owner acts on most take a swipe.
Complexity: medium. Files: `app/(app)/layout.tsx`, `components/pos/BackControl.tsx`, `components/pos/EdgeBack.tsx`, `components/pos/Sidebar.tsx`, `app/globals.css`, new `components/pos/SwipeRow.tsx`, `modules/tasks/ui/Board.tsx`, `app/(app)/review/ReviewList.tsx`, `app/(app)/notifications/AlertCentre.tsx`, `e2e/screens.spec.ts`. No migration; `db push: not needed`. Read `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` first: React 19.3 ships `ViewTransition` and Next 16.3 needs no config.

- [x] Transitions: `{children}` in the app layout wrapped in `<ViewTransition>`; `BackControl`, `EdgeBack` and the capsule add a transition type (`back`, `tab`) inside `startTransition` before navigating, so a plain `Link` to a detail page is the forward case. CSS under `@media (max-width: 767px)`: forward slides in from the right with the old page moving 30 percent left and dimming, back reverses, tab cross-fades, 300ms `var(--ease)`, cross-fade only under `prefers-reduced-motion`. `.reveal` is `animation: none` below md so the two never stack; desktop keeps the stagger. `PullToRefresh` and `Overlay` untouched.
- [x] `SwipeRow`: the task row's swipe lifted out of `Board.tsx` (`useSwipe` with `onMove`, the word behind the row, `translateX` capped at 80px, `data-swipes`). Props `left` and `right`, each `{ label, tone, onCommit }`; the caller owns its optimistic state as Board does. Touch and pen only, as `useSwipe` enforces.
- [x] Tasks: right completes as today, left snoozes to tomorrow through `writeTask` with the new due; a done row's left swipe still reopens.
- [x] Review: right approves, left dismisses, both through `review/actions.ts`; guarded proposals are excluded and keep the panel.
- [x] Notifications: right marks read, left dismisses through the screen's existing snooze default.
- [x] Brain archive and pin are out: `brain.note` has no such columns and the migration belongs to Brain's next phase.
- [x] e2e: the swiped task test gains a left swipe asserting the due moved; a review row swipe approves and a notification row swipe marks read; the page root carries `view-transition-name` at 402 and not at 1440 (computed style, not a screenshot).

Exit: owner check on the phone (push, pop, tab fade, the three swipes) in iOS 26 Safari standalone; the Next guide warns Safari can differ on transition types, and no animation is the accepted fallback.

Built 2026-09-21. Two things later phases should know. Pop does not go through React: React flushes any transition started inside a `popstate` event synchronously (so scroll restores before paint), and a synchronous commit never starts a view transition, so `goBack()` in `components/pos/PageTransition.tsx` wraps `history.back()` in `document.startViewTransition` and the CSS keys off `html[data-nav="back"]`; BackControl and EdgeBack call it, and a plain browser back does not animate. The page column (`.page` in the app layout) now carries main's padding, `min-h-dvh` and the canvas colour below md so each snapshot is one opaque card; a phase that adds a fixed element outside `.page` gets the root cross-fade, which is invisible when old and new match. The Notifications left swipe is a one-day snooze, and `listAlerts` now leaves snoozed rows out until the snooze ends, as the dashboard tile always did.

## Phase 3d: look, rollout

Goal: every clickable thing on every screen reads as clickable in both themes at both widths; nothing decorative does.
Complexity: high. Files: every module `ui/` that renders its own `<button>` or `<Link>` outside the primitives; `modules/goals/ui/GoalList.tsx` (whole card opens the drawer); `components/pos/*`.

- [x] Replace raw `<button>` and clickable `<div>` with `Button` or the row-link class: `grep -rn "<button" modules app components | grep -v components/pos` is the worklist; each file is one commit.
- [x] Goals: the card is one `<button>` opening the drawer; inner actions (check-in field) `stopPropagation`. Same for any card whose title alone was the link (Finance accounts, Insurance rows, Home assets, Travel trips: verify each).
- [x] The Skills constellation and the Travel globe are excluded by the 2026-09-18 decision.
- [x] a11y script from Holon Phase 7 rerun over 24 routes: no unlabelled control, contrast pass at 11px and 12px added to it.
- [x] e2e: a sample of five screens asserts `cursor: pointer` and a visible border or fill on each button role; the goal card opens its drawer from a click on its body.

Exit: ui-verifier six-width pass as in Holon Phase 7; owner spot check on the monitor that prompted this.

## Phase 4: forms, required fields and keyboard

Goal: a missing or invalid field is named and highlighted at the field; Enter submits; Tab moves in reading order; the first field is focused on open.
Complexity: medium. Files: `components/pos/Field.tsx` (exists: verify; else new), `components/pos/Overlay.tsx`, every drawer form (`grep -rln "onSubmit\|action=" modules/*/ui app/(app)`), `core/tools.ts` (zod error shape).

- [x] `callTool` and server actions return zod issues as `{ error, fields: { [path]: message } }` (one mapping in `core/tools.ts`; today it is `{ error }` only).
- [x] `Field` takes `error?: string` and `required?: boolean`: a red 1px border, the message under the field in `--bad` at 12px, `aria-invalid`, `aria-describedby`. The form scrolls the first invalid field into view and focuses it.
- [x] Client-side check before send for `required` and type (date, number) so the message appears without a round trip; the server mapping stays the truth.
- [x] Keyboard: every drawer form is a `<form>` so Enter submits from any single-line field; textareas submit on Cmd or Ctrl Enter; `Overlay` focuses the first field on open (it already traps and returns focus); Escape closes only when the form is not dirty, else asks.
- [x] Sweep: the New task, New goal, New trip, Log service, Log a visit, Add policy, Capture, Idea, Plan and Projects forms. One commit each. Recipe has no typed form until Phase 12 (Meals holds only the one-field URL ingest, already a form), so it is not in this sweep.
- [x] e2e: New task with an empty title shows "Title is required" at the field; Enter in the title field creates the task; Tab from title lands on the next control.

Exit: e2e above; ui-verifier on three forms in both themes.

Built 2026-09-21. Notes for later phases: `Field`, `useFormErrors` and `submitOnModEnter` live in `components/pos/FormField.tsx` (named so `./Field` cannot resolve to `field.ts` on a case-insensitive disk); destructure the hook as `const { errors, ref: formRef, submit } = useFormErrors(...)`, since the react-hooks/refs rule rejects `form.ref`. A footer Save is `type="submit" form={formId}` and never disabled for a missing field: a disabled button cannot explain itself. Drawers close optimistically, so the server's `fields` reach the toast, not the form; the client check is what puts the message at the field. Escape and the dim tap ask before discarding a dirty form; the close control, Cancel and Save stay direct. Phase 12's recipe form and Phase 8's fitness forms should start from this pattern.

## Phase 5a: Finance, full pull, pending, categories

Goal: the owner can trust that what SimpleFIN has is what Finance shows, and budgets count the right things.
Complexity: high. Files: `modules/finance/jobs/sync-simplefin.ts`, `integrations/simplefin/client.ts`, `modules/finance/categorise.ts`, `modules/finance/seed.ts`, migration `finance_category_kinds`, `modules/finance/ui/Finance.tsx`, `modules/finance/ui/TransactionRow.tsx` (name: verify), `modules/finance/manifest.ts`, `docs/SETUP-INTEGRATIONS.md`.

- [x] Sync window: `sync_simplefin` takes `{ days?: number }`; the Sync button offers "Sync" (30-day overlap, today's behaviour) and "Pull 90 days" (the `FIRST_RUN_DAYS` window). SimpleFIN Bridge's history limit is the provider's: record what the owner's accounts return (verify: some institutions return less than 90 days; state the count per account in the job log and the band).
- [x] Pending: rows with `pending = true` show a `Pending` chip and are excluded from budget `spentCents` until posted (they already upsert into the same row on posting). Setting `finance.count_pending` (default off) flips that, for the owner who wants the live number.
- [x] Category kinds: `finance.category.kind` in `('expense','income','transfer','credit')`. Seed the new categories from the Decisions list. Budget spent = sum of `expense` minus `credit` in the category, `transfer` never counted; the net worth and cash flow reads are unchanged (transfers net to zero across accounts). Recurring detection ignores `transfer`.
- [x] Rules: merchant patterns for card payments ("AMEX EPAYMENT", "CHASE CREDIT CRD AUTOPAY", "Payment Thank You", the owner's institutions from the accounts table) classify as Credit card payment; a positive amount on a credit account whose merchant matches a recent negative one is Refund; "MEMBERSHIP REWARDS CREDIT", "DINING CREDIT", "UBER CREDIT" are Statement credit and net against the category the rule names. Tests in `categorise.test.ts`, one per rule.
- [x] Manual override with a rule offer: the category select on a transaction row writes `is_manual = true` (exists: verify) and offers "Always file {merchant} as {category}", which writes a `finance.category_rule` row; the next sync applies it before the model.
- [x] Digest: `budgetsOver` uses the new spent; the alerts sentence is unchanged.
- [x] e2e: a seeded card payment shows in Transactions and not in any budget; a seeded dining credit lowers the Dining budget's spent; Pull 90 days is offered.

Exit: tests; the owner runs Pull 90 days on production and compares one account's count against the bank; the numbers go in STATUS.md.

Built 2026-09-21. Notes for later phases: `finance.category.kind` is on every category and `listCategories()` in `modules/finance/data.ts` returns it; `categorySpend()` is the expense kind only and skips pending rows unless `count_pending`. 5b's cash flow should read income as the `income` kind, expense as `expense` minus `credit`, and leave `transfer` out. 10b and 11 write into categories by name (`Insurance premiums`, `Travel`) that exist since this migration. Built-in rules are `BUILTIN_RULES` in `categorise.ts`; the institution check and `matchRefund` are beside it. `SyncBand` takes `also` (a second pull) and `note` (a line under the clock). The production 90-day counts wait on OWNER-TODO 27.

## Phase 5b: Finance, three new views

Goal: the empty corner at 1440 shows cash flow, what is due, and one category's year.
Complexity: medium. Files: `modules/finance/ui/Finance.tsx`, `modules/finance/data.ts`, `modules/finance/ui/CashFlow.tsx`, `modules/finance/ui/Upcoming.tsx`, `modules/finance/ui/CategoryTrend.tsx`, `components/pos/LineChart.tsx` (reuse), `components/pos/charts.tsx` (bars: verify a bar primitive exists; else the smallest SVG in the new file).

- [x] `data.ts`: `cashFlowByMonth(6)` (income and expense sums per month, transfers excluded), `dueSoon(14)` (both `finance.recurring` and `finance.subscription`, deduped, with the running balance after each from the largest checking account), `categorySeries(12)` (every expense category at once, so the select costs no round trip).
- [x] Three cards on the desktop overview: cash flow bars with the net line and the category trend fill the corner under Accounts; the due list is the existing Upcoming card with a Balance after column, not a fourth card. Phone: the two new cards sit inline in the Overview stack.
- [x] Digest gains `netThisMonthCents` for the Finance tile head.
- [x] e2e: the three cards render with the seed; the category select switches the series.

Exit: ui-verifier at 1440 shows the corner filled without a taller page than today plus one row.

## Phase 5c: Finance, rules, back-filing and the transfer fix

Goal: every rule is visible and changeable, money to a person counts as spending, and the 607 uncategorised rows are reachable.
Complexity: medium. Files: migration `finance_rule_provenance`, `modules/finance/rules.ts` (+ test), `modules/finance/categorise.ts`, `modules/finance/data.ts`, `modules/finance/manifest.ts`, `modules/finance/ui/Finance.tsx`, `modules/finance/ui/RulesDrawer.tsx`, `modules/finance/ui/actions.ts`, `modules/finance/README.md`.

Why this phase exists: on the owner's real data 607 of 622 transactions (97.6 percent) have no category, across 172 distinct merchants. `BUILTIN_RULES` holds eleven patterns and every one of them is a payment, a transfer or a credit, so nothing files an ordinary purchase. `finance.category_rule` is written by `learn_rule` and read by `loadRules` and by nothing else: there is no screen, no edit and no delete, and a wrong rule (`apple icloud` to Dining, from an e2e run) is unreachable. `listTransactions` has no filter, so the uncategorised rows cannot be found either.

- [x] Migration `finance_rule_provenance`: `finance.category_rule` gains `classified_by text not null default 'human'` and `confidence numeric`; `is_manual` keeps its meaning as the override flag. Insert the `People` category (`kind = 'expense'`, not fixed) for money to and from individuals.
- [x] `modules/finance/rules.ts` (+ test), the one place that answers which rows a rule touches. `applyRule` re-files every matching row where `is_manual = false` and returns the count; `removeRule` clears those rows and re-runs the remaining rules over them, so a row two rules matched is not orphaned by deleting one. Never writes where `is_manual = true`.
- [x] Peer payments: `zelle`, `venmo`, `cash app` sort ahead of the transfer patterns and file to `People`. "Zelle Transfer to <name>" carries both `zelle` and `transfer to`, so precedence is the whole fix; `online transfer`, `transfer to` and `transfer from` stay for the owner's own accounts. A $1,382.45 Zelle is currently `Account transfer` and counted as no spending at all.
- [x] Rules drawer, opened from the Transactions tab beside Edit limits, the Budget limits drawer's shape: the owner's and the model's rules with a provenance badge, each editable and deletable, the eleven built-ins read-only below them (a rule the owner writes already beats a built-in in the sort, so overriding one is writing one), and an Unfiled merchants list with row count and total where filing one writes a rule and back-files in the same action. Saving says how many rows moved.
- [x] Tools: `write_rule` and `delete_rule` on the manifest, unguarded, for the same reason `categorise` is unguarded (README: hundreds of rows a month through the Review inbox would make the inbox useless).
- [x] Uncategorised filter on the Transactions tab: All, Uncategorised and Pending with counts, fed by a third `listTransactions` call unioned into the page data, the pattern the budget drawer fix already set.
- [x] `categoriseNew`'s 500 row limit is raised or looped: 607 rows do not fit it, and the backlog would otherwise take two nights.
- [x] Tests first, as the project asks for classification: a peer payment beats the transfer rule; a back-file leaves an `is_manual` row alone; deleting a rule re-files rather than orphans.
- [x] e2e: the drawer lists a built-in as read-only; filing an unfiled merchant writes a rule and the Uncategorised count falls.

Exit: standard; migration pushed (`db push: done`). The owner files or confirms the 172 merchants and the uncategorised share in STATUS.md is below 10 percent.

Built 2026-09-22. Notes for later phases: `modules/finance/rules.ts` is the one
place that re-files history. `refile(pattern)` re-runs the *whole* ranked rule
set over every automatic row whose normalised descriptor contains the pattern,
which is why a short new rule cannot steal a longer one's rows and why deleting
a rule hands its rows to whatever matches next instead of clearing them;
`applyRule` and `removeRule` are both one line over it. `loadRuleSet()` there is
now the single shaper of the rule list and the nightly `categoriseNew` reads it
too, so a rule cannot mean one thing at match time and another when written.
`Rule` gained `priority`, set only on the three peer built-ins, because
`transfer to` is a longer pattern than `zelle`. `learnRule()` returns the
pattern it wrote rather than a boolean, and every caller back-files with it.
5d writes `finance.category_rule` rows with `classified_by = 'model'` and a
`confidence`, and the drawer already renders that badge; it should call
`applyRule` after writing, exactly as `write_rule` does. The Unfiled list is
grouped on `learnFrom()`'s pattern by `groupUnfiled()`, a pure function, so 5d's
payload should be those patterns and not the stored merchant.

## Phase 5d: Finance, the model arm

Goal: the rules-first design gets its second half, so a new merchant files itself.
Complexity: medium. Files: `modules/finance/jobs/categorise-model.ts` (+ test), `modules/finance/jobs/nightly-digest.ts`, `modules/finance/manifest.ts`, `modules/finance/ui/RulesDrawer.tsx`, `modules/finance/README.md`.

`categorise.ts` has said "null means ask the model" since it was written and nothing ever did. This is that arm.

- [ ] One batched call through `core/llm.ts`, never one per merchant: `claude-haiku-4-5`, the unfiled shop names and the category list in, `{ merchant, category, confidence }` out. The model chooses from existing categories and never invents one. Measured: 172 merchants is about $0.012, then under a cent a month against `llm_soft_cap_cents` of 1000.
- [ ] At or above 0.8 it writes a `finance.category_rule` with `classified_by = 'model'` and the confidence, then back-files through 5c's `applyRule`, so next month is a rule hit and not a second call. Below 0.8 nothing is written and the merchant shows in the drawer's Unfiled list. `is_manual` is never touched.
- [ ] Peer payments never reach the model: `zelle`, `venmo` and `cash app` descriptors are filed by 5c's rules before any call, so a person's name and a payment memo do not leave the machine. Everything sent is a shop name.
- [ ] Runs at the end of the nightly `categorise` job, and on demand from a Categorise unfiled button in the drawer, which is how the backlog clears the day this ships rather than overnight.
- [ ] Tests: the threshold (0.79 writes nothing, 0.80 writes a rule); a peer payment is never in the payload; an unknown category name from the model is refused rather than created.
- [ ] e2e: the Unfiled count falls after the button, and a model rule shows its badge and confidence in the drawer.

Exit: standard; no migration. The owner checks a sample of what the model filed against the bank.

## Phase 6a: Calendar module

Goal: one calendar of everything dated in POS, and a home for external events.
Complexity: high. Files: `modules/calendar/` (manifest, migration `calendar_init`, `data.ts`, `jobs/nightly-digest.ts`, `ui/Calendar.tsx`, `ui/CalendarPage.tsx`, `seed.ts`, `README.md`), `core/module-contract.ts` (`calendar` seam), nine manifests, `app/(app)/[module]` catch-all picks it up through `modules/_index`, `docs/ARCHITECTURE.md`.

- [x] Seam: `ModuleManifest.calendar?: (range: { from: string; to: string }) => Promise<CalendarItem[]>` with `CalendarItem { id, module, title, startsAt, endsAt?, allDay, href, kind, entityRef? }`. Implemented by tasks (due, and repeat rules from 6b), goals (deadline), travel (trip span, itinerary items with a time), insurance (expiry), home (service due), health (appointments, screenings due), meals (plan entries), finance (recurring next charge), fitness (plan days). Each is a small read over rows the module already has; one unit test per module for the mapping.
- [x] Schema: `calendar.event (id, source, external_id, calendar_name, title, starts_at, ends_at, all_day, location, url, raw jsonb, updated_at, unique (source, external_id))` for external feeds (7a, 7b) and owner-typed events (a `write_event` tool, `source = 'manual'`).
- [x] Screen: month grid (reuse the Tasks Calendar grid component, generalised to `CalendarItem`), week strip on the phone, a day list under the grid for the selected day grouped by module with the module colour and a link through `href`. Filters by module as chips. Today opens on today.
- [x] Digest: today's and tomorrow's items count for the tile; `review.upcoming` not needed (the modules already answer that).
- [x] Onboarding modules step and the rail: Calendar appears after Tasks (nav order in the manifest).
- [x] e2e: the seed's task due date, trip and appointment show on their days; clicking a day lists them; a module chip filters.

Exit: standard; migration pushed (`db push: done`).

## Phase 6b: recurring tasks

Goal: "Use the Amex credits" comes back every month by itself.
Complexity: medium. Files: migration `tasks_repeat`, `modules/tasks/manifest.ts`, `modules/tasks/data.ts`, `modules/tasks/repeat.ts` (+ test), `modules/tasks/ui/TaskDrawer.tsx`, `modules/tasks/ui/Calendar.tsx`, `modules/calendar` seam.

- [x] `tasks.task.repeat jsonb null`: `{ every: 'day' | 'week' | 'month' | 'year', on?: number[] (weekdays 0 to 6, or a day of month 1 to 31 or -1 for last), interval?: number }`. `nextDue(repeat, fromDate, tz)` pure and tested (month end clamping, last day, weekly sets, the owner's timezone through `core/clock.ts`).
- [x] `complete` (the existing tool path) writes the next instance when `repeat` is set: same title, notes, project, goal_ref, skills copied as automatic links, `due = nextDue(repeat, due)`, `repeat` carried; the completed row keeps `repeat` for history. One open instance at a time by construction.
- [x] Drawer: a Repeat select (None, Daily, Weekly on ..., Monthly on the ..., Yearly) with the caption "Next: {date}".
- [x] Tasks Calendar: selecting a day lists that day's tasks under the grid (the owner's ask), including projected instances of repeating tasks in a lighter tone (from `nextDue` walked forward, no rows written). The Calendar module seam does the same.
- [x] e2e: complete a monthly task; a new open task exists with next month's date; the calendar shows the projection.

Exit: standard; `db push: done`.

## Phase 7a: Google Calendar feed

Goal: the owner's Google calendars appear in the Calendar module, read only.
Complexity: high. Files: `integrations/google/` (manifest, `client.ts`; built on the generic `app/api/integrations/[id]/oauth/*` routes, so no Google route), `modules/calendar/jobs/pull-google.ts`, `docs/SETUP-INTEGRATIONS.md`, `docs/OWNER-TODO.md` (step 22 becomes this).

- [x] Owner step first (written as OWNER-TODO 22 and SETUP-INTEGRATIONS, Google; the owner has not run it yet): Google Cloud project, OAuth consent published In production and unverified (Testing expires refresh tokens after 7 days), scope `calendar.readonly` only by the owner's answer (7c adds `gmail.readonly` to the same app), client id and secret into Vercel env `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (infrastructure, like VAPID). Written as OWNER-TODO 22 with exact clicks.
- [x] OAuth routes follow the existing Strava routes' shape (`maxDuration` 30, state cookie, refresh token stored in `core.connections` through `saveCredentials`); the Connections card shows Connect, Test (lists calendars), Disconnect.
- [x] `pull-google.ts`: `events.list` over the full window each run, 30 days back to 365 ahead, deleting what Google stopped returning (the owner's answer, replacing the planned `syncToken`), `singleEvents=true`, upsert into `calendar.event` with `source = 'google'`. Nightly and on the Calendar screen's Sync button. A cancelled or deleted event drops out of the window and its row is deleted.
- [x] Calendar picker in Settings > Connections: which Google calendars to include (a list of ids in the connection metadata).
- [x] Unit tests on the response mapping with a fixture.
- [ ] The pull exercised against the real account by the owner and the count recorded (waits on OWNER-TODO 22).

Exit: the owner's events on the Calendar screen; standard checks.

## Phase 7b: Apple calendar by .ics and Reminders by webhook

Goal: iCloud calendars and Reminders arrive without an Apple API.
Complexity: medium. Files: `integrations/ics/` (client parses `text/calendar`, no dependency: VEVENT, DTSTART, DTEND, RRULE expanded for the window, SUMMARY, LOCATION, UID), `integrations/apple_reminders/` (webhook through the generic `/api/integrations/[id]/webhook` route, like Health Auto Export's), `modules/calendar/jobs/pull-ics.ts` and `jobs/feed.ts` (the upsert both feeds share), `modules/tasks/inbound.ts` (reminders become tasks with `source = 'apple_reminders'`), migration `tasks_apple_reminders`, `docs/SETUP-INTEGRATIONS.md`, the Privacy Policy.

- [x] iCloud: the owner publishes a calendar in Calendar.app and pastes the `webcal://` URL into the card; the rest are added and removed on the card's own panel, stored in the connection's credentials as 7a stores the picked Google calendars. The pull fetches through `core/fetching.ts` (SSRF rules already there), parses and upserts `source = 'ics'`, keyed `<8 hex of the URL>/<uid>`. RRULE: daily, weekly, monthly, yearly with INTERVAL, COUNT, UNTIL and BYDAY (including "the second Tuesday"); anything else keeps its first event and the job log names the rule. `EXDATE` and a moved instance's `RECURRENCE-ID` are honoured. Tests on a fixture `.ics` with each rule.
- [x] Reminders: a Shortcut (documented step by step) runs daily, "Find Reminders where not completed", posts JSON to `/api/integrations/apple_reminders/webhook` with the shared secret; the seam upserts tasks by `(source, external_id)` (title, due, notes, list as project), touches no field Apple did not send, never reopens a task completed here, and completes a task when the reminder has been missing for two days (swept on arrival, keyed on `updated_at`).
- [x] e2e: a posted reminders payload creates a task under its list, and a wrong secret is refused; the seeded `ics` row shows on its day and opens no editor. The `.ics` fetch itself is not in the e2e: `core/fetching.ts` refuses loopback by design, so the test server cannot serve a fixture the pull would fetch (decisions/log.md, 2026-09-24).
- [x] Privacy Policy: both sources named before the code ships, per the docs/LEGAL.md rule; `LEGAL.effective` moved to 24 September 2026.

Exit: standard; both documented with screenshots' worth of steps in SETUP-INTEGRATIONS; migration pushed (`db push: done`).

## Phase 7c: Gmail to proposals

Goal: an email the owner labels becomes a task or a calendar event proposal, never a live row.
Complexity: high. Files: `integrations/google/client.ts` (gmail), `modules/tasks/jobs/pull-gmail.ts`, `modules/calendar` (event proposals), `core/proposals.ts` (reuse), `modules/tasks/gmail-rules.ts` (+ test), `docs/SETUP-INTEGRATIONS.md`.

- [ ] Scope by label: only messages with the Gmail label `POS` (owner applies it, or a Gmail filter does for reservations, bills and invites). `users.messages.list` with `labelIds` and `historyId` for increments.
- [ ] Rules first: a `.ics` attachment becomes a calendar event proposal directly; a `text/calendar` part the same; subject patterns "Your reservation", "Confirmation", "Invoice", "is due" set the kind. Then one Haiku call per message under the cap for title, due or start, amount, place; `classified_by` and `confidence` stored on the proposal payload.
- [ ] Proposals land in `core.proposals` (Review screen, existing approve and dismiss); approving a task proposal calls `tasks.write` in review state as the SPEC says; approving an event calls `calendar.write_event`. The email id and a Gmail deep link travel in the payload.
- [ ] Cost line: messages per night and cents in the job log; the cap applies.
- [ ] e2e: a fixture message with an `.ics` part yields an event proposal; approving it puts the event on the calendar.

Exit: standard; the owner labels three real emails and reviews the result; the count and cost in STATUS.md.

## Phase 8: Fitness, source band and manual forms

Goal: no Strava nag, Apple Health named as the source, and the owner can create an exercise, a plan and a fitness goal by hand.
Runs after docs/plans/fitness-workout-detail.md Phases 1 (sync visibility) and 2 (workout detail), which are approved and take the Holon merge as their gate.
Complexity: medium. Files: `modules/fitness/ui/Fitness.tsx`, `modules/fitness/ui/SyncBand.tsx`, `modules/fitness/ui/ExerciseDrawer.tsx` (new), `modules/fitness/ui/PlanDrawer.tsx`, `modules/fitness/manifest.ts` (`write_exercise` if absent: verify), `modules/goals` (a goal with `metric_source` from fitness, existing), `docs/SETUP-INTEGRATIONS.md`.

- [ ] The band: Apple Health line first with arrivals (from the fitness plan's Phase 1); the Strava line appears only when Strava is connected; "Connect a workout source" empty state names Apple Health first and Strava with "(needs a Strava subscription for API access)".
- [ ] Exercises tab: New exercise (name, muscle group, unit) over `write_exercise`; Edit on a row; a set logger on a workout that was logged by hand.
- [ ] Plans: PlanDrawer's New plan is reachable from the Plan tab head as well as the empty state; a day gains "Copy from last week".
- [ ] Fitness goal: a "New fitness goal" button on the goal tile opens the Goals drawer prefilled with a fitness `metric_source` (body weight, weekly workouts, weekly distance: the metrics the manifest already exposes) so progress computes.
- [ ] e2e: create an exercise, a plan, a fitness goal; the band shows no Strava line with the seed.

Exit: standard.

## Phase 9: Home & Assets

Goal: assets and their service schedule are typed in the app.
Complexity: medium. Files: `modules/home/ui/Home.tsx`, `modules/home/ui/AssetDrawer.tsx` (new), `modules/home/ui/ScheduleDrawer.tsx` (new), `modules/home/ui/LogServiceDrawer.tsx`, `modules/home/manifest.ts` (`write_asset`, `schedule_service` exist), `modules/home/data.ts`, calendar seam.

- [ ] Add asset drawer over `write_asset`: name, kind (from the seed's kinds), purchase date, value, annual cost, warranty end, notes; Edit from the card head; Archive.
- [ ] Schedule service drawer over `schedule_service`: asset, task name, interval months or fixed date, vendor, estimated cost; the twelve month cards read it (they already do from the table).
- [ ] Log service opens prefilled from an asset card and from a month card's due row.
- [ ] Empty state: "Add your first asset" opens the drawer.
- [ ] Calendar seam from 6a lists service due dates and warranty ends.
- [ ] e2e: add an asset, schedule a service, it shows in its month and on the Calendar.

Exit: standard.

## Phase 10a: Travel, itinerary by day and reservations

Goal: each day of a trip can hold a list of things with an optional time and kind, knows its city, and reservations are first class.
Complexity: high. Files: `modules/travel/ui/TripDrawer.tsx`, `modules/travel/ui/Itinerary.tsx` (new, split out of the drawer), `modules/travel/ui/ReservationForm.tsx` (new), `modules/travel/data.ts`, `modules/travel/manifest.ts` (`write_item` fields), migration `travel_item_kind_time` if `kind` and `starts_at` are missing (verify: items have `kind` for budget actuals; a time column is likely missing), `modules/travel/ui/LoyaltyDrawer.tsx`, migration `travel_loyalty_account_ref`.

- [ ] Itinerary by day: one section per day from `starts_on` to `ends_on`; the day's place is the destination whose date range covers it (`travel.destination` from v1.1 Phase 9), editable per item; items have title, optional time, kind (activity, food, transport, lodging, other), notes, `status` (`idea`, `pending`, `confirmed`), `amount_cents`, `confirmation`. Inline add per day with the existing parsed add line; drag between days on desktop, a Move to day select on the phone.
- [ ] The current edit failure ("won't let me edit"): reproduce on the owner's Europe Oktoberfest 2026 trip locally with its shape (multi-destination, many days) first; the likely cause is the drawer's edit form binding to the trip summary dates rather than destinations, so days outside the first destination are not rendered. Test on a fixture with three destinations.
- [ ] Add reservation: a form for a confirmed item with provider, confirmation code, time, amount, and a file (bucket path locked to the trip's prefix as Insurance does). A reservation is an itinerary item with `status = 'confirmed'`, by the SPEC amendment.
- [ ] Loyalty programs: `travel.loyalty_program.account_ref` referencing `core.entities` for a Finance account (the card that earns it), so the program row shows the card's last statement spend and the manual balance side by side. Balances stay manual (no public APIs; the SPEC forbids scraping). Points earned are not computed (unverifiable earn rates).
- [ ] Automation the owner asked for, within the rule set: Gmail proposals (7c) prefilled as reservations when the message carries a trip name or dates inside a trip; a `.ics` on a flight email becomes the itinerary item's time. Everything lands as `pending` until confirmed.
- [ ] e2e: a three-destination trip shows each day under its city; add an item with a time to day 4; add a reservation with a confirmation code; both survive reload.

Exit: standard; migrations pushed.

## Phase 10b: Travel, spend from Finance

Goal: Budget, Planned, Spent on every trip, with Spent from real transactions.
Complexity: medium. Files: migration `finance_transaction_trip_ref`, `modules/finance/ui/TransactionRow.tsx` (a Trip select), `modules/finance/data.ts`, `modules/travel/data.ts` (Spent through the `linked`-style seam: Finance answers `spentForTrip(entityRef)`; Travel reads no finance table), `core/module-contract.ts` (`spend` seam or extend `linked`), `modules/finance/trip-rule.ts` (+ test).

- [ ] `finance.transaction.trip_ref uuid null references core.entities(id)`, `is_manual` covers it as it covers category.
- [ ] Seam: Finance manifest exposes `linked.spend(entityRef) -> { cents, count }`; Travel's trip card and drawer show Budget (typed), Planned (confirmed itinerary amounts), Spent (linked transactions), Remaining = Budget minus max(Planned, Spent) with the rule sentence written out.
- [ ] Pre-tag rule: a transaction dated inside a trip's span whose merchant, city or country text matches a destination name is tagged with `classified_by = 'rules'`, confidence 0.7; the owner confirms in the transaction row (Trip select) or clears it. No model call.
- [ ] e2e: a seeded transaction inside the trip's dates and city is pre-tagged; the trip shows it as Spent; clearing the tag removes it.

Exit: standard; `db push: done`.

## Phase 11: Insurance to Finance

Goal: a premium paid every six months shows in Finance as what it is.
Complexity: low. Files: `modules/insurance/manifest.ts` (`post_to_finance` becomes real), `modules/finance/manifest.ts` (`write_recurring` tool if absent: verify), `modules/finance/ui/Finance.tsx` (Upcoming and budgets), `docs/SPEC.md`.

- [ ] `post_to_finance = true` on a policy calls `finance.write_recurring` through `callTool` (the Ideas to Tasks precedent) with name, amount, cadence (`monthly`, `quarterly`, `semiannual`, `annual`), next charge from the policy's paid-through date, `source = 'insurance'`, `external_id = policy id`; updates follow the policy; turning it off deletes the recurring row.
- [ ] Finance shows a non-monthly recurring in Upcoming on its charge date and, in the Insurance premiums budget row, the monthly equivalent as "set aside $X / month" so a $1,200 semiannual premium does not read as a $1,200 month. Cash flow by month (5b) shows the real hit in the month it lands.
- [ ] Tests: cadence to monthly equivalent; the tool call payload.

Exit: standard.

## Phase 12: Meals

Goal: the owner can type a recipe, paste one, find an ingredient's macros, and see why an import failed.
Complexity: high. Files: `integrations/usda/` (manifest, `client.ts`, key in `core.connections`), `modules/meals/manifest.ts` (`write_recipe` exists: verify fields; `parse_recipe_text` new, guarded because it spends), `modules/meals/ui/RecipeForm.tsx` (new), `modules/meals/ui/IngredientSearch.tsx` (new), `modules/meals/jsonld.ts`, `modules/meals/text-recipe.ts` (+ test), `docs/SETUP-INTEGRATIONS.md`.

- [ ] Own recipe: a form with name, servings, time, ingredients (rows: quantity, unit, name, optional USDA match), steps, tags, photo; saved through `write_recipe` as `source = 'manual'`, not a draft.
- [ ] USDA FoodData Central: `foods/search` by the typed name, the top five with macros per 100 g; picking one stores `fdc_id` and per-serving macros on the ingredient row so the week's macro strip uses real numbers. Free key from api.data.gov, stored in `core.connections` as `usda`. Rate limit 1,000 an hour (verify on the docs page at build time).
- [ ] Paste: a textarea (or an Instagram caption pasted) goes to `parse_recipe_text`: rules first (a line starting with a number and a unit is an ingredient; numbered lines are steps), then one Haiku call for the rest under the cap; result is a draft the owner approves, with `classified_by` on the draft. Instagram URLs are not fetched (login wall); the UI says paste the caption.
- [ ] Import errors: `import_recipe` stores the failure reason on a `meals.import_attempt` row (url, status, reason: no JSON-LD, blocked, timeout, parse error) and the drawer shows it with "Paste it instead"; the Errors tab lists attempts. Collect the owner's failed URLs from that table in the first week and fix the top parser gaps (common: `@graph` arrays, `HowToSection` steps, ingredient strings with HTML entities; write a fixture per fix).
- [ ] e2e: create a recipe by hand; paste three lines and get a draft (model mocked); a URL with no JSON-LD shows the reason.

Exit: standard; `db push: done`.

## Phase 13: Skills, events drill through

Goal: a skill's event list links to the thing that earned it.
Complexity: low. Files: `core/module-contract.ts` (`entityHref?: (type, id) => string` on the manifest), each module manifest (one line: tasks `/tasks?task=`, goals `/goals?goal=`, brain `/brain?note=`, ideas `/ideas?idea=`, fitness `/fitness?workout=`, meals `/meals?recipe=`, travel `/travel?trip=`, health, home, insurance: read each page's drawer param), `modules/skills/ui/SkillTree.tsx`, `core/entities.ts` (a resolver `hrefFor(entityRef)`).

- [ ] Events list rows are links through `hrefFor`; unresolved (deleted) rows render the title with "(deleted)" and no link (1b did the label; this makes the live ones links).
- [ ] The event row shows the XP it gave and the weight name, so the owner sees why.
- [ ] e2e: click an event under a skill; the task drawer opens.

Exit: standard.

## Phase 14: Weekly review settings

Goal: the review has a day and time, reminds, can be a recurring task, and the week starts on the owner's day.
Complexity: medium. Files: `core/settings.ts` (`week_start`, `review_day`, `review_time`, `review_reminder`, `review_task`), `app/(app)/review/weekly/*`, `core/notify.ts` (a rule `weekly_review` in `core.notification_rules`, seeded by migration), `modules/tasks` (the recurring task from 6b with a fixed repeat), `core/clock.ts` (`startOfWeek(date, weekStart)`), every reader of "this week" (`grep -rn "getDay()\|startOfWeek\|monday" core modules app`).

- [ ] Settings card on the Weekly review page: week starts on (Sunday or Monday), review day and time, "Remind me" (queues a notification through the rule at that time, in the owner's timezone), "Add as a recurring task" (creates or removes one task with `repeat: { every: 'week', on: [day] }` and `external_id = 'weekly_review'`).
- [ ] `startOfWeek` is the one function; Tasks This week, the review's week window, Meals' week grid, the Calendar's week strip and Fitness "This week" call it. Tests for both starts across a year boundary.
- [ ] e2e: set Sunday; Tasks This week's first column is Sunday; the review page shows the reminder time.

Exit: standard; migration pushed.

## Phase 15: manual entry audit

Goal: every entity type in every module has a typed add path or a documented reason it does not.
Complexity: low. Files: each module `README.md`, `docs/ARCHITECTURE.md` (the matrix), any small form the audit finds missing.

- [ ] Matrix: module, entity type, add path (screen and control), edit path, upload if applicable. Known gaps before this plan: home asset (Phase 9), home service schedule (9), fitness exercise (8), meals own recipe (12), health screening (verify), travel reservation (10a), health record upload (exists through Log a visit: verify).
- [ ] Anything still missing after Phases 8 to 12 gets its form here, sized like the neighbours.
- [ ] Every add path is reachable on the phone (the header's one action or the empty state).

Exit: matrix in ARCHITECTURE.md with no empty cells; ui-verifier on the forms added here.

## Phase 16: release v1.2.0

Goal: production runs a version it can name, and GitHub carries the notes.
Complexity: low. Files: `package.json`, `next.config.ts` (expose `NEXT_PUBLIC_APP_VERSION` from `package.json`), the Settings diagnostics card and Agent log header (Phase 2 read it), `docs/RELEASING.md`, `CHANGELOG.md`, `.github/release.yml` (categories by conventional prefix and module label).

- [ ] Rule from here on: a merge that completes a plan bumps `package.json` (minor) and tags; a fix PR on a shipped version bumps patch and tags. `docs/RELEASING.md`: the steps, `gh release create v1.2.0 --generate-notes`, then edit the notes into plain English grouped by module with a "What you will notice" section first and the owner steps last. Previews and unreleased main show `1.2.0-dev+<sha>`.
- [ ] `app/api/mcp/route.ts` `serverInfo.version` (hardcoded `0.1.0` today) reads the same exposed version.
- [ ] `CHANGELOG.md` seeded with v1.0.0 (2026-09-13 live), v1.1.0 (v1.1 and Holon, 2026-09-20), v1.2.0 (this plan).
- [ ] The v1.2.0 notes list every phase's user-visible change, the owner steps done (Google project, iCloud URLs, the Reminders Shortcut, USDA key) and the migrations pushed.
- [ ] Prod-auditor pass (the last phase of a plan by rule); its rows into DECISIONS.md's readiness table.

Exit: `git tag` shows v1.2.0 on the merge; the GitHub Release is published; Settings shows 1.2.0 on production.

## Platform concerns

- **Vercel Hobby log retention is one hour**, so nothing here depends on Vercel logs; the Errors tab (Phase 2) is the record. The cron's `maxDuration` is 300 s; 7a to 7c add three pulls to the nightly run, each timed in the job log, and a pull that exceeds 60 s moves to its own cron entry (Hobby allows two crons a day: verify against the plan limits before adding one).
- **OAuth app credentials** are infrastructure and live in Vercel env (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), like VAPID; the refresh token is an account credential and lives in `core.connections`. The rotation table in SETUP-SUPABASE.md gains both.
- **Google verification**: an app requesting `gmail.readonly` outside "testing" mode needs Google's review; the owner's account as a test user avoids it (100 test users, tokens expire after 7 days in testing only for external apps: verify the current rule and, if it bites, use an internal app under a Workspace or accept a re-consent weekly).
- **Apple has no Reminders or Calendar REST API**: `.ics` public URLs and a Shortcut webhook are the routes; a private iCloud calendar cannot be read without CalDAV and an app-specific password, which is out of scope this version.
- **Instagram** cannot be fetched anonymously; paste only.
- **Strava's API needs a paid Strava subscription** (2026 policy, already in decisions/log.md); it stays optional.
- **Cost**: Haiku on pasted recipes and labelled emails only, both capped; USDA and Google free; the running total stays under $10 with Health Auto Export's $1.99.
- **Migrations**: Phases 2, 5a, 6a, 6b, 10a, 10b, 12, 14 carry one each; each PR is red until `db push: done`, and the push happens before the merge deploys.
- **Passkey RP id** is bound to `pos-gilt-rho.vercel.app`; a custom domain later re-enrols every passkey. Noted in the passkey card copy.
- **e2e**: workers 1; the seed owns `core.job_runs`, `core.notifications`; new fixtures (an `.ics`, a reminders payload, a Gmail message) live under `e2e/fixtures/`.
- **Worktrees**: each phase in `../pos-<phase>`; two parallel phases only when the table marks them parallel-safe.
- **SimpleFIN history** is whatever the institution returns; the 90-day pull may return less for some accounts, and the band says the count per account rather than claiming 90.

## Owner steps this plan needs (added to OWNER-TODO)

- 22 Google Cloud project and OAuth consent, before 7a.
- 24 Make the iCloud calendars public and paste their URLs, before 7b.
- 25 Install the Reminders Shortcut, before 7b.
- 26 USDA FoodData Central key, before 12.
- 27 Run "Pull 90 days" on Finance after 5a and compare one account with the bank.
- 28 Label three emails `POS` after 7c and review the proposals.
- 23 stays: the phone check of the Holon build.

## Verification

```
pnpm typecheck && pnpm lint && pnpm test
pnpm test:e2e
```

Per phase: the e2e named in the phase, ui-verifier at 402 and 1440 in both themes, spec-reviewer before the PR. Production evidence per phase in STATUS.md: the digest cause (1a), the passkey path (1a), the 90-day counts (5a), the Google event count (7a), the Gmail proposal count and cost (7c), the version string on Settings (16).

## Open decisions

None. Assumptions stated inline are marked "verify" and are checked in the phase that touches them.
