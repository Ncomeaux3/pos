# Goals to the artboard

## Context

Screen seven of the fidelity pass (method: docs/plans/weekly-review-fidelity.md). `POS Goals.dc.html` captured at 1440 into `/private/tmp/pos-handoff-sources/goals/` (Active dark and light, the view drawer for Net worth and Deadlift, the edit drawer, the inline add, Archive). Another session is running Insurance, Meals and Second Brain in worktrees off `6f5dd33`; it constrains itself to `modules/<name>/`. This pass touches `core/` for one seam (below) and `modules/tasks/manifest.ts` to fill it, which that session does not touch.

The app has the right bones: the band, title and lede, Active / Archive tabs in the URL, the inline add form, cards grouped by area, `progress()` and `rule()`, the drawer in the URL with both projections, the metric picker from the registry, check-in and archive. What differs: the band summary and dot, the lede copy, the New goal button (DS small ink button, 36px), the tab padding (14), the card (the artboard's 26px "current / target" figure, the 3px bar with the pace mark, the two 11px lines with the deadline and projected finish, the 80 by 28 sparkline in the status colour, and a footer row with "Next: task · due", a check-in field with Check in, Mark done for a milestone, "AUTO · metric" for a computed goal), the group meta ("2 goals · 1 on track"), and the drawer: a view mode with the head (22px title, status pill, "area · type · source", notes), a three-cell strip (Now, Target, Days left), a Status rule card with the long sentence and both projections, a History chart (area, target dashed line, needed-pace line, dots, manual dots in ink), check-in under it, Linked tasks, Linked skills, Agent proposals, and a footer with Edit, Archive and Delete; and an edit mode as a form (Title, Type, Life area, Target / Times per week, Unit, Deadline, Starting value, Metric source, Notes) with Cancel and Save → / Create →. The app's drawer today is a mix of both with saves on blur.

Decisions with Nick (append to `decisions/log.md`):
- Linked tasks come through a new optional `linked(entityRef)` hook on the module contract (`core/module-contract.ts`, aggregated by `getLinked()` in `core/modules.ts`), which Tasks fills with its tasks whose `goal_ref` is the entity: `{ title, meta, done, href }`. Goals reads the registry entity for each goal and asks core. Same shape of seam as `metrics` and `skillNames`; no module reads another's schema.
- A guarded `delete` tool, as Tasks and Travel have; Delete on the drawer footer asks first. The registry row goes (skill links cascade), check-ins cascade, events stay.
- Agent proposals: pending `core.proposals` rows for module `goals` whose `payload.id` is the goal, listed with PENDING and a Review → link; absent when there are none.
- The drawer's edit mode holds edits until Save (one `write`), like Tasks; the view mode has no inline editing. Metric source is the registry list plus "Manual check-ins"; the artboard's "Custom query…" is not offered because the app resolves a metric by registry key, not by a query string.
- Status pills are the artboard's outlined mono 9px marks in the status colour (done = accent); the shared `StatusChip` stays for other screens.
- Not drawn for want of a source: nothing on this screen. Every artboard element has a truthful source once the seam exists.
- Linked skills are read from `core.skill_links` on the goal's registry row, named through `getSkillNames()` (Tasks pass), each a link to `/skills?skill=<id>`.

## Artboard measurements (POS Goals.dc.html lines 30 to 93; drawer 95 to 171; logic 176 to 291)

Band: eyebrow "Goals / Active|Archive"; compact search "Search goals"; right an eyebrow with a dot: "{active} active · {atRisk} at risk · {stalled} stalled", dot red when any stalled, amber when any at risk, green otherwise.

Title block `padding 20px 28px 0`, `align-items flex-end`: h1 28px; lede 13px ink-3 `margin-top 8`: "Progress is computed from a metric when one exists, otherwise from check-ins. Status: at risk when pace is under 80% of what the deadline needs; stalled after 30 days without change." Right: "New goal →" DS button small (`padding 9px 14px`, 13px, ink ground, 36px) opening the drawer in new mode.

Tabs `margin 18px 28px 0`: Active {n}, Archive {n}; `padding 8px 14px 12px` (TabBar `tabClassName="px-3.5"`).

Body `padding 18px 28px 28px`, gap 22. Inline add on the Active tab: closed, a dashed rule-2 button "+ Add a goal inline" (`padding 12px 16px`, 13px ink-3, accent on hover); open, a dashed accent form `padding 14px 16px`, grid `minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) auto` gap 10, fields Goal ("e.g. Run a half marathon"), Target (mono, "21.1 km"), Deadline (date), then Add (mini accent), "More options…" (mini, opens the drawer in new mode with the three values), Cancel. Empty: "Nothing here yet." 13px ink-3 centred `padding 40`.

Group: head 15px area, mono 11px ink-3 "{n} goal(s) · {k} on track" (on track counts ON TRACK and DONE), `padding-bottom 8`, rule-2, `margin-bottom 12`; grid `auto-fill minmax(min(100%, 300px), 1fr)` gap 14. Areas in the fixed order Engineering, Business, Communication, Health, Life ops, then any other area the data has.

Card: 1px rule on bg-elev `padding 16px 18px`, hover rule-2 and lift 2px. Head: title 15px/1.3 -0.01em as a button opening the drawer, under it 11px ink-3 "{Numeric target|Count|Habit · weekly|Milestone} · {computed|check-ins}"; right the status pill (mono 9px 0.08em, 1px border, `padding 2px 6px`, colour: green ON TRACK, amber AT RISK, red STALLED, accent DONE). `margin-top 14`: mono 26px/300 -0.02em current with " / target" 12px ink-3; right mono 13px ink-2 "{pct}%". `margin-top 10`: 3px bar on rule-2, fill in the status colour, a 1px by 9px ink-2 mark at the expected percent (`top -3`). `margin-top 12` grid `1fr auto` gap 12: left two 11px ink-3 lines, the rule sentence (line-height 1.5) and "Deadline {Mon D[ YYYY]} · {n days left|n days over} · finish ≈ {Mon D YYYY|never at this pace|done}" (a milestone shows no finish clause; the artboard's dash is a placeholder) (deadline and days in ink-2, finish green when within the deadline, amber otherwise; ellipsis); right an 80 by 28 sparkline path in the status colour, 1.5px. Footer `margin-top 12; padding-top 10; border-top rule`, space-between: left 11px ink-3 link "Next: {task} · {due}" | "All linked tasks done" | "No linked tasks" to /tasks?view=goal (ellipsis); right: check-in form (72px mono input `padding 4px 8px` 11px placeholder "$ value" | unit | "value", "Check in" mini) when manual and not a milestone and not archived; "Mark done" / "Reopen" mini accent for a milestone; "AUTO · {metric}" mono 10px ink-4 for a computed goal.

Formats (logic 224 to 228): dates "Sep 28" with the year when not this year; projections "Mar 8 2027" always with the year; values as `formatValue` already does ("$247,200", "340 lb", "3/wk", "Done" / "Not yet"). The card's "current / target" for a milestone reads "Not yet / Done".

Drawer 520px (shared Overlay), crumb "Goals / {title}" | "Goals / Edit" | "Goals / New goal", body `padding 22px 24px` gap 18, no h2 in the Overlay slot (the head is drawn in the body as the artboard has it).
- View: head with h2 22px/400 -0.03em and the pill (`margin-top 4`) right; 12px ink-3 "{area} · {type} · {source}" `margin-top 6`; notes 13px ink-2 1.55 `margin-top 10`. Strip: 1px rule grid of three cells `padding 10px 12px` on bg: eyebrow Now / Target / Days left, mono 18px/300 `margin-top 6` (days left as "476 days left" | "12 days over"). Status rule card (1px rule, `padding 12px 14px`, gap 8): eyebrow, 13px/1.55 long sentence: done "Target reached. Archive it or raise the target."; milestone "Milestones are binary. At risk when under 30 days remain and it is not done."; streak "Habit goals compare this week's count ({cur}) with the target ({target}). Under 60% is stalled."; else "You need {needed}/mo to hit {target} by {deadline}. Last 30 days you did {pace} per month, which is {share}% of the needed pace. Under 80% flags at risk; no change for 30 days flags stalled."; under it a 2-col 12px ink-3 grid "Projected · last 30d pace" / "Projected · all history" with the date under each in green or amber. History: eyebrow with mono 11px "{n} points · nightly snapshots|check-ins"; an svg 400 by 110 `preserveAspectRatio none` full width: dashed ink-4 target line at Y(target), a rule-2 line from (0, Y(start)) to (400, Y(start + span × expected)), the area in accent-soft, the path in accent 1.5px, dots r 2.5 (ink for a manual point, accent otherwise, bg-elev stroke); Y maps [min(start, values), max(target, values)] to 100..10, X maps ago to 400 − ago/maxAgo × 400; under it 10px ink-4 "{START DATE}" · "dashed = target · grey = needed pace" · "TODAY". Check-in form `margin-top 12` (mono input flex 1, "Check in" mini accent) for a manual non-milestone; for a computed goal the 11px ink-4 line "Computed nightly from {metric}. Manual check-ins are disabled while a source is set." Linked tasks: eyebrow with "{done} / {n} done →" link to /tasks?view=goal; rows `padding 8px 0` rule under: 12px box (accent filled when done), 13px title (ink-3 struck when done), mono 11px ink-3 due. Linked skills: chips 11px `padding 3px 8px` linking to the tree. Agent proposals when any: eyebrow with "Review →", rows with 11px ink-3 "{module}.{tool}" and PENDING amber 9px, 13px title (the payload's title or the reason). Footer: Edit and Archive / Unarchive minis left, Delete 13px ink-3 (red on hover) right.
- Edit / New: Title 15px input; 2-col grid gap 12: Type select (Numeric target, Count, Habit · per week, Milestone), Life area select (the five areas), Target ("Times per week" for a habit; hidden for a milestone), Unit (placeholder "$, lb, books, /wk"; hidden for a milestone), Deadline (date), Starting value (hidden for a milestone); Metric source · optional with the right-hand note "progress is computed when set", a select "Manual check-ins" plus the registry's "{label} · {id}"; Notes textarea 3 rows. Footer: Cancel (13px ink-3) left, "Save →" / "Create →" DS small (38px) right.

## Files

- `core/module-contract.ts`: `linked?: (entityRef: string) => Promise<LinkedItem[]>` with `LinkedItem = { title: string; meta: string; done: boolean; href?: string }`; `core/modules.ts`: `getLinked(entityRef)` concatenating every provider; a test in `core/modules.test.ts` that `getLinked` on an unknown ref is `[]`.
- `modules/tasks/manifest.ts`: `linked` reading `tasks.task where goal_ref = $1` (title, `dueLabel`-style meta via `dueLabel(days, today)` from `./quickadd` with `ownerToday()`, done = status done, href `/tasks?view=goal`). `modules/tasks/data.ts`: `listByGoal(ref)`.
- `modules/goals/data.ts`: `entityRefs()` (goal id → registry id), `listSkillLinks()` (as Tasks), `pendingProposals()` (module goals, status pending, `payload->>'id'`), `deleteGoal(id)`; `modules/goals/manifest.ts`: `delete` tool in `guarded`; `modules/goals/ui/actions.ts`: `deleteGoal`.
- `modules/goals/progress.ts`: `ruleLong(goal, p, unit, deadlineLabel)` (pure, tested in `progress.test.ts`), `historyPaths(goal, history)` returning path, area, dots, target y, pace line (pure, tested: a two-point history yields a path with two commands and the target line at 10).
- `modules/goals/ui/GoalsPage.tsx`: band summary and dot, lede, the DS New goal (as `?goal=new`), `tabClassName`, joins links / skills / proposals onto `GoalCard`.
- `modules/goals/ui/GoalList.tsx`: card to the measurements, group meta and order, inline add with "More options…"; `modules/goals/ui/GoalDrawer.tsx` (new): view and edit modes (`?goal=<id>`, `&edit=1`, `?goal=new`), Save as one write, Delete, Archive.
- `e2e/screens.spec.ts`: the four goals tests reworked; `e2e/seed.mts`: after both seeds, link two demo tasks to demo goals (`update tasks.task set goal_ref = (select id from core.entities where module='goals' and entity_id = <goal>::text) where external_id in (...)`) so the card's Next line and the drawer list have rows. (`modules/tasks/seed.ts` cannot: tasks seed before goals.)

## Tasks

### Task 0: Baseline
Plan to `docs/plans/goals-fidelity.md`, decisions logged. Failing e2e asserts (desktop): band `/\d+ active · \d+ at risk · \d+ stalled/`; a card with text `/\d+ goals? · \d+ on track/` in a group head; the Net worth card shows "$247,200" and "/ $300,000"; "Next: " on a card; opening Net worth shows "Status rule", "Days left", "Linked tasks" with a row, "Linked skills"; Edit switches the drawer to a form whose footer has "Save"; Delete asks and removes.

### Task 1: Seam, data and tools
`linked` seam + Tasks provider; goals data reads; `delete` tool and action; `ruleLong` and `historyPaths` with tests. Check: `pnpm test`, `pnpm typecheck`. Commit: `feat: linked seam, goal delete tool, the drawer's arithmetic`.

### Task 2: Page and cards
Band, lede, New goal, tabs, inline add, groups, cards. Check: Task 0 page asserts; pairs. Commit: `fix: goals page and cards to the artboard`.

### Task 3: Drawer
`GoalDrawer.tsx` view and edit modes; history chart; check-in; linked tasks, skills, proposals; footer. Check: the drawer asserts, the check-in test, the inline add test. Commit: `feat: the goal drawer as the artboard draws it`.

### Task 4: Proof
`--grep goals` both widths; typecheck, lint, unit; full e2e once (coordinate: the other session reseeds the same database). Pairs: Active dark and light, drawer view, drawer edit, inline add. Phone at 402 against the shell rules. STATUS.md, memory. Commit: `docs: goals fidelity pass`.

## Verification
- `pnpm test` (progress, modules seam), `pnpm typecheck`, `pnpm lint`.
- `E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --project=desktop --grep "goals"` and `--project=mobile`.
- Pairs in `/private/tmp/pos-handoff-sources/goals/pairs/` sent to Nick.

## Out of scope
- A custom metric query string, drag reordering, and any other screen.
