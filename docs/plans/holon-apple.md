# Holon, Apple edition: a reusable design system built on the Apple HIG

## Context

Nick wants Apple's design language for everything he builds, not just POS. Today POS styling comes from the Holon contract: tokens in `app/globals.css` and shared components in `components/pos/`. Holon is already Apple-adjacent: system grey canvas, glass surfaces, the system font first and a capsule tab bar. But it is not faithful to Apple, and it is not reusable:
- Its type scale is 14px body, not Apple's 17pt.
- It has no concentric radii: 18px, 12px and 10px are fixed values.
- It has no Liquid Glass layering rule.
- Screens bypass it: 515 hard-coded `text-[Npx]` and 25 `rounded-[18px]` in `modules/*/ui`.
- It lives inside one app.

Answers from the interview (2026-09-23, four rounds):
- **Target:** a reusable design system in a separate GitHub repo, published as a private GitHub Packages npm package. POS is the first consumer.
- **Holon evolves toward Apple** rather than being replaced. The Holon name, logo, Skills constellation and Travel globe stay. **The bar (owner, 2026-09-25): it should look good enough that you would think Apple made it, with Holon's own design and spin.** **Holon action blue stays the accent** (#3157b7 light, #9bb9ff dark).
- **As close to Apple as licensing allows. iOS sizing at every width.** Desktop keeps a sidebar, which is what iPadOS does at regular width. The phone keeps the floating tab bar.
- **Font and icons:** the system font stack, so real SF on Apple devices with Geist as fallback, plus Lucide styled to match SF Symbols. SF Pro and SF Symbols are licensed only for Apple-platform software, so neither is bundled. The license text comes from quotes, so verify the primary text once.
- **The notes live in both places:** `docs/design/APPLE-HIG.md` in the design-system repo, plus a published page.
- **Rollout:** a full plan across all screens. Tokens and components come first, then the shell, then one PR per module in daily-use order.

On approval, copy this file to `docs/plans/holon-apple.md` (the project convention) and log the answers in `decisions/log.md` under 2026-09-23.

## Architecture

- **New repo** `holon-ui`. The package is `@<github-owner>/holon-ui` (verify the owner scope; GitHub Packages requires it).
- **No build step:** it ships `.tsx` source and `tokens.css`. POS lists the package in `transpilePackages` in `next.config`. Add a build when a non-Next consumer appears.
- **Package contents:** anything with no POS data dependency. That means tokens, Button, Chip, Card, Sheet (from `Overlay`), Row/RowList, Segments, Switch/PillGroup, TabBar/MobileTabBar, Sidebar shell, FormField/field, edit primitives, Toast, EmptyState, PageHeader (large title), SwipeRow and gestures, PageTransition, LineChart and charts, MonthGrid, CommandPalette, `useIsPhone`, `useOptimisticAction`.
- **Stays in POS:** SkillPicker, SyncBand, ReviewShell, WizardShell, Logo (Holon brand assets, which can move later), and the pieces Phase 2 lists as staying.
- **`components/pos/index.ts` becomes a re-export barrel** of the package plus the POS-only pieces, so the 49 module files that import `@/components/pos` keep compiling unchanged.
- **Release:** semver tags. A GitHub Action publishes on tag. POS pins an exact version. The project `.npmrc` holds only the scope's registry line: pnpm 11 ignores a `${VAR}` credential there, so the token is user-level config (`~/.npmrc` locally, `pnpm config set` from the `NODE_AUTH_TOKEN` secret in CI, the `NPM_RC` env var on Vercel, a `DEPENDABOT_NPM_TOKEN` Dependabot secret; see `.env.example`).

## Token spec (the core of the system)

All tokens use `light-dark()`, with `prefers-contrast: more` and `prefers-reduced-transparency` overrides. Values come from the research (appendix). Rows marked verify are checked against the Figma iOS 26 kit in Phase 1.

- **Type, iOS Dynamic Type at Large:**

  | Style | Size / leading (pt) |
  |---|---|
  | Large Title | 34/41 |
  | Title 1 | 28/34 |
  | Title 2 | 22/28 |
  | Title 3 | 20/25 |
  | Headline | 17/22, semibold |
  | Body | 17/22 |
  | Callout | 16/21 |
  | Subheadline | 15/20 |
  | Footnote | 13/18 |
  | Caption 1 | 12/16 |
  | Caption 2 | 11/13 |

  Each is a utility class (`.text-body` and so on) and a Tailwind `@theme` entry. No Ultralight, Thin or Light weights. The root font size respects the browser's text size setting (rem-based), which is the web's equivalent of Dynamic Type.
- **Colour:**
  - The label hierarchy: `label`, `secondaryLabel`, `tertiaryLabel`, `quaternaryLabel`.
  - The backgrounds: `systemBackground` and `secondarySystemBackground`, plus the grouped set.
  - `separator` and system grey 1 to 6.
  - Status colours use Apple's system red, orange and green, with the **accessible** variants whenever the colour is used as text.
  - The accent is Holon action blue. Old Holon names (`--ink`, `--bg`, `--rule`, `--positive` and the rest) are kept as aliases until the module sweeps finish, then deleted.
- **Materials:**
  - Content layer: `ultraThin`, `thin`, `regular` and `thick` (translucent background plus `backdrop-filter`).
  - Functional layer, a Liquid Glass approximation: `glass-regular` and `glass-clear`, the latter over media with the 35% dim layer Apple specifies.
  - The rule: glass only on navigation, tab bar, toolbars, sheets and popovers, never on content cards.
  - This changes Holon, whose cards are glass today. Cards become opaque `secondarySystemGroupedBackground` on the grouped canvas, as in iOS Settings.
- **Concentric shape:**
  - Every container sets `--r` (its radius) and `--p` (its padding). A child with `.concentric` gets `border-radius: max(var(--r-min), calc(var(--r) - var(--p)))`, which is the CSS form of `ConcentricRectangle`.
  - `corner-shape: squircle` is added as progressive enhancement for continuous corners (verify browser support; Safari may lack it).
  - Base radii: 26px for sheets and the top of the device-like layer (verify against the kit), then derived from there. Capsules for buttons and chips.
- **Hit targets:** 44x44 minimum at every width. This is iOS everywhere, so desktop no longer shrinks to 32px.
- **Motion:** `--ease` becomes spring-like curves. Durations run 200 to 350ms. Reduced motion follows Apple's list: cross-fades instead of axis moves, no blur animation, no depth change.
- **Scroll edge effect:** a soft gradient blur under the floating tab bar and top bar (CSS mask plus `backdrop-filter`).

## Component rules (from the HIG, enforced in the package)

- **Buttons:** Normal, Primary, Cancel and Destructive roles. At most 1 or 2 prominent buttons per screen. Destructive is never primary. Every button has a pressed state.
- **Sheet:** medium and large detents on the phone, a floating panel on desktop. Done pairs with Cancel. Sheets never stack, except that an alert may sit on a sheet.
- **Alert:** a required title, at most 3 buttons, never Yes or No as labels, and Cancel is never the default. This replaces ad hoc confirms (`ConfirmButton`).
- **Segmented control:** at most 5 segments on the phone. Text and icons are never mixed. It selects state and never performs an action.
- **Lists:** inset grouped rows, disclosure chevrons for drill-down, and swipe actions (the existing SwipeRow).
- **Toast:** a transient overlay, so it counts as a popover and is glass.
- **Tab bar:** 5 tabs or fewer. It floats, minimises on scroll (already built in 3b) and uses monochrome glass.
- **Sidebar:** two levels at most, never hidden by default, icons in the accent colour.
- **Large title header:** a 34pt title that collapses into an inline 17pt semibold title on scroll, through a CSS scroll-driven animation. This replaces the band-and-title `PageHeader`.
- **Text fields:** a clear button, inline validation, and Continue disabled until the form is valid. This builds on FormField.
- **Loading:** show a spinner only after a short delay. Prefer determinate progress.
- **Writing:** verb-led buttons, no "we" and no "your", errors that say how to fix the problem, and sentence case (Holon's rule already).
- **Icons:** Lucide, with the stroke width tuned per text style (SF Symbols weight follows the text weight). Icons sized relative to the adjacent text style.

## Phases

Each phase is one branch and one PR. Every PR is checked by ui-verifier at 402 and 1440 px in both themes, then by spec-reviewer. The `screens` e2e must pass.

**Foundation**
0. **Notes** (Complexity low, quick-builder). **Done 2026-09-24:** `docs/design/APPLE-HIG.md`; every type size and the contrast and target numbers confirmed on Apple's pages; Navigation bars is retired into Toolbars; the SF Symbols license is still forum-quoted only (verify in the SF Symbols app); published at https://claude.ai/artifact/4rQxg2WvuuBmJf5RS4dKdb:
   - Write `docs/design/APPLE-HIG.md` (Foundations, Patterns, Components, Liquid Glass and concentricity, licensing, sources) from the appendix. It goes in POS now and moves to `holon-ui` in Phase 1.
   - Publish the notes as an artifact.
   - Fetch the unread pages: Navigation bars (it returned a 404, perhaps renamed), Collaboration, and the primary SF license text.
   - Check: every section cites its URL, and no unverified number lacks a "verify" mark.
1. **`holon-ui` repo and tokens:** **Done 2026-09-24, the owner approved the demo; holon-ui #1 and POS #148 merged:** https://github.com/Ncomeaux3/holon-ui (private); 420 text pairs pass 4.5:1 in both themes, base and under Increase Contrast and Reduce Transparency, including text on button fills and on clear glass over white media; the HIG notes moved there. Still open: the radii (26, 18, 12) stay Holon values marked verify, because the HIG pages give no radius numbers and the kit was not read. For Phase 3: POS `app/globals.css` and the package both define `--red`, `--green`, `--accent`, `--glass-edge`, `--glass-line`, `--font-sans`, `--shadow-pop` and `--color-accent` (POS `var(--accent-soft)`, the package the strong accent), and theme.css redefines Tailwind's `--ease-out`; the alias layer settles each before `tokens.css` is imported. POS `--lift` and `--pop` wrap whole shadows in `light-dark()`, which takes colours only, so both are invalid today. Installing needs a token with `read:packages`.
   - Scaffold the repo, `tokens.css`, the Tailwind v4 `@theme` export, the publish workflow and a README contract.
   - Build one static reference page (`demo/index.html`) showing type, colour, materials, concentric nesting and targets in both themes. This is the owner's **mockup gate**: Nick approves it before Phase 2.
   - Check: a contrast script asserts every text-on-surface token pair is at least 4.5:1 in both themes, and fails the CI if not.
2. **Components into the package**, inside `holon-ui` only (the owner's answer, 2026-09-24: POS cannot install the package until Phase 3). Two PRs:
   - **2a, primitives. Built 2026-09-24, PR open:** Button (the HIG roles `normal`, `primary`, `cancel`, `destructive`, old variant names kept as aliases), Chip, Card (opaque grouped, `Chevron` added), Row and RowList (inset grouped), Switch, PillGroup and SnoozeControl, FormField (clear button, `valid` from `useFormErrors`), edit (ConfirmButton now asks through an Alert), Toast, EmptyState, text, gestures (the maths moved from `core/gestures.ts`, plus an up swipe), `Sheet` with medium and large detents (`Overlay` kept as an alias; a dirty sheet asks through an Alert), and `Alert` (a native modal `<dialog>`). Checks: `tsc`, 13 `node:test` cases, the contrast script, `demo/components.html` through ui-verifier, and a dry run in a throwaway POS worktree: 15 files shimmed to the package, `transpilePackages` added, `pnpm typecheck` and `pnpm lint` exit 0 with zero edits in `modules/` or `app/`. vitest could not run there (its config loads `.env` and a live test database), so Phase 3 proves the suite.
   - **2b, navigation and data. Built 2026-09-24, PR open (holon-ui #3, stacked on #2):** TabBar, Segments (built on TabBar), MobileTabBar split out of Sidebar, a Sidebar shell taking its items as props, PageHeader as a collapsing large title, SwipeRow, PageTransition, LineChart and charts (`core/series` moves in), MonthGrid, CommandPalette with items and search as props, `useIsPhone`, `useOptimisticAction`. Same checks, the dry run repeated over both halves. As built: Sidebar, MobileTabBar, PageHeader and CommandPalette take their content as props (items with icons and badges, a brand render prop, `onCollapse`, `leading`/`search`/`trailing` slots, `items`/`search`/`searchAllHref`/`openEvent`), so in Phase 3 those four stay in POS as thin wrappers (three files: Sidebar.tsx keeps both Sidebar and MobileTabBar) and the rest become pure re-export shims; `NAV_ICON`, `NAV_GROUPS` and `phoneTabs` stay in POS. PageHeader is now the large title and renders a fragment, so its sticky bar sits in the page column. A new `components.css` carries the tab bar's compact state, the title collapse and the phone page transitions, which POS's `app/globals.css` drops in Phase 3. Chart series tokens `--chart-1` to `--chart-4` (accent, orange, teal, purple) joined `tokens.css`. Checks: `tsc`, 25 `node:test` cases (series ported from vitest), 420 contrast pairs, `demo/navigation.html` through ui-verifier, and the dry run over 2a and 2b together: 23 shims, 3 wrappers, `core/series`, `core/gestures`, `lib/utils` and `transpilePackages`, `pnpm typecheck` and `pnpm lint` exit 0 with zero edits in `modules/` or `app/`.
   - Follow-ups from 2b's ui-verifier, in the module sweeps: MonthGrid day buttons (24px) and desktop item pills (21px) under 44, and a roving tabindex for its 30 or more Tab stops; the palette's combobox ARIA (`aria-activedescendant`) and its Enter hint on the last row; the collapsed rail hides its badges; the LineChart legend omits the average line; the pinned desktop bar shows the breadcrumb and the inline title side by side.
   - For Phase 3's wrappers, none of which typecheck or lint can catch: CommandPalette gets `openEvent="pos:search"` (BandSearch and QuickSearchButton dispatch it) and a `key` per hit (hits share `/${module}` hrefs); the page column keeps the `page` class that `goBack()` looks for; `hideTitle` now also shows the inline title in the phone bar from the top, which keeps Home, Search and Fitness titled on the phone; the five-segment limit on a phone is kept by review, since Settings has more tabs on desktop.
   - Stays in POS: SkillPicker, SyncBand, ReviewShell, WizardShell, Logo, AvatarMenu, Avatar, BackControl, BandSearch, searchState, ThemeSwitch, DataTable, DiffRow, Copy, EdgeBack, PullToRefresh.
3. **POS consumes the package and the shell:** **Built 2026-09-25 on `holon-apple-phase-3`:** holon-ui 0.1.0 published locally (billing still blocks Actions) and pinned; 26 shims, 3 wrappers; `globals.css` imports the three package stylesheets and lets the package win every shared token but the chart series; ui-verifier's two Must fixes done (the phone bar title yields to wide actions, holon-ui #5, published as 0.1.1 and pinned; Settings tabs lost their old padding) plus 44px avatar and band search; e2e moved to the package's contract (44px rail rows, Collapse/Expand in the rail, opaque cards, the sheet's large detent, exact `Saved`). vitest 1166 of 1166. Local e2e failures left after the fixes read as local state (no VAPID keys in this checkout, the fitness weight count's date drift, leftover trips, onboarding green alone); CI's `screens` on a fresh database passed (PR #151, 2026-09-25), as did `check` and the Vercel preview installing the private package. Follow-ups for the sweeps: Home's Approve at 4.38:1 on the tan card, Alert without `role="alertdialog"`, the desktop content width against the demo's 896px column, the Today tab's mark on the phone against the sun on the rail, sub-44 module controls (Calendar chevrons, Home's Open links, task Complete circles).
   - Add the package (`.npmrc`, `NODE_AUTH_TOKEN` in Vercel and CI, `transpilePackages`). Needs Actions billing fixed (or a local `npm publish`) and a token with `read:packages` and `write:packages`.
   - Flip `components/pos`: each moved file becomes a re-export shim, as the 2a dry run did, so deep imports keep working.
   - `lib/utils` re-exports the package's `cn`, which knows the type styles; the stock merge reads `text-body` as a colour and drops it beside `text-label`.
   - `app/globals.css` imports `tokens.css` and keeps the alias layer, and adds `@source` for the package's `src` so Tailwind generates its classes.
   - Build the shell: tab bar, sidebar, large-title header, scroll edge effect, the grouped canvas, and opaque cards.
   - e2e that the flip breaks: screens.spec.ts line 763 presses the armed `ConfirmButton` label ("Drop 1 edit"), which is now the Alert's title, not a button; and any test that presses Escape on a dirty drawer now meets an Alert where Playwright used to dismiss a `window.confirm`. The `page.on('dialog')` tests at 3501 and 4267 are untouched: their confirms live in TripDrawer and PolicyDrawer, which the module sweeps move to the Alert.
   - The existing `confirmLabel` values ("Really delete", "Confirm disconnect", "Archive?") become Alert titles verbatim; each caller gets a `title` that names what goes, in its module sweep.
   - Check: a Vercel preview builds with the private package, `pnpm test` passes with the flip, and a full `screens` e2e run passes.

**Module sweeps**, one PR each, in this order: Home, Tasks, Finance, Calendar, Goals, Fitness and Health, Meals, Travel (the globe rebuilt, see below), Insurance and Home, Second Brain, Ideas, Skills (the constellation rebuilt to the same bar), then Settings, Notifications, Agent log, Browse, Login and legal.
- **Home: built 2026-09-25 on `claude/module-passes-home-6kb8i3`.** The six top-level files of `app/(app)` carry no `text-[` or `rounded-[`; sizes map by role to the package's type styles (row titles and meta as `Row` draws them); Needs attention is an opaque grouped card rather than sand (owner's answer), which lifts Approve from 4.37:1 to 5.28:1 and the grey lines from 4.27:1 to 5.23:1; Add a task, All tasks and Arrange are the package's 44px buttons; the tile head links and the phone's "and N more" link have 44px hit areas; `scripts/check-tokens.sh` runs in the `check` job and also fails on a Holon alias token (`ink`, `rule`, `action`, `bad`, `warn`, `ok`, `brand`, `sand`, `glass`) or a missing swept path. Left for the shell sweep: the desktop content width against the 896px column, the Today tab's mark, Alert's `role="alertdialog"`. The module tiles inside the bento are each module's own sweep.
- **Tasks: built 2026-09-25 on `holon-apple-sweep-tasks`.** `modules/tasks/ui` (the board, calendar, both drawers and the Home tile) carries no `text-[`, `rounded-[`, `t-caption` or Holon alias, mapped by Home's roles; the Projects list and the drawer's Source grid lose glass for `bg-grouped-2`; the Complete circles, the column plus and Archive get `HIT` at every width (the old touch-only pseudo element is gone); the Complete ring is `border-gray` (3.26:1 light, the old `rule-2` was 1.52:1); the expanded row is `bg-accent/8`, since `/15` put secondary-label at 4.18:1 light and red-text at 4.46:1 dark; QuickAdd's focus is the package's `--focus-ring` outline and its submit a Primary button; Archive's Alert is titled "Archive this project?". Left for later: the meta line's `·` separator starts a wrapped line, now more often at 15px; the QuickAdd placeholder clips at 402 at 17px; the calendar view's title bar shows collapsed at scroll 0 and the Sheet header has no opaque backing (shell). The guard now also fails on `t-caption`, `bg-field` and `--accent-soft`.
- **Finance: built 2026-09-25 on `holon-apple-sweep-finance`.** `modules/finance/ui` (the page, the cash flow card and its accounts sheet, the category trend, the Rules drawer, the limits sheet and the Home tile) carries no `text-[`, `rounded-[`, `t-caption` or Holon alias, including the `var(--ink)` and `var(--rule)` values inside the cash flow SVG, which the guard cannot see. The dense table rows stay 13px as `text-footnote` and the limits sheet's category descriptions 11px as `text-caption-2`: at 15px the 1440 overview truncated 41 elements against 31 and the limits sheet cut 7 descriptions against 2 (ui-verifier). The tile figures are `text-title-2 font-semibold`, as Home's are. The limits and cash flow accounts sheets drop `window.confirm` for the Sheet's `dirty` Alert, and their Reset becomes Cancel beside Done (the sheet rule), closing directly as the close control does. The transaction meta line loses `md:truncate`, whose `overflow: hidden` clipped the File link's 44px area to its text line at 1440; it wraps from md up instead. Manual categories keep a darker label than automatic ones (`text-label` against `text-secondary-label`). The File link, the Rules disclosure, the threshold slider, the pending checkbox's label and the desktop overview rows reach 44px. The guard now also reads the `accent-`, `caret-` and `decoration-` prefixes, after `accent-action` passed it. Left for holon-ui: the PillGroup count (4.09:1) and the quiet StatusChip (4.28:1) in light; the Row meta wrapping its last word and dropping the chevron at 402; the five Finance segments scrolling sideways at 402.
- **Calendar: built 2026-09-26 on `holon-apple-sweep-calendar`.** `modules/calendar/ui` (the page, the event sheet and the Home tile) carries no `text-[`, `rounded-[`, `t-caption` or Holon alias, mapped by the earlier sweeps' roles (the day heading `text-headline`, the tile titles `text-body`). The module chips are `brand` when shown and `quiet` when off, since the package's `outline` is an accent tint too and read as a second shown. The phone day pills are opaque grouped cards in both states and the selected one is marked by the accent ring alone: an `/8` tint over the grey canvas put secondary-label at 4.18:1 in light. The chip scroller gains 4px of vertical padding, because its `overflow-x-auto` clipped the chips' 44px hit area to 36. Deleting a typed event asks through an Alert, "Delete this event?". The shared MonthGrid is untouched by the owner's answer: its 24px day buttons, 21px desktop item pills, small month chevrons, missing roving tabindex and its "+N" count at 4.18:1 on the tinted cell go to a holon-ui PR. Also left: the destructive button's text at 4.43:1 in dark and Alert's `role="alertdialog"` (holon-ui); the global `border-radius` on `button` in `app/globals.css` bends the Alert's button separator (shell sweep); shown and off chips still differ by colour alone, `aria-pressed` carrying the state.
- **Goals: built 2026-09-30 on `holon-apple-sweep-goals`.** `modules/goals/ui` (the list, the goal drawer and its form, the Home tile) carries no `text-[`, `rounded-[`, `t-caption`, glass or Holon alias, including the inline values the guard cannot see: the status stroke map and the history chart now name `--green`, `--orange`, `--red`, `--gray` and `--label`, and the area under the line is the accent at 15% opacity. The goal cards, the status rule box and the drawer's three-stat grid are opaque `bg-grouped-2` cards on `rounded-card`; the grid draws its hairlines as a 1px gap over `bg-separator`. The card title and the rule text keep their old 15px and 13px (`text-subheadline`, `text-footnote`): at 17px and 15px a card title wrapped and the rule box grew a line at 1440 (ui-verifier). Progress bar fills use the accessible `-text` shades, since system green and orange fall under 3:1 on a white card (1.93:1 and 2.01:1), and the chart's pace line is `--gray` for the same reason. Emphasis spans that were `ink-2` inside `ink-3` text map to `label`. Deleting a goal asks through an Alert, "Delete this goal?". The card's Next link and the drawer's two links reach 44px through padding, New goal and Create lose their 36px and 38px overrides, and the check-in field's `sm:h-6` override goes, which `fieldClass`'s 44px minimum was already beating. The inline add test titles its goal with a timestamp and the seed clears it and the Ideas capture by prefix. Left: the destructive text at 4.43:1 in dark (holon-ui, as in Calendar); SkillPicker's 24px Unlink and 25px Link controls (shared, the shell sweep); the edit form's Target sitting 6px below Unit, a `Field` beside a bare label (pre-existing).
- **Fitness and Health: merged 2026-10-06 as #158.** `modules/fitness/ui` (the page and its KPI strip, the tabs, the plan drawer, the setup card, the Home tile) and `modules/health/ui` (the page, its drawers, the Home tile) carry no `text-[`, `rounded-[`, `t-caption`, glass or Holon alias. The KPI strip drops its `border-rule bg-rule` and `bg-bg` overrides for MetricStrip's own opaque cells, as Finance's does; the setup card is an opaque `bg-grouped-2` card on `rounded-card`, and the global `grid-bg` behind it (its only user) draws with `--separator` rather than `--rule`; the Health file input loses its glass for a `fill-3` pill at 44px. Status tones use the `-text` shades. Workout rows reach 44px at 1440 (`min-h-11`; they were 36); the Review link, the Insurance link and the Settings link reach 44px, the inline two through `HIT` on an `inline-block` (padding gave 36 to 40px, `inline-flex` pushed the underline 15px below the word). No delete lives in either module, so no Alert. Left: the /health hydration mismatch from `rowWhen()` in local time (pre-existing, a behaviour fix); the Health tile colours an overdue screening orange where the page uses red; the expanded workout panel has no side padding and the plan rows are inset twice (pre-existing layout). Shared, for holon-ui or the shell sweep: SyncBand's "Not syncing" at 4.37:1 on its tint in light and its 34px Connect link; DataTable still glass with `rounded-[18px]` and old header tokens, framed again inside the workouts Card; the five Fitness tabs scroll sideways at 402; DataRow forwards no `aria-expanded`; SkillPicker's sub-44 controls.
- **Meals: merged 2026-10-06 as #161.** `modules/meals/ui` (the week grid, the Today card, the recipe library, the pick, grocery and recipe drawers, cook mode and the Home tile) carries no `text-[`, `rounded-[`, `t-caption`, `t-title`, glass or Holon alias. The Today card is an opaque `bg-grouped-2` card on `rounded-card` keeping its accent ring; the week grid is `rounded-card` with `grouped-2` cells over a 1px `bg-separator` gap, and the planned meals inside are `grouped-3` on `rounded-control`. Today's column is marked by its header alone (accent top rule and day text, 6.61:1 light, 8.73:1 dark); the `brand-soft` tint on its cells is gone. A past meal not marked eaten draws a dashed `secondary-label` border instead of `opacity-55`, which had put its meta line at 2.08:1 in light (ui-verifier); the eaten tick's empty ring is `secondary-label` too, since `gray` on the `grouped-3` card is about 2.9:1, and over-target bars use `orange-text`, as Goals' do (spec-reviewer). Cook mode's step is `text-title-1` at every width: a responsive pair of type styles fails, since holon-ui's `tokens.css` defines `.text-title-*` again in `@layer utilities` after Tailwind's, so `text-title-2 sm:text-title-1` measured 22px at 1440. The same order made `leading-11` lose to `text-footnote`, so the recipe source link reaches 44px as a `flex min-h-11` anchor around a truncating span. The eaten tick, the card star and the Fitness link reach 44px through `HIT`; the tick's row gap is 12px, 16px from `sm`, so its hit area clears the label; grocery rows are `min-h-11`. The grocery count takes the button's accent (5.17:1) rather than secondary-label on the fill (4.09:1). Remove from plan and the draft Discard ask nothing: a slot is restored by picking again. Left: the Today card's label column cramps the chips and the Ate something else field at 402 (pre-existing layout); holon-ui's duplicate `.text-title-*` and `.text-*` utilities beating responsive variants; SkillPicker's sub-44 controls and the destructive text at 4.43:1 in dark (shared).
- **Travel: built 2026-10-06 on `holon-apple-sweep-travel`, without the globe rebuild (owner's answer: sweep now, globe later).** `modules/travel/ui` (the page, the trip drawer and its form, the loyalty and place drawers, the globe's chrome and the Home tile) carries no `text-[`, `rounded-[`, `t-caption`, glass or Holon alias, including the globe's inline SVG values (`--rule`, `--ink-*` and `--bg-deep` become `--separator`, `--opaque-separator`, `--label`, `--secondary-label`, `--gray` and `--gray-5`, which equals the old deep background in both themes). The globe frame and its alert band are opaque `bg-grouped-2` cards on `rounded-card`; the loyalty calculator is one too. The three `window.confirm` calls are Alerts: "Merge this trip?" opened by the Merge into select through holon-ui's `Alert` (now re-exported from `components/pos`), "Delete this trip?" through `ConfirmButton`, and "Remove from the wishlist?" as one page-level Alert opened by the row's ✕, since a Remove label wrapped the row's chevron at 402. Budget actuals summed from the itinerary are `text-label/70` and the Merge select `text-label`, since `secondary-label` on the field fill is 4.41:1 in light. Left for holon-ui: the destructive text at 4.43:1 in dark, and the selected segment's orange count at 2.97:1 in dark. The globe controls keep their 26px circles and reach 44px through `HIT`; packing rows are `min-h-11`; the New trip form's Save and the destination Remove lose their 38px overrides. The drawer's inline inputs take the footnote size from md up as a property, since `md:text-footnote` loses to fieldClass's body size. The globe's legend keeps its uppercase until the rebuild. Next for the globe: `/research` on the renderer and texture, then the mockup gate below.
- **Insurance and Home: built 2026-10-06 on `holon-apple-sweep-insurance-home`.** `modules/insurance/ui` (the list and its metric strip, the policy drawer and form, the upload drawer, the Home tile) and `modules/home/ui` (the page, its three drawers, the Home tile) carry no `text-[`, `rounded-[`, `t-caption`, glass or Holon alias. The policy drawer's three-stat grid and the upload drawer's extracted fields are opaque `bg-grouped-2` cells over a 1px `bg-separator` gap on `rounded-card`, as Goals' grid is; the stat values are `text-title-3 font-semibold`, Goals' size. The policy number's Reveal button loses its glass for a `fill-3` control at 44px with the focus ring, its Hide and Reveal word `text-label/70` (secondary-label on fill-3 is under 4.5:1 in light). The metric strip drops its `border-rule bg-rule` and `bg-bg` overrides for MetricStrip's own cells. Home's twelve month buttons are opaque cards and the selected one is marked by the inset accent ring alone, as Calendar's day pills are; the job dots are system `red`, `orange` and `gray`. Expiry and due colours use the `-text` shades. Deleting a policy asks through an Alert, "Delete this policy?". Mark renewed is the drawer's Primary button; the Log service form's Cancel is the cancel style; the header and drawer buttons lose their `h-[51px]`, `h-11` and `sm:h-10` overrides; Home's Insurance link and the warranty's Open the file link reach 44px through `HIT`; document rows are `min-h-11`. ui-verifier (402 and 1440, both themes, 32 states): every text passes 4.5:1 but the destructive Delete at 4.43:1 in dark (holon-ui, as in Calendar and Travel), every control in scope reaches 44px. Left: on /insurance the Upload PDF button is 44px beside the 50px Add policy, as Meals' pair is; the policy drawer footer wraps Delete to its own line at 402; the asset drawer's eyebrow reads the kind in lowercase and Property's `Row` amounts wrap under their titles (pre-existing). Shared, for holon-ui or the shell sweep: DataTable still glass; SkillPicker's sub-44 controls; the sheet header has no opaque backing when the drawer scrolls.
- **Globe and constellation (owner, 2026-09-25, reversing "untouched" from 2026-09-23).** Both stay as features and are rebuilt to Apple quality. The globe's target is Apple Maps and Weather: a realistic Earth with a satellite-style texture, an atmosphere glow at the rim, day and night shading, and inertia when spun. The constellation gets the same finish in the Skills sweep. Before either is built:
  - `/research` the renderer. WebGL is likely (three.js or a smaller alternative), which is a new dependency, and the Earth texture is a new asset: check its licence and size ("verify").
  - A mockup gate: a scratch render the owner approves before the module sweep changes the screen.
  - Keep what the SVG globe does today: pins by kind, legend, zoom about the cursor, reset, flat mode, fly-to on a pin, labels past 2x, `data-gesture-surface`. Flat mode may stay SVG if WebGL cannot unroll cheaply.
  - Budgets: client JS measured against the 1668 kB baseline and loaded only on the Travel and Skills pages; both themes; reduced motion stops the spin and the inertia; a static fallback when WebGL is unavailable.
- Per module:
  - Replace every `text-[Npx]` with a type-style class and every `rounded-[..]` with a token or `.concentric`.
  - Apply the component rules: alerts, sheets, segment counts and copy.
  - Remove the glass from content cards.
- Guard: a script, `scripts/check-tokens.sh`, fails CI on `text-\[` or `rounded-\[` in any module already swept. Its allowlist of swept modules grows by one per PR, and hex colours are allowed only in the Skills constellation and the Travel globe.

**Close**
- Delete the Holon alias layer.
- Run prod-auditor.
- Update the SPEC.md styling paragraph to point at `holon-ui`, plus `docs/STATUS.md`.
- Bump the POS minor version, tag, and publish a GitHub Release.

## Risks to flag now

- **Density on desktop:** 17pt body and 44px targets at 1440 px make desktop about 20% less dense than today, the direct cost of iOS sizing everywhere. The Phase 1 mockup shows it before anything ships.
- **Glass off cards:** removing glass from cards is the largest visible change, and it is what the HIG says. The mockup gate covers it.
- **Private package:** a private package adds a token to Vercel and CI. A failed install blocks every deploy, so Phase 3 proves it on a preview first.
- **Browser support:** `corner-shape` and scroll-driven animations are progressive enhancements. Without them the page still renders with plain radii and a static header.

## Verification

- **Package:** the contrast script, `tsc`, and the demo page reviewed by the owner.
- **POS, every phase:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm test:e2e` through the test-runner agent; ui-verifier at 402 and 1440 in light and dark; spec-reviewer before the PR; all CI checks green (`check`, `screens`, `migrations`) before merge.
- **Sweeps:** `scripts/check-tokens.sh` passes for each swept module, and grep counts of `text-[` and `rounded-[` fall to 0 by the last module.

## Appendix: research notes (source for Phase 0)

Updated by Phase 0 (2026-09-24): docs/design/APPLE-HIG.md supersedes these notes. Navigation bars is retired into Toolbars, Collaboration is read (collaboration-and-sharing), and the SF fonts license was read on developer.apple.com/fonts; the SF Symbols license text is still forum-quoted only.

The notes were fetched 2026-09-23 through the `developer.apple.com/tutorials/data/...json` endpoints. About 45 HIG pages were read.

- **Concentricity.** `ConcentricRectangle` (iOS 26+) corners can be `.concentric`, `.concentric(minimum:)`, `.fixed` or `.square`. The radius shares a centre with the container shape, which is set by `.containerShape(_:)`. It falls back to `ContainerRelativeShape` insetting. In CSS: child radius = max(min, parent radius - padding).
- **Liquid Glass.**
  - Two variants: Regular (default, used for alerts, sidebars and popovers) and Clear (over media, with a 35% dim behind it on bright content).
  - Two layers: the content layer uses standard materials, and the functional layer (controls, navigation, tab bars, sheets) uses glass. Glass is used sparingly and has no inherent colour; the accent is only for primary button fills. Toolbars and tab bars are monochrome.
  - Accessibility: Reduce Transparency makes it frostier, Increase Contrast makes it near solid, and Reduce Motion lowers the effects.
  - SwiftUI APIs: `glassEffect`, `GlassEffectContainer(spacing:)`, `glassEffectUnion`, `glassEffectID` with the `.matchedGeometry` and `.materialize` transitions.
- **Typography.** iOS minimum 11pt, default 17pt. Large Title 34/41, Body 17/22, Headline 17 semibold, Caption 2 at 11pt. Text scales to AX5. macOS Body is 13/16. Avoid Ultralight, Thin and Light. SF and New York are variable fonts with optical sizes.
- **Colour.**
  - 12 system colours, each with light, dark, accessible-light and accessible-dark values. Blue, for example: 0,136,255 / 0,145,255 / 30,110,244 / 92,184,255.
  - Grey 1 to 6, the four-level label hierarchy, and system plus grouped backgrounds.
  - Never repurpose a semantic colour. Use P3 for imagery.
- **Accessibility.** Contrast 4.5:1 up to 17pt and 3:1 at 18pt or bold. Targets: iOS default 44, minimum 28; macOS 28, minimum 20. Padding about 12 around bezeled controls and 24 around unbezeled ones. Text scales 200%. Never use colour alone.
- **Reduce Motion.** Fewer automatic animations, tighter springs, no z-depth, fades instead of axis moves, and no blur animation.
- **Writing.** Active voice, verb-led labels, no "we" or "our", no needless "your", errors that give the fix without blame, no "oops", and one case style per element type.
- **Patterns.**
  - Loading: finish before people notice, show progress only after a moment, and prefer determinate.
  - Entering data: prefill, never prefill passwords, prefer pickers, validate inline, and disable Continue.
  - Modality: never stack modals except an alert, and give an obvious dismiss.
  - Onboarding: skippable, taught by doing, and permissions deferred.
  - Search: one entry point, suggestions, scopes.
  - Settings: task options inline, and few options with smart defaults.
  - Charts: show insight not raw data, keep charts consistent, and add accessibility labels.
  - Drag and drop: always offer an alternative.
  - Accounts: in-app deletion, passkeys.
  - Help: contextual tips of 1 to 2 sentences; tooltips of at most 60 to 75 characters that start with a verb.
- **Components.**
  - Buttons: 44x44, and roles never make a destructive action primary.
  - Menus: title case, a verb first, an ellipsis when more input is needed, and one level of submenu.
  - Segmented: 5 or fewer on iPhone, never mixed.
  - Stepper: always shows its value beside it.
  - Sheets: medium and large detents, Done with Cancel, never stacked.
  - Popovers: one at a time.
  - Alerts: at most 3 buttons, no Yes or No, Cancel never the default.
  - Tab bar: 5 or fewer, floating glass, minimises on scroll.
  - Toolbar: leading, centre and trailing zones.
  - Sidebar: 2 levels, not hidden.
  - Search: as a tab, in a toolbar, or inline.
  - Progress: never switch shape mid-task.
  - Scroll edge effect: separates floating bars from content.
  - Widgets: 16pt margins, 11pt minimum text.
- **Licensing.** The SF fonts are licensed for mockups of Apple-platform UI only and must not be embedded. SF Symbols are for Apple-platform software only. Both come from forum quotes because the primary license page sits behind a click-through, so verify it in Phase 0. The system-ui stack is safe. Apple's UI kits exist for iOS, iPadOS, macOS, watchOS and visionOS in Figma and Sketch.
- **Not confirmed:**
  - The Navigation bars page (a 404).
  - The Collaboration page.
  - List row heights.
  - The kit's reuse terms.
  - Whether Apple publishes a web HIG (none found).
  - The exact text of `RoundedRectangle` `.continuous`.
