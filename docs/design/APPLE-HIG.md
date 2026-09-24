# Apple HIG notes for Holon

What Apple's Human Interface Guidelines say, condensed for building Holon (`holon-ui`) on the web. This is the source the token spec and component rules in docs/plans/holon-apple.md are drawn from. It lives in POS until Phase 1 of that plan moves it to the `holon-ui` repo.

Read 2026-09-23 and 2026-09-24 through the JSON behind each page (`developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json`). Every section names the pages it rests on. Numbers checked against Apple's pages on 2026-09-24: the Dynamic Type table, the contrast ratios, the hit targets, the 35% dim layer and the 15-character toolbar title. Every other number came from the first reading's notes and is marked "verify".

Published copy (private artifact): https://claude.ai/artifact/4rQxg2WvuuBmJf5RS4dKdb

HIG base URL, used below as `hig/<slug>`: https://developer.apple.com/design/human-interface-guidelines/

## Foundations

### Typography
Source: hig/typography

- iOS default body is 17pt; minimum text size is 11pt (verify).
- iOS Dynamic Type at the default (Large) size, point size over leading:

  | Style | Size / leading (pt) |
  |---|---|
  | Large Title | 34/41 |
  | Title 1 | 28/34 |
  | Title 2 | 22/28 |
  | Title 3 | 20/25 |
  | Headline | 17/22, semibold |
  | Body | 17/22 |
  | Callout | 16/21 |
  | Subhead | 15/20 |
  | Footnote | 13/18 |
  | Caption 1 | 12/16 |
  | Caption 2 | 11/13 |

- Text scales up to the AX5 accessibility size. macOS Body is 13/16 (verify).
- Avoid the Ultralight, Thin and Light weights.
- SF and New York are variable fonts with optical sizes. On the web, the system font stack (`-apple-system, system-ui`) renders SF on Apple devices; see Licensing.
- Web equivalent of Dynamic Type: rem-based sizes that follow the browser's text size setting.

### Color
Source: hig/color

- 12 system colours (verify the count), each with light, dark, accessible-light and accessible-dark values. Blue, for example: 0,136,255 / 0,145,255 / 30,110,244 / 92,184,255 (verify, from notes).
- System grey 1 to 6 (verify).
- A four-level label hierarchy: label, secondary, tertiary, quaternary.
- System backgrounds (primary, secondary, tertiary) and a separate grouped set for grouped lists.
- Never repurpose a semantic colour for another meaning. Use Display P3 for imagery.
- Use the accessible variant of a status colour whenever it is used as text.

### Materials
Source: hig/materials

- Standard materials for the content layer: ultra thin, thin, regular, thick.
- Liquid Glass for the functional layer; see Liquid Glass and concentricity.

### Accessibility
Source: hig/accessibility

- Contrast: at least 4.5:1 for text up to 17pt, 3:1 for text at 18pt or bold.
- Hit targets: iOS default 44x44pt, minimum 28x28pt; macOS default 28x28pt, minimum 20x20pt.
- Padding about 12pt around bezeled controls and 24pt around unbezeled ones (verify).
- Support text enlarged to 200% (verify).
- Never use colour alone to carry meaning.
- Reduce Transparency, Increase Contrast and Reduce Motion each change how materials and motion render.

### Motion
Sources: hig/motion, hig/accessibility

- Under Reduce Motion: fewer automatic animations, tighter springs, no z-depth changes, cross-fades instead of moves along an axis, no animated blur.

### Writing
Source: hig/writing

- Active voice. Labels start with a verb.
- No "we" or "our", and no needless "your".
- Errors say how to fix the problem, without blame and without "oops".
- One case style per element type. Holon uses sentence case everywhere.

### Layout
Source: hig/layout

- Respect safe areas and keep content clear of the floating bars; the scroll edge effect separates the two (see Components).

## Liquid Glass and concentricity

Sources: hig/materials, https://developer.apple.com/documentation/swiftui/concentricrectangle

### Liquid Glass
- Two variants. Regular is the default, used for alerts, sidebars and popovers. Clear sits over media; "If the underlying content is bright, consider adding a dark dimming layer of 35% opacity."
- Two layers. The content layer uses standard materials. The functional layer (controls, navigation, tab bars, toolbars, sheets, popovers) uses glass.
- Glass is used sparingly and has no colour of its own. The accent colour is for primary button fills. Toolbars and tab bars are monochrome.
- Content cards are not glass. In Holon this means cards become opaque grouped surfaces on a grouped canvas, as in iOS Settings.
- Accessibility: Reduce Transparency makes glass frostier, Increase Contrast makes it near solid, Reduce Motion lowers its effects.
- SwiftUI names, for reference: `glassEffect`, `GlassEffectContainer(spacing:)`, `glassEffectUnion`, `glassEffectID`, with the `.matchedGeometry` and `.materialize` transitions.

### Concentricity
- `ConcentricRectangle` (iOS 26 and later, verify) draws corners that share a centre with their container's shape, set by `.containerShape(_:)`. Corner options: `.concentric`, `.concentric(minimum:)`, `.fixed`, `.square` (verify the option list; only the page title was confirmed on the second read). It falls back to `ContainerRelativeShape` insetting.
- CSS form: child radius = max(minimum radius, parent radius minus the padding between them).
- Continuous corners: `corner-shape: squircle` is a progressive enhancement on the web (verify browser support).

## Patterns

Sources: hig/patterns and the page named in each bullet.

- **Loading** (hig/loading): finish before people notice; show progress only after a moment; prefer determinate progress.
- **Entering data** (hig/entering-data): prefill what you can, never passwords; prefer pickers to typing; validate inline; keep Continue disabled until the input is valid.
- **Modality** (hig/modality): never stack modals, except an alert on a sheet; always give an obvious way to dismiss.
- **Onboarding** (hig/onboarding): skippable; teach by doing; ask for permissions when they are needed, not up front.
- **Searching** (hig/searching): one entry point, suggestions, scopes.
- **Settings** (hig/settings): put task options inline where the task happens; few options, smart defaults.
- **Charting data** (hig/charting-data): show the insight, not raw data; keep charts consistent across the app; give every chart an accessibility label.
- **Drag and drop** (hig/drag-and-drop): always offer another way to do the same thing.
- **Managing accounts** (hig/managing-accounts): account deletion inside the app; support passkeys.
- **Offering help** (hig/offering-help): contextual tips of one or two sentences (verify); tooltips start with a verb and stay short (60 to 75 characters, verify).
- **Collaboration and sharing** (hig/collaboration-and-sharing): a prominent Share button; a share sheet trimmed to the app's own sharing methods; permission summaries in plain words ("Only invited people can edit"); few custom setup choices; the Collaboration button beside Share once collaboration starts; notifications that link back into the app.

## Components

Sources: the page named in each bullet.

- **Buttons** (hig/buttons): 44x44pt targets; roles are normal, primary, cancel and destructive; a destructive action is never the primary button; one or two prominent buttons per view (verify).
- **Menus** (hig/menus): title case, verb first, an ellipsis when the item needs more input, one level of submenu (verify).
- **Segmented controls** (hig/segmented-controls): five segments or fewer on iPhone (verify); text or icons, never mixed; they select state, never perform an action.
- **Steppers** (hig/steppers): always show the value beside the stepper.
- **Sheets** (hig/sheets): medium and large detents; Done pairs with Cancel; sheets never stack.
- **Popovers** (hig/popovers): one at a time (verify).
- **Alerts** (hig/alerts): a title; at most three buttons (verify); no Yes or No labels; Cancel is never the default.
- **Tab bars** (hig/tab-bars): five tabs or fewer on iPhone (verify); floating glass; minimises on scroll.
- **Toolbars** (hig/toolbars): this page now covers what the retired Navigation bars page did ("In iOS, a navigation-specific toolbar is sometimes called a navigation bar"). Leading zone for back, sidebar toggle and title; centre for customisable items; trailing for search and primary actions, always visible. Standard back and close symbols, no text labels. Titles under 15 characters, never the app name. A More menu for overflow rather than a crowded bar. Minimal custom backgrounds and tint.
- **Sidebars** (hig/sidebars): at most two levels (verify); not hidden by default.
- **Search fields** (hig/search-fields): search as a tab, in a toolbar, or inline.
- **Progress indicators** (hig/progress-indicators): never switch from determinate to indeterminate, or the reverse, partway through a task.
- **Scroll views** (hig/scroll-views): the scroll edge effect softens content under floating bars so the two stay distinct.
- **Widgets** (hig/widgets): 16pt margins and 11pt minimum text (verify).

## Licensing

Sources: https://developer.apple.com/fonts/, https://developer.apple.com/sf-symbols/, https://developer.apple.com/design/resources/

- **SF fonts.** The license shown on the fonts page limits use to "creating mock-ups of user interfaces to be used in software products running on Apple's iOS, OS X or tvOS operating systems" (SF Compact adds watchOS), and says "You may not embed the Apple Font in any software programs or other products." It also bars mockups made on non-Apple systems and requires a registered Apple Developer account. These quotes were extracted by a fetch tool, not compared character by character (verify the exact wording before quoting it elsewhere).
- **SF Symbols.** The SF Symbols page carries no license text; the license ships inside the SF Symbols app. Apple Developer Forum threads quote it as: "THE APPLE SOFTWARE IS TO BE USED SOLELY FOR CREATING USER INTERFACES TO BE USED IN SOFTWARE PRODUCTS RUNNING ON APPLE'S iOS, iPadOS, macOS, tvOS OR watchOS OPERATING SYSTEMS", and symbols may not be used in app icons, logos or trademarks (verify against the license in the app; sources https://developer.apple.com/forums/thread/739523 and https://developer.apple.com/forums/thread/724523).
- **What Holon does.** Holon is web software, not software running on an Apple operating system, so it bundles neither. It uses the system font stack, which renders SF on Apple devices because the device supplies the font, and Lucide icons styled to sit beside SF text.
- **UI kits.** Apple Design Resources publishes Figma and Sketch kits for iOS, iPadOS, macOS, tvOS, watchOS and visionOS (listed on the page when read 2026-09-24). Their reuse terms were not read (verify before copying anything from a kit).

## Not confirmed

Where each would be settled: the license inside the SF Symbols app, the fonts page at https://developer.apple.com/fonts/, the iOS UI kit on https://developer.apple.com/design/resources/ (row heights, kit terms, radii), and the SwiftUI documentation.

- The SF Symbols primary license text (forum quotes only).
- The exact SF fonts license wording (tool-extracted).
- List row heights.
- The UI kits' reuse terms.
- Whether Apple publishes web-specific HIG guidance (none found).
- The exact documentation text for `RoundedRectangle` with `.continuous` corners.
- The `ConcentricRectangle` corner option list (from notes; the page's existence is confirmed).

## Sources

All confirmed live on 2026-09-24. Prefix `hig/` = https://developer.apple.com/design/human-interface-guidelines/

- Foundations: hig/foundations, hig/typography, hig/color, hig/materials, hig/accessibility, hig/motion, hig/writing, hig/layout
- Patterns: hig/patterns, hig/loading, hig/entering-data, hig/modality, hig/onboarding, hig/searching, hig/settings, hig/charting-data, hig/drag-and-drop, hig/managing-accounts, hig/offering-help, hig/collaboration-and-sharing
- Components: hig/buttons, hig/menus, hig/segmented-controls, hig/steppers, hig/sheets, hig/popovers, hig/alerts, hig/tab-bars, hig/toolbars, hig/sidebars, hig/search-fields, hig/progress-indicators, hig/scroll-views, hig/widgets
- Retired: hig/navigation-bars returns 404; its guidance is in hig/toolbars.
- SwiftUI: https://developer.apple.com/documentation/swiftui/concentricrectangle
- Licensing and kits: https://developer.apple.com/fonts/, https://developer.apple.com/sf-symbols/, https://developer.apple.com/design/resources/
