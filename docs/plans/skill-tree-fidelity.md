# Skill Tree to the artboard

Superseded for styling on 2026-09-19 by the Holon redesign (docs/plans/holon-product-redesign.md, section 4): colour, type, radii, surfaces and control shapes now come from the Holon design contract and the shared components in `components/pos/`. This plan still governs what each screen shows and how it is laid out.


## Context

Screen four of the fidelity pass (method: docs/plans/weekly-review-fidelity.md). `POS Skill Tree.dc.html` captured at 1440x900 (default, a leaf selected, a branch selected, light) into `/private/tmp/pos-handoff-sources/skills/`. The app's screen already has the constellation, the character block, the four digest columns, the radar, the detail panel with its 90-day bars, events, children and drag-to-reassign (the 2026-09-10 rework). What differs is geometry and chrome: the artboard is two flush halves split by one rule under a 56px band, with the character and the attribute pips overlaid on the night sky and the hints and legend in its corners; the app draws two cards with gaps under a header that carries a summary line, keeps Reset view inside the canvas, and opens with nothing selected.

Decisions with Nick (append to `decisions/log.md`):
- Attribute labels are cut to six letters everywhere the artboard cuts them (the pips and the radar): ENGINE, BUSINE, COMMUN, HEALTH, LIFE O. Full names stay in the constellation, the columns and the detail panel.
- The screen opens on the top-gaining skill when the URL names none, so the right pane is never empty; a click still writes `?skill=`.

Constraints as before. This closes Task 5 of `docs/plans/ui-handoff-fidelity.md` (equal panes, no outer cards); note it there.

## Artboard measurements (POS Skill Tree.dc.html lines 30 to 157)

Band: 56px, `padding 0 28px`, gap 16: eyebrow "Skill Tree / Constellation" (no dot), compact search scoped "Search skill tree" (flex 1, 220 to 320), "Reset view" (12px, `padding 7px 12px`, 1px `--rule-2`, `--ink-2`, hover `--ink`). No title block: the panes start under the band.

Panes: `grid-template-columns: repeat(auto-fit, minmax(min(100%, 560px), 1fr))`, filling the rest of the viewport, the grid itself scrolling.
- Left `section`: `#05080c`, `border-right --rule`, flex column. The canvas `flex 1 0 auto; min-height 420px; overflow hidden` holds the SVG and four absolutely placed overlays: Character at `left 20, top 18` (eyebrow `#8fa3b8`; "Lv 8" 34px/300 with the title 20px in white, baseline, gap 12; "32,800 XP · 6,404 TO LV 9" 11px mono `#8fa3b8` 0.06em `margin-top 8`); the pips at `right 20, top 18` (`flex-wrap; justify-content flex-end; gap 1px; max-width calc(100% - 320px)`, hairline `rgba(255,255,255,.12)` fill and border; cells `padding 6px 10px; min-width 56; #0a1018; centred`: 9px 0.1em `#8fa3b8` label, 16px/300 white level `margin-top 3`); the hints at `left 20, bottom 14` (11px `#6f8399`, gap 14: "Hover: details", "Click: inspect", "Double-click: zoom", "Scroll: zoom · Drag: pan"); the legend at `right 20, bottom 14` (11px `#6f8399`, gap 12: an 8px accent dot with an 8px glow "gaining", an 8px `#cfe6ff` dot "active", an 8px dashed amber ring "stagnant 60d+"). Under the canvas the four columns: `minmax(min(100%, 150px), 1fr)`, 1px `--rule` gaps and top rule, cells `padding 12px 16px` on `--bg`: the eyebrow in the column's colour (gaining accent, stagnant amber, goal weight amber, level-ups accent) wrapping at 1.4, then rows gap 4: 12px name truncated, 11px mono `--ink-3` meta ("+140", "Lv 3", "w 0.6", "→ Lv 7"), hover accent.
- Right `aside`: `--bg-deep`, scrolls. "Attributes" eyebrow at `padding 18px 22px 0`, the radar `max-width 240px` centred `margin-top 6`. Then one block `margin 14px 22px 0; border-top --rule; padding-top 16; gap 16`: the crumb eyebrow ("Engineering / Coding", or "Attribute"); h2 22px/400/-0.03em with "Lv 7" 22px/300 on the same baseline; a 2px bar `margin-top 12`; "4,900 XP" and "1,500 to Lv 8" 11px mono `--ink-3` `margin-top 6`; three cells in a 1px `--rule` grid (`padding 10px 12px` on `--bg`, eyebrow, 15px mono value `margin-top 6`, the 30-day one in green); "XP · 90 days" with "weekly" right, a 64px bar chart `margin-top 8`, labels −90D −45D NOW 10px `--ink-4` `margin-top 4`; for a leaf, "Events · 30 days" with "8 · drag to reassign", rows (`padding 7px 0`, rule under) of a 34px 10px mono when, the 12px title with "task completed · rule" 10px `--ink-4` under, "+12" 11px green, and a 22px square reassign select; the empty line "No events linked in 30 days. Finish a task, note, or workout that matches a keyword below."; after a reassign, "N REASSIGNED · is_manual = true" 10px amber; then "Keywords · skills.yaml" chips 11px `padding 3px 8px`. For a branch, "Children" rows (`padding 8px 0`, hover accent-soft): 13px name, then the 30-day gain 11px in its colour and "Lv 9" 12px; "Drop an event here to reassign it to that skill." 11px `--ink-4`. Footer pinned: `padding 14px 22px 22px; margin-top auto`, 11px `--ink-4`: "Level = √(XP ÷ 100). Parent XP is the sum of its children." (true: `modules/skills/xp.ts` is `floor(sqrt(xp/100))`).

## Files

- `modules/skills/ui/SkillTreePage.tsx`: the band (eyebrow, scoped search, Reset view) moves into the client component so Reset view can reach the canvas; the page passes data only.
- `modules/skills/ui/SkillTree.tsx`: the band; the two flush panes filling the viewport under it; the overlays on the canvas; the columns strip; the right pane's sections and footer to the measurements; six-letter pips; default selection.
- `modules/skills/ui/Constellation.tsx`: a `resetToken` prop that resets pan and zoom when it changes; the hints and legend move out to the pane's overlays (or the Constellation renders them at the artboard's corners; whichever keeps the canvas measuring itself); the "Reset view" button inside the canvas goes.
- `components/pos/charts.tsx` `Radar`: size 240 on this screen (prop already), labels already sliced.
- `e2e/screens.spec.ts`: the two skill tree tests.

## Tasks

### Task 0: Baseline
Plan to `docs/plans/skill-tree-fidelity.md`, decisions logged, Task 5 of the old plan marked. Failing e2e asserts in `skill tree, constellation and the selected skill panel` (desktop): `data-testid="skill-tree-canvas-pane"` and `data-testid="skill-tree-detail-pane"` widths within 8% of each other at 1440; the band has a "Reset view" button and the page has no "skills active" text; the pips read ENGINE BUSINE COMMUN HEALTH LIFE O (whatever the six-letter cuts of the seeded attributes are: compute from the names in the test); on first open with no `?skill`, the detail shows a "to Lv" line (a skill is selected); the hints text "Double-click: zoom" is visible.

### Task 1: Band and panes
1. Move the header into `SkillTree`: a 56px full-bleed band (the dashboard's pattern: `-mx-7 -mt-7 h-14 border-b px-7`, phone `-mx-[18px]`), eyebrow without dot, `BandSearch` with "Search skill tree", Reset view button bumping a `resetToken`. `h1` stays sr-only.
2. Panes: `-mx-7 -mb-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,560px),1fr))] h-[calc(100dvh-56px)] overflow-auto` (verify the app shell's actual offsets: the main has 28px padding and the band is 56px); left section `border-r border-rule bg-[#05080c] flex min-h-full flex-col`, right aside `bg-bg-deep overflow-y-auto`. No Card either side.
3. Constellation: `resetToken` prop; internal Reset view removed; canvas `flex-1 min-h-[420px]`.
   Check: the width assert passes; `skill tree, the constellation hovers, selects, pans and zooms` still passes. Commit: `fix: skill tree panes and band to the artboard`.

### Task 2: The canvas overlays and the columns
Character block and pips as absolute overlays at the artboard's corners (pointer-events none on the block; the pips stay buttons); pips six letters; hints and legend at the bottom corners with the artboard's dots; the columns strip's cell padding, label colours, row type. Default selection: when `params.get('skill')` is null, `selected` starts as the top gainer's id (`gainingFastest[0]`, else the first attribute), without writing the URL until a click.
   Check: side by side of the left half; the pips assert passes. Commit: `fix: skill tree canvas overlays and columns to the artboard`.

### Task 3: The detail pane
Radar 240; the sections at the artboard's margins and rules; the three cells' 15px values; the events rows with the when column, the type · by line and the 22px reassign select (an accessible `select` labelled "Reassign to skill", listing leaves); "N · drag to reassign"; the reassigned line; keywords chips; children rows; the two helper lines; the pinned footer.
   Check: side by side of the right half in leaf and branch states (click a leaf and a branch in the e2e and shoot both: `skills-leaf`, `skills-branch`). Commit: `fix: skill tree detail pane to the artboard`.

### Task 4: Proof
`--grep "skill tree"` on both widths, then typecheck, lint, unit, full e2e. Pairs: default, leaf, branch, light. Phone `skills-402-*` against the shell rules (PosPhone has no Skill Tree frame). STATUS.md. Commit: `docs: skill tree fidelity pass`.

## Out of scope
- The constellation's own drawing (node radii, halos, edges, starfield, hover card): already measured against the artboard on 2026-09-10 and matching in the pairs; only its chrome moves.
- A phone layout beyond the shell rules; other screens.
