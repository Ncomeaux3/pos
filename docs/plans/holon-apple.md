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
- **Holon evolves toward Apple** rather than being replaced. The Holon name, logo, Skills constellation and Travel globe stay. **Holon action blue stays the accent** (#3157b7 light, #9bb9ff dark).
- **As close to Apple as licensing allows. iOS sizing at every width.** Desktop keeps a sidebar, which is what iPadOS does at regular width. The phone keeps the floating tab bar.
- **Font and icons:** the system font stack, so real SF on Apple devices with Geist as fallback, plus Lucide styled to match SF Symbols. SF Pro and SF Symbols are licensed only for Apple-platform software, so neither is bundled. The license text comes from quotes, so verify the primary text once.
- **The notes live in both places:** `docs/design/APPLE-HIG.md` in the design-system repo, plus a published page.
- **Rollout:** a full plan across all screens. Tokens and components come first, then the shell, then one PR per module in daily-use order.

On approval, copy this file to `docs/plans/holon-apple.md` (the project convention) and log the answers in `decisions/log.md` under 2026-09-23.

## Architecture

- **New repo** `holon-ui`. The package is `@<github-owner>/holon-ui` (verify the owner scope; GitHub Packages requires it).
- **No build step:** it ships `.tsx` source and `tokens.css`. POS lists the package in `transpilePackages` in `next.config`. Add a build when a non-Next consumer appears.
- **Package contents:** anything with no POS data dependency. That means tokens, Button, Chip, Card, Sheet (from `Overlay`), Row/RowList, Segments, Switch/PillGroup, TabBar/MobileTabBar, Sidebar shell, FormField/field, edit primitives, Toast, EmptyState, PageHeader (large title), SwipeRow and gestures, PageTransition, LineChart and charts, MonthGrid, CommandPalette, `useIsPhone`, `useOptimisticAction`.
- **Stays in POS:** SkillPicker, SyncBand, ReviewShell, WizardShell, Logo (Holon brand assets, which can move later), AvatarMenu's POS links.
- **`components/pos/index.ts` becomes a re-export barrel** of the package plus the POS-only pieces, so the 49 module files that import `@/components/pos` keep compiling unchanged.
- **Release:** semver tags. A GitHub Action publishes on tag. POS pins an exact version. `.npmrc` reads `NODE_AUTH_TOKEN`, which is set in GitHub Actions and in Vercel (new env var names go in `.env.example`).

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
1. **`holon-ui` repo and tokens:**
   - Scaffold the repo, `tokens.css`, the Tailwind v4 `@theme` export, the publish workflow and a README contract.
   - Build one static reference page (`demo/index.html`) showing type, colour, materials, concentric nesting and targets in both themes. This is the owner's **mockup gate**: Nick approves it before Phase 2.
   - Check: a contrast script asserts every text-on-surface token pair is at least 4.5:1 in both themes, and fails the CI if not.
2. **Components into the package:**
   - Move and restyle the list in Architecture. Add `Alert` and `Sheet` detents.
   - Make `components/pos/index.ts` a re-export barrel.
   - Check: POS `pnpm typecheck`, `pnpm test` and `pnpm lint` stay green with zero edits in `modules/`.
3. **POS consumes the package and the shell:**
   - Add the package (`.npmrc`, `NODE_AUTH_TOKEN` in Vercel and CI, `transpilePackages`).
   - `app/globals.css` imports `tokens.css` and keeps the alias layer.
   - Build the shell: tab bar, sidebar, large-title header, scroll edge effect, the grouped canvas, and opaque cards.
   - Check: a Vercel preview builds with the private package, and a full `screens` e2e run passes.

**Module sweeps**, one PR each, in this order: Home, Tasks, Finance, Calendar, Goals, Fitness and Health, Meals, Travel (the globe untouched), Insurance and Home, Second Brain, Ideas, Skills (the constellation untouched), then Settings, Notifications, Agent log, Browse, Login and legal.
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
