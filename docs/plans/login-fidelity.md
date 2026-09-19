# Login to the artboard

Superseded for styling on 2026-09-19 by the Holon redesign (docs/plans/holon-product-redesign.md, section 4): colour, type, radii, surfaces and control shapes now come from the Holon design contract and the shared components in `components/pos/`. This plan still governs what each screen shows and how it is laid out.


## Context

Core screen of the fidelity pass (method: docs/plans/weekly-review-fidelity.md). `POS Login.dc.html` (121 lines) captured at 1440x900 into `/private/tmp/pos-handoff-sources/login/`: the idle form, the inline validation error, the sending state, the sent state and the denied state, dark and light (10 PNGs). Login already had one fidelity commit (`51289f7 Login to its artboard`, 2026-09-10): the card is 440px not 400, "Sign in" is the eyebrow over the heading, the button sits sized on the right of the form rather than as a bar, and the top band with the lockup and the install eyebrow exists. What is still open is small: the install eyebrow uses "/" where the artboard uses "·", the email input has no placeholder and no arrow on the button, the sent card is missing the artboard's "Sent via" cell (which this app cannot honestly draw), and the artboard's footer (domain plus a live nightly-job dot) is not built at all. The app also has one thing by deliberate, already-logged decision that the artboard draws and the build must keep leaving out: the denied view (see decisions/log.md 2026-09-07). Nothing else on the artboard needs a decision; the rest is measurement.

Decisions with Nick (append to `decisions/log.md`):
- The artboard's sent-card right cell reads "Sent via, Resend · noreply@cmxlogic.com" (logic line 44 markup). False: `supabase/config.toml`'s `[auth.email.smtp]` block is commented out, so the magic link goes out through Supabase Auth's own mailer, not through the Resend integration `core/notify.ts` uses for digests. Default: drop the "Sent via" cell; the sent card keeps only the "Expires" cell, full width. Alternative: wire a Resend SMTP relay into `supabase/config.toml` for auth email so the line becomes true (infra, outside `app/(auth)/login/**`, Blocked for this pass).
- The artboard's footer (line 68 to 71: `pos.cmxlogic.com` left, a green dot and "NIGHTLY JOB OK · 04:02 CDT" right, reading `core.jobs`) is decorative chrome on a page nobody has signed into yet. The app's own rule for this page is to answer a stranger identically regardless of what they typed (2026-09-07 decision) specifically to leak nothing about the install; a live job-health dot pre-auth cuts against that even though it holds no secret. Default: no footer, on both the form and sent cards. Alternative: build it with `getOrigin()`'s real host and the orchestrator's `core.jobs` row (name that job truthfully; a fresh install has never run one, so the copy needs a null case too) if Nick wants the chrome enough to accept a small pre-auth read.

## Artboard measurements (POS Login.dc.html lines 24 to 76, logic 78 to 121)

Root (line 24): `data-theme`, full width, min-height 100vh, column flex, `background-color:var(--bg-deep)`, a dotted `grid-bg` that tracks the mouse (`onMouseMove`/`onMouseLeave`, decorative, not chased: no cursor-tracking background in the app, as with every other screen).

Header (line 25 to 27; 56px, `padding 0 28px`, space-between): the lockup (118 by 20, masked SVG) and, right, `<span class="eyebrow"><span class="dot"></span>POS · single owner · v0.1</span>`. The app's `ComeauxverseLockup` and `Eyebrow dot="brand"` already match in shape; the string differs: app renders `POS / single owner / v0.1` (slashes). Fix the copy to middots, matching the artboard exactly (the app's slash convention is for a page crumb like "Review / Pending"; this line is not a crumb).

Card (line 27; `position relative`, `width min(440px, 100%)`, 1px `--rule-2` on `--bg-elev`, `padding 36px 36px 28px`, `rise` on mount, not chased). The app's `div.max-w-[440px] border-rule-2 bg-bg-elev p-9 pb-7` already matches (36/36/28 = `p-9`/`pb-7`).

Form state (`isForm`, line 30 to 37): eyebrow "Sign in"; h1 30px/400 -0.03em line-height 1.05 `margin-top 14` "Personal Operating System"; p 13px `--ink-3` `margin-top 10` line-height 1.5, artboard copy "One owner, one login. Enter the owner email and we'll send a single-use link." (the app's own edit, "...and a single-use link comes back.", stands: no "we" voice, already shipped). Form `margin-top 26`, column, gap 8:
- Label eyebrow "Owner email" (line 32).
- Input row (line 33): flex, 1px border (red when `hasError`, else `--rule-2`), `background:var(--bg)`. `>` prompt 12px mono `--ink-4` `padding 0 12px`; input 14px mono, `padding 12px 12px 12px 0`, placeholder `nick@cmxlogic.com`, no visible border of its own. The app's `> ` prompt is 13px (`code text-[13px]`) against the artboard's 12; the input carries no placeholder today, add one (a generic address, not the owner's own, since this is a fork-and-fill template: `you@yourdomain.com`).
- Error line (line 34): mono 11px `--red` `letter-spacing .06em`, artboard text "ENTER A VALID EMAIL" (rendered uppercase from the DS `.mono`/eyebrow-style class); the app already renders "Enter a valid email" through its own `label` class, which uppercases via CSS the same way. Match confirmed, no change.
- Button row (line 35): `margin-top 14`, flex-end. `MagneticBtn primary`, measured 190 by 44: label plus a spinner (12px ring, `border-top-color:transparent`, `animate spin .7s linear`) while `sending`, replaced by the `Arrow` (14 by 14) when idle. The app's `SubmitButton` (`size="lg"`, `min-w-[190px]`) matches the box; it has neither the arrow glyph nor a spinner today. Add a trailing arrow (the same "→" glyph the Review pass uses for "Approve →") and, while `useFormStatus().pending`, swap it for a small spinning ring using the existing `animate-spin` utility (no new dependency).
- Footer row (line 37): `margin-top 22; padding-top 16; border-top 1px --rule`, space-between, 11px `--ink-3` `letter-spacing .06em`: "LINK EXPIRES IN 15 MIN" | "NO PASSWORDS · NO SIGNUP". The app already renders both, uppercased via `label`, in `--ink-4` rather than `--ink-3` (a shade darker), cosmetic, not worth chasing given the brand layer already governs shade choices elsewhere; leave as is.

Sent state (`isSent`, line 39 to 46): eyebrow with a dot "Link sent"; h1 "Check your inbox"; p 13px `--ink-3` "A sign-in link went to {email}. Open it on this device to finish." The app's own copy stands (2026-09-07 decision: one reply regardless of whether the address is the owner, so it cannot confirm a link was sent to that specific address as fact). Grid `1fr 1fr` on a 1px `--rule` border (line 41): left cell "Expires" eyebrow over a 20px/300 mono countdown; right cell "Sent via" eyebrow over 12px mono "Resend · noreply@cmxlogic.com" (dropped per the decision above; the app's cell becomes full width, keeping only Expires). Below (line 42): space-between, "← Use a different email" (13px `--ink-3`, hover ink) and a bordered mono "RESEND"/"SENT AGAIN" button (11px, `padding 6px 10px`, border `--rule-2`, colour green when just resent). The app's `Resend` is a plain unbordered label button with no "sent again" feedback state; that feedback is unnecessary here because the app's resend re-runs the whole server action and reloads the page, which remounts `Countdown` at 15:00, the same signal the artboard's transient label gives, by a different, already-correct mechanism. No change.

Denied state (`isDenied`, line 48 to 51): red eyebrow "Not the owner"; h1 "This system has one seat"; p naming the typed address and "OWNER_EMAIL"; a "← Back" button. Confirmed out of scope by the 2026-09-07 decision already in `decisions/log.md`; nothing here reopens it.

Footer band (line 68 to 71): see the Decision above. If Nick picks the alternative, the copy is `{host}` (from `getOrigin()`, stripped of the scheme) left, and right a dot (green when `last_status = 'ok'`, ink-3 dot and "no run yet" when `core.jobs` has no row for the orchestrator) plus "NIGHTLY JOB {STATUS} · {last_run in owner tz}" using `clockIn`/`dayIn` from `core/today`, matching the Review pass's convention for reading the clock.

Colours: `--bg`, `--bg-elev`, `--bg-deep` (an extra depth step the app's DS has and the artboard does not; already used correctly for the input), `--ink`, `--ink-2/3/4`, `--rule`, `--rule-2`, `--red`/`--bad`, `--brand`/`--accent`. Type and shape from the brand layer: Manrope, existing radii; the artboard's crosshair corner marks are decorative chrome, not chased anywhere else in this app and not here either.

## Files

- `app/(auth)/login/page.tsx`: the eyebrow copy ("·" not "/"), the email input's placeholder, drop the "Sent via" cell (Decision resolved), the optional footer (Decision resolved).
- `app/(auth)/login/SubmitButton.tsx`: trailing arrow glyph, a spinner swap while pending.
- `app/(auth)/login/Countdown.tsx`: unchanged.
- `e2e/screens.spec.ts`: the three existing `login` tests (`login, signed out`, `login, link sent`, `login rejects a malformed address without clearing it`) gain the new asserts below; `e2e/auth.setup.ts` is read only and must keep passing unmodified (it drives this same form for real).

Constraints for the build phase: the only editable files are `app/(auth)/login/**` plus this screen's e2e block. No edits to `components/pos/*`, `core/*` (including `core/auth.ts`, `core/owner.ts`, `core/ratelimit.ts`), `app/(auth)/layout*` (none exists today; do not add one), middleware, `e2e/seed.mts`, `supabase/migrations`, or `supabase/config.toml` unless Nick picks the SMTP alternative above.

## Tasks

### Task 0: Baseline
Plan to `docs/plans/login-fidelity.md` (tmp path in this pass; the build phase writes the real one), decisions logged. Failing e2e asserts (desktop) to add:
- `login, signed out`: the band eyebrow text matches `/POS · single owner · v0\.1/i` (not `/`); the email input has placeholder text; the submit button's accessible name matches `/send sign-in link/i` (arrow glyph does not change the name).
- `login, link sent`: the panel does not contain the text "Resend ·" or "noreply@cmxlogic.com" (the false "Sent via" cell); the "Expires" cell is still visible.
- New `login, resend restarts the countdown`: on `/login?sent=1&email=...`, read the countdown text, click "Resend", assert the countdown text is back to `15:00` (proves the existing remount covers the artboard's "SENT AGAIN" signal without new UI).

### Task 1: The page and button
`page.tsx`: eyebrow punctuation, input placeholder, drop the "Sent via" cell, the footer per Nick's decision. `SubmitButton.tsx`: arrow glyph, spinner while pending.
Check: Task 0 asserts pass; side by side dark and light of the idle form and the sent card. Commit: `fix: login screen to the artboard`.

### Task 2: Proof
`E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --project=desktop --grep "login"` and `--project=mobile`; confirm `e2e/auth.setup.ts` still signs in (run the full suite's setup project once). `pnpm typecheck`, `pnpm lint`, `pnpm test`. Pairs into `/private/tmp/pos-handoff-sources/login/pairs/`: form, sent, dark and light. Phone at 402 against the shell rules only. `docs/STATUS.md`, memory. Commit: `docs: login fidelity pass`.

## Out of scope
- The denied view (2026-09-07 decision stands; the same reply goes out regardless of the address).
- Wiring Resend as the auth mailer, and any footer built against a hosted `core.jobs` row, unless Nick picks that alternative.
- The mouse-tracked dotted background, the crosshair corner marks, and any other screen.
