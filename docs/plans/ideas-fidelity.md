# Ideas to the artboard

Superseded for styling on 2026-09-19 by the Holon redesign (docs/plans/holon-product-redesign.md, section 4): colour, type, radii, surfaces and control shapes now come from the Holon design contract and the shared components in `components/pos/`. This plan still governs what each screen shows and how it is laid out.


## Context

Screen eight of the fidelity pass (method: docs/plans/weekly-review-fidelity.md). `POS Ideas.dc.html` captured at 1440 into `/private/tmp/pos-handoff-sources/ideas/` (board dark and light, matrix, the view drawer, the edit drawer). Insurance, Meals and Second Brain are in flight in another session's worktrees; this pass stays inside `modules/ideas/` plus one migration, one line in `e2e/seed.mts`, and its own e2e tests.

The app has the bones: capture line, stage tabs with a Board / Matrix switch, quadrant chips, the matrix, an inline detail card with effort and impact pills, stage buttons, killed reason, and the research panel. The artboard is a different shape: a band with "{n} ideas · {stale} stale"; the view switch beside the title as an ink-filled segment; a capture line that parses `#tags`, `effort:` and `impact:` with Add and Full form beside it; an AGENT band offering to merge two similar ideas; four stage columns at once (not tabs) with cards carrying the quadrant pill, IMPACT and EFFORT segmented bars, a two-line pitch, #tags and skill chips, and "{n}d in stage" (STALE in amber at 60 days); the matrix as a full-width panel; and a 520px drawer with a view mode (title and pill, pitch, tags, a Stage / Impact / Effort strip, Move to, Problem, an Agent card with Draft task, Linked skills, Linked goal, Related notes, Edit and Delete) and an edit mode (Idea, One-line pitch, Problem, Effort and Impact segments, Stage, Linked goal, Tags, auto-linked skills, Cancel and Save →).

Decisions with Nick (append to `decisions/log.md`):
- Research stays, as a boxed card in the drawer under the Agent card (verdict, confidence, cost, sections, sources, Run / Deep run). A built feature is not dropped for a drawing that predates it.
- "Draft task" writes a review-state task through core's `callTool('tasks', 'write', ..., { source: 'agent', agent: 'ideas' })`: the first module calling another module's tool, through the tool registry and never SQL. Under `observe` autonomy it lands in the Review inbox instead; both are "drafts land in Review". Title "Validate: {idea} · 30m", the pitch and problem as notes, the idea's goal_ref carried over. The card shows the pending draft (a review-status task whose notes name the idea) with a link to /tasks?view=review.
- Similarity from `core.embeddings`: the AGENT band shows the closest pair of live ideas with cosine similarity ≥ 0.85 and "{n}% overlap"; Related notes lists brain notes ≥ 0.70 for the open idea, with the score. Both are absent when nothing is embedded. Merge keeps A, appends B's pitch and tags, kills B with `killed_reason` "Merged into {A}". "Keep separate" dismisses for the session (the pair is not stored).
- `ideas.idea` gains `tags text[]` and `stage_since timestamptz` (migration `ideas_tags_stage`): the artboard's tags and its "in stage" age need columns; `write` resets `stage_since` when the stage changes. `notes` is shown and edited as "Problem · who it's for" (the artboard's one free-text field).
- The quadrant rule stays the app's tested two-axis split (`modules/ideas/quadrant.ts`): the artboard's special case that scores medium/medium as BIG BET is a drawing choice, not a rule, and the digest and Review already use the app's. The label "Filler" becomes the artboard's "Fill-in".
- The killed column keeps its cards at full opacity with ink-3 titles (the 2026-09-08 rule: de-emphasis by ink, never opacity).
- Skills on the card and the drawer come read-only from `core.skill_links` through `getSkillNames()`; the artboard's live "auto-linked, click to remove" box in the edit form becomes a read-only "Skills · linked" box (classification runs on save through `register`; correction lives on the Skill Tree, as Tasks and Goals decided).
- The "Not moving" card goes; stale is on each card's age line and in the band count, as drawn.

## Artboard measurements (POS Ideas.dc.html lines 28 to 92; drawer 94 to 143; logic 149 to 218)

Band: eyebrow "Ideas / Board|Matrix"; compact search "Search ideas" (160 to 320); right an eyebrow with a dot: "{live} ideas · {stale} stale" (live = not killed; stale = exploring and ≥ 60 days in stage; dot amber when any stale, green otherwise).

Title block `padding 20px 28px 0`, wraps: h1 28px; lede 13px ink-3 `margin-top 8`: "Product and business ideas, scored on effort and impact. Columns are stages; ideas sit still for 60 days before they count as stale." Right: a 1px rule-2 segment of two buttons "Board" | "Effort × impact", 12px `padding 8px 14px`, the active one ink ground with bg text, the other ink-3.

Capture form `margin 18px 28px 0`, gap 8: input flex 1 on bg-elev, 1px rule-2 (accent on focus), 14px `padding 11px 14px`, placeholder "Capture an idea… add #tags, effort:low impact:high"; "Add" ghost accent (12px, `padding 8px 12px`, 1px accent, ink; accent fill on hover); "Full form" ghost (rule-2, ink-3). Parser (logic 205): `#tag` tokens lowercased into tags, `effort:(low|med|high)`, `impact:(low|med|high)`, the rest is the title; defaults med / med.

AGENT band (when a pair exists) `margin 14px 28px 0`, 1px accent, `padding 10px 14px`, wraps: mono 9px 0.08em accent "AGENT"; 13px "Similar ideas: {A} and {B} · {n}% overlap" (titles in ink); right minis "Merge" (accent border), "Keep separate", and "In Review →" as a link to /review (kept only if a proposal exists; otherwise omitted, see decisions: the merge itself is done from the band, nothing is queued).

Board `margin 18px 28px 28px`: grid `auto-fit minmax(min(100%, 200px), 1fr)` gap 14, always the four stages. Column head `padding 0 4px 10px`, rule-2 under: 14px label in the stage colour (Exploring ink, Validated accent, Building green, Killed ink-4), mono 11px ink-3 count. Cards gap 8 `padding-top 10`, sorted by impact × 2 − effort desc then age asc: 1px rule on bg-elev `padding 12px 14px`, hover rule-2 and lift 1px, grab cursor: title 13.5px/1.35 -0.01em; `margin-top 8` row gap 6: quadrant pill (mono 9px 0.08em, 1px border in its colour, `padding 2px 6px`: QUICK WIN green, BIG BET accent, MONEY PIT red, FILL-IN ink-3), "IMPACT" mono 9px 0.06em ink-3 with a 30 by 6 bar (three 9px segments with 1.5px gaps, filled accent to the level, rule-2 beyond), "EFFORT" the same in ink-3; pitch 11.5px ink-3 1.45 clamped to two lines `margin-top 6`; `margin-top 10` chips gap 4: "#tag" mono 9.5px ink-3 1px rule `padding 1px 5px`, skills mono 9.5px accent 1px accent-soft; `margin-top 10` 10.5px row: "{n}d in stage" (amber with "STALE · " when stale; ink-4 otherwise) left, "{n} notes" ink-4 right when related notes exist. Empty column: dashed rule box "Drop here" 12px ink-4 `padding 18`. Drop onto a column moves the idea there (the app's drag already does this; `stage_since` resets).

Matrix `margin 18px 28px 28px`, grid `28px 1fr / 1fr 24px` gap 6: "Impact →" vertical eyebrow, the panel 1px rule-2 with the two centre rules, corner eyebrows (Quick wins green, Big bets accent, Fill-ins ink-4, Money pits red), pills at `left (e−1)×33+17%`, `top (3−m)×33+17%` with a ±7px jitter by index, `padding 6px 10px`, 1px rule-2 on bg-elev, an 8px square in the quadrant colour and the 11px title (max 180px, ellipsis); "Effort →" eyebrow centred under.

Drawer 520px, crumb "Ideas / {title}" | "Ideas / Edit" | "Ideas / New idea", body `padding 22px 24px` gap 18.
- View: h2 22px/400 -0.03em with the quadrant pill right (`margin-top 4`); pitch 14px ink-2 1.5 `margin-top 8`; tags mono 10px `margin-top 10`. Strip: 1px rule grid of three cells `padding 10px 12px` on bg: Stage (14px in the stage colour, mono 10px age under it in amber when stale), Impact (14px "Low|Med|High" + bar), Effort (the same). "MOVE TO" eyebrow + minis for the other three stages. "Problem · who it's for" eyebrow + 13px ink-2 1.55. Agent card (1px rule, `padding 12px 14px`, gap 10): eyebrow "Agent" in accent with "drafts land in Review" 11px ink-3 right; row "Validation task" 13px with the hint 11px ink-3 under ("Drafts a 30-minute task to test the riskiest assumption" when exploring, "Drafts the next concrete step for this stage" otherwise) and "Draft task" | "Redraft" mini accent; when a draft exists, a rule-topped line: mono 9px amber "PENDING · " + the task title + "Review →" (to /tasks?view=review). Research card (decision) in the same box style. "Linked skills" eyebrow with "Skill tree →" 11px right, chips 11px `padding 3px 8px` linking to /skills?skill=. "Linked goal" eyebrow + 13px "{title} →" to /goals?goal=, when set. "Related notes" eyebrow with "Second Brain →", rows `padding 8px 0` rule under: 12px title, mono 10px ink-4 "{folder} · {n}%"; "Nothing similar in the vault yet" 12px ink-4 when none. Footer: "Edit" ghost left, "Delete" 13px ink-3 right (asks first; a new guarded `delete` tool, since a killed idea is kept but a wrong capture is not an idea).
- Edit / New: Idea (15px, "Short name"), One-line pitch ("What it does, in a sentence"), Problem · who it's for (textarea 3 rows); 2-col grid gap 12: Effort and Impact as 1px rule-2 segments of Low / Med / High (active ink ground), Stage select, Linked goal select (None + goals from `core.entities` module goals); Tags (mono, "saas, b2b, hardware"); "Skills · linked" box (read-only chips, "Classified when it is saved." for a new idea). Footer: Cancel left, "Save →" / "Create →" DS small (38px) right.

## Files

- `supabase/migrations/<ts>_ideas_tags_stage.sql`: `alter table ideas.idea add column tags text[] not null default '{}', add column stage_since timestamptz not null default now(), add column draft_task_id uuid, add column draft_title text`; backfill `stage_since = updated_at`. The draft columns are how the Agent card shows "PENDING · {title}" without reading the tasks schema: the tool that wrote the task stores what it wrote.
- `modules/ideas/quadrant.ts`: label "Fill-in"; `parseCapture(text)` (pure, tested in `quadrant.test.ts`: tags, effort, impact, title) and `boardScore` (impact × 2 − effort) for the column order.
- `modules/ideas/data.ts` (new): `listIdeas()` with tags, days in stage, goal title and ref, the stored draft; `similarPair()` and `relatedNotes(ideaIds)` from `core.embeddings` joined to `core.entities` (ideas against brain notes; Ideas does not know a note's folder, so the meta reads "note · {n}%"); `listSkillLinks()` as Tasks and Goals have; `listGoals()` from the registry for the Linked goal select.
- `modules/ideas/manifest.ts`: `write` accepts `tags` and `goal_ref`, resets `stage_since` on a stage change; `delete` tool (guarded); `merge` tool (`keep`, `drop`: appends pitch and tags, kills `drop` with the reason); `draft_task` tool (calls `callTool('tasks','write')` with `source: 'agent'`, stores `draft_task_id` and `draft_title`).
- `modules/ideas/ui/actions.ts`: `saveIdea(input)` (one write), `deleteIdea`, `mergeIdeas`, `draftTask`; `captureIdea` takes the parsed capture.
- `modules/ideas/ui/IdeasPage.tsx`: band summary and dot, lede, the view segment as `actions`, data joins (skills, notes, pair, goals list, metrics unchanged).
- `modules/ideas/ui/Ideas.tsx`: capture line, AGENT band, four columns with the cards and drag, matrix with jitter, drawer state `?idea=<id>`, `&edit=1`, `?idea=new`; `modules/ideas/ui/IdeaDrawer.tsx` (new): view and edit modes, the Research card moved in from `Ideas.tsx`.
- `e2e/screens.spec.ts`: the four ideas tests reworked; `e2e/seed.mts`: nothing new (tags come from `modules/ideas/seed.ts`, which gains `tags` per demo idea and `stage_since` from `staleDays`).

## Tasks

### Task 0: Baseline
Plan to `docs/plans/ideas-fidelity.md`, decisions logged. Failing e2e asserts (desktop): band `/\d+ ideas · \d+ stale/`; four column heads "Exploring", "Validated", "Building", "Killed" visible at once; the Voice capture card shows "QUICK WIN", "IMPACT", "EFFORT" and `/\d+d in stage/`; a stale card shows "STALE ·"; the capture line with "#tag effort:low impact:high" creates an idea whose card shows the tag chip; the drawer shows "Move to", "Problem · who it's for", "Agent", "Linked skills"; Edit shows "One-line pitch" and Save; the research test still passes inside the drawer.

### Task 1: Data and tools
Migration (by hand, `supabase migration up --local < /dev/null`); `parseCapture` and `boardScore` with tests; `data.ts`; `write` changes; `delete`, `merge`, `draft_task` tools; actions; seed tags and stage_since. Check: `pnpm test`, `pnpm typecheck`. Commit: `feat: idea tags and stage age, merge, delete and draft task tools`.

### Task 2: Page
Band, lede, segment, capture line, AGENT band, columns and cards, matrix. Check: page asserts; pairs. Commit: `fix: ideas board to the artboard`.

### Task 3: Drawer
`IdeaDrawer.tsx` view and edit; Research card inside; Draft task; Delete. Check: drawer asserts, research test. Commit: `feat: the idea drawer as the artboard draws it`.

### Task 4: Proof
`--grep ideas` both widths; typecheck, lint, unit; full e2e once. Pairs: board dark and light, matrix, drawer view, drawer edit. Phone at 402 against the shell rules (columns stack to one, the segment wraps under the title). STATUS.md, memory. Commit: `docs: ideas fidelity pass`.

## Verification
- `pnpm test` (quadrant, parseCapture), `pnpm typecheck`, `pnpm lint`.
- `E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --project=desktop --grep "ideas"` and `--project=mobile`.
- Pairs in `/private/tmp/pos-handoff-sources/ideas/pairs/` sent to Nick.

## Out of scope
- A model-written validation task (the title is a template), a stored merge proposal, drag on the matrix, and any other screen.
