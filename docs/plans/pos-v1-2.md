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
| 0 Housekeeping and baseline tag | main pulled, branches pruned, STATUS rewritten, package.json 1.1.0 and tag v1.1.0, SPEC v1.2 amendments | low | all | none | | |
| 1a Diagnose: nightly digest and passkey | Both explained with production evidence and fixed | medium | 1b, 2 | 0 | | |
| 1b Reported module bugs | Budget percent and colours, 30d column, Health insurance by type, phantom skill event, travel date icon and suggestion re-pop, Projects select speed | medium | 1a, 2 | 0 | | |
| 2 Errors tab and diagnostics | Agent log Errors tab, client_errors table, Settings diagnostics card | medium | 1a, 1b | 0 | | |
| 3a Look: mockup gate | Today and one drawer, before and after, light and dark, owner approves | low | 2 | 1b | | |
| 3b Look: affordance and contrast rollout | Every button, row link and tile visibly clickable; ink tokens AA at every size; whole goal card opens | high | none | 3a | | |
| 4 Forms: required fields and keyboard | Missing field highlighted with a message; Enter submits, Tab order, first field focused | medium | 5a | 3b | | |
| 5a Finance: full pull, pending, categories | 90-day re-pull button, pending marked, transfers out of spending, credits net, new categories, rule offer on manual override | high | 4 | 1b | | |
| 5b Finance: three new views | Cash flow by month, Upcoming 14 days, Category trend in the desktop corner | medium | 6a | 5a | | |
| 6a Calendar module | `calendar` schema, the `calendar` manifest seam on nine modules, month grid with day list, recurring rules drawn | high | 5b | 4 | | |
| 6b Recurring tasks | Repeat rule on a task, next instance on completion, Tasks calendar day list | medium | 7a | 6a | | |
| 7a Google: Calendar feed | One OAuth app, refresh token in connections, events pulled nightly and on demand | high | 6b | 6a | | |
| 7b Apple: .ics feeds and Reminders webhook | iCloud calendar by subscription URL, Reminders through a Shortcut posting to a webhook | medium | 7c | 6a | | |
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

- [ ] Digest, in order, stop at the first hit. Vercel Hobby keeps runtime logs one hour and the cron runs 09:00 UTC, so the record is the database. (1) Owner opens Agent log > Jobs and reads the red row's module, job and log, or runs in the dashboard SQL editor `select module, name, last_run, last_status, log from core.jobs order by last_run desc limit 20` and `select * from core.job_runs order by started_at desc limit 5`. (2) `relation ... does not exist` means a migration behind the code: `supabase db push`, rerun with Run now, done. (3) A module job throwing: reproduce locally against a copy of the failing input, fix, unit test in that module's `*.test.ts`. (4) The run exceeding `maxDuration` 300: time each module job in the log (`core/jobs.ts` already stores per-job status; add `ms`) and move the slow one behind `Promise.allSettled` with a per-job timeout. Write the cause into STATUS.md.
- [ ] A partial run must not read as "keeps failing" on the dashboard: the run line shows `ok`, `partial (2 failed)` or `failed`, and links to the Errors tab from Phase 2 (until then, Agent log > Jobs).
- [ ] Passkey. Playwright test with `CDPSession` `WebAuthn.enable` and a virtual authenticator (internal, resident key, user verified) on `/login` in Chromium: assert the three paths the button handles (`passkey_disabled`, no credential, success). Then the real cause on the owner's Chrome: read `PasskeyButton.tsx`'s fallback text after the press (it renders the error message). Expected: the passkey was enrolled on the phone and is bound to `pos-gilt-rho.vercel.app`; Chrome on the Mac has no credential unless synced. Fix regardless of cause: `autocomplete="username webauthn"` on the email field with a conditional-mediation `navigator.credentials.get({ mediation: 'conditional' })` so a synced passkey is offered in the field, and Settings > General > Passkeys says on which device each was made (`aaguid` and the user agent at enrolment, stored in the existing table's metadata if Supabase exposes it, else the label the owner typed).
- [ ] Keyboard on login: Enter in the email field submits; the code input submits on the sixth digit (check `CodeInput.tsx`; it may already).
- [ ] e2e: virtual-authenticator sign-in passes; login form submits on Enter.

Exit: STATUS.md names the digest cause; Agent log shows green after Run now; passkey e2e green.

## Phase 1b: reported module bugs

Goal: the seven visible bugs fixed with a test each.
Complexity: medium. Files: `modules/finance/ui/Finance.tsx` (BudgetRow around line 760, accounts table line 469), `modules/finance/jobs/nightly-digest.ts`, `modules/insurance/jobs/nightly-digest.ts`, `modules/health/ui/HealthPage.tsx`, `modules/skills/ui/SkillTree.tsx`, `modules/travel/ui/TripForm.tsx`, `modules/travel/ui/DestinationInput.tsx` (name: verify), `modules/tasks/ui/TaskDrawer.tsx`, `app/globals.css`.

- [ ] Budget percent. `percent(spent, limit)` is right (436 of 200 is 218 percent); the minus sign the owner saw comes from a signed delta somewhere in the budgets drawer or MetricStrip: grep `signed` and `delta` in `Finance.tsx` and `MetricStrip` callers and remove the sign on a ratio. BudgetRow reads: under limit "62% used · $76 left" in `--good`; from `100 - alertThreshold` percent (default 80) "88% used · $24 left" in `--warn`; over "218% used · $236 over" in `--bad`. The colour goes on the number and the category name, not only the bar. Fixed costs keep the brand tone. Unit test on a pure `budgetTone(spent, limit, threshold, isFixed)` extracted for it.
- [ ] Accounts table: head `30d` becomes `30d change`, the `new` cell becomes "no history yet" in `text-ink-3`; a title attribute explains both.
- [ ] Health insurance card: the Insurance digest gains `byType: { [type]: { annualCents, active, expiring } }`; `HealthPage.tsx` reads `byType.health` (and `dental`, `vision` if present) and renders nothing when absent. Test in the insurance digest test file.
- [ ] Phantom skill event: `deleteTask` removes the registry row and leaves the event with its title snapshot. In the skill events list (`SkillTree.tsx` line 158 area), an event whose `entity_ref` no longer resolves renders "POS Skills Version 1.3 (deleted)" with no link. The drill-through for live events is Phase 13.
- [ ] Travel date pickers invisible: the native calendar icon takes the page `color-scheme`; set `color-scheme: light dark` on `:root` in `globals.css` and check the icon in both themes on `TripForm`. If the icon is clipped by the pill's padding instead, `[&::-webkit-calendar-picker-indicator]:opacity-100` on the shared input class.
- [ ] Destination suggestion re-pops after a pick: the suggestions effect refetches when `value` changes, including the change the pick made. Keep a `pickedRef` set on select; skip the fetch while `value === pickedRef.current`. e2e: pick a suggestion, assert the list is gone after 500 ms.
- [ ] Projects select slow: it fetches projects on open. Pass `projects` to the drawer with the page data (the board already loads them for By project) and render the select from props; creation stays optimistic. Measure before and after in Chrome (done-time from the click) and record the numbers.

Exit: seven tests; ui-verifier on Finance budgets, Health, Travel new trip form.

## Phase 2: Errors tab and diagnostics

Goal: one place to read what broke, including client-side, without Vercel logs.
Complexity: medium. Files: migration `core_client_errors`, `app/error.tsx`, `app/global-error.tsx`, `app/api/client-error/route.ts`, `app/(app)/agent-log/*`, `app/(app)/settings/general/*`, `core/request-log.ts` (name: verify), `docs/ARCHITECTURE.md`.

- [ ] Migration: `core.client_errors (id, route, digest, message, stack text, user_agent, occurred_at)`; nightly prune past 30 days in the existing `prune_*` job.
- [ ] `error.tsx` and `global-error.tsx` POST `{ route, digest, message, stack }` to `/api/client-error` (owner cookie required, zod, rate limited by the existing limiter, `maxDuration` 10). They keep rendering the digest and Try again.
- [ ] Agent log gains an Errors tab: three sections, Requests (`core.request_log` rows with status 400 or more and their error text), Jobs (every `failed` or `partial` run with the log expanded), Client (`core.client_errors`). Filters: module, last 24h / 7d / 30d. A Copy button per row copies route, time and text as plain text. Existing Agent log layout and TabBar.
- [ ] Settings > General Diagnostics card: app version (`package.json` through `next.config` env), last cron run and outcome (`core.jobs` core rows), database round trip in ms (one `select 1`), connections with a stored key (names only), Vercel region. Read only.
- [ ] Every `catch` that swallows in a job or tool writes `error` to `core.request_log` or the job log: grep `catch {}` and `catch (e) {}` in `core/` and `modules/*/jobs/` and add the write.
- [ ] e2e: the seed inserts one 500 request_log row, one failed job run and one client error; the tab shows all three and Copy puts text on the clipboard.

Exit: tab live; the Diagnostics card shows the version string.

## Phase 3a: look, the mockup gate

Goal: the owner approves the affordance and contrast treatment on two surfaces before it spreads.
Complexity: low. Files: `app/globals.css` (a scratch branch), `components/pos/Button.tsx`, `components/pos/Card.tsx`, `components/pos/Overlay.tsx`; screenshots under `e2e/.scratch/look/`.

- [ ] Token pass on a branch: `--ink-2` and `--ink-3` measured with the existing contrast script (Holon Phase 7 has one under `e2e/.scratch/p7-*`) against `--bg`, `--bg-elev` and the glass surface in both themes; raise each until 4.5:1 at 11px; darken the dark wash one step if the glass surface fails.
- [ ] Button treatment: primary filled; secondary 1px `--rule-2` border on a `--bg-elev` fill; ghost gets a border on hover and always a pointer; focus ring 2px `--accent`; disabled 50 percent with `cursor: not-allowed`. Row and card links: hover `--bg-elev`, a trailing `›` in `--ink-3`, pointer; the whole row is the link, not the title.
- [ ] Four screenshots at 1440 (Today, a task drawer, light and dark) before and after, plus 402 for Today. Present to the owner in one message. Approval is the gate for 3b; changes requested are applied on this branch first.

Exit: owner's written approval in the PR; no merge until then (the PR carries only tokens and the three primitives).

## Phase 3b: look, rollout

Goal: every clickable thing on every screen reads as clickable in both themes at both widths; nothing decorative does.
Complexity: high. Files: every module `ui/` that renders its own `<button>` or `<Link>` outside the primitives; `modules/goals/ui/GoalList.tsx` (whole card opens the drawer); `components/pos/*`.

- [ ] Replace raw `<button>` and clickable `<div>` with `Button` or the row-link class: `grep -rn "<button" modules app components | grep -v components/pos` is the worklist; each file is one commit.
- [ ] Goals: the card is one `<button>` opening the drawer; inner actions (check-in field) `stopPropagation`. Same for any card whose title alone was the link (Finance accounts, Insurance rows, Home assets, Travel trips: verify each).
- [ ] The Skills constellation and the Travel globe are excluded by the 2026-09-18 decision.
- [ ] a11y script from Holon Phase 7 rerun over 24 routes: no unlabelled control, contrast pass at 11px and 12px added to it.
- [ ] e2e: a sample of five screens asserts `cursor: pointer` and a visible border or fill on each button role; the goal card opens its drawer from a click on its body.

Exit: ui-verifier six-width pass as in Holon Phase 7; owner spot check on the monitor that prompted this.

## Phase 4: forms, required fields and keyboard

Goal: a missing or invalid field is named and highlighted at the field; Enter submits; Tab moves in reading order; the first field is focused on open.
Complexity: medium. Files: `components/pos/Field.tsx` (exists: verify; else new), `components/pos/Overlay.tsx`, every drawer form (`grep -rln "onSubmit\|action=" modules/*/ui app/(app)`), `core/tools.ts` (zod error shape).

- [ ] `callTool` and server actions return zod issues as `{ error, fields: { [path]: message } }` (one mapping in `core/tools.ts`; today it is `{ error }` only).
- [ ] `Field` takes `error?: string` and `required?: boolean`: a red 1px border, the message under the field in `--bad` at 12px, `aria-invalid`, `aria-describedby`. The form scrolls the first invalid field into view and focuses it.
- [ ] Client-side check before send for `required` and type (date, number) so the message appears without a round trip; the server mapping stays the truth.
- [ ] Keyboard: every drawer form is a `<form>` so Enter submits from any single-line field; textareas submit on Cmd or Ctrl Enter; `Overlay` focuses the first field on open (it already traps and returns focus); Escape closes only when the form is not dirty, else asks.
- [ ] Sweep: the New task, New goal, New trip, Log service, Log a visit, Add policy, Capture, Idea, Recipe, Plan forms. One commit each.
- [ ] e2e: New task with an empty title shows "Title is required" at the field; Enter in the title field creates the task; Tab from title lands on the next control.

Exit: e2e above; ui-verifier on three forms in both themes.

## Phase 5a: Finance, full pull, pending, categories

Goal: the owner can trust that what SimpleFIN has is what Finance shows, and budgets count the right things.
Complexity: high. Files: `modules/finance/jobs/sync-simplefin.ts`, `integrations/simplefin/client.ts`, `modules/finance/categorise.ts`, `modules/finance/seed.ts`, migration `finance_category_kinds`, `modules/finance/ui/Finance.tsx`, `modules/finance/ui/TransactionRow.tsx` (name: verify), `modules/finance/manifest.ts`, `docs/SETUP-INTEGRATIONS.md`.

- [ ] Sync window: `sync_simplefin` takes `{ days?: number }`; the Sync button offers "Sync" (30-day overlap, today's behaviour) and "Pull 90 days" (the `FIRST_RUN_DAYS` window). SimpleFIN Bridge's history limit is the provider's: record what the owner's accounts return (verify: some institutions return less than 90 days; state the count per account in the job log and the band).
- [ ] Pending: rows with `pending = true` show a `Pending` chip and are excluded from budget `spentCents` until posted (they already upsert into the same row on posting). Setting `finance.count_pending` (default off) flips that, for the owner who wants the live number.
- [ ] Category kinds: `finance.category.kind` in `('expense','income','transfer','credit')`. Seed the new categories from the Decisions list. Budget spent = sum of `expense` minus `credit` in the category, `transfer` never counted; the net worth and cash flow reads are unchanged (transfers net to zero across accounts). Recurring detection ignores `transfer`.
- [ ] Rules: merchant patterns for card payments ("AMEX EPAYMENT", "CHASE CREDIT CRD AUTOPAY", "Payment Thank You", the owner's institutions from the accounts table) classify as Credit card payment; a positive amount on a credit account whose merchant matches a recent negative one is Refund; "MEMBERSHIP REWARDS CREDIT", "DINING CREDIT", "UBER CREDIT" are Statement credit and net against the category the rule names. Tests in `categorise.test.ts`, one per rule.
- [ ] Manual override with a rule offer: the category select on a transaction row writes `is_manual = true` (exists: verify) and offers "Always file {merchant} as {category}", which writes a `finance.category_rule` row; the next sync applies it before the model.
- [ ] Digest: `budgetsOver` uses the new spent; the alerts sentence is unchanged.
- [ ] e2e: a seeded card payment shows in Transactions and not in any budget; a seeded dining credit lowers the Dining budget's spent; Pull 90 days is offered.

Exit: tests; the owner runs Pull 90 days on production and compares one account's count against the bank; the numbers go in STATUS.md.

## Phase 5b: Finance, three new views

Goal: the empty corner at 1440 shows cash flow, what is due, and one category's year.
Complexity: medium. Files: `modules/finance/ui/Finance.tsx`, `modules/finance/data.ts`, `modules/finance/ui/CashFlow.tsx`, `modules/finance/ui/Upcoming.tsx`, `modules/finance/ui/CategoryTrend.tsx`, `components/pos/LineChart.tsx` (reuse), `components/pos/charts.tsx` (bars: verify a bar primitive exists; else the smallest SVG in the new file).

- [ ] `data.ts`: `cashFlowByMonth(6)` (income and expense sums per month, transfers excluded), `upcoming(14)` (recurring rows due, from `finance.recurring`, with the running balance after each from the main checking account), `categorySeries(categoryId, 12)`.
- [ ] Three cards on the desktop overview under the budgets: bars with the net line, a due list with the running balance, a category select over `LineChart`. Phone: the three join the Overview segment rows.
- [ ] Digest gains `netThisMonthCents` for the Finance tile head.
- [ ] e2e: the three cards render with the seed; the category select switches the series.

Exit: ui-verifier at 1440 shows the corner filled without a taller page than today plus one row.

## Phase 6a: Calendar module

Goal: one calendar of everything dated in POS, and a home for external events.
Complexity: high. Files: `modules/calendar/` (manifest, migration `calendar_init`, `data.ts`, `jobs/nightly-digest.ts`, `ui/Calendar.tsx`, `ui/CalendarPage.tsx`, `seed.ts`, `README.md`), `core/module-contract.ts` (`calendar` seam), nine manifests, `app/(app)/[module]` catch-all picks it up through `modules/_index`, `docs/ARCHITECTURE.md`.

- [ ] Seam: `ModuleManifest.calendar?: (range: { from: string; to: string }) => Promise<CalendarItem[]>` with `CalendarItem { id, module, title, startsAt, endsAt?, allDay, href, kind, entityRef? }`. Implemented by tasks (due, and repeat rules from 6b), goals (deadline), travel (trip span, itinerary items with a time), insurance (expiry), home (service due), health (appointments, screenings due), meals (plan entries), finance (recurring next charge), fitness (plan days). Each is a small read over rows the module already has; one unit test per module for the mapping.
- [ ] Schema: `calendar.event (id, source, external_id, calendar_name, title, starts_at, ends_at, all_day, location, url, raw jsonb, updated_at, unique (source, external_id))` for external feeds (7a, 7b) and owner-typed events (a `write_event` tool, `source = 'manual'`).
- [ ] Screen: month grid (reuse the Tasks Calendar grid component, generalised to `CalendarItem`), week strip on the phone, a day list under the grid for the selected day grouped by module with the module colour and a link through `href`. Filters by module as chips. Today opens on today.
- [ ] Digest: today's and tomorrow's items count for the tile; `review.upcoming` not needed (the modules already answer that).
- [ ] Onboarding modules step and the rail: Calendar appears after Tasks (nav order in the manifest).
- [ ] e2e: the seed's task due date, trip and appointment show on their days; clicking a day lists them; a module chip filters.

Exit: standard; migration pushed (`db push: done`).

## Phase 6b: recurring tasks

Goal: "Use the Amex credits" comes back every month by itself.
Complexity: medium. Files: migration `tasks_repeat`, `modules/tasks/manifest.ts`, `modules/tasks/data.ts`, `modules/tasks/repeat.ts` (+ test), `modules/tasks/ui/TaskDrawer.tsx`, `modules/tasks/ui/Calendar.tsx`, `modules/calendar` seam.

- [ ] `tasks.task.repeat jsonb null`: `{ every: 'day' | 'week' | 'month' | 'year', on?: number[] (weekdays 0 to 6, or a day of month 1 to 31 or -1 for last), interval?: number }`. `nextDue(repeat, fromDate, tz)` pure and tested (month end clamping, last day, weekly sets, the owner's timezone through `core/clock.ts`).
- [ ] `complete` (the existing tool path) writes the next instance when `repeat` is set: same title, notes, project, goal_ref, skills copied as automatic links, `due = nextDue(repeat, due)`, `repeat` carried; the completed row keeps `repeat` for history. One open instance at a time by construction.
- [ ] Drawer: a Repeat select (None, Daily, Weekly on ..., Monthly on the ..., Yearly) with the caption "Next: {date}".
- [ ] Tasks Calendar: selecting a day lists that day's tasks under the grid (the owner's ask), including projected instances of repeating tasks in a lighter tone (from `nextDue` walked forward, no rows written). The Calendar module seam does the same.
- [ ] e2e: complete a monthly task; a new open task exists with next month's date; the calendar shows the projection.

Exit: standard; `db push: done`.

## Phase 7a: Google Calendar feed

Goal: the owner's Google calendars appear in the Calendar module, read only.
Complexity: high. Files: `integrations/google/` (manifest, `client.ts`, OAuth start and callback routes under `app/api/oauth/google/`), `modules/calendar/jobs/pull-google.ts`, `docs/SETUP-INTEGRATIONS.md`, `docs/OWNER-TODO.md` (step 22 becomes this).

- [ ] Owner step first: Google Cloud project, OAuth consent (internal or testing with the owner as test user), scopes `calendar.readonly` and `gmail.readonly` (7c reuses the app), client id and secret into Vercel env `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (infrastructure, like VAPID). Written as OWNER-TODO 22 with exact clicks.
- [ ] OAuth routes follow the existing Strava routes' shape (`maxDuration` 30, state cookie, refresh token stored in `core.connections` through `saveCredentials`); the Connections card shows Connect, Test (lists calendars), Disconnect.
- [ ] `pull-google.ts`: `events.list` with `syncToken` per calendar (stored in the connection metadata), `singleEvents=true`, window 30 days back to 365 ahead, upsert into `calendar.event` with `source = 'google'`. Nightly and on the Calendar screen's Sync button. Deleted events (`status = 'cancelled'`) delete the row.
- [ ] Calendar picker in Settings > Connections: which Google calendars to include (a list of ids in the connection metadata).
- [ ] Unit tests on the response mapping with a fixture; the pull is exercised against the real account by the owner and the count recorded.

Exit: the owner's events on the Calendar screen; standard checks.

## Phase 7b: Apple calendar by .ics and Reminders by webhook

Goal: iCloud calendars and Reminders arrive without an Apple API.
Complexity: medium. Files: `integrations/ics/` (client parses `text/calendar`, no dependency: VEVENT, DTSTART, DTEND, RRULE expanded for the window, SUMMARY, LOCATION, UID), `integrations/apple_reminders/` (webhook route like Health Auto Export's), `modules/calendar/jobs/pull-ics.ts`, `modules/tasks` (reminders become tasks with `source = 'apple_reminders'`), `docs/SETUP-INTEGRATIONS.md`.

- [ ] iCloud: the owner makes a calendar public in Calendar.app and pastes the `webcal://` URL into a Connections card (one URL per calendar, stored in `core.connections`); the pull fetches through `core/fetching.ts` (SSRF rules already there), parses and upserts `source = 'ics'`. RRULE: expand daily, weekly, monthly, yearly with COUNT, UNTIL and BYDAY only; anything else is stored once with a note in the job log. Tests on a fixture `.ics` with each rule.
- [ ] Reminders: a Shortcut (documented step by step) runs daily and on reminder change, "Find Reminders where not completed", posts JSON to `/api/webhooks/apple-reminders` with the shared secret; the route upserts tasks by `external_id` (title, due, notes, list as project), never overwrites an `is_manual` field, completes a task when the reminder goes missing from the next post for two days.
- [ ] e2e: a fixture `.ics` served by the test server appears on the Calendar; a posted reminders payload creates a task.

Exit: standard; both documented with screenshots' worth of steps in SETUP-INTEGRATIONS.

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
