# Finance to the artboard

Superseded for styling on 2026-09-19 by the Holon redesign (docs/plans/holon-product-redesign.md, section 4): colour, type, radii, surfaces and control shapes now come from the Holon design contract and the shared components in `components/pos/`. This plan still governs what each screen shows and how it is laid out.


## Context

Screen three of the fidelity pass (method: docs/plans/weekly-review-fidelity.md). `POS Finance.dc.html` captured at 1440 (page at 900 and 1240 tall, the three drawers, light) into `/private/tmp/pos-handoff-sources/finance/`. The artboard is one overview page: header band, title block, a four-cell KPI strip, then a two-column grid (Accounts over the Net worth chart; Upcoming over Budgets), with three drawers at 520px (an account's transactions, a budget's transactions with its limit, and Budget limits with an alert-threshold slider). The app's Overview already has this anatomy and its drawers; what differs is a five-tab row the artboard does not have, row densities and copy shape in every card, the drawer's chrome and width, the limits drawer (absent), and a fixed 80% threshold.

Decisions with Nick for this screen (append to `decisions/log.md`):
- The desktop tab row goes. Filing a transaction stays where the drawers already have it (an account's or a budget's transaction rows); a subscription due in the next fortnight can be cancelled from its Upcoming row, a small deliberate addition since the artboard gives cancel no home. The phone keeps PosPhone's four segments.
- The alert threshold becomes a Finance setting (default 80) read everywhere the constant is today: budget flags, the KPI tile, the digest's `overBudget`, and the headline clause's wording.
- The shared Overlay goes to the artboard's drawer once: 520px, the band with the crumb and ESC · CLOSE, title 26px and lede, `rgba(0,0,0,.45)` backdrop, shadow. Insurance's artboard uses the same 520px drawer, so this is the app's drawer, not Finance's.

Constraints as before: no em dashes, artboard copy where true, brand layer owns type and shape, module data stays in the module schema (the threshold is a row in `finance`, not a core setting).

## Artboard measurements (POS Finance.dc.html lines 31 to 190)

Band: 56px, `padding 0 28px`, gap 16. Eyebrow "Finance / Overview" (slash `--ink-4`); compact search scoped to finance ("Search finance", flex 1, min 140 max 320); eyebrow with dot "SimpleFIN · synced 04:02"; Sync now as the DS button (outline, not primary).

Title block: `padding 20px 28px 0`, h1 28px/400/-0.03em/1, sub 13px `--ink-3` `margin-top 8`: "Balances, upcoming charges, and budgets. Synced nightly, amounts in USD." Right, bottom-aligned, 11px mono 0.08em `--ink-3`: "FRI SEP 11 · 6 ACCOUNTS · 2 FLAGS".

KPI strip: `margin 18px 28px 0`, `repeat(auto-fit, minmax(220px, 1fr))`, 1px `--rule` gaps and border, cells `padding 16px 20px` on `--bg`: eyebrow, 34px/300/-0.02em figure `margin-top 10`, 11px mono `--ink-3` line `margin-top 8`. Net worth "ASSETS $249,510 · DEBT $2,310"; 30-day change in `--green` with "+1.7% · FROM $243,020"; Due in 14 days "4 CHARGES · NEXT SEP 14"; "Budgets over 80%" in `--amber` with "DINING · FITNESS · 19 DAYS LEFT".

Grid: `margin 14px 28px 24px`, `repeat(auto-fit, minmax(min(100%, 520px), 1fr))`, gap 14, `align-items start`; each column a flex column gap 14; the left column `align-self stretch` so the chart card (`flex 1; min-height 340px`) fills to the bottom.

Cards: 1px `--rule`, `--bg-elev`, `padding 14px 20px`. Head: eyebrow left, 11px mono `--ink-3` right, `margin-bottom 4`. Column headers 11px 0.08em `--ink-3`, `padding 7px 0`, `border-bottom --rule-2`. Rows 13px, `border-bottom --rule`, hover `--accent-soft`.
- Accounts: `1.3fr 1fr .9fr .7fr 1fr`, gap 16, rows `padding 9px 0`; name with "10 TX →" in 10px mono `--ink-4` after it; institution `--ink-3`; balance mono right; 30d in its colour ("flat" `--ink-3`); share as a 56px 2px bar plus 34px 11px figure. Head right "SHARE OF ASSETS".
- Net worth · 30 days: head right "HIGH $247,621  LOW $242,520  AVG $245,107" (values `--ink`), gap 18; plot `1fr 64px` with four y labels; x labels row; legend `margin-top 10; padding-top 10; border-top --rule`: DAILY NET WORTH, 30D AGO $243,020, HIGH / LOW, right "BEST DAY +$2,016 · WORST -$1,184".
- Upcoming · 14 days: head right "SEP 11 → SEP 25"; `82px 1fr auto`, gap 12, rows `padding 9px 0`: date 12px mono with "Mon · in 3d" 10px under; name with "Subscription · monthly · Anthropic" 11px under; amount mono right. Total row `padding 10px 0 2px`: "TOTAL", "4 charges · $67.99/mo in subscriptions" 12px, amount.
- Budgets · Sep 2026: head right "2 OVER 80%" in `--amber` and an EDIT LIMITS mini button (11px 0.08em, `padding 4px 8px`, 1px `--rule-2`); `1fr auto auto`, gap 14, rows `padding 6px 0`: name with "OVER 80%" or "FIXED" 10px mono after it; "$372 / $600" 12px mono (limit `--ink-3`); "62%" 12px in its colour, 44px right; 2px bar `margin-top 5` in the colour with a 1px pace tick at the day of month. Total row `padding 10px 0 0`: "TOTAL · $850 left · pace mark at day 11", "$2,580 / $3,430", "75%".

Drawer: fixed right, `width min(520px, 100%)`, `--bg-elev`, `border-left --rule-2`, `box-shadow -24px 0 48px rgba(0,0,0,.35)`, backdrop `rgba(0,0,0,.45)`. Band 56px `padding 0 24px`: eyebrow "Finance / Accounts / Checking", ESC · CLOSE mini button (`padding 5px 9px`). Title block `padding 22px 24px 0`: h2 26px/400/-0.03em/1, lede 13px `--ink-3` `margin-top 8`.
- Transactions view: three stat cells `margin 18px 24px 0` in a 1px `--rule` box (`padding 12px 14px`, eyebrow, 22px/300 figure): Balance / 30-day change / In / Out for an account; Spent / Used / Remaining for a budget. Budget only: a Monthly limit box `margin 14px 24px 0; padding 12px 14px` with "$" and a 96px right-aligned number input and a hint "per month · $2/day left". Then "Transactions · 30 days" with "N transactions" right, a `64px 1fr auto` header, rows `padding 9px 0`: date 11px mono `--ink-3`; merchant with "Groceries MODEL 0.91" or "Income RULE" under (the classifier in its colour); amount mono, income in `--green`.
- Budget limits view: crumb "Budgets / Settings", title "Budget limits", lede "Monthly limits per category. Spent this month is shown for reference. Changes apply immediately and are never overwritten by a job."; rows `1fr auto auto`, `padding 10px 0`: name with its description under; "$372 · 62%" 12px in the flag colour; "$" and an 88px number input in a 130px cell. TOTAL row. Then an Alert threshold box (`padding 12px 14px`): range 50 to 100 step 5 with "80%" and the line "Categories past this share of their limit are flagged in the digest and count toward "Budgets over threshold"." Footer `padding 16px 24px; border-top --rule`: a save hint left, Reset and Done right.

## Files

- `supabase/migrations/<ts>_finance_settings.sql`: `finance.settings (id boolean primary key default true check (id), alert_threshold int not null default 80 check (alert_threshold between 50 and 100), updated_at)`, one seeded row, grants as the other finance tables.
- `modules/finance/data.ts`: `getAlertThreshold()`; `modules/finance/manifest.ts`: a `set_alert_threshold` tool (guarded like `set_budget`); `modules/finance/jobs/nightly-digest.ts`: `BUDGET_ALERT` becomes the setting and the digest carries `alertThreshold`; `modules/finance/ui/actions.ts`: `saveThreshold`.
- `core/orchestrator.ts`: the budgets clause says "past {alertThreshold}%" from the digest (80 when absent); `core/headline.test.ts`.
- `components/pos/Overlay.tsx`: the artboard's drawer (width, band, title block, backdrop, shadow), keeping the bottom sheet below `md`.
- `modules/finance/ui/FinancePage.tsx`: title block copy and the right-hand line; passes the threshold.
- `modules/finance/ui/Finance.tsx`: tab row hidden at `md` and up (phone segments untouched); KPI strip, the four cards and the chart legend to the measurements; account and budget drawers to the transactions view; a new limits drawer (`?limits=1`); Cancel on an Upcoming row.
- `components/pos/MetricStrip` / `MetricTile`, `DataTable`: only if the strip cannot reach the artboard through props; prefer Finance-local markup for the row grids since the column templates are the artboard's.
- `e2e/screens.spec.ts`: the three finance tests reworked (no tabs); structural asserts; `e2e/seed.mts` if the fixture lacks a flagged budget (it has two) or a next charge.

## Tasks

Commit after each. The threshold and the headline wording get tests first.

### Task 0: Baseline
Plan to `docs/plans/finance-fidelity.md`, decisions logged. Failing e2e asserts in `finance, net worth and the budget pace marks` (desktop): no tab list on the page; the KPI cells read "Net worth", "30-day change", "Due in 14 days", "Budgets over 80%" in order; the accounts header row reads ACCOUNT INSTITUTION BALANCE 30D SHARE; the Budgets head has an "Edit limits" button; an account row's computed padding is 9px 0; the page's title block sub line is the artboard's sentence.

### Task 1: Threshold setting
1. Migration (`supabase migration new finance_settings`, applied with `supabase migration up`, never reset). `getAlertThreshold()` in data.ts. Tool `set_alert_threshold` on the manifest (zod 50 to 100), `saveThreshold` action.
2. Digest: read the threshold, filter `overBudget` by it, add `alertThreshold` to the payload. Test first in `core/headline.test.ts`: a finance payload with `alertThreshold: 90` makes the clause read "past 90%"; absent reads "past 80%".
3. Finance UI reads the threshold from props instead of `ALERT`.
   Check: `pnpm test`; the KPI cell's eyebrow reads "Budgets over 80%". Commit: `feat: the budget alert threshold is a Finance setting`.

### Task 2: Drawer to the artboard (shared)
`Overlay`: right drawer `w-[min(520px,100%)]`, band 56px `px-6` with the eyebrow crumb (caller passes it) and an "ESC · CLOSE" mini button, title block `pt-[22px] px-6` with 26px title and 13px lede (`lede` prop), backdrop `bg-black/45`, the shadow; content area scrolls. Bottom sheet below `md` unchanged. Callers elsewhere (grep `<Overlay`) keep working: `eyebrow` and `title` exist; `lede` is new and optional.
   Check: an existing Overlay user (Tasks or Insurance) still opens and closes in its e2e. Commit: `fix: the drawer to the artboard`.

### Task 3: The page
1. Tab row: `hidden md:hidden`-style removal at `md` and up; the `?tab=` param still drives the phone segments. Desktop renders the overview regardless of `?tab`.
2. Title block and right-hand line, KPI strip (cells on `--bg` with 1px `--rule` gaps, 34px figures, 11px mono lines with "·"), Accounts card, Net worth card (legend row, HIGH/LOW/AVG head), Upcoming card (two-line date and name cells, total line with the monthly subscriptions sum, "SEP 11 → SEP 25" head), Budgets card (single-line rows with the inline flag, "$372 / $600", the pace tick, the total line, EDIT LIMITS). Sync band copy "SimpleFIN · synced 04:02". Cancel on an Upcoming row: an 11px mini button after the amount that calls `setSubscriptionStatus(id, 'cancelled')` with a confirm toast, present only for rows that are subscriptions.
   Check: Task 0 asserts pass; side by side. Commit: `fix: finance overview to the artboard`.

### Task 4: The three drawers
1. Account: crumb "Finance / Accounts / Chase"... as drawn ("Accounts / {name}"), lede "{institution} · balance {x} · {change} over 30 days. Synced nightly from {provider}.", the three stat cells (In / Out summed over the 30 days from the transactions already loaded), the transactions list in the artboard's shape with the classifier word ("MODEL 0.91" in accent, "RULE" in `--ink-3`). Filing: the category label under the merchant is the control (a button that opens the existing picker row), so the artboard's row stays the artboard's row until pressed.
2. Budget: crumb "Budgets / {name}", lede "{description}. Classified by rules first, model second; every transaction shows which.", Spent / Used / Remaining cells, the Monthly limit box with "per month · $N/day left" (remaining divided by days left), the same transactions list.
3. Limits: `?limits=1` from EDIT LIMITS; crumb "Budgets / Settings"; the rows with descriptions and per-row inputs; TOTAL; the Alert threshold box. Edits are held in the drawer: the footer hint counts them ("3 unsaved changes", "No changes"), Reset discards them, Done writes them (each limit through `saveBudget`, the threshold through `saveThreshold`) and closes; Esc or the backdrop with unsaved edits asks before discarding. The budget drawer's own Monthly limit box keeps saving on change, as it does today.
   Check: e2e `filing a transaction teaches the rule` reworked to open an account drawer and file from it; a new limits assertion (open, change the threshold, the KPI eyebrow follows); side by side of each drawer. Commit: `fix: finance drawers to the artboard`.

### Task 5: Proof
`E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --project=desktop --project=mobile --grep "finance"`, then typecheck, lint, unit, full e2e. Pairs at 1440x1240 (page, dark and light) and the three drawers; phone `finance-402-*` checked against PosPhone's Finance frame for chrome only. STATUS.md updated. Commit: `docs: finance fidelity pass`.

## Out of scope
- Other screens; the phone Finance segments (done 2026-09-10 against PosPhone).
- A cancel path for subscriptions not due within 14 days (MCP still has it).
- The artboard's "6 ACCOUNTS" sample count and its synced time: both come from the data.
