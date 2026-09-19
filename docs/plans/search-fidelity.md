# Search to the artboard

Superseded for styling on 2026-09-19 by the Holon redesign (docs/plans/holon-product-redesign.md, section 4): colour, type, radii, surfaces and control shapes now come from the Holon design contract and the shared components in `components/pos/`. This plan still governs what each screen shows and how it is laid out.


## Context

Screen seventeen of the fidelity pass (method: docs/plans/weekly-review-fidelity.md). `POS Search.dc.html` captured at 1440 into `/private/tmp/pos-handoff-sources/search/` (empty, results for "amex", the preview drawer, the quick search palette, results in light). The other session has Notifications, Agent Log, Onboarding and Login; Search lives in `app/(app)/search/`, `core/search.ts` (one additive field) and `components/pos/CommandPalette.tsx`, none of which that batch touches.

The app already has hybrid search over the registry with the closest-match fallback, scope chips, grouped results with a relative score bar, a preview drawer with fields, linked skills and related entities, and the Cmd K palette with the Go to list. What differs is the shape: the artboard's band is the eyebrow "Search" with a "Quick search ⌘K" button; the box is 60px on bg-elev, centred in an 880px measure, 18vh down when empty and 24px down once there is a query, with the chips under it (every module when empty, only those with hits when searching, ink-filled when active); results are 880px wide with a 14px group head, 15px rows with the type chip, snippet, an 11px meta row (age and skills) and a 64px "match" bar; the drawer has a 24px title, the snippet, a fields strip (Module, Type, When), Linked skills, a clickable Related list and a DS "Open in {module} →" footer; the palette is a 640px column at 14vh with the 52px box and a separate "Go to" panel with G-codes.

Decisions with Nick (append to `decisions/log.md`):
- The hit gains `updatedAt` from `core.entities` so the meta row and the drawer's "When" cell can say "{n} days ago" (an entity's last change is the one date every module's rows share). The artboard's "Amount" cell is not drawn: a hit is a registry row, and nothing there holds a money field.
- The empty page shows the box and every module's chip and nothing else, as drawn; the app's "Nothing searched" explainer goes (the placeholder says what the box is for).
- Related rows open the entity's module ("/{module}"), the same target as the footer button, because the registry knows the module and not the row's own URL. Clicking a result opens the preview drawer; the drawer is in the URL (`?open=<entity id>`).
- The palette takes the artboard's geometry (640px at 14vh, the 52px box, a separate panel with "Results" for hits and "Go to" for the nav with its G-code on the right); behaviour is unchanged (arrow keys, Enter, Esc, the "Search everything" row).

## Artboard measurements (POS Search.dc.html lines 26 to 105; logic 110 to 170)

Band: eyebrow "Search" left; right a 12px ghost button "Quick search" with mono 11px ink-3 "⌘K" (`padding 6px 10px`, 1px rule-2, ink-2) that opens the palette (the app's `pos:search` event). No search field in this band.

Box block: `padding {18vh|24px} 28px 0`, `max-width 880`, centred. Box 60px, 1px rule-2 (accent when a query) on bg-elev: mono 14px ink-4 ">" `padding 0 14px 0 18px`; 18px input, placeholder "What are you looking for?"; "Clear" 12px ink-3 `padding 0 16px` when a query. Chips `margin-top 12` gap 6: 12px `padding 5px 10px`, 1px rule-2 ink-3; active ink ground with bg text; a count mono 10px `margin-left 6` at .7 when searching. "Everything" first, then modules in rail order.

Results block: `padding 22px 28px 28px`, same measure. No-match line 13px ink-3 `margin-bottom 14`: "Nothing matched "{q}"{ in {scope}}. Closest matches:". Group `margin-bottom 26`: head 14px label + 11px ink-3 "{n} item(s)", `padding-bottom 8`, rule-2 under. Row: link, flex gap 14 `padding 12px 8px`, rule under, hover accent-soft: 15px title + type chip (10px `padding 2px 7px`); snippet 13px ink-3 1.5 `margin-top 4`; meta row `margin-top 6` gap 14 11px: "{n} days ago" ink-3, "Skills: a, b" ink-4; right column: 64 by 2 bar on rule-2 with accent fill at score / top (min 12%), "match" 10px ink-4 under. "Show {n} more" | "Show less" 12px accent `margin-top 8`. Three rows a group until expanded.

Drawer (Overlay narrow, 480): crumb "{Module} / {type}"; h2 24px/400 -0.03em 1.15; snippet 14px ink-2 1.55 `margin-top 10`; fields strip 1px rule grid `auto-fit minmax(120px, 1fr)`, cells `padding 10px 12px` rule right: Module, Type, When ("{n} days ago"); "Linked skills" chips when any; "Related" rows `padding 9px 0` rule under 13px title (ellipsis) + 11px ink-3 module label, each a link to the module; footer right: DS small "Open in {Module} →".

Palette: scrim .55; column `width min(640px, 100% - 32px)` at `padding-top 14vh`; the box 52px (the shared band search at size lg: 16px text, ">" prefix); `margin-top 10` a panel on bg-elev 1px rule-2 `padding 6px 0`: 11px ink-4 labels "Results" (when hits) and "Go to", rows `padding 9px 14px` 13px ink-2 (accent-soft and ink when active) with the right-hand mono 11px ink-4 hint ("G 02" for nav, "{Module} · {type}" for a hit, "Enter" for search everything). Footer line dropped (the artboard has none).

## Files

- `core/search.ts`: `updatedAt: string` on `SearchHit` (both the hit query and `closest`).
- `app/(app)/search/page.tsx`: band via `PageHeader` with `hideTitle` and a `QuickSearchButton` status (client, dispatches `pos:search`); the measure; chips for every module when empty; `?open=` read for the drawer.
- `app/(app)/search/SearchBox.tsx`: the 60px box and the padding rule.
- `app/(app)/search/Results.tsx`: rows, meta row, bar column, the drawer to the measurements with the fields strip and the footer button; `open` in the URL.
- `components/pos/CommandPalette.tsx`: the geometry and the two-panel layout.
- `e2e/screens.spec.ts`: the search tests (empty page shows the box and the "Everything" chip without a count; results show "match" and "Show 1 more" or the group head; opening a row shows the fields strip; the palette test checks the "Go to" label and a G-code).

## Tasks

### Task 0: Baseline
Plan to `docs/plans/search-fidelity.md`, decisions logged. Failing asserts as above.

### Task 1: Page and results
Check: search asserts; pairs (empty, results, drawer). Commit: `fix: search page and preview drawer to the artboard`.

### Task 2: Palette
Check: the palette test; pair. Commit: `fix: the command palette to the artboard`.

### Task 3: Proof
`--grep "search|palette"` both widths; typecheck, lint, unit; full e2e once. Phone at 402 against the shell rules. STATUS.md, memory. Commit: `docs: search fidelity pass`.

## Verification
- `pnpm test`, `pnpm typecheck`, `pnpm lint`.
- `E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --project=desktop --grep "search|palette"` and `--project=mobile`.
- Pairs in `/private/tmp/pos-handoff-sources/search/pairs/` sent to Nick.

## Out of scope
- Per-row URLs into a module's drawer (the registry does not know them), an Amount cell, and any other screen.
