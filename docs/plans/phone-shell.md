# Phone shell rebuild

Approved 2026-09-13. Each phase is one branch and PR, implemented in a fresh session. Superseded decisions are logged in decisions/log.md.

## Context

The owner uses POS mostly as an installed PWA on a recent iPhone. The phone build today is the desktop screen squeezed to 402px: the desktop `PageHeader` (breadcrumb, search field, status band) sits on every phone screen, Finance renders every section in one column with truncated text, the Skill Tree tells a phone user to "Hover, Double-click, Scroll to zoom", the Dashboard is a 4900px column of thirteen tiles, Tasks shows both a "New task" button and a quick-add field. The owner's verdict on 2026-09-13: finding a module, refresh and sync, buttons and forms, going back, screen layout, swipes, and speed all fail on the phone.

Root causes, verified in the code:

- No `loading.tsx` anywhere. Every tab, module and item open waits for Vercel plus Supabase before anything on screen changes.
- Every drawer opens by `router.replace('?drawer=...')`, a server round trip per open. The same ten-line `setParams` helper is copied in 13 module files.
- No `touch-action`, `overscroll-behavior` or `safe-area-inset` anywhere. The hand-rolled swipes fight native scroll, pull-to-sync fights the rubber band, and the home indicator gap is a hardcoded 26px, 34px, 90px, 103px in four files.
- The bottom bar is four hardcoded tabs plus a `<details>` More sheet with 9px labels and no scrim.
- Installed PWAs on iOS have no Safari edge swipe, and the app draws no back control.

## Decisions made with the owner on 2026-09-13

Not to be re-opened during implementation.

1. Phone first. Desktop keeps rail and drawers; it changes only where shared code forces it.
2. Feel: polished mainstream app (Todoist, Apple Health, Copilot Money), not specifically Apple.
3. Tab bar: Home, Tasks, Finance, Browse. Browse is a full page: search on top, every enabled module as a row (icon, name, badge, chevron), then a POS group: Review, Notifications, Agent log, Settings. The More sheet goes away.
4. A row opens a bottom sheet instantly from client state. The URL still records it. Back closes it.
5. Module sections stay a segmented row under the title, one section visible, swipe changes it, URL remembers it.
6. Pull down reloads the screen's data with a spinner. Running the nightly agent is an explicit button on Home and Agent log, both widths.
7. Every phone screen: title, back control when not at a tab root, at most one primary action top right. No desktop PageHeader bands on the phone.
8. Approach: rebuild the shared primitives phone-first with the desktop variant in the same component, then per-module passes for Dashboard, Finance, Tasks, Goals. The other nine modules get only what the primitives give them and each gets a later plan.
9. Brand layer holds: Manrope, 12px and 8px radii, existing colour tokens. The PosPhone artboard is no longer the shell spec.
10. Phone Home is a short Today page: headline, warnings, review proposals, tasks due today, net worth with 30 day change, next 7 days. About two screens. Arrange is desktop only. Desktop keeps the full grid.
11. The app runs installed (standalone), so the app owns swipe-back: a left-edge drag that calls `history.back()` past a threshold, on top of the visible back control.
12. Phone Tasks shows three segments: Today, Week, Calendar. By goal, By project, Inbox and Done move to a filter in the header action. Desktop keeps all seven.
13. Phone Finance keeps five segments, Overview first: Overview, Accounts, Budgets, Subscriptions, Transactions.

Superseded decisions to log in `decisions/log.md`: 2026-09-10 "phone tabs named by the plan (Home, Finance, Tasks, Fitness) and More opens the artboard's sheet"; 2026-09-10 "rejected reflowing each screen's content"; the gestures pass entry where pull-to-sync runs the nightly job.

## Platform concerns

- iOS standalone PWA: `env(safe-area-inset-*)` is zero unless `viewportFit: 'cover'` is set. `body.style.overflow = 'hidden'` (Overlay.tsx:74) does not lock scroll on iOS; `overscroll-behavior: contain` on the sheet body is the first fix, a `position: fixed` body lock only if the device test still scrolls. No browser edge-swipe in standalone; `window.history.length` behaviour there is unverified, so the back control falls back to a link to `/browse`. Use `dvh` for any new height.
- Next 16 App Router: `window.history.pushState` and `replaceState` sync into `useSearchParams` (verified in `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`, "Native History API"). One `loading.tsx` under `app/(app)/` wraps every child route including the `[module]/[[...path]]` catch-all, so the skeleton is generic. `router.refresh()` re-fetches server components and keeps client state. React `ViewTransition` exists but Safari support is uneven: out of scope.
- Vercel plus Supabase: cold start still waits on the network. `public/sw.js` caches nothing and stays that way in this plan; the skeleton is the lever, not a cache.
- Playwright: gesture tests dispatch synthetic pointer events with no real pointer id, so `setPointerCapture` must sit in try/catch. The mobile project is 402x874 with `hasTouch`. No pixel baseline exists; screenshots in `e2e/__screens__` are for eyes.
- Tailwind v4: the breakpoint is `md` = 768. Comments and tests that say 720 are wrong and get corrected.

## Phase 1: speed and gesture foundation

Goal: every navigation paints within a frame, sheets open with no server trip, gestures respect the OS, the nightly job is a button.

Add
- `app/(app)/loading.tsx`: generic skeleton (title block, three card blocks, `animate-pulse`).
- `components/pos/searchState.ts`: `useSearchState()` returning `{ params, set(next, { push }) }`. Body is the `setParams` helper from the 13 module files with `router.replace` swapped for `window.history.replaceState(null, '', url)`, and `pushState` when `push` is true. Sheets push (Back closes them via popstate). Segments replace.
- `components/pos/PullToRefresh.tsx`: the `PullToSync` body from `app/(app)/RunNow.tsx:52-105`, moved. On release: `startTransition(() => router.refresh())`, 16px spinner strip while pending. Mounted once in `app/(app)/layout.tsx`.

Change
- `app/(app)/RunNow.tsx`: delete `PullToSync`; drop `hidden md:inline-flex` so the button shows on both widths. `app/(app)/agent-log/page.tsx:84`: pass `<RunNow />` as the header action.
- `app/layout.tsx:21-26`: `viewportFit: 'cover'`.
- `app/globals.css`: `--tabbar: calc(72px + env(safe-area-inset-bottom))`; `html { overscroll-behavior-y: contain }`.
- Replace hardcoded insets: `Sidebar.tsx:268` `pb-[26px]` to `pb-[env(safe-area-inset-bottom)]`; `Toast.tsx:30` to `bottom-[calc(var(--tabbar)+12px)]`; `Overlay.tsx:143,151` to `pb-[calc(18px+env(safe-area-inset-bottom))]` and sheet body `[overscroll-behavior:contain]`; `layout.tsx:52` main `pb-[var(--tabbar)] md:pb-7`.
- `core/gestures.ts`: add `EDGE_PX = 20` and `fromEdge(x)`. `components/pos/gestures.ts` `useSwipe`: return early on pointerdown when `fromEdge`; `setPointerCapture` in try/catch; optional `onMove(dx)` for a card that follows the finger.
- The 13 `setParams` copies (`modules/finance/ui/Finance.tsx:180-188`, `modules/tasks/ui/Board.tsx:88-96`, `modules/goals/ui/GoalList.tsx:111-121`, `Home.tsx`, `Health.tsx`, `Meals.tsx`, `Brain.tsx`, `Fitness.tsx`, `Insurance.tsx`, `Ideas.tsx`, `Travel.tsx`, `app/(app)/weekly-review/Wizard.tsx`, `Onboarding.tsx`): swap for `useSearchState`. Drawer keys push, tab and view keys replace. Leave `router.*` in `Bento.tsx:80`, `ReviewTabs.tsx`, `SearchBox.tsx`, `Results.tsx` (server reads `q`), `CommandPalette.tsx`.
- `modules/tasks/ui/Board.tsx`: `useOptimistic` on the task list; complete flips the row before `completeTask` resolves. Task row gets `[touch-action:pan-y]` and follows the finger up to 80px with a check glyph behind it.

Verify
- vitest `core/gestures.test.ts`: `fromEdge` true at 20px, false at 21px.
- e2e `e2e/screens.spec.ts`: lines 813-817 drop the width guard (Run now on both projects). Gesture tests 2510-2590 keep dispatching pointer events. Task swipe test asserts the row shows done before the request settles.
- Screens: dashboard, tasks, finance at 402 and 1440.
- iPhone: kill and reopen, skeleton before data. Open a task sheet, press Back, sheet closes with no reload. Pull down on Finance: spinner, refresh, and the Agent log shows no nightly run. Tab bar clears the home indicator.

Out of scope: any visual change to headers, tabs, tiles.

## Phase 2: shell

Goal: tab bar Home, Tasks, Finance, Browse; a phone header on every screen; the segmented row owns its swipe; app-owned swipe-back.

Add
- `app/(app)/browse/page.tsx`: server component. `BandSearch` on top (dispatches `pos:search`). Rows from `getNav()` minus Dashboard and Review, icon from `NAV_ICON`, label, badge, chevron. POS group: Review (badge from the pending-proposals query already in the layout), Notifications, Agent log, Settings. Static segment wins over `[module]`.
- `components/pos/useIsPhone.ts`: the `useDesktop` body from `Finance.tsx:135-145`, inverted, server snapshot `true`. Only for sections that must not render at all on one width; CSS everywhere else.
- `components/pos/Segments.tsx`: the existing `TabBar` row plus a pane. Pane has `[touch-action:pan-y]`, `useSwipe` with capture, ignores edge starts. Row scrolls the active tab into view. Replaces `TabBar` for module sections; `TabBar` stays for Review and Settings.
- `components/pos/EdgeBack.tsx`: mounted in `app/(app)/layout.tsx`, phone only. Pointerdown inside `EDGE_PX`, drag past 90px (reuse `swipeOf` threshold), release calls `history.back()`. Decision logic in `core/gestures.ts`, pointer listening in `components/pos/gestures.ts`, same split as the existing four gestures.

Change
- `components/pos/Sidebar.tsx`: `PHONE_TABS = ['/', '/tasks', '/finance', '/browse']`; delete the `<details>` More sheet (297-328) and the `footer` prop; add `'/browse': LayoutGrid` to `NAV_ICON` and export it. Comment at 243: 720 becomes 768. Move `phoneTabs` into `core/nav.ts` as a pure function with Browse as a fixed last entry.
- `components/pos/PageHeader.tsx`: phone variant in the same component. `md:hidden` block: 44px back control when `usePathname()` is not a tab root (`router.back()` when `history.length > 1`, else link to `/browse`), `h1` title, one `phoneAction` on the right. `hidden md:block`: the two bands exactly as now. Search, lede, status, breadcrumb: desktop only.
- `components/pos/Overlay.tsx`: drag the handle down to close; "Esc · close" reads "Close" below md; keep 74vh.
- `modules/finance/ui/Finance.tsx`: `useDesktop` becomes `!useIsPhone()`, no layout change yet.
- `modules/skills/ui/SkillTree.tsx:277-280`: the hover and double-click copy gets `hidden md:flex`. One line, primitive-level defect.
- Desktop rail: no Browse link; the rail already lists every module and the palette covers the rest. Log it.

Verify
- vitest: new `core/nav.test.ts`: phoneTabs is Home, Tasks, Finance, Browse; a disabled module drops and Browse stays last. `core/gestures.test.ts`: edge-back fires past 90px from the edge, not from mid-screen.
- e2e: every `< 720` and `>= 720` (52, 219, 567, 1087, 1101, 1313, 1388, 1431, 1449, 1470, 1656, 1917, 1970, 2056) becomes 768. Lines 54-56 and 170-173: replace the More click with `page.goto('/browse')` and assert the Review row. Add: browse lists every enabled module and the POS group (both projects); phone header shows back on /goals and not on /tasks (mobile). Gesture test 2510: dispatch on the `Segments` pane.
- Screens: dashboard, browse, finance, goals, settings at 402; dashboard and finance at 1440 unchanged.
- iPhone: Browse rows open modules; edge drag on a module page goes back; Finance pane swipe moves the row and URL; sheet handle drag closes.

Out of scope: content of any module. Dashboard's inline header (Phase 3).

## Phase 3: Dashboard phone pass

Goal: Home is the Today page.

Change
- `app/(app)/page.tsx:373`: replace the inline header with `PageHeader` (title Home, `phoneAction` RunNow; desktop bands unchanged: crumb, BandSearch, ArrangeToggle, RunNow). `ORDER` at line 105 already holds `warnings, finance, tasks, review, timeline`: those five plus the headline render on the phone, every other tile gets `hidden md:flex`. Data is fetched server side either way, so no `useIsPhone`.
- `app/(app)/Bento.tsx`: phone is `grid-cols-1` with 12px gap; Arrange toggle and long-press `hidden md:block`.

Verify
- e2e: mobile tile count asserts five; add "home shows Run now on the phone". Long-press test 2555-2590 runs desktop only.
- Screens: dashboard 402 under 1800px tall; 1440 unchanged.
- iPhone: page fits in two swipes; Run now toasts.

Out of scope: tile internals.

## Phase 4: Finance phone pass

Goal: one section per screen, no truncation, sheets from rows.

Change
- `modules/finance/ui/Finance.tsx`: `TabBar` at 227 becomes `Segments` with the pane wrapping the five `tab ===` blocks (244, 485, 528, 560, 594). Overview on the phone: the two-up KPIs, sparkline, then three summary rows (Accounts, Budgets, Subscriptions) that switch segment. Account and budget rows open `Overlay` through `push: true`. Remove `useDesktop`.
- `modules/finance/ui/FinancePage.tsx:112`: `phoneAction` is the Sync button alone; provider and time stay in the desktop band.
- `components/pos/DataTable.tsx`: below md a row is two lines (name over meta, amount right). Check the current phone markup first; skip if `DataRow` already stacks.

Verify
- e2e: 1388-1430 desktop unchanged; 1431 and 1449 keep `?tab=`. Add "finance segments swipe from overview to accounts and the URL follows" (mobile).
- Screens: five Finance segments at 402; finance at 1440 unchanged.
- iPhone: no clipped text; account sheet opens on tap, Back closes it.

Out of scope: charts, the limits drawer body.

## Phase 5: Tasks and Goals phone pass

Goal: Tasks reads like Todoist; Goals is a list with a sheet.

Change
- `modules/tasks/ui/Board.tsx`: `TabBar` at 165 becomes `Segments`. Phone segments are Today, Week, Calendar (`modules/tasks/shape.ts:9-16` keeps all views; the phone list is a filter on it). By goal, By project, Inbox, Done become a `PillGroup` filter behind the header action. Quick-add field stays; "New task" button (584-591) becomes the phone `phoneAction` (plus) and stays inline on desktop. Per-row EDIT (453-462) is `hidden md:inline-flex`; on the phone tapping the row opens the drawer.
- `modules/tasks/ui/TasksPage.tsx`: `phoneAction`.
- `modules/goals/ui/GoalList.tsx:185`: `Segments` for Active and Archive; rows open `GoalDrawer` with push; the inline add form collapses to one field on the phone. `modules/goals/ui/GoalsPage.tsx`: `phoneAction` new goal.

Verify
- e2e: tasks tests that click `Edit task` tap the row title on mobile; 2537-2553 unchanged. Add "goals segment swipe reaches Archive" (mobile); "phone Tasks shows three segments" (mobile).
- Screens: tasks today, tasks calendar, goals at 402; tasks and goals at 1440 unchanged.
- iPhone: swipe a task, it completes before the network returns; the segment row never clips; one action top right.

Out of scope: the other nine modules beyond what `PageHeader`, `Segments`, `Overlay`, `EdgeBack` and `useSearchState` give them. Each gets its own later plan.

## Reused, replaced, new

- Reused unchanged: `Overlay` (polished only), `TabBar` (Review, Settings), `ActionButton`, `Card`, `Toast`, `CommandPalette`, `BandSearch`, `SyncBand`, `PillGroup`, `core/gestures.ts` `swipeOf` and `atTop`, `useLongPress`.
- Replaced: `PullToSync` by `PullToRefresh`; 13 `setParams` copies by `useSearchState`; Finance `useDesktop` by `useIsPhone`; the More `<details>` by the Browse page; hardcoded insets by `--tabbar` and `env()`.
- New: `loading.tsx`, `searchState.ts`, `PullToRefresh.tsx`, `useIsPhone.ts`, `Segments.tsx`, `EdgeBack.tsx`, `browse/page.tsx`.
- Follow-ups, not in this plan: `components/ui/button.tsx` is an unused shadcn leftover (delete in a cleanup PR); `public/sw.js` app-shell caching for instant cold launch; view transitions once Safari support settles; a phone pass per remaining module.

## Per-phase checklist

Each phase: branch, implement, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm test:e2e`, `ui-verifier` at 402 and 1440, the iPhone hand check above, `spec-reviewer`, PR with `gh`, decisions logged. STATUS.md updated at the end of each phase.
