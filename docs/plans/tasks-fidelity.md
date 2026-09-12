# Tasks to the artboard

## Context

Screen six of the fidelity pass (method: docs/plans/weekly-review-fidelity.md). `POS Tasks.dc.html` captured at 1440 into `/private/tmp/pos-handoff-sources/tasks/` (Today, By goal, By project, Calendar, Review, Done, and Today with a row expanded). The app already has the right bones (URL view tabs, quick add parser, `columnsFor`, month grid, a drawer, `write`/`complete`/`approve` tools). What differs: a title block the artboard does not have, the band's right-hand count, the quick-add row's exact shape, the tab row's style and order (Calendar sits before Review), the column card and its rows (chips, EDIT mini, expand in place), no delete anywhere, no skill links on screen, and a field-by-field-on-blur drawer where the artboard has a form with Save and Delete.

Decisions with Nick (append to `decisions/log.md`):
- A row expands in place on click (notes, Goal, Skills, Source, Edit, Delete, Approve for agent rows); the EDIT mini and the Edit button open the drawer.
- Skill links are shown read-only from `core.skill_links` with their confidence and how they were classified; no inline add, no "new skill" box, no learned-rules panel (the classifier is rules from skills.yaml then a model; there are no per-word learned rules in the app).
- Delete removes the row and asks first (`confirm()`), through a new guarded `delete` tool, like Travel's `delete_trip`.
- The drawer becomes a form that holds edits until Save (same as the Finance limits drawer), 480px (a `narrow` Overlay option beside `wide`), band crumb "Tasks / Edit" or "Tasks / New task", no h2.
- "Remind me" stays a select over `remind_minutes` (At the time, 30 min before, Day before, No reminder). "Morning of · in digest" has no integer meaning and is left out. The "Reminder channel" cell shows the channels of the `task_reminder` rule in `core.notification_rules` (it exists: `{push,inapp}`) with "change" linking to Settings; if the rule is missing or muted the cell says "Off".
- Not built because the app has no source: the +12 XP toast (XP is a weight times events; the amount is not known at click time), the "Suggested goal from project" box, drag-and-drop on the calendar (kept as is: the grid already exists and drops are not in scope), the MODEL FALLBACK explanations.
- The shared `TabBar` is restyled to the DS tab every artboard uses (1px underline on the rule, 13px, `padding 8px 10px 12px`, no gap, mono 10px count with an optional amber tone). Every artboard's tabs share this style; only the horizontal padding varies (10 to 16), so a `tabClassName` prop carries it per screen.

## Artboard measurements (POS Tasks.dc.html lines 29 to 118, logic 246 to 352)

Band (56px, rule under, `padding 0 28px`): eyebrow "Tasks / {view label}"; compact search "Search tasks" (220 to 320); right, eyebrow with accent dot "{open} open · {done today} done today".

Quick add (`padding 18px 28px 0`, then 14px to the tabs): DS button "New task →" 44px tall `padding 0 16px` 13px; form 44px, 1px `--rule-2` (accent while typing) on `--bg-elev`: mono "+" `padding 0 12px 0 16px` 13px `--ink-4`; input 14px placeholder "Add a task… e.g. Renew renters policy !p1 #Home @fri 30m"; empty: mono 10px 0.08em `--ink-4` "!P1 · #PROJECT · @DAY · 30M" `padding 0 16px`; typing: chips 10px `padding 2px 7px` in the token's colour (P1 red, P2 ink-2, P3 ink-4, project and due ink-3, estimate ink-4) then "ADD ↵" mono 10px 0.08em on `--ink` in `--bg` `padding 6px 10px`.

Tabs (rule under): Today {n}, This week {n}, By goal, By project, Calendar, Review {n amber}, Done {n}; counts mono 10px `margin-left 6` ink-3.

Body `padding 16px 28px 24px`. Columns grid `auto-fit minmax(min(100%, 220px), 1fr)` gap 14 (Today: one column, 100%). Column: 1px `--rule` on `--bg-elev`, `padding 12px 10px`; head `padding 0 4px 10px`, rule-2 under: eyebrow label in the column colour (Today "Today · Fri Sep 11"; Review amber; Done today green), mono 11px ink-3 meta "{n} · {h}h|{m}m" (hours to one decimal when 60+). List `padding-top 10`, gap 6, `min-height 60`; empty: 12px ink-4 centred, dashed rule, `padding 18px 8px`.

Row (card): 1px `--rule` (rule-2 when expanded) on `--bg`, `padding 10px`, grab cursor; `gap 10`: 16px box (1px ink-3; dashed amber for an agent row; filled accent with a 6px `--bg` square when done), `margin-top 1`; title 13px/1.35 (ink-3 struck when done); meta line `margin-top 6`, gap 6: OVERDUE (mono 9px 0.08em red outline `padding 1px 5px`), AGENT · REVIEW (same in amber), priority mono 10px in its colour, due label mono 10px ink-3 ("1d overdue", "Today", "Tomorrow", weekday, "Sep 20") with " · 17:30" when timed, ⏰ chip (mono 9px 0.06em ink-4 outline rule-2: "-30M", "-1D", or the time for At the time), "#Project" 10px ink-3, "{est}m" mono 10px ink-4; right, EDIT mini (mono 9px 0.08em, 1px rule, ink-3, `padding 2px 6px`). Click title toggles expand; double-click opens the drawer (title attribute "Click: details · Double-click: edit").

Expanded (`margin-top 10; padding-top 10; border-top --rule`, gap 8): notes 12px ink-2 1.5; 11px ink-3 line gap 12: "Goal: {title|none}", "Skills: {Name 92%, Name 71%|none} RULE|MODEL|MANUAL" (mono, accent / ink-4 / amber), "Source: manual|agent"; buttons gap 6: Edit (mini, accent border, ink), Approve for agent rows, "→ {column}" moves for every other droppable column in the view (label cut at 18), Delete (mini, `margin-left auto`, red on hover).

Calendar view: head `margin-bottom 12`: ‹ 18px month title (min-width 150 centred) › Today as minis; right mono 11px ink-3 "{n} open · {m} with reminders"; grid gap 1px on `--rule` with 1px border; DOW cells `padding 8px 10px` `--bg-elev` mono 10px 0.08em; day cells `min-height 96` `padding 8px 10px`, today on `--accent-soft`, pad cells `--bg-deep`, past at .55 opacity (the app keeps ink not opacity, per the 2026-09-08 decision); number mono 11px (accent today); pills 11px `padding 3px 6px` on `--bg`, border red for P1 / amber for agent / rule-2, time mono ink-3 first; "+{n}" mono 9px ink-4.

Drawer (480px, `--bg-elev`, rule-2 left, band 56px "Tasks / Edit|New task", body `padding 22px 24px` gap 16): Title (15px input `padding 10px 12px`, placeholder "What needs doing?"); 2 by 2 grid gap 12: Due (select: the date itself when set, Today, Tomorrow, This week, Later, No date), Priority (P1 P2 P3, mono), Project (select), Time · optional (time input, mono), Remind me (select), Estimate · min (number, mono); Goal (select, None + goals); Notes (textarea 4 rows, placeholder "Context, links, acceptance…"); "Linked skills" with the RULES / MODEL FALLBACK / MANUAL mark right and chips "{Name} {conf}%" (11px `padding 3px 8px`), "Nothing matched yet." when empty; the two-cell strip (1px rule grid): "Source · who created it" mono 12px (amber for agent), "Reminder channel" mono 12px "{channels} · change"; footer `padding 16px 24px` rule over: Delete (13px ink-3, red on hover) left, DS "Save →" / "Create →" 38px right.

## Files

- `components/pos/TabBar.tsx`: the DS tab style, `tabClassName`, `count` may carry `countTone: 'warn'`.
- `components/pos/PageHeader.tsx`: `hideTitle` renders the h1 `sr-only` and no title row (the band alone). Placeholder still "Search tasks".
- `components/pos/Overlay.tsx`: `narrow` (480px).
- `core/module-contract.ts` + `core/modules.ts`: optional `skillNames?: () => Promise<Record<string, string>>` beside `classifier`, `getSkillNames()` returning `{}` with no provider. `modules/skills/manifest.ts` provides it from `loadTree()` (merged with overrides).
- `modules/tasks/data.ts`: `listSkillLinks()` joining `core.skill_links` to `core.entities` where `module = 'tasks' and entity_type = 'task'`, returning `{ taskId, skillId, confidence, classifiedBy, isManual }`; `deleteTask(id)`; `reminderRule()` (channels + muted of `task_reminder`, same shape as Travel's `checkinRule`).
- `modules/tasks/manifest.ts`: `delete` tool (zod `{ id: uuid }`), in `guarded`.
- `modules/tasks/ui/actions.ts`: `deleteTask`.
- `modules/tasks/shape.ts`: `Task.skills: { name, confidence, by }[]` and `remindLabel(minutes, dueAt)` for the ⏰ chip; `columnsFor` metas become "{n} · {load}" with hours to one decimal (`loadLabel` changes: "4.2h" / "45m"); tests updated in `shape.test.ts`.
- `modules/tasks/ui/TasksPage.tsx`: band only (`hideTitle`), status "{open} open · {done today} done today" with the accent dot; passes `skillNames`, links and the reminder rule down.
- `modules/tasks/ui/Board.tsx`: quick add to the artboard's shape (DS `New task` button opens the drawer in new mode, as the artboard does), tab order with Calendar before Review and counts for Today / This week / Review / Done, columns and rows per the measurements, expand in place (`expanded` state, one id), the drawer opened from EDIT / Edit / double-click / calendar pill; drawer state `?task=<id>` / `?task=new` in the URL so `shoot()` survives.
- `modules/tasks/ui/TaskDrawer.tsx` (new, split out of Board): the form, Save and Delete.
- `modules/tasks/ui/Calendar.tsx`: head and cell chrome to the measurements.
- `e2e/screens.spec.ts`: the three tasks tests reworked; `e2e/seed.mts` unchanged unless a timed task with a reminder is needed for the ⏰ chip (check `modules/tasks/seed.ts` first; add `remind_minutes: 30` on the deadlift row if absent).

## Tasks

### Task 0: Baseline
Plan to `docs/plans/tasks-fidelity.md`, decisions logged. Failing e2e asserts (desktop): no `heading` "Tasks" visible (sr-only is fine: assert the band eyebrow "Tasks / Today" instead); band text `/\d+ open · \d+ done today/`; tabs in the order Today, This week, By goal, By project, Calendar, Review, Done; the Today column head matches `/Today · \w{3} \w{3} \d+/`; clicking a row title shows "Source: manual" and a "Skills:" line; EDIT opens a dialog whose band reads "Tasks / Edit" and that has a "Save" button; Delete removes a row after `page.on('dialog')` accepts.

### Task 1: Data and contract
1. `skillNames` seam and the skills provider; unit test in `core/modules.test.ts` that `getSkillNames()` is `{}` without a provider.
2. `listSkillLinks`, `reminderRule`, `deleteTask`; the `delete` tool; `deleteTask` action.
3. `shape.ts`: `skills` on `Task`, `remindLabel` (test: 30 → "-30M", 1440 → "-1D", 0 with "17:30" → "17:30"), `loadLabel` to "4.2h" (tests updated).
   Check: `pnpm test`. Commit: `feat: tasks delete tool, skill links on the row, reminder chip label`.

### Task 2: Shared pieces
TabBar style + `tabClassName` + `countTone`; PageHeader `hideTitle`; Overlay `narrow`.
   Check: `pnpm typecheck`; the Finance/Goals/Review screens still render (grep tests pass). Commit: `fix: DS tab row, band-only page header, 480px drawer`.

### Task 3: The page
Band, quick add row, tabs, columns, rows, expanded band, moves, Approve, Delete; the calendar chrome.
   Check: Task 0 asserts pass except the drawer ones; side by side of Today (collapsed and expanded), By project, Review, Done, Calendar. Commit: `fix: tasks page to the artboard`.

### Task 4: The drawer
`TaskDrawer.tsx` with the form, `?task=` in the URL, Save as one `writeTask`, Create for new, Delete in the footer, the skills block, the source and channel strip.
   Check: e2e: EDIT opens, change the estimate, Save, the row shows the new "{est}m"; New task → Create adds a row; the XP test and the review approve test still pass. Commit: `feat: the task drawer as the artboard's form`.

### Task 5: Proof
`--grep "tasks"` both widths; typecheck, lint, unit, full e2e. Pairs: Today dark and light, the expanded row, drawer, calendar. Phone (402) against the shell rules: one column, chips wrap, EDIT stays on the row, drawer full width. STATUS.md, memory. Commit: `docs: tasks fidelity pass`.

## Verification
- `pnpm test` (shape, quickadd, modules seam), `pnpm typecheck`, `pnpm lint`.
- `E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --project=desktop --grep "tasks"` and `--project=mobile`.
- Pairs in `/private/tmp/pos-handoff-sources/tasks/pairs/` sent to Nick.

## Out of scope
- Drag and drop onto calendar days, learned rules, the XP toast, a new-skill box, the goal suggestion, and any other screen.
