# Long press to arrange: the fourth phone gesture

## Context

Every artboard is matched and step 15 (deploy) is owner work, so the remaining code item in docs/plans/design-build.md is the mobile gestures late pass. Three of its four gestures shipped 2026-09-09 (`core/gestures.ts`, `components/pos/gestures.ts`): swipe between tabs, swipe a task to complete it, pull down to sync. The fourth, long press a dashboard tile to arrange, was left out because "the dashboard has no stored tile order to arrange" (STATUS, decisions 2026-09-09). That reason is gone: the Dashboard pass (2026-09-11) added Arrange mode in `app/(app)/Bento.tsx`, entered by `?arrange=1`, with the order saved on the device and drag plus ‹ › to move tiles.

PosPhone.dc.html: `onPointerDown` on a tile starts a 480ms timer that sets `arranging: true`; `onPointerUp` and `onPointerLeave` clear it. Arranging then shows per-tile move buttons, which the app already has.

So the gesture is only an entry point: hold a tile for 480ms on touch or pen and the page goes to `/?arrange=1`. Everything after that is the existing Arrange mode. The Arrange link in the header keeps working on the phone as it does now.

Decision for `decisions/log.md`: a long press is 480ms (PosPhone's timer) with the pointer moving less than 10px, touch and pen only, and it enters the existing Arrange mode rather than a phone-specific one. Rejected: a phone-only arrange with ↑↓ as PosPhone draws it (a second arrange to keep in step with the first, for an interaction the existing ‹ › already covers); firing on mouse (a slow click is not a request to rearrange).

## Changes

- `core/gestures.ts`: `LONG_PRESS_MS = 480`, `LONG_PRESS_SLOP = 10`, and `isLongPress(heldMs, dx, dy)` returning true when held at least `LONG_PRESS_MS` and moved less than the slop on both axes. No React, like `swipeOf`.
- `core/gestures.test.ts`: three cases, written first: too short is not a press; long enough and still is; long enough but moved 12px is not (that is a scroll).
- `components/pos/gestures.ts`: `useLongPress(onFire)` returning `onPointerDown / onPointerMove / onPointerUp / onPointerCancel / onPointerLeave`. Touch and pen only, same guard as `useSwipe`. Down starts a timer for `LONG_PRESS_MS`; move beyond the slop, up, cancel or leave clears it; the timer fires `onFire` once. Timer held in a ref and cleared on unmount. The file's header comment loses the sentence saying the fourth gesture is not here.
- `app/(app)/Bento.tsx`: each tile wrapper spreads `useLongPress(() => router.push('/?arrange=1'))` when not already arranging (`useRouter` from `next/navigation`). One hook instance per Bento, since the handlers do not depend on which tile is held. The arrange banner copy gains nothing; the phone reaches the same banner.
- `e2e/screens.spec.ts`: one mobile-only test beside the two gesture tests: on `/`, `pointerdown` with `pointerType: 'touch'` on the first tile, wait 600ms, expect the URL to match `/arrange=1/` and the banner text "Arrange mode" visible; then reload `/`, `pointerdown` then `pointerup` after 100ms, wait 600ms, expect no `arrange` in the URL; and a mouse `pointerdown` held 600ms stays on `/`.
- `docs/STATUS.md`: the Gestures paragraph under "Late passes" says the fourth is built and how; the "Not built" sentence goes. `decisions/log.md` entry above.

## Tasks

1. The unit test red, then `isLongPress` green (`pnpm test core/gestures`). Commit: `feat: a long press is decided in core/gestures`.
2. Hook, Bento, e2e. Check: `E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --project=mobile --grep gestures` (3 tests) and `--project=desktop --grep dashboard` unchanged. Commit: `feat: long press a dashboard tile to arrange it, on the phone`.
3. typecheck, lint, unit; STATUS, decision, memory. Commit: `docs: the fourth phone gesture`.

## Verification

- `pnpm test core/gestures`, `pnpm typecheck`, `pnpm lint`.
- `E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --grep "gestures|dashboard"` on both projects.
- A 402 shot of the dashboard in arrange mode after the press, for the record in `/private/tmp/pos-handoff-sources/mobile/`.

## Out of scope

- Reordering by dragging tiles with a finger (HTML drag and drop does not fire on touch; ‹ › covers the phone, as PosPhone's ↑↓ do).
- Anything in the owner to-do (keys, hosted Supabase, Vercel, `supabase db push` of the three pending migrations).
