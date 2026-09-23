# Finance charts build plan

> **For agentic workers:** one phase is one branch, one PR, one fresh session, run with `/build-phase`. A phase is Done only when its exit checks pass and its PR is merged. Tick task boxes as they finish. Written 2026-09-22 from the owner's report after using the phase 5b cash flow card, through three interview rounds; the twelve answers are under "Decisions" below and go to decisions/log.md when this file lands.

**Goal:** the cash flow card tells the truth about money the owner actually spends, says what its numbers are when you point at them, and every Finance chart covers a window the owner chooses.

**Why now.** The owner has 21 accounts: 7 `other` ($211,951), 3 `retirement` ($192,991), 1 `brokerage` ($64,850), 3 `savings`, 1 `checking`, 4 `credit`, 2 `crypto`. `cashFlowByMonth` sums transactions across every one of them, and an uncategorised row is read by its sign, so a retirement contribution reads as income and a brokerage sale reads as spending. Against $8,420 of actual checking, the card is dominated by money that is not cash flow. The card also draws a net line with no readout: there is no way to learn what any bar is worth, and on a phone there is no way at all, because the shared `LineChart`'s hover is `onMouseMove` only.

**Architecture:** no new patterns. One boolean on `finance.account`, one int on `finance.settings`, both read by the existing request-scoped `cache()`. The account picker is a drawer on the Finance page in the `LimitsDrawer` shape, which is where v1.2 phase 5c put the Rules drawer for the same reason: this is Finance data, not app configuration. Two new unguarded tools. No new dependency and no new chart library: `CashFlow.tsx` stays hand-rolled SVG and `LineChart.tsx` keeps its own.

**Spec:** docs/SPEC.md section 1 Finance and its v1.2 amendments. A "v1.2 amendments" line is added for the account filter and the range in Phase 1.

**Depends on:** v1.2 phase 5c (#124). Phase 5d is independent of this plan and may run before, after, or beside it.

## Global constraints

The v1.2 plan's constraints hold unchanged (docs/plans/pos-v1-2.md, "Global constraints"): rules before model, `is_manual` never overwritten, one schema per module, the Holon design contract, native date inputs, `db push: done` on a PR with a migration, never commit to main, and the standard exit checks for a UI phase (`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, an e2e in `e2e/screens.spec.ts`, ui-verifier at 402 and 1440 in both themes with no Must fix, spec-reviewer before the PR). Not repeated per phase.

Two that bear on this plan in particular:

- **A number on a tile and the number on the card it links to may not disagree.** The v1.1 digest freshness work exists because they did. `netThisMonthCents` is computed from `cashFlowByMonth`, so it follows the account filter by construction rather than by a second rule.
- **`money()` is absolute by design.** Totals that can be negative render through `balance()` or `signedMoney()`. Three bugs in phase 5b came from this family.

## Status

| Phase | Goal | Complexity | Depends on | Status | PR |
|---|---|---|---|---|---|
| 1 Cash flow accounts | The owner picks which accounts are cash flow; investments stop reading as income | medium | 5c | Built 2026-09-22, PR open | |
| 2 Chart readouts | Point or tap any chart and read the number; "Net" becomes "Left over" | medium | 1 | Not started | |
| 3 Time range | One 3/6/12/24 month control in the Finance band, saved | low | 2 | Not started | |

Order matters: Phase 1 is the one that fixes a wrong number, so it ships first. Phase 2 makes the corrected chart readable. Phase 3 changes the window over both. They are not parallel-safe: all three touch `modules/finance/ui/Finance.tsx` and two touch `CashFlow.tsx`.

## Phase 1: Cash flow accounts

Goal: cash flow counts only the accounts the owner marks as cash, and the choice is visible and changeable in one place.
Complexity: medium. Files: migration `finance_cash_flow_accounts`, `modules/finance/data.ts`, `modules/finance/manifest.ts`, `modules/finance/jobs/sync-simplefin.ts`, `modules/finance/ui/CashFlowAccounts.tsx` (new), `modules/finance/ui/Finance.tsx`, `modules/finance/ui/FinancePage.tsx`, `modules/finance/ui/actions.ts`, `modules/finance/README.md`, `docs/SPEC.md`.

- [x] Migration `finance_cash_flow_accounts`: `finance.account` gains `in_cash_flow boolean not null default true`, then `update finance.account set in_cash_flow = false where kind in ('brokerage', 'retirement', 'crypto', 'other')`. On the owner's data that is 13 accounts off and 8 on (checking 1, savings 3, credit 4).
- [x] The same migration adds one category, `('Entertainment', 'Movies, events, games and hobbies', 'expense', false, 23) on conflict (name) do nothing`, the way `People` was added in phase 5c. Shopping is left as it is. No rule is seeded: the owner files merchants into it from the Unfiled list, and anything already filed as Shopping is moved by hand or by re-filing its rule.
- [x] `sync-simplefin.ts` sets `in_cash_flow` from the kind **on insert only**, beside `kind`, which the upsert already omits from its update list for the same reason. A column default cannot vary by kind, so without this a newly synced brokerage arrives `true` and re-inflates the card silently.
- [x] `cashFlowByMonth(months)` joins `finance.account` and filters on `in_cash_flow`. Nothing else changes: the kind rules (income is the income kind, spending is expense plus credit, transfers on neither side, an uncategorised row read by its sign) are untouched.
- [x] `categorySpend`, `categorySeries`, `netWorthSeries`, `listAccounts` and `dueSoon` are **not** filtered. The owner's answer was cash flow card only, and net worth is a balance question, not a spending one.
- [x] `nightlyDigest`'s `netThisMonthCents` follows, because it already calls `cashFlowByMonth(1)`. Assert this with a test rather than leaving it to inspection.
- [x] Tool `set_cash_flow_accounts` on the manifest, unguarded, input `{ account_ids: string[] }`, setting `in_cash_flow` true for those and false for every other non-archived account in one statement. Archived accounts are left alone: the drawer does not list them, so a call could not speak for them. Unguarded because it is a display preference and reversible from the same drawer.
- [x] `CashFlowAccounts.tsx`, the `LimitsDrawer` shape, opened from the cash flow card head on both widths: every non-archived account grouped by kind, each with its balance and a switch, a footer counting how many feed cash flow. Held until Done like the limits drawer, since a change re-reads the chart.
- [x] The card head says what it is counting: "Cash flow · 6 months · 8 of 21 accounts", so an excluded account is never a silent exclusion. The month count stays whatever the card passes today; Phase 3 is what makes it a choice.
- [x] The card footer says plainly that money between your own accounts is on neither side, and that an unfiled transfer may still show. Rules already file `online transfer`, `transfer to` and `transfer from`; 5c and 5d close the rest. No pair-matching heuristic, by decision.
- [x] Tests first: `cashFlowByMonth` excludes an off account's rows; the same account's rows still count in `categorySpend`; `nightlyDigest.netThisMonthCents` matches the filtered card.
- [x] e2e: the drawer lists the accounts with their switches; turning one off changes the card head's count.

Exit: standard; migration pushed (`db push: done`). The owner opens the drawer and confirms the 21 accounts are sorted correctly, in particular the 7 in `other`.

## Phase 2: Chart readouts

Goal: point at or tap any chart and read the number under the pointer, on a phone as well as a laptop.
Complexity: medium. Files: `components/pos/LineChart.tsx`, `modules/finance/ui/CashFlow.tsx`, `modules/finance/README.md`.

- [ ] `LineChart` gains pointer and touch: `onPointerMove` and `onPointerDown` beside the existing mouse handlers, `touch-action: none` on the SVG so a scrub does not scroll the page. The four callers (net worth, category trend, fitness trends, and any later one) get it without changing.
- [ ] `LineChart` gains keyboard: `tabIndex={0}`, left and right arrows move the cursor, Home and End jump to the ends, Escape clears. The existing `aria-label` summary stays, so nothing here is the only way to reach the data.
- [ ] `CashFlow` gains the same interaction over month slots, with a readout naming the month and giving In, Out and Left over. One readout component shared with `LineChart`'s if the shapes turn out the same; two small ones if they do not. Do not build an abstraction for two callers.
- [ ] "Net" becomes "Left over" in the legend, the readout and the footer average. The zero line is labelled, and the footer says what being above or below it means in one sentence.
- [ ] `signedMoney` already reads anything under half a dollar as flat, which is correct here and must not be worked around in the readout.
- [ ] Contrast: the readout is measured at 11px in both themes against the glass surface it sits on, to the 4.5:1 the project asks for.
- [ ] Tests: the readout formatting is pure and tested (month label, the three figures, the flat case). The interaction itself is e2e.
- [ ] e2e: hovering a cash flow month shows its three figures; at 402 a tap shows them; arrow keys move the cursor on the net worth chart.

Exit: standard; no migration. ui-verifier confirms the readout does not clip at either edge of either chart at 402 and 1440.

## Phase 3: Time range

Goal: one control changes the window on both Finance charts, and it is still there tomorrow.
Complexity: low. Files: migration `finance_chart_months`, `modules/finance/data.ts`, `modules/finance/manifest.ts`, `modules/finance/ui/FinancePage.tsx`, `modules/finance/ui/Finance.tsx`, `modules/finance/ui/actions.ts`, `modules/finance/README.md`.

- [ ] Migration `finance_chart_months`: `finance.settings` gains `chart_months int not null default 12 check (chart_months in (3, 6, 12, 24))`. The check is the allowed set, so an out-of-range value cannot be stored by any path.
- [ ] Tool `set_chart_months`, unguarded, input `{ months: 3 | 6 | 12 | 24 }`.
- [ ] `FinancePage` reads `chart_months` and passes it to `cashFlowByMonth` and `categorySeries`. Both already take a month count; neither needs a new shape.
- [ ] A `PillGroup` in the Finance page band, labelled, four pills. It writes through a server action and `revalidatePath`, the shape `saveCountPending` already uses. A round trip is unavoidable because both series are server reads.
- [ ] Phone: the band already carries Sync; the range gets its own row rather than competing for that one. Verified at 402, not assumed.
- [ ] Both card heads say the window they are showing, so a screenshot is self-describing.
- [ ] Net worth keeps its own 30-day daily line and is not wired to this control. It answers a different question and its `spine()` is built on days.
- [ ] The category trend drops from a hardcoded 12 to the setting. Its "every category at once" read (v1.2 phase 5b decision) still holds at 24 months: about 20 categories by 24 months is 480 numbers, one read.
- [ ] Tests: the tool refuses a value outside the set; `cashFlowByMonth(24)` returns 24 months of spine including empty ones.
- [ ] e2e: choosing 3m narrows both cards and the choice survives a reload.

Exit: standard; migration pushed (`db push: done`).

## Decisions

From the owner's interview of 2026-09-22, three rounds, twelve answers. These go to decisions/log.md when this file lands.

1. **Per-account toggle, not by kind.** The 7 `other` accounts hold $211,951 and a kind rule cannot guess them, so the switch is per account. Rejected: one switch per kind; a kind default with per-account overrides (two mechanisms for one question).
2. **Scope is the cash flow card.** Budgets, the category trend, the digest's other figures and net worth keep reading every account. Rejected: filtering every spending number (budget figures would move under the owner with no warning); filtering net worth (it would drop $357k of real assets off a balance question).
3. **Ranges are month counts.** 3, 6, 12, 24, default 12. Cash flow stays monthly bars and only their number changes. Rejected: day ranges with the cash flow card re-bucketing to weeks (a partial first week draws as a collapse in income and needs its own handling); day ranges with cash flow rounding to months (the control would mean something different per card); a 1-month option (one bar is not a comparison, and Budgets already answers that).
4. **"Net" becomes "Left over", against a labelled zero.** Rejected: dropping the line and leaving the figure to the readout (the trend across months is the reading); a third bar per month (cramped at 402 and the sign flip is harder to follow).
5. **The range control is Finance-wide and saved in `finance.settings`.** Rejected: a core setting every module reads (it would have to reconcile or remove the fitness trends tab's own 30/90/365 control, which is a different question); URL-only state that resets each visit.
6. **Touch and keyboard go on the shared `LineChart`, not only on the new card.** Net worth, the category trend and fitness trends all gain tap-to-inspect from one change. Rejected: cash flow only (the trend sits beside it and would still be mouse-only on a phone); pointer without keyboard (against the project's own accessibility line).
7. **Investments start off, and so does `other`.** A wrong "on" overstates spending silently, while a wrong "off" is visible in the card head's count. Rejected: everything on (the reported bug would still be on screen after the deploy); `other` on (it is $211,951 of probable holdings).
8. **The picker is a drawer on the Finance page.** Same reasoning as the Rules drawer in v1.2 phase 5c: Finance data, not app configuration, and it belongs beside the chart it governs. Rejected: a Settings tab (two clicks from the chart, and it splits Finance configuration across two places); a switch per account drawer (21 drawers, and nowhere showing the whole picture).
9. **The dashboard tile's "net this month" follows the filter.** It is computed from `cashFlowByMonth`, so the alternative is a tile and the card it links to printing different numbers for the same words. Rejected: holding the tile to the old figure for strictness.
10. **Internal transfers are left to the rules.** The built-ins already file `online transfer`, `transfer to` and `transfer from`, and 5c and 5d close the rest; the card says so in its footer. Rejected: automatic matching-pair detection (a heuristic with its own false positives that the owner can neither see nor correct); a warning count of uncategorised rows in the window (useful, but it belongs with the model arm's leftovers, not here).
11. **Three phases, three PRs**, accounts first because that is the one that fixes a wrong number. Rejected: two phases; one PR touching a shared component used by four charts plus two settings behind one check.
12. **`in_cash_flow` is set from the kind on insert in the sync job.** A column default cannot vary by kind. Rejected: a nullable column meaning "not decided" with the read falling back to a kind rule, which is a second rule to hold in mind for a question the drawer answers directly.
13. **Entertainment is its own category, added in Phase 1's migration.** Asked for by the owner on 2026-09-22 while filing the Unfiled list. An expense kind, so it counts as spending and can carry a budget. Rejected: renaming Shopping to "Shopping / Entertainment" (one budget line would hide which of the two went over); a phase of its own (one insert, and Phase 1 already ships a migration).

## Not in this plan

- Matching-pair transfer detection.
- An account filter on the category trend, on budgets, or on net worth.
- A 1-month range, a year-to-date range, or a custom date range.
- Any change to the net worth chart's 30-day daily window.
- Reconciling the fitness trends tab's own 30/90/365 control with this one.
