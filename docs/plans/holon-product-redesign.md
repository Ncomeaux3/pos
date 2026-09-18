# Holon product redesign

Date: 2026-09-18
Status: proposed implementation plan, not authorization to implement or deploy.
Scope: rebrand the existing POS application as Holon using the selected Cobalt + Sand identity. This document is the deliverable for the current planning request.

## 1. Outcome

Holon should feel like a clear view of one connected life. The interface should help the owner see what needs attention, take the next action, and move between related records without maintaining a wall of dashboards.

Carry the approved ribbon symbol, cobalt/sand blend, charcoal, off-white and Geist into the actual application. Keep gradients concentrated in the mark and occasional welcome surfaces. Everyday work uses readable, neutral surfaces and restrained accents.

Success means a coherent product across desktop, phone, sign-in, installed PWA, notifications and all enabled modules, with existing actions, data, integrations and deep links preserved.

## 2. Decisions and open questions

Confirmed:
- Product name: Holon. Approved kit: `holon-cobalt-sand/`.
- Identity: upright interwoven ribbon, Cobalt + Sand.
- No “A More Intentional You” slogan. “Your life. One system.” is optional on entry screens, not repeated inside workspaces.
- This is a plan for the current product, not a replacement backend.

Answered by the owner on 2026-09-18 (four question rounds; the implementation plan that carries them is in the session plan file and mirrored in decisions/log.md):
- Scope: full visual and information hierarchy redesign with the navigation grouping in section 5. Workflows change only for two named problems: drawers and sheets are inconsistent; tables and rows are hard to scan.
- Theme: a new `system` option follows the device; explicit light and dark overrides are preserved. An absent cookie means system (it meant dark before).
- Most used: Today, Tasks, Finance. Phase 0 mockups cover those plus the task drawer, as static HTML under `docs/design/holon/`, both themes, 402 and 1440 px.
- Keep unchanged in feel: phone gestures, the skills constellation, the travel globe. The dashboard arrangement is open to recomposition (tile ids and the saved layout keys stay).
- Phone bottom bar: Today, Tasks, Finance, Browse.
- Delivery: one PR per phase, sequential, into an integration branch `holon`; one final PR from `holon` to `main`, merged with a merge commit so each phase stays one revertable commit. Production keeps the old brand until then.
- Rail mark, tab bar and favicon: the colour ribbon as raster PNG (the kit's transparent optical exports), not inline SVG.
- Owner name leaves the rail header; the rail shows ribbon plus Holon wordmark. The name appears once in the Today greeting.
- Labels: Dashboard becomes Today, Skill Tree becomes Skills, Home & Assets becomes Home & Property. Routes and module ids unchanged.
- Page headings: 28 px desktop, 24 px phone, weight 500. The kit's 40 px H1 is for sign-in and splash only.
- Baseline: the e2e suite run locally on `main`, `e2e/__screens__/` copied to a scratch folder as the before set.
- Emails and push: user-facing names become Holon. Sender address, domain and env var names unchanged.

Assumed, not asked: the kit folders and the zip stay out of git (`.gitignore`); only the files the app uses are copied under `public/brand/` and `app/fonts/`.

## 3. Current implementation and constraints

Repository inspection, not a live usability audit:

| Area | Current state | Implication |
| --- | --- | --- |
| Global styling | `app/globals.css`: Manrope, green accent, dark default, zero radii, uppercase tracked labels | Replace the old brand contract, including contradictory historical comments |
| Shared UI | `components/pos/`: Card, Button, PageHeader, Overlay, controls, rows, tables, charts | Evolve these components; do not install another component library |
| Shell | `app/(app)/layout.tsx`, `components/pos/Sidebar.tsx` | Fixed 232px/64px desktop rail, phone bottom navigation, shared command palette |
| Navigation | `core/nav.ts`: numbered rail, manifest-based enabled modules and off-rail entries | Preserve module availability and routes when changing display grouping |
| Themes | `core/theme.ts`: server cookie plus durable settings; dark fallback | Keep first-paint theme correctness and existing preferences |
| Dashboard | `app/(app)/page.tsx`, Bento, DashboardTiles | Saved show/hide/order; latest module digests, separately nightly headline |
| View state | `components/pos/searchState.ts` | Preserve URL state, drawer history and local view switching without RSC refetch |
| Mobile behavior | pull-to-refresh, edge back, task swipe, long press, shared overlays | Retain functional gestures with visible alternatives |
| Brand surfaces | `app/layout.tsx`, manifest, favicon, public icons/splash, Logo | Replace user-facing POS identity consistently |
| Data architecture | Modules own schemas; core composes through contracts | Do not join module schemas into a new dashboard service |

`docs/STATUS.md` and `docs/plans/pos-v1-1.md` describe partially completed parallel product work. Reconcile their status against the implementation branch before starting each phase, especially skill pickers, travel destinations, fitness trends and error boundaries. Do not revert those features to match old mockups.

The kit examples are illustrative compositions, not complete product specifications. Reconstruct them with real application components and actual data contracts. The editable symbol is a vector reconstruction; use the supplied masters consistently rather than redrawing it again.

## 4. Design contract

### Color and semantic roles

| Role | Light | Dark | Rule |
| --- | --- | --- | --- |
| Canvas | #F7F6F2 | #202927 | Quiet base |
| Surface | #FFFFFF | #29332F | Panels, menus and sheets |
| Primary text | #202927 | #F7F6F2 | Main content |
| Secondary text | #59645F | #B9C5BE | Metadata that remains readable |
| Border | #D9DED8 | #526159 | Surface separation; verify stronger control borders separately |
| Brand cobalt | #416ACA | #416ACA | Identity and selected data emphasis |
| Action | #3157B7 | #9BB9FF | White text on light-theme action; charcoal text on dark-theme action |
| Sand | #D6BB9A | #D6BB9A | Warm brand highlight, never generic warning or white-text button |
| Mist / sand surface | #EEF2FA / #F0E7DA | Derive and validate subtle dark fills | Selected and contextual surfaces |

Create explicit action foreground, focus, selection, disabled, chart and status tokens. Do not map the existing `--green` to blue: success and brand are different semantics. Light positive/attention/risk start from kit #15803D/#A16207/#B91C1C; select and verify separate dark variants. Check every rendered foreground/background pairing, not just the palette sheet.

Map the existing `--bg`, `--ink`, `--rule`, Tailwind and shadcn aliases to the new semantic values to reduce module churn. Keep `--accent` versus shadcn `accent` meaning explicit. Update accent buttons currently hardcoded to `text-white` so they remain readable in dark mode.

### Typography, shape and density

- Geist, locally served from the licensed kit; system sans fallback. Keep font license with distributed assets.
- Page headings: 28-32px desktop, 24px phone, weight 500. Editorial welcome display can use 36-48px, never dominate an everyday dashboard.
- Section headings: 18-20px/500. Body and controls: 14-16px/400-500. Metadata: 12-13px. Phone form inputs at least 16px.
- Tabular numerals for amounts, dates and measurements. Sentence-case labels. Remove routine tracked uppercase eyebrows and decorative numbering.
- Spacing steps: 4, 8, 12, 16, 24, 32, 48. Page gutters 16-20px phone, 24-32px desktop.
- Radii: 8px small controls, 12px inputs/buttons, 16px cards, 20-24px sheets where appropriate. Pills only for chips and compact filters.
- Borders organize information. Shadows chiefly distinguish overlays. Avoid a separate card around every line or metric.
- Dense transaction/task tables stay useful; whitespace belongs between groups, not between every record.

### Distinctive application language

The ribbon is the identity anchor in the rail, app icon and sign-in. Connected records are represented by readable context links, such as Task → Project → Goal, not ornamental orbit diagrams. Sand adds warmth to reflection and selected summaries without becoming a competing action color. Cobalt marks what is interactive or selected. The product is recognizable through these consistent choices rather than giant decorative logos.

## 5. Navigation and layout proposal

Keep URLs, module IDs and stored keys. User-facing Dashboard becomes Today at `/`; the household module remains Home & Property at `/home` to avoid ambiguity.

Proposed desktop order:
- Today and global Search.
- Plan: Tasks, Goals, Skills.
- Knowledge: Second Brain, Ideas.
- Life: Finance, Health, Fitness, Meals, Travel, Home & Property, Insurance.
- Review: pending approvals and Weekly review remain distinct destinations.
- Utilities: Notifications, Agent log, Settings.

Group labels are navigational headings, not new parent pages. Keep enabled/off-rail modules discoverable. Existing manifest data remains the source of availability. Avoid user-configurable navigation or a new grouping framework in the first release.

Desktop rail: approximately 224-240px expanded and 64-72px collapsed, symbol plus wordmark when expanded, accessible names/tooltips when collapsed. Use existing Lucide icons instead of numbered codes. Active state has shape and text emphasis as well as color.

Phone: retain four reachable bottom destinations initially, Today, Tasks, Finance, Browse. Revisit the middle two only after owner priorities. Browse uses the same groups as desktop. Search stays reachable from Browse and the appropriate header; command palette remains available on desktop. Do not put every module in the bottom bar.

```text
Desktop
[Holon rail] [Page title                 Search / primary action]
             [Relevant filters / tabs / freshness]
             [Primary working area       Context, when useful]

Today
[Date / concise overview                 Review count]
[Needs attention: only actionable items]
[Today and next steps                    Upcoming]
[Selected domain summaries, preserving saved order/visibility]

Phone
[Title                              Action]
[Filters when relevant]
[Highest-priority content]
[Secondary content / disclosure]
[Today       Tasks       Finance       Browse]
```

Breakpoints: phone below 768px; intermediate widths get reduced columns without squeezed controls; wide layouts from roughly 1200px. Normal workspaces cap around 1440px content width; boards, calendars, maps and constellations may use available width. Test 360, 390/402, 440, 768, 1024 and 1440px.

## 6. Shared component work

| Family | Change | Behavior to protect |
| --- | --- | --- |
| PageHeader, text | Single clear heading, optional supporting line, fewer decorative bands | One accessible h1, module search, phone actions |
| Card, MetricStrip | Softer surfaces and varied content hierarchy | Real values, null versus zero, selected state |
| Button, controls, field/edit | Semantic variants, clear focus/error/help states | Native dates, validation, pending/disabled states |
| Segments, TabBar, Chip | Consistent selected state and touch sizing | URL view state and no unnecessary fetches |
| Row, DataTable | Clear scanning, contextual actions, phone summaries | Sort/filter state, exact amounts, selection |
| Overlay | Consistent desktop drawer and phone sheet; visible title/actions | Deep links, escape, focus containment/return, scroll locking, keyboard-safe footer |
| CommandPalette, search | Holon styling and grouped results | Keyboard shortcuts, active item and enabled-module reachability |
| EmptyState, Toast, SyncBand | Clear next action, honest freshness and errors | Retry, stale/offline distinction, announcements |
| Charts | Named semantic series, readable axes and legends | Null gaps, units, date ranges, screen-reader summary |
| Logo | One reusable wrapper around approved assets | Correct reverse/mono/small variants; decorative images hidden from AT |

Meet at least 44px effective touch targets for primary touch interactions, including on touch laptops; do not assume a wide viewport means a mouse. Verify contrast at WCAG AA targets (4.5:1 normal text, 3:1 large text and meaningful UI boundaries), visible keyboard focus, zoom/reflow, reduced motion and color-independent state labels.

Interaction transitions: 160-240ms for opening, selection and feedback. Use the kit's slow breathing only for genuine processing. No permanent ambient motion on the daily dashboard.

## 7. Screen-by-screen scope

| Screen / module | Proposed redesign | Preserve / avoid |
| --- | --- | --- |
| Today | Attention, today's work, upcoming dates, compact domain summaries | Saved dashboard order/hidden keys, fresh digests, distinct nightly timestamps; no invented AI insights |
| Tasks / Projects | Readable rows and boards, consistent view/filter toolbar, contextual task editor | All current views, drag/swipe, project-goal inheritance, native dates, deep links |
| Goals | Goal progress, next actions and related projects as one clear detail flow | Manual values win; no new progress scoring |
| Skills | Calm tree/constellation chrome, clearer selection/details and readable progress | Existing XP rules, links, pan/zoom and performance; retain visualization rather than replace with decorative cards |
| Second Brain | Capture-first layout, readable note pane, clear hubs and related notes | File/URL/text capture, drafts, pending transcription, source links and existing classification |
| Ideas | Consistent list/quadrant controls and clear research status | Cost guards, actual citations and current scoring |
| Finance | Strong amount hierarchy, understandable net-worth trend, efficient transactions | Cents, missing dates, currencies, manual overrides; no palette-driven change to meaning |
| Health | Clear reading/history hierarchy and source/date context | Real units, no medical interpretation invented by redesign |
| Fitness | Trends and history with quiet plan/log actions | Existing integrations, units, history filters and pending v1.1 work |
| Meals | Clear plan, recipe and grocery grouping | Existing actions and native inputs |
| Travel | Globe as exploration surface plus usable trip list/details | Destination pins, gestures, dates and budgets; readable non-map alternative |
| Home & Property | Group existing property/asset/maintenance content around records and due work | No new standalone Assets module merely because the brand brief mentions it |
| Insurance | Scannable coverage/policy summary and document detail | Real premium/renewal values, upload and extraction states |
| Review | Clear proposed change, source and approval actions | Review safeguards, approve/reject/snooze semantics and audit trail |
| Weekly review | Focused steps, saved context and manageable next actions | Existing workflow and write behavior |
| Notifications | Urgency and state with clear mute/snooze controls | Delivery rules and quiet hours |
| Search / Browse | Consistent result rows and domain grouping | Current routes, matching and permissions |
| Settings / Connections | Calm forms and clear connection health | Credentials, passkeys, spend caps, enabled modules and notification settings |
| Agent log | Readable system history separate from daily priorities | Actual costs, job failures and diagnostic detail |
| Auth / onboarding / errors | Holon brand, brief copy and obvious next step | OTP and passkeys, owner gating, fallback behavior; no domain migration bundled in |

All screens include loading, empty, populated, long-content, validation-error and failed-request states. Integration-dependent screens also include unconnected, syncing and stale states. Screenshot fixtures must be synthetic and cover at least one large dataset.

## 8. Implementation phases

Each phase is a focused branch/PR with a screenshot comparison, relevant regression results and updated checklist. Dependencies below describe delivery order, not a request to spawn agents. No production deploy is part of this planning task.

### Phase 0: baseline and representative designs
Complexity: medium. Depends on owner scope answers.
- [ ] Reconcile current branch with active v1.1/v2 work; inventory actual routes and actions.
- [ ] Capture current screens with synthetic data at phone and desktop widths; record a route/state matrix.
- [ ] Record route bundle sizes, view-switch requests and representative rendering timings.
- [ ] Build reviewable designs for Today, Tasks, Finance, Second Brain and one shared drawer in both themes and phone/desktop layouts.
- [ ] Confirm layout, density and hierarchy against the selected kit and owner feedback before module-wide changes.
Exit: concrete visual targets plus current behavior checklist. No speculative feature work.

### Phase 1: foundations and components
Complexity: medium. Depends on Phase 0.
Files: `app/globals.css`, `app/layout.tsx`, `components/pos/*`, local font/brand assets; `core/theme.ts` and shell actions only if default behavior needs change.
- [ ] Introduce semantic Holon tokens and locally served Geist, maintaining existing aliases where practical.
- [ ] Restyle shared controls, typography, cards, overlays, tables and feedback states.
- [ ] Replace ComeauxverseMark with Holon wrapper; choose compact raster or simplified SVG for repeated UI use after measuring the large vector master's size.
- [ ] Add a development-only component preview or test fixture using existing tooling, not a new design-system app.
- [ ] Verify themes, focus, dialogs, touch targets and readable status variants.
Exit: representative screens use the new foundation without behavior regressions. Every module receives a smoke check because global CSS affects all of them.

### Phase 2: shell and entry surfaces
Complexity: medium. Depends on Phase 1.
Files: app layouts, Sidebar, PageHeader, CommandPalette, Browse/Search, `core/nav.ts`, auth/onboarding pages, `app/manifest.ts`, favicon, `public/icons`, `public/splash`, relevant service-worker references.
- [ ] Apply agreed navigation grouping and Today label; retain route contracts and module discovery.
- [ ] Complete expanded/collapsed rail, tablet behavior and safe-area-aware phone navigation.
- [ ] Rebrand sign-in, onboarding, document titles and PWA assets as Holon.
- [ ] Update theme-color handling to match the active theme, not only device preference.
- [ ] Inspect digest/email/push templates for user-facing POS naming; preserve sender/domain configuration.
Exit: entry through sign-in and installed PWA is consistent; existing sessions/passkeys and shortcuts work.

### Phase 3: Today and daily execution
Complexity: high. Depends on Phase 2.
Files: dashboard page/Bento/DashboardTiles/Inbox and `modules/tasks/ui`, `modules/goals/ui`.
- [ ] Recompose Today around attention and current work without dropping hidden/order settings.
- [ ] Keep existing tile IDs. Define a deterministic fallback for new/removed keys before changing composition.
- [ ] Restyle task views, projects, goals and drawers using the same control language.
- [ ] Keep system run status discoverable but lower in hierarchy than personal work.
Exit: create/edit/complete a task, navigate its project/goal, arrange dashboard, refresh and reload successfully on phone and desktop. Switching local task views adds no RSC request.

### Phase 4: knowledge and progress
Complexity: medium. Depends on Phase 3.
Files: `modules/brain/ui`, `modules/ideas/ui`, `modules/skills/ui`.
- [ ] Refine capture, hubs, note reading and related-record placement.
- [ ] Apply consistent idea research states and skill selection/detail panels.
- [ ] Reduce decorative chart/constellation noise only where it improves readability, preserving gestures and data.
Exit: text/URL/file capture, note reading, idea research states and skill navigation remain usable, including long content and reduced motion.

### Phase 5: finance, health and fitness
Complexity: high. Depends on Phase 4; reorder ahead of Phase 4 if owner priorities warrant.
Files: respective module UI, shared charts.
- [ ] Apply chart roles and semantic state colors; preserve precision and null handling.
- [ ] Restyle overview/detail/history/connection states and phone forms.
- [ ] Integrate any completed v1.1 finance/fitness improvements rather than rebuild them.
Exit: amounts and dates match pre-redesign fixtures, charts handle sparse data, forms save and integrations report honest state.

### Phase 6: remaining life modules and review
Complexity: high, delivered as two manageable PRs. Depends on shared foundations; follows earlier module patterns.
Files: meals/travel/home/insurance UI; review, weekly-review, notifications, settings, connections, agent-log routes.
- [ ] Complete remaining module rows, details, filters, uploads and empty states.
- [ ] Verify map/constellation alternatives and mobile controls.
- [ ] Restyle approval flows and utilities without concealing destructive or external actions.
Exit: every enabled route and its principal action passes the route/state matrix; no old-brand islands remain.

### Phase 7: release validation and handoff
Complexity: medium. Depends on all earlier phases.
- [ ] Final visual pass at 360, 390/402, 440, 768, 1024 and 1440px; both themes.
- [ ] Test keyboard navigation, focus return, 200% zoom, screen-reader labels, reduced motion and phone keyboard/safe areas.
- [ ] Validate PWA install/update, splash, icon readability and theme changes on the owner's phone.
- [ ] Run regressions, compare performance to baseline and resolve material regressions.
- [ ] Update design contract, screenshots, `docs/STATUS.md` and durable decisions; mark old visual specs superseded for styling only.
- [ ] Review preview, merge through normal workflow, then deploy under the separately authorized release process.
Exit: complete evidence and rollback instructions, no known critical navigation/data/auth/accessibility failures.

## 9. Validation and acceptance

Per implementation PR: relevant unit/interaction tests, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and impacted Playwright flows. Run the full suite at foundation and final release checkpoints. Keep e2e workers at 1 because fixtures share state. Do not run demo seeding or DB reset against personal data. Record pre-existing environment failures separately; a missing VAPID setup cannot be reported as a design pass.

Visual checks must inspect screenshots, not just assert element existence. Compare against agreed designs, while accepting intentional data-dependent height changes. Automated contrast checks do not substitute for focus, touch and readability review.

Acceptance checklist:
- [ ] Approved logo/palette/type across all visible product surfaces.
- [ ] No unexpected horizontal page overflow; deliberate boards/tables scroll within named regions.
- [ ] Existing theme choice, dashboard configuration and URL state survive reload and release.
- [ ] All modules reachable with correct disabled-module behavior.
- [ ] Existing writes, permissions, manual overrides, money values and approval safeguards unchanged.
- [ ] No task-view refetch regression, no duplicate data loading introduced for decorative summaries.
- [ ] Bundle growth and render timing measured; any increase above 10% on representative routes investigated before release, using comparable builds and fixtures.
- [ ] Null, zero, stale and loading remain distinguishable.
- [ ] All interactive elements named, keyboard-operable and visibly focused.
- [ ] Light/dark and installed-phone checks completed, including actual device verification before claiming device support.

## 10. Rollout, exclusions and rollback

Use the existing Next.js/Tailwind/shadcn/Lucide stack. No new animation, chart or component library without a demonstrated requirement. No new database schema is expected for the visual redesign. If navigation preferences, dashboard composition or OS-following themes require persistent settings beyond existing keys, specify and test that small change explicitly before implementation.

OS-following theme is not a label-only toggle: current Theme supports only light/dark. If selected, define system preference persistence, first-visit rendering, device-change handling and hydration behavior as a Phase 1 task. Preserve explicit owner overrides.

Keep the deployment origin, auth configuration, module IDs, API names, cookie keys and database schemas intact. User-facing rebranding does not require a repository/package rename. A future custom domain needs separate passkey, OAuth and PWA planning.

Out of scope: new AI agent capabilities, chatbot, causal health insights, new integrations, subscription/multi-user architecture, native mobile app and a public marketing site. Existing proposed AI actions receive clearer presentation, not new authority.

Rollback: retain the prior deploy and use revertable PRs. Since initial phases are presentation changes, reverting restores the old UI without data conversion. If a later phase changes saved layout semantics, preserve old keys or supply a reversible compatibility mapping. Avoid a permanent dual-theme-brand feature flag unless staged production testing proves necessary.

## 11. Immediate next implementation step

Resolve the three owner questions, then produce the Phase 0 representative designs using real current workflows. Review Today plus one task drawer first: together they establish shell, typography, density, controls and overlays before work spreads across the application.
