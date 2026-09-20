# Dashboard to the artboard

Superseded for styling on 2026-09-19 by the Holon redesign (docs/plans/holon-product-redesign.md, section 4): colour, type, radii, surfaces and control shapes now come from the Holon design contract and the shared components in `components/pos/`. This plan still governs what each screen shows and how it is laid out.


## Context

Screen two of the fidelity pass (method and decisions: docs/plans/weekly-review-fidelity.md). `POS Dashboard.dc.html` was captured this session at 1440 in dark, light and arrange mode into `/private/tmp/pos-handoff-sources/dashboard/`. The artboard is nine tiles in a fixed default order on a three-column grid under a 56px header and a headline block; the app has the same header, headline block, grid and arrange mode, and its tile internals already follow the artboard's shapes loosely, but it draws eighteen tiles in digest order, its headline is the alerts sentence, and every tile is off the artboard by copy, right-hand metadata and a few measurements.

Decisions taken with Nick for this screen (to be appended to `decisions/log.md`):

- Desktop tile set: the artboard's nine first, in its order, then the remaining module tiles in rail order. Nothing hidden; Arrange still covers all of them. Consistent with the 2026-09-10 phone decision.
- Headline: the 2026-09-09 template is extended to the artboard's three clauses, built from digests with no model call: net worth change (Finance), budgets past 80% with days left in the month (Finance), the longest-idle skill (Skills). Each clause only when its digest has the number; the alerts sentence is the fallback when none does.
- All nine tiles matched to the artboard in this pass.
- The net worth clause says "in 30 days", what the digest measures, and drops "mostly the brokerage". The System footer shows the next run only; the backup line is not written because the app has no record of the backup workflow.

Constraints as before: no em dashes, brand layer owns type and shape, core reads digests and manifests only, nothing invented (the artboard's "mostly the brokerage" needs per-account attribution no digest has, so that clause is not written).

## Artboard measurements (from the source, lines 30 to 191 and the logic at 194 to 341)

Header: 56px, `border-bottom --rule`, `padding 0 28px`, gap 16. Left: eyebrow "Dashboard / Fri Sep 11" (the slash in `--ink-4`; day as `DOW MON D`). Right: the compact search (34px, flex 1, min 220 max 320, the "›" prefix and "What are you looking for?" placeholder, i.e. the app's `BandSearch`/PosSearch compact), the Arrange button (12px, `padding 8px 12px`, 1px `--rule-2`, `--ink-2`; in arrange mode filled accent with `--bg` text and the label "Done"), and Run now (13px, `padding 9px 14px`, gap 8, the DS button with the arrow).

Headline block: `padding 26px 28px 0`. Eyebrow with a status dot: "Nightly summary · 04:02 CDT · Last run 04:02 · ok" (the first time is when the headline was refreshed; the app has one run time, so it reads "Nightly summary · Last run 04:02 CDT · ok"; while running, "Running N jobs…"). h1 `clamp(22px, 2.2vw, 30px)` / 400 / -0.03em / 1.25, `margin-top 12px`, `max-width 920px`, `text-wrap pretty`; links inherit colour with a 1px accent underline at 4px offset, accent on hover. Sub line 13px `--ink-3`, `margin-top 8px`: "Written from module digests only. Raw data is touched when you ask a direct question."

Arrange banner: `margin 18px 28px 0`, `padding 10px 14px`, 1px dashed accent, 12px `--ink-2`, "Arrange mode: drag tiles, or use ‹ › on each. Order is saved on this device." with "Reset to default" on the right.

Grid: `margin 22px 28px 28px`, `repeat(auto-fit, minmax(min(100%, 300px), 1fr))`, `grid-auto-rows minmax(200px, auto)`, gap 14, `align-content start`.

Tile: flex column, 1px solid `--rule` (`--rule-2` on hover for the module tiles; dashed accent in arrange), `--bg-elev`, `padding 16px 20px` (arrange: `40px 20px 16px` under a 28px handle bar in `--accent-soft`). Head: flex space-between baseline, eyebrow left, 11px `--ink-3` right (a link with " →" when it opens a screen). Rows across tiles are `border-bottom --rule`. `miniBtn`: 11px, `padding 3px 8px`, 1px `--rule-2`, `--ink-3`; approve is the same with `--ink` text and an accent border.

Per tile, default order:
1. **Warnings** (eyebrow in `--amber`; right "5 open"): rows `padding 8px 4px`, hover `--accent-soft`; a 6px square in the severity colour, 13px title / 1.35, 11px `--ink-3` sub; right, Snooze and ✕ mini buttons (Snooze opens 1d / 7d). Empty: centred 26px/300 `--ink-3` "0 warnings".
2. **Finance** (right "2 budgets flagged →"): two columns gap 18, `margin-top 14`: 11px label, 30px/300/-0.02em number, 11px line under (green "+$4,180 · 30d"; `--ink-3` "next: Claude Pro · in 3d"); then the sparkline svg `height 56px`, `margin-top 14`, flex 1, area in `--accent-soft`, 1.5px accent line.
3. **Tasks · today** (right "0 of 4 done →"): rows `grid 16px 1fr auto`, gap 10, `padding 9px 0`, 14px box (accent filled when done), 13px title, right 10px mono tag in its colour ("P1 · POS", "40 MIN", "AGENT · REVIEW" in accent, "OCT 12").
4. **Review · agent proposals** (right "3 pending →"): rows `padding 10px 4px`; 11px `--ink-3` source, 10px tracked state right ("PENDING" amber); 13px title / 1.4 `margin-top 4`; Approve / Edit / Dismiss mini buttons `margin-top 8`, gap 6. Empty: centred "inbox clear".
5. **Goals** (right "1 at risk →"): rows `padding 9px 0`, gap 2; 13px title with 10px tracked status right in its colour; `margin-top 6` a 2px bar in the status colour with an 88px right-aligned 11px `--ink-3` figure ("$247k / $300k", "340 / 405 lb", "7 / 12").
6. **Skill Tree** (right "level 14 →"): `grid 120px 1fr`, gap 14, `margin-top 12`: the 120px radar (rings and axes in `--rule`, shape `--accent-soft` with a 1.5px accent stroke, axis labels) and, centred vertically, up to three skill rows gap 8: 12px name with 11px mono delta right ("+140 XP" green, "74d idle" amber), a 2px bar under.
7. **System** (right "10 ok · 1 warning"): `margin-top 10` a strip of 11 cells gap 3; `margin-top 10` four rows `grid 1fr auto auto`, gap 12, `padding 7px 0`: 11px mono name, 11px `--ink-3` took, 10px tracked status ("OK", "WARN · 2 SKIPPED", "OK · EMAIL SENT"); footer pinned with `margin-top auto; padding-top 10`, 11px `--ink-3`: "Next run 04:00 CDT" left, "Backup 04:10 · 30 kept" right.
8. **Model spend · month** (right "cap $25 →" to Settings): `margin-top 14` a baseline row: 30px/300 figure and 11px `--ink-3` "19% of cap"; `margin-top 12` a 2px pace bar; `margin-top 12` rows `grid 1fr auto auto`, gap 12, `padding 7px 0`, 12px: purpose ("Classification · Haiku"), 11px `--ink-3` calls, 11px cost.
9. **Next 7 days** (right "$67.99 in bills · 6 items"): a 44px strip `margin-top 16` with a 1px rule at 10px, eight ticks with 9px labels (TODAY, SA, SU…, +7) and one square dot per item; `margin-top 6` rows `padding 6px 4px`, gap 10: 56px 11px mono when ("Today", "Tmrw", "Mon 14"), 6px module-coloured square, 13px title truncated, 11px mono `--ink-2` amount or tag right.

## Files

- `app/(app)/page.tsx`: tile order (nine ids first, then the rest in rail order), header, eyebrow, headline sub line; dashboard-only Card border.
- `app/(app)/Bento.tsx`: grid margins to the artboard (they may already match: verify), nothing else.
- `app/(app)/DashboardTiles.tsx`: SevenDays, JobRows and the warnings / proposals / spend rows to the measurements above.
- `core/orchestrator.ts`: `headlineSegments()` gains the three digest clauses ahead of the alerts fallback; `core/orchestrator.test.ts` (or the existing test file for it) first.
- `modules/finance/ui/Tile.tsx`, `modules/tasks/ui/Tile.tsx`, `modules/goals/ui/Tile.tsx`, `modules/skills/ui/Tile.tsx`: internals to the artboard; each module's right-hand metadata line.
- `components/pos/Card.tsx`: only if a `border` prop is the cleanest way to get `--rule` on the dashboard; otherwise a className from the page.
- `e2e/screens.spec.ts`: order and structure asserts; `e2e/seed.mts` only if a tile needs data the seed lacks (a budget past 80%, a stagnant skill, a warning of each kind).

## Tasks

Commit after each. Tests first where a function has one (the headline).

### Task 0: Baseline
1. Copy this plan to `docs/plans/dashboard-fidelity.md`; append the three decisions to `decisions/log.md`.
2. Prototype captures already exist (`proto-1440-dark.png`, `-light.png`, `-dark-arrange.png`, trimmed to 1318px). Take the app's current `dashboard-1440-*.png` as the before.
3. Failing e2e asserts in `dashboard shell` (desktop): the first nine tiles' eyebrow labels in DOM order are Warnings, Finance, Tasks · today, Review · agent proposals, Goals, Skill Tree, System, Model spend · month, Next 7 days; the tenth onwards are module tiles in rail order; a tile's computed padding is 16px 20px and its border colour is `--rule`; the header search placeholder is the compact one. Run `E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --project=desktop --grep "dashboard shell"`: fails.

### Task 1: Order, grid and chrome
1. `page.tsx`: build the tile array as the nine artboard ids in order, then module tiles for every remaining module in `getNav()` order, then nothing else (jobs and llm are among the nine). Give the module tiles stable ids the Bento already keys on.
2. Header: eyebrow "Dashboard / Fri Sep 11" (slash `--ink-4`); replace the page's own search input with the app's compact band search (34px, "What are you looking for?"); Arrange 12px `padding 8px 12px`, filled accent with "Done" in arrange mode; Run now 13px `padding 9px 14px` with the arrow.
3. Headline eyebrow: "Nightly summary · Last run 04:02 CDT · ok" from the run's own timestamp through `clockIn` (core/today.ts), "Running N jobs…" while a run is in flight if the page can know it, else omitted. h1 and sub line to the measurements.
4. Tiles: border `--rule`, padding 16px 20px, hover `--rule-2` on the module tiles. Grid margins 22px 28px 28px.
   Check: the Task 0 asserts pass; `dashboard, the week ahead and arranging the tiles` still passes; mobile `dashboard shell` passes. Commit: `fix: dashboard order and chrome to the artboard`.

### Task 2: Headline from digests
1. Test first: `headlineSegments()` given a summary whose modules carry `finance { changeCents: 418000, overBudget: [{name:'Dining'},{name:'Fitness'}] }` and `skills { stagnant: [{ name: 'Negotiation', lastEventAt }] }` and a `today` returns segments that read "Net worth climbed $4,180 in 30 days. Dining and Fitness are past 80% of budget with 19 days left, and Negotiation has gone 74 days without a linked event." with hrefs `/finance`, `/finance`, `/skills` on the underlined spans; "fell" for a negative change and "held" for zero; one budget reads "Dining is past 80%"; a missing digest drops its clause and the joiners adapt; no clauses at all returns the existing alerts sentence unchanged.
2. Implement in `core/orchestrator.ts`, pure over the summary plus `today`. The period is what the digest measures (30 days), not "this month".
   Check: unit test; the dashboard shows the sentence on demo data (the seed has budgets and a stagnant skill: verify, and seed one of each if not). Commit: `feat: the dashboard headline reads the artboard's three clauses from digests`.

### Task 3: The five core tiles
Warnings, Review, System, Model spend, Next 7 days to the per-tile measurements above, in `DashboardTiles.tsx` and the page: row paddings, the 6px squares, the right-hand metadata ("5 open", "3 pending →", "10 ok · 1 warning", "cap $25 →", "$67.99 in bills · 6 items"), the System footer line (next run from the cron schedule setting, backup line only if the app knows its backup schedule and count; otherwise the next run alone), the mini buttons' size, the Next 7 days strip's eight ticks and labels. Empty states: "0 warnings", "inbox clear".
   Check: side by side per tile; e2e `dashboard renders the nightly run` still passes. Commit: `fix: dashboard core tiles to the artboard`.

### Task 4: The four module tiles
Finance, Tasks, Goals, Skill Tree tiles in their modules' `ui/Tile.tsx` to the measurements above, from their own digest payloads: Finance two KPIs plus sparkline (the "next: X · in Nd" line from `upcoming` if the digest carries the next charge, else the count); Tasks four rows with the right tag from priority / estimate / status / date; Goals three rows with status and the 88px figure; Skill Tree radar plus three moves (`gaining` for gains, `stagnant` for the idle line). Right-hand line per tile as the artboard: "N budgets flagged →", "N of M done →", "N at risk →", "level N →".
   Check: side by side per tile. Commit: `fix: dashboard module tiles to the artboard`.

### Task 5: Proof
1. `E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --project=desktop --project=mobile --grep "dashboard"`; then `pnpm typecheck && pnpm lint && pnpm test && pnpm exec playwright test` (full).
2. Pairs: prototype beside app, dark and light, and the arrange state, into `/private/tmp/pos-handoff-sources/dashboard/`; read every tile; anything off goes back to its task. Phone `dashboard-402-*.png` checked against PosPhone's dashboard frame (the one phone artboard that exists for this screen) for chrome only, since the 2026-09-10 pass already did its geometry.
3. `docs/STATUS.md`: Dashboard done, next screen. Commit: `docs: dashboard fidelity pass`.

## Out of scope
- Other screens; the remaining Tasks 4 and 5 of `ui-handoff-fidelity.md` (connections grid, Skill Tree panes) stay queued; its Task 3 is superseded by this plan (note it in that file).
- The artboard's "mostly the brokerage" attribution and its "Backup 04:10 · 30 kept" line unless the app already knows those facts.
- Snooze 1d / 7d if the notifications model has no snooze duration; the existing Snooze stays.
