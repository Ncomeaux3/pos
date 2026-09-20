# Weekly Review to the artboard, and the shell under it

Superseded for styling on 2026-09-19 by the Holon redesign (docs/plans/holon-product-redesign.md, section 4): colour, type, radii, surfaces and control shapes now come from the Holon design contract and the shared components in `components/pos/`. This plan still governs what each screen shows and how it is laid out.


## Context

Nick wants the POS app to match the Claude Design prototypes exactly, module by module, starting with `POS Weekly Review.dc.html`. The prototypes are the screen spec (decision 2026-09-07). The live project file matches the Sep 9 export on disk line for line, so `/Users/ncomeaux/Downloads/design_handoff_pos 2/` is the source; the two extra remote files (`-standalone`, `.html`) are variants of the same screen and are not used.

The screen is already built to the artboard's geometry (`components/pos/ReviewShell.tsx` was measured off it, the Wizard's step markup mirrors it, and the module contract carries computed goals). What is left is everything a screenshot still shows different:

1. The shared sidebar (order, a Notes row the prototype does not have, row geometry, badge colour, Dark and Collapse as list rows).
2. Step one: six named metric tiles with a coloured delta line, instead of whatever digest keys happen to exist.
3. Copy that drifted from the artboard, and copy the artboard has that the app has nothing for (the "shape of the week" sentence, the header theme button).
4. The misses meta line ("Due Tue · rolled 3 times · Finance") which needs a roll count Tasks does not keep.

Decisions taken with Nick this session (all on record in the conversation, to be appended to `decisions/log.md` on the first commit):

- Deliverable is the app, not a second canvas. Weekly Review first, then every other screen with the same method.
- Source: live project, which equals the local export. Fidelity bar: pixel geometry in the app's own components, no prototype markup, no visual-diff dependency.
- Metrics: match the six tiles with deltas. A tile whose digest is absent is hidden; the delta line is omitted when there is no prior week.
- Glance sentence: deterministic from the numbers, no model call.
- Chrome: both the header theme button and the sidebar Dark and Collapse rows, exactly as drawn. Sidebar first, in this pass.
- Roll counts come from `core.write_log` (kind `rescheduled`), no schema change.
- Wins helper stays honest: no "feed the Skill Tree" clause, because ticked wins award no XP.
- `/notes` leaves the numbered sidebar list and stays reachable by URL and the command palette.
- Done means side-by-side prototype and app shots for all six steps at 1440x900, dark and light, plus structural e2e asserts, plus typecheck, lint, unit and e2e green. Phone at 402 is checked against the shared shell rules only: neither the Weekly Review artboard nor PosPhone has a phone layout for this screen.

Constraints that hold throughout: no em dashes (the artboard's em dashes become commas or middle dots), type and shape come from the brand layer not the prototype (Manrope, 12px and 8px radii; the square badge in the prototype is not chased), core names no module on this screen except through the review and digest contracts, nothing personal in code.

## Platform concerns map

| Concern | How this plan handles it |
|---|---|
| Vercel read-only filesystem | Nothing is written to disk; deltas read `core.digests` history, which already exists (one row per module per run) |
| One schema per module, links through core | Core reads digests and the `review` contract only. Tasks reads its own `rescheduled` rows in `core.write_log`, which is the shared schema |
| Digest history | First week after deploy shows no delta lines and no "rolled twice"; the tile still renders |
| Cost cap | No model calls anywhere in this pass |
| Mobile hit targets | Header theme button is 38px on desktop per the artboard and 44px below `md`, per the README's mobile rule |
| Theme single source of truth | Header button and sidebar row both call the existing `setTheme` server action |
| Fork and fill | The nav order is a list of module ids in `core/nav.ts`, no names or personal data |
| Manual override / classification | Not touched |

## Files

Shell
- `core/nav.ts`: source order for enabled modules; modules not in the list leave the numbered set.
- `components/pos/Sidebar.tsx`: row geometry, badge colour, header padding, footer as a list with Dark and Collapse rows.
- `e2e/screens.spec.ts`: structural asserts.

Weekly Review
- `core/review-glance.ts` (new, no imports beyond types): the six-tile spec and delta rules as a pure function, with `core/review-glance.test.ts`.
- `core/reviews-shape.ts`: copy strings, `glanceSentence()`, `missesHelper()`, `pickLabel()`; tests in `core/reviews.test.ts`.
- `app/(app)/weekly-review/page.tsx`: call the pure glance builder with the two digest snapshots; pass contributing module labels; pass the theme action.
- `app/(app)/weekly-review/Wizard.tsx`: wire `themeToggle`, the note paragraph, the copy helpers; no layout changes.
- `modules/finance/jobs/nightly-digest.ts`: `spendCents`, `budgetCents` (month to date, categories with a budget this month).
- `modules/tasks/jobs/nightly-digest.ts`: `rolledTwice`; `modules/tasks/manifest.ts` `review.slipped` meta.
- `modules/skills/jobs/nightly-digest.ts`: `xpThisWeek`, `gainedThisWeek` (top three, seven day window).
- `e2e/seed.ts` (or wherever the e2e seed lives): write digests and a backdated copy so deltas render.

## Tasks

Each step names its check. Commit after each task. Write the test before the feature where the project rule asks for it (classification and XP paths; here the tile builder and the copy helpers).

### Task 0: Baseline
1. Copy this plan to `docs/plans/weekly-review-fidelity.md`. Append the session's decisions to `decisions/log.md`. Delete the stray `wr-proto-step1-1440.png` at the repo root (a capture that landed in the wrong place); `.playwright-mcp/` captures stay out of git (confirm `.gitignore`).
2. Capture the prototype: serve `/Users/ncomeaux/Downloads/design_handoff_pos 2/` on a local port, `POS Weekly Review.dc.html` at 1440x900, six steps, dark and light (its own theme button), into `/private/tmp/pos-handoff-sources/weekly-review/`. Not committed.
   Check: 12 PNGs exist.

### Task 1: Sidebar to `PosSidebar.dc.html`
Measured from the prototype (lines 18 to 55): width 232 / 64 collapsed; header 56px, `padding 0 18px`, gap 12, mark 28, name 13px/600/-0.01em; nav `padding 12px 0`, gap 2; row `min-height 36px`, `padding 9px 18px 9px 0`, a 2px stretched bar (accent when active, transparent otherwise), gap 12, number 11px mono 0.12em width 20 in the row's own colour, label 13px, row colour `--ink-3` (active `--ink`), background `--accent-soft` when active, hover changes colour only; badge 10px mono `padding 2px 7px` border and text `--accent`; footer `border-top --rule`, `padding 10px 0`, gap 2, rows `padding 9px 18px 9px 20px`, 13px, no bar; Dark row is a 10px circle in a 20px slot with the current theme's name as label; Collapse row is the chevron in the 20px slot with the label "Collapse".

1. Write failing e2e asserts in `dashboard shell` (desktop): module link labels in DOM order equal Dashboard, Finance, Skill Tree, Tasks, Goals, Second Brain, Insurance, Ideas, Fitness, Health, Home & Assets, Meals, Travel, Review; no "Notes" link in the sidebar; the Review badge's computed colour is the accent; a nav row's computed min-height is 36px and its number's font-size 11px; the footer contains rows labelled "Dark" (or "Light") and "Collapse". Assert `/notes` still opens and appears in the command palette.
   Check: `pnpm test:e2e -- --project=desktop --grep "dashboard shell"` fails on order and geometry.
2. `core/nav.ts`: one ordered id array; enabled manifests filtered and ordered by it; a manifest not in the list is not numbered (it keeps its route). `NAV_FOOTER` unchanged.
3. `components/pos/Sidebar.tsx`: `NavRow` to the measured values (bar as an inner span so the padding-left is 0 as drawn, or `border-l-2 pl-0` with the same result), footer rows as a second list, theme and collapse as rows in that list; remove the separate footer bar. Mobile tab bar and More sheet untouched.
   Check: the asserts from step 1 pass; `pnpm test:e2e -- --project=mobile --grep "dashboard shell"` still passes.
4. Commit: `fix: sidebar to the PosSidebar artboard`.

This supersedes Task 2 of `docs/plans/ui-handoff-fidelity.md`; note that in that file's Task 2 heading.

### Task 2: Six tiles with deltas
1. `core/review-glance.test.ts` first: given `now` and `lastWeek` maps of module id to payload, `glanceTiles(now, lastWeek)` returns, in this fixed order and only when the module and key are present:
   - Tasks closed: `tasks.completedThisWeek`; delta `+4 vs last week` (brand up, warn down, quiet on no change, none without a prior row).
   - Slipped: `tasks.overdue`; delta `2 rolled twice` in warn when `rolledTwice > 0`, otherwise the vs-last-week form with the good direction being down.
   - Spend vs budget: `round(spendCents / budgetCents * 100)%`; delta `$2,889 of $3,450`; brand under 100%, warn at or over; hidden when `budgetCents` is 0.
   - Net worth: signed percent of `changeCents / (netWorthCents - changeCents)` to one decimal; delta the formatted net worth; quiet when the base is 0.
   - Workouts: `fitness.workoutsThisWeek`; delta `load 312 · +18` from `loadThisWeek` and `loadLastWeek`.
   - XP earned: `skills.xpThisWeek`; delta `Planning → level 7` when an attribute's `level` rose against last week's `attributes`, otherwise `Planning +120` from `gainedThisWeek[0]`, otherwise none.
   Numbers are formatted with `toLocaleString('en-US')`, cents to whole dollars. Check: the test fails to compile.
2. Implement `core/review-glance.ts`. Check: `pnpm test core/review-glance`.
3. Digest keys, each with its existing digest test extended if one exists, otherwise a focused test on the new query's formatter:
   - Finance: `spendCents`, `budgetCents` summed over categories with a `finance.budget` row for the current month (the `spend` rows the digest already computes carry `spent_cents` and `limit_cents`).
   - Tasks: `rolledTwice` = count of currently overdue open tasks with at least two `rescheduled` rows in `core.write_log` (see Task 4 for the shared query).
   - Skills: `xpThisWeek` = XP from `core.events` in the last seven days through the existing weight function; `gainedThisWeek` = top three skills by that sum, `{ skillId, name, gained }`.
   Check: `pnpm test` for the three modules.
4. `page.tsx`: `glance()` becomes a call to `glanceTiles()` over `latestDigests()` and `digestsBefore(7)` keyed by module; also return the labels of the modules that contributed (from their manifests' `nav.label`) for the helper sentence.
   Check: with `pnpm setup:demo` data and one nightly run, `/weekly-review` shows the six tiles in order.
5. Commit: `feat: weekly review glance reads the six numbers the artboard names`.

### Task 3: Copy to the artboard, honest
Strings live in `core/reviews-shape.ts` (`STEPS`) and the Wizard. Change only the strings and the two helper functions; layout stays.
1. Tests first in `core/reviews.test.ts`: `glanceSentence(tiles, stalledGoals)` produces "The shape of the week: 23 tasks closed and 4 slipped, spend at 84% of budget, 4 workouts, and one goal that has not moved." dropping any clause whose tile is missing and returning "No numbers yet this week." when none are; `missesHelper(4)` gives "Four items missed their date. Each one needs a decision: carry it, drop it, or shrink it." and `missesHelper(0)` "Nothing missed its date."; `pickLabel(3)` ends "· picking a fourth replaces the first".
2. Copy, per step:
   - Glance helper: "Pulled from Finance, Tasks, Fitness and the Skill Tree. Nothing here needs your input; read it, then move on." built from the contributing labels, falling back to "the module digests". The bordered-left paragraph becomes `glanceSentence()` and replaces the architecture sentence there today.
   - Wins helper unchanged (decision). Wins note "3 picked. These go in the note and nowhere else." matches already; verify.
   - Misses helper from `missesHelper(count)`. Footnote stays "N still undecided, you can move on and come back".
   - Goals and Plan helpers: already the artboard's words; verify character for character.
   - Close: question "Ready to close week {n}?"; helper "This writes one note, reschedules what you carried, and sets the {count} priorities." with the real pick count in words; the empty block reads "Nothing recorded."; the three cards read as the artboard's shape with the app's true facts ("1 item moves to next week with its original context.", "2 priorities pin to the top of Monday and show on the dashboard." only if the dashboard shows them, else the app's current sentence; the note card keeps the app's sentence unless the note really is linked from every item, which `actions.ts` will settle).
   Check: unit tests pass; `grep -rn "—"` over the touched files finds nothing.
3. Commit: `fix: weekly review copy to the artboard`.

### Task 4: Misses meta and the roll count
1. A pure `slipMeta({ dueOn, today, rolls, project })` in `modules/tasks/` with a test: "Due Tue · rolled 3 times · Finance" when due inside the last six days; "Due 2 Sep · rolled once · Finance" when older; "rolled twice" for two; no roll clause for zero; no project clause when none. The estimate is appended by the Wizard already, so it is not part of the meta.
2. One query, used by `review.slipped` and by the digest's `rolledTwice`: rolls per task from `core.write_log where module = 'tasks' and kind = 'rescheduled'`, grouped by the task id in the apply payload. Confirm the column name and the payload key against `core/writelog.ts` (`applyPayload` in code; verify the SQL column) before writing it.
   Check: `pnpm test modules/tasks`; on demo data after two nightly runs the misses step shows "rolled twice".
3. Commit: `feat: tasks tells the review how often an item rolled`.

### Task 5: Header theme button
1. In `Wizard.tsx`, pass `themeToggle` to `ReviewShell`: a button labelled with the current theme's name ("Dark" / "Light"), `min-h-[38px] md:min-h-[38px] min-h-11 px-3.5 border border-rule-2 text-[11px] uppercase tracking-[0.12em] text-ink-2`, calling the same `setTheme` action the sidebar uses (`app/(app)/shell-actions.ts`), passed in from `page.tsx`. The label is the current theme, as drawn.
   Check: clicking it flips `data-theme` on `html` and the sidebar row's label agrees.
2. Commit: `feat: weekly review header theme button`.

### Task 6: Proof
1. e2e seed: after module seeds, call `writeDigests()`, then insert a backdated copy of each digest row (`run_at - interval '8 days'`, a few numbers adjusted) so deltas render. Weekly review spec: assert the six tile labels in order; extend `shoot()` calls to all six steps (`weekly-review`, `-wins`, `-misses`, `-goals`, `-plan`, `-close`).
   Check: `pnpm test:e2e -- --project=desktop --grep "weekly review"`.
2. Side by side: prototype captures from Task 0 beside `e2e/__screens__/weekly-review*-1440-*.png`, one contact sheet per theme, made with `sips` or a short script into `/private/tmp/pos-handoff-sources/weekly-review/`. Read every pair; anything off by more than a pixel or a word goes back to its task. Attach the sheets in the handover.
3. Phone: `weekly-review*-402-*.png` checked against the shell rules (padding, tab bar, 44px targets), nothing else claimed.
4. Full run: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`. Paste the tail of each.
5. Update `docs/STATUS.md` (Weekly Review matched to the artboard; sidebar to PosSidebar; the method for the next 26 screens) and mark Task 2 in `ui-handoff-fidelity.md` as done here. Commit: `docs: weekly review fidelity pass`.

## Out of scope, on purpose
- The other 26 screens: next passes, same method (prototype captures, structural asserts, side by side).
- Tasks 3 to 5 of `ui-handoff-fidelity.md` (dashboard tiles, connections grid, Skill Tree panes): unchanged, still queued.
- A phone layout for Weekly Review beyond the shared shell: no artboard exists.
- Awarding XP for ticked wins: declined this session.
