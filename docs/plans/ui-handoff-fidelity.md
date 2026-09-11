# POS Handoff UI Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the POS UI match the supplied Claude handoff at 1440x900 desktop and 402x874 phone viewports without changing routes, data ownership, writes, or module contracts.

**Architecture:** The handoff prototypes at `/Users/ncomeaux/Downloads/design_handoff_pos 2/` are the visual source of truth. Keep each screen's real server data and existing interaction model, but correct layout in the existing page and UI component files. Use the existing Playwright seed and screenshot helper as the proof loop, with manual source-artboard comparisons for geometry that data-dependent screenshots cannot pixel-diff.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind v4, Playwright.

**Spec:** `/Users/ncomeaux/Downloads/design_handoff_pos 2/README.md`, its `POS *.dc.html` artboards, and this audit's source/current captures in `/private/tmp/pos-handoff-sources/` and `e2e/__screens__/`.

## Global Constraints

- Source artboards define colour, Manrope typography, spacing, copy shape, border treatment, desktop grid geometry, and mobile chrome.
- Preserve real data and every existing route, form action, server action, write, and module manifest contract.
- Do not copy prototype markup or add a visual-diff, styling, or animation dependency.
- Keep navigation registry-driven. A route removed from the visual primary navigation remains reachable by URL, search, and its owning screen.
- Preserve the existing 402px phone shell behavior and its 44px touch targets.
- No em dashes in code, UI copy, comments, or documentation.
- Use `pnpm typecheck && pnpm lint && pnpm test`, then the targeted Playwright specs and finally `pnpm test:e2e` before declaring the pass complete.

---

## File map

- `core/nav.ts`: establish the source-artboard order for desktop primary navigation while retaining manifest-derived enabled modules.
- `components/pos/Sidebar.tsx`: render the corrected desktop primary/secondary navigation boundary without changing mobile tabs or More-sheet behavior.
- `app/(app)/page.tsx`: reduce the dashboard to the source's six visible bento tiles and preserve module access through navigation.
- `app/(app)/Bento.tsx`: support a fixed, source-sized dashboard grid without changing arrange-mode state or ordering behavior.
- `app/(app)/settings/connections/page.tsx`: put provider cards into the source two-column desktop grid while preserving each form and server action.
- `modules/skills/ui/SkillTree.tsx`: restore the source's two equal, border-separated desktop panes and eliminate the added outer-card geometry.
- `e2e/screens.spec.ts`: assert the source-defined visible dashboard set, connection grid, navigation order, and Skill Tree pane geometry before screenshot capture.

## Task 1: Establish a repeatable visual baseline

**Files:**
- Modify: `e2e/screens.spec.ts:28-125,248-252`
- Read: `/Users/ncomeaux/Downloads/design_handoff_pos 2/README.md`
- Read: `/Users/ncomeaux/Downloads/design_handoff_pos 2/POS Dashboard.dc.html`
- Read: `/Users/ncomeaux/Downloads/design_handoff_pos 2/POS Settings.dc.html`
- Read: `/Users/ncomeaux/Downloads/design_handoff_pos 2/POS Skill Tree.dc.html`

**Interfaces:**
- Consumes: `shoot(page, name)` and existing seeded routes.
- Produces: layout assertions that fail when the verified source geometry regresses, plus regenerated visual evidence in `e2e/__screens__/`.

- [ ] **Step 1: Add failing desktop assertions for the three confirmed defects.**

  Add checks that the dashboard has exactly six direct bento tiles at desktop, the connections card wrapper resolves to two columns at 1440px, and the Skill Tree's desktop left and right panes are within 8% of the same width. Use named `data-testid` attributes only where an existing accessible selector cannot identify a structural wrapper.

- [ ] **Step 2: Run the focused tests and confirm they fail on the current UI.**

  Run: `pnpm test:e2e -- --project=desktop --grep "dashboard shell|settings, connections|skill tree, constellation"`

  Expected: the new structural assertions fail; existing content assertions remain meaningful.

- [ ] **Step 3: Record the source comparison matrix in the test comments.**

  Immediately above each new assertion, name the exact artboard and viewport: `POS Dashboard.dc.html`, `POS Settings.dc.html`, or `POS Skill Tree.dc.html`, at `1440x900`. Do not store source screenshots or prototype copies in the repository.

- [ ] **Step 4: Commit the failing-test baseline.**

  ```bash
  git add e2e/screens.spec.ts
  git commit -m "test: define handoff layout fidelity checks"
  ```

## Task 2: Restore source navigation order without removing routes

> Done 2026-09-11 in docs/plans/weekly-review-fidelity.md, Task 1, with one difference: Notes is not appended after the artboard's sequence, it leaves the rail and stays in the command palette.

**Files:**
- Modify: `core/nav.ts:16-36`
- Modify: `components/pos/Sidebar.tsx:98-142`
- Modify: `e2e/screens.spec.ts:41-69`

**Interfaces:**
- Consumes: `getModules()` and `modules_enabled`.
- Produces: `getNav()` in source order: Dashboard, Finance, Skill Tree, Tasks, Goals, Second Brain, Insurance, Ideas, Fitness, Health, Home & Assets, Meals, Travel, Review.

- [ ] **Step 1: Write the failing navigation assertion.**

  In `dashboard shell`, collect the desktop module-link labels in DOM order and assert the source sequence above. Assert `/notes` remains reachable through the command palette or direct navigation, not as a numbered primary module row.

- [ ] **Step 2: Run the focused assertion.**

  Run: `pnpm test:e2e -- --project=desktop --grep "dashboard shell"`

  Expected: FAIL because Notes is currently third and shifts every following source index.

- [ ] **Step 3: Make `getNav()` order enabled modules by the source module-id order.**

  Declare one local ordered id array in `core/nav.ts`, filter the enabled manifest collection through it, and append manifests not named by the source after the authored sequence. Do not hardcode labels or duplicate manifest metadata. Keep `/notes` out of numbered desktop primary navigation while keeping its route in command palette input.

- [ ] **Step 4: Keep the sidebar purely presentational.**

  Change `Sidebar.tsx` only if needed to render an unnumbered secondary link for a source-unlisted enabled module. Do not change `MobileTabBar`'s explicitly named Home, Finance, Tasks, Fitness tabs or the More sheet.

- [ ] **Step 5: Re-run the focused assertion and take both desktop and mobile shell screenshots.**

  Run: `pnpm test:e2e -- --project=desktop --grep "dashboard shell" && pnpm test:e2e -- --project=mobile --grep "dashboard shell"`

  Expected: PASS; source primary order is preserved and Notes remains reachable.

- [ ] **Step 6: Commit the navigation repair.**

  ```bash
  git add core/nav.ts components/pos/Sidebar.tsx e2e/screens.spec.ts
  git commit -m "fix: restore handoff navigation order"
  ```

## Task 3: Rebuild the Dashboard to the six-tile source composition

> Superseded 2026-09-11 by docs/plans/dashboard-fidelity.md: the artboard has nine tiles, not six, and the decision is nine first then the rest, not a fixed six.

**Files:**
- Modify: `app/(app)/page.tsx:104-281`
- Modify: `app/(app)/Bento.tsx:65-142`
- Modify: `e2e/screens.spec.ts:41-96,351-370`

**Interfaces:**
- Consumes: the existing `warnings`, `proposals`, `diary`, summary module payloads, jobs, and spend queries.
- Produces: the source tile set `warnings`, `finance`, `tasks`, `review`, `goals`, `skills`, with Arrange mode still operating on those tile ids.

- [ ] **Step 1: Add a failing dashboard tile-set assertion.**

  Add a stable `data-testid="dashboard-bento"` to the bento root and `data-tile` to each rendered tile. At desktop, assert the direct ids are exactly `warnings`, `finance`, `tasks`, `review`, `goals`, `skills` in source default order. Continue asserting the live Next 7 days interaction separately if it moves into an existing source tile rather than becoming a seventh tile.

- [ ] **Step 2: Run the dashboard Playwright tests.**

  Run: `pnpm test:e2e -- --project=desktop --grep "dashboard"`

  Expected: FAIL because the implementation currently adds every digest module, system, and model-spend tile.

- [ ] **Step 3: Replace the generic digest expansion with the six source tiles.**

  In `DashboardPage`, look up the existing Finance, Tasks, Goals, and Skills tile components from the manifest collection by module id. Keep the existing warnings and review nodes. Fold the existing upcoming-strip content into the Tasks node if it is needed to preserve real upcoming-item access. Keep the generic digest renderer out of the dashboard rather than inventing a generic overflow surface.

- [ ] **Step 4: Restrict arrange state to the six authored ids.**

  Keep `Bento`'s localStorage format and drag behavior, but filter saved ids against the fixed six-tile list. Do not delete saved state for unrelated older tile ids until the user presses Reset.

- [ ] **Step 5: Match the source first-viewport grid.**

  Keep the existing three-column desktop grid and 300px minimum width, but give the source tiles the source two-row composition at 1440px. Ensure the base dashboard screenshot at 1440x900 shows the complete bento without the current long module directory.

- [ ] **Step 6: Run the focused desktop and mobile dashboard tests.**

  Run: `pnpm test:e2e -- --project=desktop --grep "dashboard" && pnpm test:e2e -- --project=mobile --grep "dashboard"`

  Expected: PASS; interactions, arrange URL state, and screenshots remain available.

- [ ] **Step 7: Commit the dashboard repair.**

  ```bash
  git add app/(app)/page.tsx app/(app)/Bento.tsx e2e/screens.spec.ts
  git commit -m "fix: match the handoff dashboard composition"
  ```

## Task 4: Restore the Settings connection-card grid

**Files:**
- Modify: `app/(app)/settings/connections/page.tsx:166-193`
- Modify: `e2e/screens.spec.ts:248-252`

**Interfaces:**
- Consumes: `ProviderCard`, each existing form action, and `manifests` in registry order.
- Produces: a two-column desktop card grid that stacks to one column below its available width without changing any credential behavior.

- [ ] **Step 1: Add a failing grid assertion.**

  Add `data-testid="connection-grid"` to the provider-card wrapper. At the desktop project viewport, use `evaluate` to assert it has two computed grid columns and that the first two provider cards share the same top coordinate.

- [ ] **Step 2: Run the focused connection screen test.**

  Run: `pnpm test:e2e -- --project=desktop --grep "settings, connections"`

  Expected: FAIL because the wrapper is currently a vertical `space-y-3` stack.

- [ ] **Step 3: Use a responsive CSS grid on the existing wrapper.**

  Replace the vertical wrapper with `grid gap-3 md:grid-cols-2`; do not alter `ProviderCard`, its forms, field ids, status chip, webhook secret generation, or actions. Leave the requested-integration section below the grid as a full-width section.

- [ ] **Step 4: Run desktop and mobile connection tests.**

  Run: `pnpm test:e2e -- --project=desktop --grep "settings, connections" && pnpm test:e2e -- --project=mobile --grep "settings, connections"`

  Expected: PASS; cards are two columns at 1440px and one readable column at 402px.

- [ ] **Step 5: Commit the Settings repair.**

  ```bash
  git add app/(app)/settings/connections/page.tsx e2e/screens.spec.ts
  git commit -m "fix: restore the connections card grid"
  ```

## Task 5: Restore the Skill Tree desktop split

> Done 2026-09-11 in docs/plans/skill-tree-fidelity.md: two flush halves split by one rule, no outer cards.

**Files:**
- Modify: `modules/skills/ui/SkillTree.tsx:154-311`
- Modify: `e2e/screens.spec.ts:100-177`

**Interfaces:**
- Consumes: existing `SkillTreeData`, selection state, `Constellation`, `Radar`, `WeeklyBars`, and event reassignment action.
- Produces: source-equivalent equal desktop panes, with a night-sky tree section and a separately scrolling right detail section.

- [ ] **Step 1: Add the failing equal-pane assertion.**

  Assign `data-testid="skill-tree-canvas-pane"` to the source left section and `data-testid="skill-tree-detail-pane"` to the detail aside. In the existing selected-skill test, compare their bounding widths at 1440px and require a ratio from 0.92 to 1.08.

- [ ] **Step 2: Run the focused Skill Tree test.**

  Run: `pnpm test:e2e -- --project=desktop --grep "skill tree"`

  Expected: FAIL because the existing desktop rail is fixed at 380px.

- [ ] **Step 3: Replace the fixed rail grid with the source's flexible two-pane grid.**

  Use `grid-template-columns: repeat(auto-fit, minmax(min(100%, 560px), 1fr))` at desktop. Remove the 20px card gap and outer-card borders that make both panes appear as independent cards. Preserve the source's hairline divider between panes, the `#05080c` tree ground, and the independent overflow behavior.

- [ ] **Step 4: Preserve canvas controls and selected-detail behavior.**

  Confirm hover, click, double-click zoom, wheel zoom, drag pan, event reassignment, and the selected detail all still use their existing callbacks. Do not rewrite `Constellation.tsx` or change XP calculations for this layout repair.

- [ ] **Step 5: Run targeted desktop and mobile tests.**

  Run: `pnpm test:e2e -- --project=desktop --grep "skill tree" && pnpm test:e2e -- --project=mobile --grep "skill tree"`

  Expected: PASS; the equal desktop split does not force a two-column phone layout.

- [ ] **Step 6: Commit the Skill Tree repair.**

  ```bash
  git add modules/skills/ui/SkillTree.tsx e2e/screens.spec.ts
  git commit -m "fix: match the handoff skill tree split"
  ```

## Task 6: Complete the screen-by-screen fidelity pass

**Files:**
- Modify only the page or component that owns a verified mismatch.
- Modify: `e2e/screens.spec.ts` only for a behavior or structural assertion that protects that mismatch.
- Read: every source file in `/Users/ncomeaux/Downloads/design_handoff_pos 2/POS *.dc.html` and `PosPhone.dc.html`.

**Interfaces:**
- Consumes: each module's existing route, server data loader, and UI tree.
- Produces: source-matched geometry and responsive presentation with no new core, schema, manifest, or integration interface.

- [ ] **Step 1: Compare each route against its matching source artifact at 1440x900.**

  Review Dashboard, Finance, Tasks, Goals, Skill Tree, Second Brain, Fitness, Health, Home, Insurance, Travel, Meals, Ideas, Review, Weekly Review, Notifications, Agent Log, Settings, Search, Login, and Onboarding. Record only observable deltas in a temporary audit note: spacing, title/header band, columns, borders, card sizes, state layout, and copy shape. Do not treat synthetic names, dates, counts, or monetary values as discrepancies.

- [ ] **Step 2: Compare the four authored phone states at 402x874.**

  Use `PosPhone.dc.html` and `POS Mobile.dc.html` to inspect Dashboard and Finance plus the shared shell. Verify 18px body padding, 44px header search control, 56px tab bar with 26px bottom inset, 18px tab glyphs, and the full-width More sheet. Keep no-artboard module content in the current responsive flow rather than inventing a mobile layout.

- [ ] **Step 3: Fix one owner-file group at a time.**

  For each confirmed delta, write the smallest failing Playwright assertion, run it red, change the owning UI file, run it green, regenerate its dark and light screenshots, and visually compare to the source artifact. Do not batch unrelated screen edits in a commit.

- [ ] **Step 4: Commit every independently verified screen group.**

  ```bash
  git add <owner-ui-files> e2e/screens.spec.ts
  git commit -m "fix: match handoff <screen-name> layout"
  ```

## Task 7: Full verification and final visual review

**Files:**
- Modify: `docs/STATUS.md` only if the full comparison has been completed and its result is accurate.
- Modify: `decisions/log.md` only if a source design forces a behavior-preserving deviation that needs a durable record.

**Interfaces:**
- Consumes: repaired UI, all tests, and generated screenshots.
- Produces: evidence for visual fidelity, with no unsupported claim of pixel parity.

- [ ] **Step 1: Run static and unit verification.**

  Run: `pnpm typecheck && pnpm lint && pnpm test`

  Expected: exit code 0.

- [ ] **Step 2: Run the complete E2E suite.**

  Run: `pnpm test:e2e`

  Expected: exit code 0 for setup, desktop, and mobile projects.

- [ ] **Step 3: Inspect the regenerated source-mapped screenshots.**

  Compare `e2e/__screens__/` to the corresponding source artboards at both authored sizes. Verify first-viewport composition, sidebar and header geometry, source column counts, and mobile chrome. Report any remaining intentional behavior-preserving deviations explicitly rather than calling the pass exact.

- [ ] **Step 4: Update status and commit the completed pass.**

  ```bash
  git add docs/STATUS.md decisions/log.md
  git commit -m "docs: record UI handoff fidelity pass"
  ```

## Self-review

- Coverage: Tasks 2 to 5 repair every confirmed mismatch. Task 6 covers the remaining source artboards one owner-file group at a time. Task 7 requires all three verification layers and visual review before a fidelity claim.
- Placeholder scan: no implementation task defers a code decision. The only variable file list in Task 6 is intentionally constrained to the owner file of an observed mismatch, which prevents unrelated refactors.
- Contract check: navigation stays registry-derived, dashboard retains core-only digest reads, connection cards retain their existing actions, and Skill Tree retains its existing client interaction APIs.
