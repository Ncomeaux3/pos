# Phone polish: the items the UI checks flagged

Approved 2026-09-14 by the owner's answers (recorded in the session, logged in decisions/log.md on merge). One branch, one PR, one session. Follow-on to docs/plans/phone-shell.md; nothing here changes a desktop screen.

## Change

1. **Phone Home under 1800px.** `app/(app)/Inbox.tsx`: `WarningList` and `ProposalList` take `phoneLimit` (2 and 1; 3 and 2 measured 2037px with the seed, 2 and 1 measure 1784px). Rows past the limit get `hidden md:flex`; below the last shown row a `md:hidden` link "and N more" goes to `/notifications` and `/review`. CSS only, no `useIsPhone`, so the server render is right on both widths. `app/(app)/page.tsx` passes the two numbers.
2. **Globe legend clear of the controls.** `modules/travel/ui/Globe.tsx`: the legend is `max-md:bottom-[42px]` so it sits on its own line above the controls below md; desktop keeps its two corners.
3. **Tasks Calendar fits the phone.** `modules/tasks/ui/Calendar.tsx`: `min-w-[560px]` becomes `md:min-w-[560px]`; cells are `min-h-14 px-1 py-1` below md and the desktop sizes from md; day heads show two letters below md; each day's tasks are a row of 6px dots below md (P1 in `--bad`, review in `--warn`, else `--ink-3`), each dot a 16 by 24px button named by the task's title that opens it, and the "+N" count stays; the desktop buttons are `hidden md:block`. Ceiling: a 16px wide target is under the 24px guideline; a day sheet listing the tasks is the upgrade if taps miss.
4. **Every drawer has a name.** `components/pos/Overlay.tsx`: when there is no title, `aria-labelledby` points at the eyebrow element, which gets an id, so "Tasks / Edit" names the task drawer.
5. **Drawer footer contrast.** `modules/travel/ui/TripDrawer.tsx`: Cancel and the attribution line move from `text-ink-3` to `text-ink-2` (5.9:1 dark, 8.6:1 light). The `ink-3` and `ink-4` tokens stay as the brand layer sets them; the AA gap on secondary text is logged as a brand-layer decision for the owner.

## Verify

- e2e (mobile): Home visible warning rows at most 2 and proposal rows at most 1 with the seed's alerts and proposals, the page under 1800px, "and N more" links present; the Calendar has no horizontal document overflow and a dot button opens a task; the task drawer has an accessible name. Desktop: the existing dashboard, tasks calendar and travel tests unchanged.
- ui-verifier at 402 both themes: Home height under 1800px, the globe legend and controls apart, Calendar cells fit, the trip form footer at AA; at 1440: nothing changed.
- `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## Out of scope

Segment row overflow hint (`TabBar`), Overlay eyebrow truncation, the quick-add focus ring, `DataTable` two-line rows, the light theme's ok and warn colours. Each is a primitive or token question for its own pass.
