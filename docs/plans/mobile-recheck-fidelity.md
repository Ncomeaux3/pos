# Mobile re-check at 402 against PosPhone

Superseded for styling on 2026-09-19 by the Holon redesign (docs/plans/holon-product-redesign.md, section 4): colour, type, radii, surfaces and control shapes now come from the Holon design contract and the shared components in `components/pos/`. This plan still governs what each screen shows and how it is laid out.


## Context

The 2026-09-10 phone pass (`fcdd7b5`, `b83dff0`) set the shell rules from `PosPhone.dc.html`: 18px body padding, 56px tab row on the 26px inset, no lede, tab rows scroll, KPIs two up. Since then twelve screens were rebuilt on the desktop (Tasks, Goals, Ideas, Health, Settings, Search here; Second Brain, Insurance, Meals, Home, Fitness, Review in the other session), so the phone was re-audited. A script measured every route at 402x874 (padding, lede, tab rows, horizontal overflow) and the shots were read by eye; captures in `/private/tmp/pos-handoff-sources/mobile/`.

Result: the shell holds on 23 of 24 routes. Four defects, all in shared or app-level files, none in the other session's screens (Notifications, Agent Log, Onboarding, Login are left alone):

1. `/weekly-review` is 412px wide: `components/pos/ReviewShell.tsx:69` uses `-m-7`, the desktop 28px, where the phone body is 18px.
2. Settings / Skills rows: the name input collapses to two characters at 402 because the keyword column (`max-w-[220px]`) and Delete win the grid (`app/(app)/settings/skills/SkillsEditor.tsx:70`).
3. Toasts sit at `bottom-6` (`components/pos/Toast.tsx:29`), under the 56px + 26px phone tab bar.
4. Drawers: PosPhone opens every detail (Account, Subscription, Quick add, Search, Modules) as a bottom sheet: `max-height 74%`, a 38x4 handle, `padding 12px 18px 34px`, 10px eyebrow + CLOSE, 20px title. The 2026-09-07 decision says drawers become sheets on the phone. `components/pos/Overlay.tsx` has that geometry only behind `side="bottom"`, which no caller passes, so at 402 every drawer is a full-width, full-height right slide. Nick chose the bottom sheet (AskUserQuestion, 2026-09-12).

Decision to append to `decisions/log.md`: below md every Overlay renders as PosPhone's bottom sheet regardless of `side`, with the phone paddings, and the desktop keeps its right drawers; the `side` prop stays for the two desktop bottom cases. Rejected: a full-height right panel on the phone (not what the artboard draws, and the 2026-09-07 decision already chose sheets), and per-caller `side` switching (twelve callers to keep in step for one rule).

## Changes

- `components/pos/Overlay.tsx`: the panel classes become responsive. Below md: `bottom-0 left-0 w-full max-h-[74vh] rounded-t-xl border-t slide-in-from-bottom`, the handle always shown below md (38x4 rule-2), header/body/footer `px-[18px] md:px-6`, title `text-[20px] md:text-[26px]`, body and footer `max-md:pb-[34px]`. At md and up the current right geometry (`right-0 top-0 h-full`, widths 480/520/560, `slide-in-from-right`). `side="bottom"` callers are unchanged at md+. tw-animate-css classes take Tailwind variants, so `max-md:slide-in-from-bottom md:slide-in-from-right` is enough.
- `components/pos/ReviewShell.tsx`: `-m-[18px] md:-m-7`, and the two `px-7` become `px-[18px] md:px-7`.
- `app/(app)/settings/skills/SkillsEditor.tsx`: row grid `grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_auto_auto]`; the marks/keywords span gets `col-span-2 order-last md:col-span-1 md:order-none`, so on the phone the row is name + Delete over the keyword line.
- `components/pos/Toast.tsx`: `bottom-[94px] md:bottom-6` (56 + 26 + 12 above the tab bar).
- `e2e/screens.spec.ts`, mobile branches in existing tests:
  - tasks drawer test: at mobile the dialog's box has `x = 0`, `width = 402`, bottom at the viewport bottom, height at most 74% of it.
  - weekly review test: at mobile `document.documentElement.scrollWidth` is 402.
  - settings skills test: at mobile the `Rename TypeScript` textbox is at least 120px wide.
  - the goal check-in or task save test that already waits for `Saved`: at mobile the toast's bottom is above the tab bar's top.
- `docs/plans/mobile-recheck-fidelity.md` (this plan), `decisions/log.md`, `docs/STATUS.md` entry, memory file progress line.

## Tasks

1. Plan file, decision, failing asserts. Commit: `test: phone sheet, weekly review width, skills rows and toast at 402`.
2. Overlay, ReviewShell, SkillsEditor, Toast. Check: the four asserts pass on `--project=mobile`; the desktop project unchanged on the same greps. Re-run the audit script (all 24 routes at 402, `sw=402` everywhere) and capture the drawers at 402 (task, goal, idea, health, search, finance account) beside the PosPhone Account sheet. Commit: `fix: the phone gets PosPhone's sheets, and three 402px defects`.
3. Proof: typecheck, lint, unit, full e2e once (both projects). STATUS, memory. Commit: `docs: mobile re-check pass`.

## Verification

- `E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --project=mobile --grep "tasks, a row|weekly review, six|settings, skills|goals"` and the same with `--project=desktop`.
- `node <scratchpad>/audit-mobile.mjs`: every route `sw=402 over=0`.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, then the full `pnpm exec playwright test` with `E2E_BASE_URL`.
- Pairs in `/private/tmp/pos-handoff-sources/mobile/pairs/` sent to Nick: PosPhone Account sheet beside the app's task and finance drawers at 402, plus before/after of weekly review and skills.

## Out of scope

- Per-screen reflow to PosPhone's four screens (rejected 2026-09-10, unchanged), the quick add button, the curated six-tile phone dashboard, gestures.
- The other session's four screens; they get the sheet through Overlay without edits on their side.
