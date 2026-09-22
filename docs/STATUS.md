# Status

Where the build actually is. Updated at the end of each step. Read this first
in a fresh session; the paragraph below names the plan that comes next.

**Current plan: docs/plans/pos-v1-2.md** (2026-09-20). Sixteen phases from
the owner's first day on Holon: the digest and passkey diagnosed, the reported
module bugs, an Errors tab, an affordance and contrast pass behind a mockup
gate, required-field errors and keyboard submit, Finance re-pulled with
transfer and credit categories and three new views, a Calendar module fed by
every module and by Google, Apple and Gmail read-only, recurring tasks,
manual entry on every module, and a semver release with notes. Decisions in
decisions/log.md under 2026-09-20. docs/plans/fitness-workout-detail.md
(approved #98) runs inside its Phase 8 slot as its own two PRs. Version
scheme starts here: `package.json` is 1.1.0 and today's main is tagged
v1.1.0 after this PR merges; this plan ships v1.2.0.

**Holon shipped 2026-09-20.** docs/plans/holon-product-redesign.md, Phases 0
to 7 (#74, #76, #79, #82, #83, #86, #88, #91, #93, with `main` synced in by
#92 and #94), released to `main` as merge commit edcb1ad (#95) and deployed.
After it on `main`: #97 (Health Auto Export needs two automations), #98 (the
fitness plan), #99 (the collapsed rail centres its icons and the theme
control fits). One owner check stays on the phone (OWNER-TODO 23).
docs/plans/phone-polish.md (2026-09-14) is done: all five items are in the
code (`aria-labelledby` from the eyebrow in Overlay, `phoneLimit` in Inbox,
`md:min-w` on the Tasks Calendar, `max-md:bottom` on the globe legend, the
trip drawer footer on `ink-2`). v1.1 below is complete.

**Queued alongside v1.2: docs/plans/finance-charts.md** (2026-09-22, three
phases from the owner's first day on the phase 5b cash flow card: a per-account
`in_cash_flow` switch so investments stop reading as income, a readout on hover
and tap with "Net" renamed "Left over", and a 3/6/12/24 month range saved in
`finance.settings`). Phase 1 also adds an `Entertainment` expense category
(#127). 5c is closed; independent of 5d. Not started.

**Queued after v1.2: docs/plans/skills-v2.md** (2026-09-15, six phases from the owner's Skill Tree rewrite in docs/SKILLS.md: the nine-attribute tree, per-event XP snapshots, projects, challenges and achievements, the digest, the screen). Not started.

**Previous plan: docs/plans/pos-v1-1.md** (2026-09-14, from /adopt-repo). Twelve
phases from the owner's first week of live use: diagnosis and small bugs, the
notes stub deleted, server and client speed, dashboard layout and freshness,
goals > projects > tasks, the skill picker, skill tree gestures, travel
destinations, the net worth chart, fitness trends and history, hardening.
Decisions in decisions/log.md under that date; DECISIONS.md carries the
production readiness table. Also merged 2026-09-14 and not yet written up below:
docs/plans/brain-capture.md, all three phases (#48, #49, #50): the capture box,
hubs, related notes and file capture with transcription.

Last updated: 2026-09-22 (v1.2 phase 5c closed at 3 uncategorised rows; #126 and #128 merged; 5d deferred). Production `pos-gilt-rho.vercel.app`
live since 2026-09-13 with the owner's bootstrap done (docs/OWNER-TODO.md
steps 1 to 9). Latest merged: docs/plans/brain-capture.md, all three phases,
#48, #49 and #50 (see Done). Three plans finished earlier this week: docs/plans/phone-shell.md
(five phases: speed and gestures, the shell, then Dashboard, Finance, Tasks
and Goals phone passes, PRs #21, #27, #33, #34, #36), docs/plans/travel-globe.md
(filled continents, pin taps, destination geocoding, #26, #28, #29), and the
backend-live plan's code phases (#13, #17, the cron-silence check). CI runs
again: the repo is public, `upload-artifact` keeps the hidden Playwright
results, and the e2e suite waits for hydration and signs in with the six digit
code (#35, #37, and docs/plans/mobile-login.md). The plan after that is not
written yet; the candidates are a phone
polish pass for the items the UI checks flagged (phone Home height, the
globe legend under the controls at 402, the Calendar grid width, Overlay's
missing accessible name, the ink-3 and ink-4 contrast tokens) and a phone
pass per remaining module, which docs/plans/phone-shell.md names as its
follow-on. Waiting on the owner: OWNER-TODO steps 12 to 16 (Obsidian vault,
SimpleFIN, the Health readings Shortcut, workouts, push on the phone). Steps
17 to 21 closed on 2026-09-14: the pooler, auth mail through Resend, the sign
in email template and OTP length, and passkeys, which are enabled and enrolled
against the Vercel domain. Laptop notes: `.env` has no VAPID pair, so `pnpm setup`
and the push Devices e2e test fail locally; the same test is the only red
one CI carries as well until the pair is added to the secrets.

## Next: finance-charts Phase 1

**5c is closed.** The owner filed the Unfiled list by hand on 2026-09-22. What
is left uncategorised is 3 rows, all AMC Theatres, held for the Entertainment
category that finance-charts Phase 1 adds: about 0.4 percent of a ledger of
about 700 rows (owner-reported from the Rules drawer, not queried). Two fixes
made the filing possible: #126 (each Unfiled line shows its transactions, which
way the money went, and three-letter names such as REI are learnable as whole
words) and #128 (the Finance tabs at every width so the desktop has a
Transactions list, a search over the whole ledger, and the account on each row).
**5d is deferred:** with the backlog filed by hand, the model arm has little to
do. Revisit if new merchants pile up in Unfiled. After Phase 1 ships, file AMC
Theatres as Entertainment.

Follow-ups from #126 and #128, not scheduled: the Travel "a trip holds a list of
destinations" e2e test sits near its 5 second wait on CI (the Create action took
5.06s once); `balance()` prints "-$0" for a group of a few cents; an account
drawer lists the loaded rows, not all of the account's (68 of 205 for one card);
the Rules button wraps at 402; Subscriptions amounts do not align at 1440; the
Finance tabs take no arrow keys.

### What 5c built

Phase 5c (#124). Rules are now visible and
changeable in a drawer, writing or deleting one re-files the history it
matches, money to a person is a `People` expense rather than an `Account
transfer`, and the Transactions tab has an All / Uncategorised / Pending filter
with the ledger's own counts. The nightly `categorise` sweep takes 5000 rows a
run rather than 500, so the backlog clears in one night. **Owner check after
merge: the uncategorised share. It was 97.6 percent (607 of 622) and the exit
criterion is below 10 percent, which needs the 172 merchants filed or confirmed
in the Rules drawer.** 5d is the model arm that files what the rules miss.

## The finding behind 5c and 5d

Planned 2026-09-22 from a three-round interview; the twelve decisions are in
decisions/log.md under that date and the phases are in docs/plans/pos-v1-2.md.
The finding behind them: **607 of 622 real transactions (97.6 percent) have no
category**, across 172 distinct merchants. `BUILTIN_RULES` is eleven patterns
and every one is a payment, a transfer or a credit, so nothing files an
ordinary purchase; `finance.category_rule` has no screen, no edit and no
delete; and `listTransactions` has no filter, so the uncategorised rows cannot
be found in the app. A $1,382.45 Zelle to a person is filed `Account transfer`,
whose kind is never counted as spending.

5c is deterministic: a migration for rule provenance and a `People` category,
one `rules.ts` that back-files without touching `is_manual`, peer payments
sorted ahead of the transfer patterns, a Rules drawer, and an Uncategorised
filter. 5d adds one batched Haiku call for what the rules miss, about $0.012
for all 172 merchants and under a cent a month after; at 0.8 it writes a rule,
below it the merchant is listed unfiled, and peer descriptors never leave the
machine.

## Done

**v1.2 Phase 5b: Finance, three new views** (2026-09-22, branch
`phase-5b-finance-views`). The corner under the accounts table was empty at
1440 while the column beside it ran on; it now holds cash flow and a category
trend. `cashFlowByMonth(6)` puts 5a's kinds to work (income is the income kind
with its sign flipped, spending is expense plus credit, a transfer is on
neither side, an uncategorised row is read by its sign) and returns every month
of the window so a quiet month draws as zero rather than vanishing.
`categorySeries(12)` sends every expense category down with the page, so the
trend card's select is a re-render and not a round trip; `LineChart` gained one
`unit` prop so a month axis says "12 months", "Monthly dining" and "Best
month".

The due list did not become a fourth card. The existing Upcoming card read
`finance.subscription` only, and nothing promotes a detection into a
subscription outside the demo seed, so on production it was empty while the
detector had rows. `dueSoon(14)` reads both, deduped, and the card gained a
Balance after column; the nightly digest reads the same function, so the
dashboard tile and the screen it links to can no longer disagree about what is
due. `runningBalance()` lives in `money.ts` and runs on the client over the
filtered list, because cancelling a charge has to correct every balance below
it. Only a curated subscription keeps its Cancel button: the nightly job would
write a detection straight back. The digest also gained `netThisMonthCents`,
which the Finance tile head now leads with.

The ui-verifier found four things worth the record. `compactMoney` dropped the
sign below $1,000, so the cash flow axis labelled its negative floor "$740";
that is shared with the net worth and fitness charts and was fixed in
`money.ts`. The first colour pair failed WCAG 1.4.11: sand is 1.81:1 on a light
card and `--chart-1` at 0.55 opacity was 1.86:1 on a dark one, so the bars are
`--chart-3` and `--chart-1` at full strength and measure 4.14:1 or better in
both themes. Both new cards in the left column ran it 511px past the right, so
the trend moved under Budgets: the columns now measure 1461 and 1461 and the
page grows 380px, one card's height. And Cancel moved ahead of the amount in an
Upcoming row, because a button after it inside the same cell pushed the amounts
of the rows that still have one 69px out of their column.


**Fix: the SimpleFIN sign and the budget drawer's list** (2026-09-22, branch
`fix-finance-sign-and-drawers`). Found on production the morning after 5a
merged: purchases read as green incoming amounts on every account. SimpleFIN
sends money out as negative ("positive numbers indicate money being deposited
into the account"), this schema says positive is money out, and nothing
flipped between them, so every pulled row was inverted. Budgets summed to
nothing, `detectRecurring` skipped every real charge as income, and the
digest's unusual list named deposits. One negation in
`integrations/simplefin/client.ts` (now `parseAccounts`, pure and tested),
plus migration `20260922120000_finance_simplefin_sign` correcting the stored
rows and emptying the derived `finance.recurring` for re-detection. Balances
are untouched: a card owed is negative in both conventions. Second bug from
the same report: a budget drawer listed the page's 60 most recent rows
filtered by category while its Spent figure was a month-to-date SQL sum, so
rent's charge vanished behind newer rows. The page now also loads this month
in full and the drawer lists exactly the rows behind the figure, captioned
"Transactions · this month"; the main list no longer claims "30 days".

**v1.2 Phase 5a: Finance, full pull, pending, categories** (2026-09-21, branch
`phase-5a-finance-pull`). `finance.category.kind` (`expense`, `income`,
`transfer`, `credit`) with eleven categories added and `Transfer` renamed
`Account transfer`; only the expense kind is a budget, and the list shows the
ones with a limit or spending this month. Spent skips pending rows unless the
new `count_pending` setting is on (Budget limits drawer); rows carry a
`Pending` chip. `BUILTIN_RULES` file both sides of a card payment and the
transfers, `categorise()` also catches a descriptor naming one of the owner's
card institutions with a payment word, and `matchRefund` files money back on a
card into the category of the charge it matches, else Refund. Recurring
detection and the digest's unusual list skip transfers. `sync_simplefin` takes
`{ days }` and reports the count and oldest date per account; the band has a
Pull 90 days pill and prints that line under its clock. Filing a row by hand no
longer learns a rule; the row offers "Always file {merchant} as {category}" and
Always calls `finance.learn_rule`. Production 90-day counts: not yet run
(OWNER-TODO 27); the numbers go here when the owner has compared one account
with the bank.

**v1.2 Phase 4: forms, required fields and keyboard** (2026-09-21, branch
`phase-4-forms`). A missing or invalid field is named at the field: `Field`
in `components/pos/FormField.tsx` wraps one control with `aria-invalid`,
`aria-describedby`, a red border and the message under it at 12px;
`useFormErrors` derives the messages from the draft after the first attempt
and focuses the first invalid control; `submitOnModEnter` makes Cmd or Ctrl
Enter submit from a textarea. A footer Save is `type="submit" form={formId}`
and is no longer disabled for a missing field, so Enter submits from any
single-line input and the button can say why it refused. `Overlay` focuses
the first field on open and asks before discarding a dirty form on Escape or
a dim tap. `callTool` throws `ToolInputError` with one message per field
from the zod issues, and every action's `failed()` passes `fields` through;
the toast reads "Title is required" instead of a JSON array. Swept: task,
goal, idea, trip, policy, fitness plan, log service, log a visit, capture
and projects. The recipe form waits for Phase 12. e2e: the task form's
missing title, Enter and Tab order, both projects.

**v1.2 Phase 2: Errors tab and diagnostics** (2026-09-21, branch
`phase-2-errors-tab`). One place to read what broke without Vercel:
`/agent-log/errors` (a second Agent log route behind a Log / Errors tab row)
lists request_log rows at 400 and above, the failed jobs inside partial and
failed runs, and the new `core.client_errors`, which `error.tsx` and
`global-error.tsx` post to `/api/client-error` (owner cookie, zod, the
limiter, `maxDuration` 10). Range (24h, 7d, 30d) and module filters are
links; every row has a Copy pill (the connections `Copy` moved to
`components/pos`). `core/errors.ts` is the one reader. Settings gains a
read-only Diagnostics card: version from package.json through
`NEXT_PUBLIC_APP_VERSION`, database round trip, connected providers by name,
Vercel region. `recordError` in `core/log.ts` writes an `internal` 500 row
where a catch hid a failure (`readMetric`, the review registry, the embed
job, `reclassify`); the other sixteen grep hits are parser fallbacks and
stay. Nightly prune adds `client_errors` past 30 days.

**v1.2 Phase 3c: motion and row swipes** (2026-09-21, branch
`phase-3c-motion-swipes`). On the phone a route change is an iOS push or
pop and a tab change a cross-fade; the desktop keeps the reveal stagger.
Push and the fade are React `ViewTransition` (`components/pos/PageTransition.tsx`
keyed by pathname in the app layout, `transitionTypes` on the capsule's
links and scrub). Pop is not: React flushes a transition started in a
`popstate` event synchronously and never animates it, measured with and
without a tagging listener, so `goBack()` wraps `history.back()` in the
browser's `startViewTransition`, names the leaving page inline and keys the
CSS off `html[data-nav="back"]`; BackControl and EdgeBack call it. The page
column took main's padding, `min-h-dvh` and the canvas colour below md so
each snapshot is one opaque card. `SwipeRow` is Board's gesture lifted out:
Tasks right completes and left snoozes to tomorrow (a done row's left still
reopens), Review right approves and left dismisses on pending unguarded
cards, Notifications right reads and left snoozes a day, with `listAlerts`
now leaving snoozed rows out. Owner phone check pending; the plan's ceiling
stands: Safari may differ on transition types and no animation is the
fallback.

**v1.2 Phase 3a: the look mockup gate** (2026-09-20, branch
`phase-3a-look-mockup`, approved by the owner on the before-and-after page
the same evening). The token pass was a measurement, not a change: `--ink-2`
and `--ink-3` already clear 4.5:1 on the canvas, the elevated surface, the
composited glass and the sunken fill in both themes (lowest 5.5:1, light
ink-3 on `--bg-deep`), and `--ink-4` is placeholder ink that #111 raises. The
treatment lives in four primitives and one base rule: the secondary button is
a 1px `--rule-2` border on `--bg-elev`; ghost buttons and the drawer's close
cross take the border on hover; `button:not(:disabled)` and `[role="button"]`
get the pointer in `app/globals.css` (Tailwind v4's preflight gives buttons
the default cursor); disabled is 50 percent; interactive rows and the new
`CardLink` hover with a 6 percent ink tint and end in a chevron (the plan's
`--bg-elev` did not read on the light glass, and `--bg-deep` made the chips
vanish). Row is shared, so every interactive row on every screen has the
chevron and the new hover; the three Finance overview rows that drew their
own arrow in `right` dropped it. Screens are otherwise untouched, and 3d
spreads the treatment to the raw buttons, `DataTable` rows and the
title-only cards. Shot script and pairs under `e2e/.scratch/look/`; the
e2e assertion on pointer, border and fill is 3d's, as its checklist says.

**v1.2 Phase 1b: the seven reported module bugs** (2026-09-20, branch
`phase-1b-module-bugs`). Four of the seven causes in the plan were guesses
that the code did not bear out, and each was re-diagnosed before the fix:
the budget minus was a net-credit month reaching a raw ratio (`percent`
floors at 0, `budgetTone` carries the copy and tone for every row, name and
number coloured together); the "phantom" skill event was a completion logged
under a task's old name, since `core.entities.title` was written only at
creation (a rename now reaches it, and the events list reads the live title
first); the date glyph was fine in Chromium but dark on the owner's dark
Chrome (a CSS mask in `currentColor` now draws it); the Projects select
already read from props, and what was slow was a new project waiting for the
server (the board holds an optimistic list, 30 ms to a row). The three that
matched the plan: the accounts head reads "30d change" with "no history yet"
and a title on both, the Health card reads `byType.health`, `dental` and
`vision` from the Insurance digest and nothing else, and a picked destination
empties its suggestion list instead of refetching it. Seven checks, one per
bug: three unit tests, one against pos_test, three e2e assertions (the date
glyph by pixels, since Chromium hides that pseudo-element from
`getComputedStyle`), and the Projects wait measured before and after. Also
in this PR, because main's `screens` job was red under it: the `Passkey
removed.` toast #106 dropped and #108's test expects is back, and the Review
dismiss test waits on the toast rather than the optimistic chip, whose early
appearance let the next navigation abort the dismissal and, through
Playwright's reseed on worker restart, fail `inbox clear` behind it.

**v1.2 Phase 1a: the nightly digest and the passkey, diagnosed** (2026-09-20,
branch `phase-1a-digest-passkey`). Two causes, both from evidence.

The digest. Every nightly email from 2026-09-16 to 2026-09-20 (six, in the
owner's inbox from `onboarding@resend.dev`) carries one alert:
`notes.nightly_digest failed. Check the Agent Log and retry it.` No such job
exists: the notes stub module was deleted in v1.1 Phase 2 (#56, merged
2026-09-15 12:52 UTC) and its migration `20260915060000_notes_drop.sql`
deletes the module's `core.jobs` rows. The 09-15 emails show the order of
events: the 09:02 cron run failed on `brain.*` (migrations behind the code,
the db push gate's origin) and `core.digests`; a Run now at 12:14 UTC, on the
build still deployed before #56 merged, ran the notes job against the schema
the push had already dropped, and `runJob`'s upsert wrote
`notes.nightly_digest = failed` back. Nothing has run that job since, so the
row never changed, and `buildSummary` reads every `core.jobs` row with
`last_status = 'failed'` as a live failure. The dashboard's corner line
counted it the same way. Not a job failing: a row that outlived its job.
Fix at the cause: the nightly `prune` stage now also deletes `core.jobs`
rows for jobs nothing registers (`pruneStaleJobs` in core/jobs.ts, module
manifests plus the six core stages), and runs before `orchestrate` so the
first run after deploy is already clean. The corner line reads the last
`core.job_runs` row ("Nightly ran at 04:12 CDT, partial, 2 of 14 jobs
failed") rather than the standing state of every job, which is what Settings
already did. After this deploys: press Run now once; the alert is gone from
that run on.

The passkey. Not reproduced on the owner's Mac (no report text yet), but the
local stack showed two things. The passkey ceremony had never run against a
dev server: the CSP `connect-src` allowed `*.supabase.co` only, so the
browser refused `http://127.0.0.1:54321` (fixed in next.config.ts from
`NEXT_PUBLIC_SUPABASE_URL`; production unchanged). And GoTrue's answer to a
credential the project does not hold is `webauthn_verification_failed`
("Credential verification failed"), not the `webauthn_credential_not_found`
the button was mapping, so the raw message was what the button showed for a
passkey removed in Settings or made against another project. Built
regardless of the Mac's cause: the login page offers a synced passkey in
the email field (`autocomplete="username webauthn"` and a conditional
mediation `navigator.credentials.get`, through GoTrue's two-step API with the
WebAuthn Level 3 JSON methods), the button names the refusal, and a passkey
made in Settings is named after the browser that made it ("Safari on
iPhone"), the only record Supabase keeps of where one came from. Three e2e
tests drive Chromium's virtual authenticator over CDP through both sign-in
paths and the refusal. Enter already submits the email form (asserted);
the code field keeps not submitting on a digit count, by the 2026-09-14
decision.

**Apple Health, nine months in, and what the data surfaced** (2026-09-19,
five small PRs off main, each merged the same morning). The owner's manual
Health Auto Export of 2026-01-01 to 2026-09-19 (64 MB, 58 metrics, 217
workouts) went through `scripts/hae-backfill.mts` twice: once after #84 and
again after #89. Every mapped metric arrived in the units the parser expects.
#84: sleep stores the smaller of the `sleepStart` to `sleepEnd` span and the
summed hours and skips a night over 14 h in both (Eight Sleep inflates each
on different nights; 10 of 225 skipped), and pool swims arrive in yards.
#85: the Recent workouts head counts Apple Health rows as APPLE HEALTH
rather than BY HAND, a trend whose readings never go below zero keeps its
axis at zero, and `strength` joins the Strength keywords so Apple's
"Traditional Strength Training" places by rule. #87: the workout list pages
by 40 with Show more and the tab badge counts every workout; swims read in
yards with pace per 100 yd. #89: `distance_m` is `numeric(10,2)` (a 625 yd
swim read as 626 from whole metres), pushed by the owner before the merge.
Then this branch: `SyncBand`'s clocks and the workout list's dates were
formatted in the renderer's zone, which on Vercel is UTC, so the band said
"arrived 16:44" for an 11:44 arrival and a load that hydrated differently
logged React #418; both now take the owner's timezone from `core.settings`
through `core/clock.ts`, a pure module a client component can import. Two
stale sleep rows from the 09-18 import (nights the new rule skips, so the
upsert never touched them) were deleted by hand in the dashboard SQL editor.
Verified on production after each merge: 217 workouts, steps high 32,193,
swims 600 to 750 yd exact, sleep 365-day high 13h39m.

**v1.1 Phase 12, hardening** (2026-09-15, branch `phase-12-hardening`). The
last v1.1 phase; the plan is complete once its PR merges. `app/error.tsx` and
`app/global-error.tsx` show the headline, Next's digest and a Try again over
`retry()`. The `check` CI job runs `pnpm audit --prod --audit-level=high`
after install. Main is protected: `check`, `screens` and `migrations` must be
green, admins included, so GitHub refuses a red merge where the rule was
manual before. `maxDuration` is 60 on the MCP route and 30 on the webhook and
both OAuth routes. `backup.yml` mirrors every storage bucket into
`storage/` of pos-backups beside the dumps, which needs two repo secrets the
owner adds, `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF`; the first
04:10 UTC run after that proves it. docs/RESTORE.md carries the restore
command (drilled against the local stack) and docs/SETUP-SUPABASE.md a
Rotating a secret table. After this: OWNER-TODO steps 12 to 16, then
docs/plans/skills-v2.md.

**v1.1 Phase 11, fitness** (2026-09-15, branch `phase-11-fitness`). The
net worth chart's drawing is now `components/pos/LineChart.tsx` (its own
client file, the crosshair needs state) over `spine()` in `core/series.ts`,
with `NetWorthChart` a wrapper that passes the money formatters. Fitness gains
a Trends tab (metric select, 30/90/365, weight's thirty days rendered with the
page and the rest through `readMetricSeries`), a filter row on Workouts
(kind, source, from, to; the URL written locally, the rows from
`readWorkouts` over the same `screenWorkouts()` the page renders from), a
`PlanDrawer` over `write_plan` through `callTool` (New plan on the empty
state, Edit on the card head; item notes carried, not edited), and the band's
"Apple data last arrived <when>" from `core.request_log` on its own line
beside Strava's clock. The demo seed writes 14 weight readings over 40 days.
Four e2e tests: Trends counts 10 of 30 and 14 of 90 recorded, the filter
narrows and survives a reload, the plan drawer adds a day and removes it, and
a weight posted to the Health Auto Export webhook (secret read from the
Connections card) shows on `/health` and moves the band's Apple line. Health
Auto Export connected by the owner 2026-09-18, and the same day a 90-day manual
export (2026-06-20 to 2026-09-18) went through `scripts/hae-backfill.mts` (#75):
the app's REST automation cannot send a custom range, so history is a manual
export posted a month per request with workout series stripped. The real
payload corrected two guesses: sleep is the `sleepStart` to `sleepEnd` span
(Eight Sleep's overlapping records made `totalSleep` two to three times the
night) and stand hours read `apple_stand_hour`, not `apple_stand_time`
(minutes). Verified on production: 39 workouts, steps and sleep unbroken over
90 days. Known: two zero rows from earlier tests (weight, body fat) and the
fitness goal tile printing its value unrounded. Phase 12 (hardening) is the
last v1.1 phase.

**Health Auto Export backfill, argument handling and a sleep report**
(2026-09-18, branch `claude/review-merge-open-prs-ccceog`). Two fixes to what
PR #75 shipped. `scripts/hae-backfill.mts` parsed its arguments by taking the
first token that did not begin with `--`, so `--url <url> export.json` read the
URL as the export file, and a misspelled `--dryrun` was ignored and the export
went to production for real; `parseArgs` in the lib now consumes `--url`'s value
and refuses a flag it does not know. `--sleep` prints every sleep point in an
export with its span, the hours the app summed, time in bed and the minutes the
webhook would store for that day, and sends nothing. It runs `toBodyMetrics`
itself, so it prints what would be stored rather than a second implementation of
it. Still open, and the reason the report exists: the real export's nights ran
297 to 1098 minutes, and 1098 is 18.3 hours. The report names the cause, because
a day carrying two sleep points keeps the last of them, so an afternoon nap can
outrank the night it shares a date with, while a single point means the span
itself is that long. Resolved 2026-09-19 against the nine-month export
(2026-01-01 to 2026-09-19, 58 metrics, 217 workouts): every mapped metric
arrived in the units the parser expects; sleep now stores the smaller of the
span and the summed hours and skips a night over 14 h in both (10 of 225
nights, all Eight Sleep); pool swims arrive in yards and were stored as 0 m.

**v1.1 Phase 7b, skill picker, remaining drawers** (2026-09-15, branch
`phase-7b-skill-picker-rest`). The same `SkillPicker` block on the trip,
policy, recipe, home asset, health appointment and health record drawers,
and under a workout row on the Fitness table, which expands when pressed
while its Skill column keeps the first name. Each page adds
`listSkillLinks(module, type)` and `getSkillNames()` to its `Promise.all`;
no data file changed, because the 7a reader already returns the entity ref
by the module's own id. Entity types with a registry row but no drawer, so
no picker: fitness `plan`, home `service_log`, health `screening`. The demo seed now registers
its two health records, as the write tool does, so they take a link too.
Inherited and left for the token pass: the fallback paragraph's `ink-4` at
12px fails AA, the same class 7a shipped on four drawers.

**v1.1 Phase 7a, skill picker, core and the four chip sites** (2026-09-15,
branch `phase-7a-skill-picker`). Two tools on the tree module, `skills.link`
and `skills.unlink`: a link by hand is the row a reassign writes (confidence
1, `human`, `is_manual`), and it clears a parked `unclassified` marker. One
reader, `core/skill-links.ts` `listSkillLinks(module, type)`, a map of every
registered entity to its `entityRef` and named chips; the five copies in the
tasks, goals, brain, ideas and fitness data files are gone, and `fitnessGoal`
reads through it too, so `from core.skill_links` appears only under
`modules/skills`. `components/pos/SkillPicker.tsx` renders on the task, goal,
idea and note drawers: chips link to the tree, carry a MANUAL / RULES / MODEL
badge, an x unlinks, a plus opens a native select of the unlinked skills,
optimistic both ways. Unlinking an automatic link leaves no row, so a later
classify() can put it back; only a manual row is protected. Phase 7b adds
the same block to trips, policies, recipes, workouts, home assets and health
records; the fitness page no longer needs `getSkillNames()` until then.

**v1.1 Phase 8, skill tree gestures** (2026-09-15, PR #65, built in a
Claude Code web session). On the phone a drag down the sky offered to refresh, a
drag from the left edge went back, and a second finger did nothing. Three
causes: `PullToRefresh` listens on `document`, `useEdgeBack` on `window`, and
`Constellation` kept one drag origin. Both canvases now carry
`data-gesture-surface` and the two listeners ignore a target inside one
(the `closest()` clause `PullToRefresh` already used for an open sheet).
`Constellation` keeps the globe's `pointers` Map: one pans, two pinch about
their midpoint, 4 px slop, no pointer capture so a star tap still selects.
`pinch()` in `modules/skills/ui/view.ts` is unit tested (scale, midpoint held,
clamp, identity when the fingers share a point). The mobile e2e covers the
one-finger half. Pinch confirmed on the owner's phone 2026-09-18 (Playwright cannot
send two touches). Not verified: the ui-verifier pass at 402 and 1440.

**v1.1 Phase 6, goals, projects, tasks** (2026-09-15, branch
`phase-6-projects-goals`). `tasks.project.goal_ref` (migration
20260915160000, backfilled where a project's open tasks all agreed). A task
counts toward its own goal, else its project's: one expression,
`coalesce(t.goal_ref, p.goal_ref)`, in the board SELECT and in `listByGoal`,
which the `linked` seam reads, so the board and the Goals drawer cannot
disagree. New `write_project` tool (name, goal_ref, archived) behind a
`ProjectsDrawer` opened from a Projects button in By project. The task drawer
binds its Goal select to the task's own goal and captions what it inherits;
Due gains "Pick a date" with a native date input. Every droppable column
header carries a plus that opens New task prefilled from the column's drop
spec; the band's New task and the phone plus take the view's first column.
Known: dragging an inheriting task onto "No goal" clears its own goal but it
still inherits, so it stays put.
**v1.1 Phase 5, dashboard** (2026-09-15, branch `phase-5-dashboard`, built
in the worktree `../pos-phase-5` beside Phase 6). The bento's layout is one
`dashboard_layout` setting (`{ order, hidden }`) in `core.settings`, saved
through `saveDashboardLayout` in `app/(app)/shell-actions.ts`; the localStorage
store is gone. Arrange mode adds Hide beside the arrows and a Hidden row under
the grid with Show buttons; Reset saves null. Grid rows are `auto` and tiles
no longer stretch, so a tile is as tall as its content. `callTool` recomputes
the calling module's digest after every tool but `get_digest`
(`writeDigest` in `core/digests.ts`, try/catch, never fails the write), and
the page's module tiles map over `latestDigests()` filtered to enabled
modules instead of `summary.modules`; headline, alerts and Last run stay on
the nightly summary. Nightly `prune_digests` keeps every row from the last two
days and the newest per module per day past that. `core.notifications.href`
(migration `20260915150100_core_notification_href.sql`): insurance reminders
open `/insurance`, the digest row opens `/notifications`, and every warning
title on the dashboard is a link. After `supabase db push`, the Notes tile
from Phase 2 is gone at once: the tiles no longer wait for a run.

**v1.1 Phase 4, speed, client** (2026-09-15, branch `phase-4-speed-client`).
`useSearchState.set` takes `local: true`: the URL is written through
`window.history.replaceState` and the router is not asked. Tasks view tabs,
the phone filter pills and the expanded row, Finance segments and the three
Overview rows, and Fitness tabs use it; drawers keep `push` and the router so
a close after a write still refetches. The four view clicks in "tasks, the
six views" went from 4 RSC requests to 0 and the e2e now asserts zero. Tasks
`Calendar` and `TaskDrawer` load through `next/dynamic` (dev tasks chunk 236
to 136 KB; the Calendar chunk, 30 KB, loads on the first click). Paint time
was already instant before this phase (the override store rendered the view
ahead of the fetch); the numbers are in docs/plans/pos-v1-1.md. Side finding
for a later pass: `/tasks` on the dev server loads every module's client
chunk because the catch-all imports all modules through `modules/_index`.
Also later: Goals, Meals, Home, Ideas and Travel segments still switch
through the router; Goals and Meals clear a drawer key on switch, so each
needs the same no-write-behind-it check before going `local`.

**v1.1 Phase 2, delete the notes stub** (2026-09-15, branch
`phase-2-delete-notes-stub`). `modules/notes/` is gone and migration
`20260915060000_notes_drop.sql` clears its `core.entities`, `core.digests` and
`core.jobs` rows and drops the schema; `20260905223936_notes_init.sql` stays as
history. `core/reviews.ts` writes the week note to Second Brain only. The MCP
and proposals suites and the e2e seed lean on `ideas.write` (one table,
unguarded) instead; the e2e Agent Log fixture writes its ideas row before the
skills row so the sidebar-order assertion still proves something. Start a new
module by copying `modules/ideas`. After `supabase db push` and the deploy,
press Run now once: the dashboard tiles read `core.dashboard_summary` until
Phase 5 (done the same day), after which the Notes tile is gone at once.

**v1.1 Phase 1, diagnose and small fixes** (2026-09-14, branch
`phase-1-diagnose-fixes`). The nightly email finding, from production
`core.dashboard_summary` and `core.jobs`: the Vercel cron fired at 09:02 UTC
every night from 2026-09-10 to 2026-09-14, all five core jobs `ok`. Four of
those nights had zero alerts, so `orchestrate` logged `queued: false` and
`notify` sent nothing, by the old design. The one night with alerts
(2026-09-13, two of them) queued one digest and `core.notifications` shows it
sent at 09:02:37. Nothing is unsent, so the Resend list was not needed. The
cron is attached to production and the sender works; silence was the rule,
and the rule is now changed: a quiet night queues "Nothing needs you today".
Also in this phase: Snooze on the dashboard held a rule id that did not exist
(it now snoozes the notification row), Next 7 days rows open their own drawer,
the System tile is the run line at the top linking to the Agent Log, a time on
a task can be cleared, the iPhone 16 Pro Max startup image is set, and
`/splash/` joins `/icons/` outside the auth proxy. Goal deadline in Chrome 153:
typed dates work once the page is hydrated; a two-digit year gives year 0026,
which is under `min` and blocks the submit with the browser's own message, and
keys typed before hydration are dropped. No handler swallows keys. For Phase 6.
Push, from the owner pressing the button on production: signed in, `/sw.js` is 200, so the proxy is cleared; the failure is `VAPID_PUBLIC_KEY` in Vercel not decoding as base64url (`atob` throws before subscribe). The pair was regenerated and set again, redeployed, and the desktop subscribed; see docs/PUSH.md, "Why enabling failed".

**Second Brain is capture first.** docs/plans/brain-capture.md, PRs #48, #49
and #50, all merged 2026-09-14. POS is the primary store for notes now and the
vault a pulled archive. One box above the list takes text (first line is the
title), a bare URL (ingested as before), a "worked on" entry (kind `daily`)
and a file. Hubs (`brain.hub`, `brain.note_hub`) are owner-named keyword
groupings shown as a second chip group in the band: rules file a note at
capture, one batched Haiku call a night files the misses (50 notes, under a
cent), a manual tick wins. Related notes by embedding show under the box while
typing and in a cell on each note; that is the one resurfacing mechanism. A
file (PDF, JPEG, PNG, GIF or WebP, 10 MB) is a note with `file_path` set in
the private `brain` bucket and one Haiku `summary` call for the body; proven
locally with a PDF at 0.18 cents and a PNG at 0.08. A cap leaves the body as
"Transcription pending" and the nightly job retries one file. Not built by
decision: per-note summaries, hub summaries, weekly email, vault write back,
XP for daily entries, graph view, MCP tools for hubs. Follow-ups nobody
scheduled: attaching the same file twice makes a second note and a second
call; no progress text during the roughly 7 s transcription; a saved note
opens below the fold at 402.

**Login works on the phone, and by passkey.** docs/plans/mobile-login.md, PRs
#41, #42, #43 and #45, all merged 2026-09-14. Proven on the live project
rather than claimed: the emailed code signed the owner in at 19:01
(`/verify` 200, one call, first type accepted), a passkey registered at 20:04
and signed in at 20:30, both rows read back from
`auth.webauthn_credentials`. Three bugs on the way, all in the same fifty
lines and all from this app deciding things Supabase owns: the verification
type, and the code length, which production set to 8 while
`supabase/config.toml` said 6, so the field truncated every code and called
the owner's correct code wrong. The screen now asserts neither. The app also
had no sign out at all until #45, which is what made the passkey path
untestable. Left as it is and worth knowing: the passkey is bound to
`pos-gilt-rho.vercel.app` and dies silently when a custom domain lands.


**Mobile login: a code, then a passkey.** docs/plans/mobile-login.md. The magic
link failed on the phone three ways at once, and two of them were structural:
`signInWithOtp` runs server side, so the PKCE verifier cookie belongs to the
browser that asked, and a link tapped in Mail opens a webview or Safari that
does not have it; separately, `display: standalone` gives the home screen app
its own cookie jar, so a link that did work signed Safari in and left the app
on the login screen. The sent screen is now a six digit field: the code is
typed into the window that already asked, so the session lands in that browser
whatever browser it is. The link still works and is still what the laptop uses.
Passkeys on top, through Supabase Auth's own WebAuthn (no table, no migration):
a button on /login and a card in Settings > General that lists, adds and
removes them. Listing and removing are server side because they are plain
calls; only creating one needs a browser. Supabase calls the passkey API
experimental, so every failure path falls back to the code and says so. Waiting
on the owner: OWNER-TODO 19 (auth mail through Resend, which is the third
failure), 20 (the email template, required before the code field has anything
to check) and 21 (turn passkeys on, and not until the custom domain is live,
because a passkey is bound to the domain it was created on).


**Phone shell, Phase 5: Tasks and Goals.** docs/plans/phone-shell.md. Tasks on the phone is three segments (Today, This week, Calendar) with the other four views behind a Filter button, a plus as the header's action, rows that open the drawer on tap and swipe to complete without moving the segment. Goals is Active and Archive segments, rows open a sheet, and the inline add is one field whose Next opens the drawer. Desktop unchanged.
**Phone shell, Phase 4: Finance.** docs/plans/phone-shell.md. The phone is five segments (Overview, Accounts, Budgets, Subscriptions, Transactions) that swipe and keep `?tab=`; Overview is the two-up KPIs, the net worth chart and three rows that switch segment; account and budget rows open sheets; Sync is the header's one action; nothing truncates below md. The desktop is unchanged, now CSS-gated.
**Phone shell, Phase 3: Dashboard.** docs/plans/phone-shell.md. Home's inline header is `PageHeader` (title Home, Run now as the phone's one action; the desktop band keeps crumb, search, Arrange and Run now). Phone Home is the headline plus five tiles, warnings, finance, tasks, review and timeline, in one column; every other tile and Arrange are desktop only. Open: the phone page is 2141px with the seeded data against the plan's 1800px, which only the tile bodies can shorten.

**The fidelity pass, screens eighteen to twenty-one in parallel: Notifications,
Agent Log, Onboarding, Login.** The third batch on the method below, all core
screens, so each agent's scope was its route folder alone; Onboarding and
Login shared one agent. Claimed first with placeholder plan files on main so
the other session (then on Settings, Search and the phone re-check) could see
them taken. The builders were stopped by an API rate limit at 09:35 and
resumed at 11:04 with their context intact and nothing lost. Merges clean.
Onboarding's first "match" verdicts did not hold up on reading (copy, step
eyebrows, the Ready step's shape and the category heads all differed) and went
back twice before they did; every pair is now read by the integrator before it
reaches Nick. Integrator work after the merge: `WizardShell` takes
`nextVariant` and `backVariant` (Onboarding's artboard draws an accent primary
and a bordered Back; the review's defaults stay), and the wizard moved to its
own route group `app/(onboarding)/` with a layout that has no rail, tab bar or
palette, since the artboard draws nothing around it but its own six steps.

**Notifications** (docs/plans/notifications-fidelity.md): every generated
string joins with the artboard's middle dot; a rule's module label is
coloured per module (accent, amber for Insurance, ink-2 for System); Pause
all turns amber when paused; the snoozed note spells out the days; the email
preview reads the real digest recipient from settings or `OWNER_EMAIL`
instead of a hardcoded address, with plain accent section labels and
bulleted lines. Kept by decision: one channel per alert row (the schema has
one column), the app's footer line rather than "Reply STOP" (nothing parses
replies), the shared 22px empty state, the cron-driven digest time.

**Agent Log** (docs/plans/agent-log-fidelity.md): the band reads "Last run
{date} {clock} · {n} writes · {m} failed"; the rail is "This run"; the Jobs
list humanises job names ("nightly_digest" to "Nightly digest") under
"{Module} / {job}"; filter pills follow nav order. "Retry now" reruns a
failed job's module through the existing `runNightly({ module })` and only
appears on a job whose module is real (the seed's one failure is stamped
`core`, so it is honestly absent there). Not drawn: a header "Undo last run"
and a second theme button (both settled earlier); "Open" links from an entry
to its module page were never built and are a candidate for a later list.

**Onboarding** (docs/plans/onboarding-fidelity.md): the six steps carry the
artboard's copy where true ("STEP 02 / 6", "Choose what it tracks", "Ready
for the first run", the rail's "Set up in 6 steps" with a sub-line per step).
Modules is the numbered card grid with a true one-line description per module.
Connections has the artboard's category heads ("Banks & credit unions", "Feeds
Finance · balances, transactions", "{n} AVAILABLE"), a global search, NEEDED
on the two Finance categories nothing computes without, manual add, a greyed
"{Module} module off" card with "Add {Module} module" when a module is off,
and only ever "Requested" (nothing connects until Settings). Goals has per-goal
Target and By when; the app's three generic seeds stay. The Ready step is the
FIRST RUN card over a SUMMARY table (NAME, MODULES, CONNECTED, GOALS, ALERTS)
with the computed nightly hour and no source count or backfill claim. One
Blocked item is left open for a later pass: completing the wizard sets
`onboarding_completed_at` with no reset path, so the goal-editing e2e checks
the inputs but does not click Finish.

**Login** (docs/plans/login-fidelity.md): a small corrective pass. The band
uses middle dots, the input has a generic placeholder, the button an arrow.
Never built: "Sent via Resend" (the magic link goes through Supabase Auth's
mailer) and the footer's live job-status dot on a page nobody has signed into.

**The Mobile re-check, 402 against PosPhone.** docs/plans/mobile-recheck-fidelity.md.
Twelve screens had been rebuilt on the desktop since the 2026-09-10 phone
pass, so every route was measured again at 402x874 (padding, lede, tab rows,
horizontal overflow) and read by eye. The shell held on 23 of 24. Fixed: the
weekly review shell's 28px negative margin (the page was 412 wide), the
skills settings rows (the keyword column squeezed the name to two letters;
it now drops to its own line), toasts under the 91px tab bar, and drawers.
PosPhone opens every detail as a bottom sheet and the 2026-09-07 decision
said so, but the geometry sat behind a prop no caller passed, so at 402 each
drawer was a full height right slide. Below md every Overlay is now the
sheet: 74vh max, a handle, 18px sides, a 20px title, the 34px inset; the
desktop is unchanged. Not built, unchanged from 2026-09-10: per-screen
reflow to the four phone screens, the quick add button, the six tile phone
dashboard, gestures. The Overlay keeps its 56px header band on the phone
where the artboard stacks the eyebrow and title tighter; it is the one drawer
header on every screen. The other session's screens get the sheet through
Overlay without an edit on their side.

**Phase 1 is done except the deploy.** Steps 1 to 14 and 16 of 16. Steps 1 to 7 shipped 2026-09-05; the design
bundle landed 2026-09-07 and steps 0, 7.5 and 8 to 14 followed.

| Step | What exists |
|---|---|
| 1 to 7 | Scaffold, core migration, auth, crypto/settings/llm, module registry with the `notes` stub, entities/events/xp/classify, integration registry and Connections |
| 0 | Design bundle adopted as the screen spec, 17 decisions logged |
| 7.5 | ComeauxVerse brand layer: tokens, Manrope, type scale, radius, ~20 primitives in `components/pos/`, sidebar and mobile tab bar, login rebuilt |
| 8 | Hybrid search, Search page, command palette |
| 9 | Proposals, the guard, the Review screen, migration `core_platform` |
| 10 | Query tool, rate limiter, request log, storage buckets |
| 11 | MCP endpoint at `/api/mcp`, Settings Agents and MCP tab |
| 12 | Job runner, notifications, orchestrator, the Dashboard bento. The nightly run works end to end and sends one email |
| 13 | `pnpm setup` and `pnpm setup:demo`, both idempotent |
| 14 | CI and backup workflows, restore drilled |
| 16 | Docs squared up: README quickstart, connections registry, the notes module README |

**The fidelity pass, screens thirteen to fifteen in parallel: Home, Fitness,
Review.** The second batch on the method of the first (below): three agents in
`.worktrees/` off `e6b02b6`, ports 3011 to 3013, Phase A decisions answered in
one round, then the build. Review is a core screen, so its agent's scope was
`app/(app)/review/**` alone. Merges clean again. Integrator work after the
merge: `propose()` now returns the dismissed row when the same call comes back
inside `dismissed_until`, so the Review dismissal line ("will not re-propose
this for 30 days") is true by construction; `MetricTile` had been losing its
`leading-none` to tailwind-merge (a `leading-*` before a text size is dropped),
so every tile number across the app rendered at 51px line height, fixed by
class order in `components/pos/Card.tsx`. Ideas and Health landed on main from
the other session while this batch ran; Fitness kept `metrics.body_weight`
untouched for Health. One flaky full-suite run from shared-database
interference, clean on the rerun (172 passed, 3 skipped).

**Home** (docs/plans/home-fidelity.md): the band's crumb with "{n} jobs due
this month · ${cost} estimated" and its dot, "Log service" as the accent
primary, four separate KPI cards with compact money, the asset card grid
(kind, OVERDUE / SERVICE DUE / GOOD pill, VALUE and ANNUAL COST, the soonest
job and its month), the twelve month cards with status dots, the selected
month's rows, the warranty table with COVER · EXPIRES · FILE, attention
cards, the Property card reading its cover from `insurance.property_premium`
(the `finance.net_worth` read went; Finance holds no mortgage, so none is
drawn), vendor rows. Drawers on the shared `narrow` Overlay; Log service
gained Notes and the hint line. Helpers in `schedule.ts` with tests. Not
drawn by decision: mortgage, rate, escrow and equity, warranty page counts,
Undo on a done job, posting a cost to Finance.

**Fitness** (docs/plans/fitness-fidelity.md): the band crumb with the shared
SyncBand, a mono "{n} WORKOUTS · {year} → TODAY" beside the title, four tiles
in the artboard's shape: This week, the heaviest set named in its eyebrow,
the fitness goal read from the Goals digest and picked by a shared skill link
("340 / 405", "STALLED · 50%"), Body metrics. The Workouts tab is the
artboard's Recent workouts card (DATE, WORKOUT, TIME, SKILL through the
`skillNames` seam, "{n} STRAVA · {m} BY HAND"). With no workouts at all the
page is the "Connect a workout source" card: the Strava row and "Run first
import →". Not drawn by decision: XP per workout (the weight lives in the
skills schema), the Apple Health row (the webhook writes body metrics but the
card stays Strava-only until the owner has the app), the four-step importing
screen. Exercises, Body and Plan tabs unchanged.

**Review** (docs/plans/review-fidelity.md): six states captured. The band
carries "{n} pending"; the tabs are the DS `TabBar` behind a `ReviewTabs`
wrapper keeping `?tab=`; the list is the artboard's `1fr 1.1fr` grid of cards
with the selection in `?sel=`; `ProposalPanel.tsx` draws Current / After per
diff entry with inline edit riding `approve()`'s patch, the Confidence /
Evidence / Affects strip, the 51px "Approve →", Undo on a dismissal only
(reopening an approval would run the tool twice). Copy cut to what the code
does: no "is_manual = true", no "marked manual"; the empty inbox names the
nightly hour from the cron in the owner's zone.

**The fidelity pass, screen seventeen: Search.** docs/plans/search-fidelity.md.
The band is the crumb and "Quick search ⌘K" (no band field); the 60px box
18vh down on an empty page and under the band once there is a query; chips
for every module (counts while searching, ink-filled when active); results
in an 880px measure with the group head, type chip, snippet, "{n} days ago"
and skills, the match bar and Show more; the preview drawer (480) with the
fields strip, linked skills, related rows that open the module and the DS
"Open in {module} →"; the open row in the URL. The command palette takes the
artboard's 640px column: the box, then a Results / Go to panel with G-codes.
Hits carry `updatedAt`. Not drawn: an Amount cell (the registry holds none).

**The fidelity pass, screen thirteen: Settings.** docs/plans/settings-fidelity.md.
One header on every tab ("Settings", the lede, the tab as the crumb,
"{n} of {m} connected" in the band), the DS tab row at the artboard's
padding. Connections: a grid of provider cards with the auth chip, "used
by" from `requires`, a status dot (CONNECTED / REJECTED / NOT CONNECTED),
a two-cell strip (Last test, Connected since or Token expires), a masked
webhook secret with REVEAL, and Test / Reauthorize / Disconnect; a
connected card has no replace field (disconnect, then connect). General:
Owner (name, the real OWNER_EMAIL read only, timezone, digest hour), the
cap as a slider with the spend bar, the nightly strip (the cron on the
owner's clock, last run, jobs registered), Save with "SAVED · core.settings".
Agents & MCP: LIVE · n TOOLS, the command with the token masked inline
and Reveal, Autonomy as a card, the tools list with reads collapsed to one
OPEN row and each write GUARDED or OPEN. Notifications: the Channels strip
with switches that write a channel onto or off every rule, the per-module
grid, quiet hours as one line, Devices below. Skills: one card per branch
("Engineering · Coding"), transparent inline name inputs, CUSTOM and "was"
marks, the keyword mark (editable), the dashed add line, Show deleted (n),
the text Reset. Not drawn for want of a source: per-provider usage figures,
Rotate token, a quiet-hours off switch, backups.

**The fidelity pass, screen twelve: Health.** docs/plans/health-fidelity.md.
The shared band carries "{n} screenings overdue · next visit {D Mon}" above
the artboard's title block and Log a visit. Left pane: vitals tiles with
their source (FITNESS for body weight through the registry, LAB / DEVICE /
MANUAL for stored readings) and a delta against the previous reading;
Appointments as month-day cards with a CONFIRMED / HELD / DONE tag and
Upcoming / History pills; Medications & supplements with "{n} DAYS LEFT"
and Mark taken; Records with search, type filters and the RECORD / TYPE ·
DATE · FILE list. Right rail: Due & overdue cards (OVERDUE, DUE SOON,
NEVER DONE, SCHEDULED with View appointment) with Mark done and Snooze,
Insurance & cost from the Insurance digest, Care team. One drawer (shared
Overlay at 480) for an appointment, a record with Open the file (signed
URL), and the Log a visit form, which files a future date as an
appointment and a past one as a record with a real attachment. New tool
`write_record`; `write_appointment` takes `provider_id`. Not drawn for
want of a source: wearable tiles, Request booking, Add to calendar, File
to Second Brain, insurance plan figures, the agent refill sentence.

**The fidelity pass, screen eleven: Ideas.** docs/plans/ideas-fidelity.md.
The band's "{live} ideas · {stale} stale" with an amber dot when anything
is stale, the artboard's lede, Board / Effort × impact as an ink-filled
segment beside the title, a capture line that reads #tags, effort: and
impact: (Add, Full form), an AGENT band offering to merge the closest pair
of ideas when core.embeddings puts them within 85% (absent otherwise), four
stage columns at once with cards carrying the quadrant pill, IMPACT and
EFFORT bars, a two-line pitch, #tags and skill chips and "{n}d in stage"
(STALE at 60), the matrix with a little scatter, and a 520px drawer: view
with the Stage / Impact / Effort strip, Move to, the problem, an Agent card
whose Draft task writes a review-state task through core's callTool to
tasks.write (the first module to call another's tool), the Research card
the artboard predates, linked skills, goal and related notes; edit as a
form holding until Save. Migration `20260912030000_ideas_tags_stage`
(tags, stage_since, the draft columns); tools merge, delete (guarded),
draft_task. "Filler" is now "Fill-in"; the quadrant rule is unchanged.

**The fidelity pass, screens eight to ten in parallel: Second Brain,
Insurance, Meals.** Plan: `~/.claude/plans/great-rigth-now-tasks-partitioned-pike.md`
(the batch method), then docs/plans/brain-fidelity.md, insurance-fidelity.md,
meals-fidelity.md. Three agents, one per screen, in `.worktrees/<screen>` on
`fidelity/<screen>` branched from `6f5dd33` with their own dev ports (3011 to
3013) and one shared local database. Two phases: each agent captured and
measured its artboard and returned a "Decisions with Nick" list; Nick answered
all three at once; then each built to its plan with the same proof loop as the
serial passes (failing e2e asserts, build, side-by-side pairs, typecheck, lint,
unit, its own screen's e2e under a `mkdir` lock). Agents could edit only their
module folder, their plan and their own test block; shared pieces were the
integrator's, done once after the merge. What the batch cost: no merge
conflicts (the test blocks are disjoint), one security finding (the new
`attach_document` tool took any bucket path; fixed in the branch with a test),
one agent killing every dev server by name (killed by port from then on), one
seed leaving rows another tree's reseed tripped on (fixed in the module seed).
Sixteen commits over three branches plus two integrator commits. The merge
cost is what the plan assumed, so the next batches run the same way, three at
a time.

**Second Brain** (docs/plans/brain-fidelity.md): the band with the folder
crumb, "{n} notes" and "Ingest →"; filled folder chips with Inbox and Reading
list; two panes, the list (title, days ago, source host and word count, KIND,
DRAFT, FINISHED · date) and the note. A draft: Discard, Edit, "Accept →", the
Source and Draft summary cards with skill chips and how they were classified.
A note: its path, body as paragraphs, lists and clickable wikilinks, Linked
skills, Backlinks, a Vault cell (path, sha and pull time for a pulled note,
"Not in the vault. Nothing here writes to it." otherwise) and Links to write.
Ingest is a 480px drawer with URL, YouTube, Book and Note. New guarded
`delete`; `ingest` takes a `kind`; `publish` emits `note_approved` plus
`book_finished` or `article_read`, because adding a book or article means it
was read (Nick): no finished column, no button. Not built: in-list semantic
search, PDF, depth and prices, any copy claiming a commit to the vault.

**Insurance** (docs/plans/insurance-fidelity.md): the "Insurance / Policies"
band with "{n} policies · {m} expiring soon", four tiles, the five column
table with masked numbers and the expiry-coloured pill; the policy drawer
with three cells, an inferred payment schedule that never says "Paid", a
reminder track from the leads, documents with "+ Attach PDF" (new
`attach_document`, path locked to the policy's own prefix, signed URLs), the
agent card, Edit, "Mark renewed · {date}" and a new guarded `delete_policy`;
the edit form holds until Save and reads the reminder channels from the
`policy_renewal` rule; the upload drawer says what happens (one Haiku call,
not local extraction). `post_to_finance` stays a recorded intent and the
screen says so. Both adequacy disclaimers went; the module still judges
nothing. `write_policy` no longer nulls fields it was not sent.

**Meals** (docs/plans/meals-fidelity.md): the band summary ("19 / 28 planned ·
100g protein avg"), Grocery list and "Suggest week →", Week and Recipes tabs
with the week stepper, a Today strip (slot toggles, a label-only "Ate
something else?" log, macros against the one target the app has), the Monday
to Sunday grid with cost and time on every cell and a totals row, four week
cells, recipe cards with drafts first, and three drawers: Pick, Grocery
(grouped by recipe, quantities as written) and Recipe. New tools:
`import_recipe` (schema.org JSON-LD, filed as a draft, no model, no fallback;
the page is fetched through `core/fetching.ts`, moved there from Second Brain
for this) and `fill_week` (deterministic, favourites first). Not drawn for
want of a source: protein, carbs and fat targets, XP amounts, the Nutrition
and Groceries budget links, pantry staples, drag and drop. Cook mode stays
behind "Cook" in the drawer.

**The fidelity pass, screen seven: Goals.** docs/plans/goals-fidelity.md.
The band's "{active} active · {n} at risk · {n} stalled" with the worst
status as the dot, the artboard's lede, New goal as the DS small button
opening the drawer, Active / Archive at 14px padding, the inline add whose
More options carries its values into the drawer, area groups in the
artboard's order with "{n} goals · {k} on track", and cards with the 26px
"current / target", the 3px pace bar, the rule and deadline lines with the
projected finish, the sparkline in the status colour, the next linked task
and a check-in field. The drawer: Now / Target / Days left, the Status rule
written out with both projections, the history chart with the target and
needed-pace lines, linked tasks (Tasks answers through a new `linked`
contract seam; nothing reads another schema), linked skills, pending
proposals matched by payload id, Edit / Archive / Delete; edit mode is a
form that holds until Save. New guarded tool `delete`. The rule sentence
now reads as the artboard's ("Pace X/mo vs Y/mo needed (N%)."). Nothing on
this screen was left undrawn for want of a source.

**The fidelity pass, screen six: Tasks.** docs/plans/tasks-fidelity.md.
The artboard's page with no title block: the band carries "Tasks / {view}"
and "{open} open · {done today} done today"; the quick add row as drawn
(New task opens the form drawer, the parsed chips in the token's colour,
ADD ↵); the DS tab row (now the shared `TabBar` style: 1px underline, 13px,
touching tabs) with Calendar before Review; columns on `--bg-elev` with the
eyebrow head and "{n} · {h}h"; rows with the 16px box (dashed amber for an
agent row), OVERDUE and AGENT · REVIEW marks, the ⏰ reminder chip, the EDIT
mini; a row expands in place with notes, Goal, Skills (read only from
`core.skill_links`, named through the new `skillNames` contract seam the
Skills module fills), Source, Edit, Approve, the → moves and Delete. The
drawer at 480px is the artboard's form and holds edits until Save; New task
is the same form with Create. New guarded tool `delete`. The Done column now
counts on the owner's calendar (it was UTC, so an evening completion was
yesterday's). Not drawn for want of a source: the XP toast, the goal
suggested from the project, the add-a-skill select and learned rules.

**The fidelity pass, screen five: Travel.** docs/plans/travel-fidelity.md.
The artboard's page: band with the summary, the loyalty strip with Manage
(a drawer with the balances and the cents-per-point calculator), the title
with Add to wishlist and New trip, the globe with filled continents and
country borders (`modules/travel/land.json`, 285 Natural Earth rings decoded
once by `scripts/land-rings.mts`, cut at the horizon in `globe.ts`; no d3 at
runtime; since 2026-09-13, in place of the artboard's dot matrix, opening
level on the US), pins by status, legend
and controls, an alert slot fed by travel notifications; Upcoming as cards
with booking segments and the next step; Past beside Wishlist (trips with
status idea). The trip drawer at 560px: Itinerary by day with inline edit
and a parsed add line, Budget with per-category lines (migration
`20260911230000_travel_budget_lines`, actuals from the confirmed itinerary
by kind), Packing with add and tick, Inbox; Edit details, the forms, Delete
trip. New tools: write_budget_line, delete_budget_line, write_packing,
delete_item, delete_trip (guarded). Not drawn for want of a source: the HOME
pin, a fare alert, the packing suggester. 2026-09-12: the globe zooms about
the cursor or a pinch (`zoomAt`, `clampView` in `modules/travel/globe.ts`),
the wheel no longer scrolls the page, max zoom is 8x, every pin is named
from 2x, and a grey pin opens its trip or a read-only PlaceDrawer.

**The fidelity pass, screen four: Skill Tree.** docs/plans/skill-tree-fidelity.md.
Two flush halves split by one rule under a 56px band (crumb, scoped search,
Reset view); the character, the six-letter pips, the hints and the legend in
the sky's corners; the columns under it; the detail pane at the artboard's
margins with the full crumb path and the pinned formula. Opens on the
top-gaining leaf. Closes Task 5 of the older fidelity plan.

**The fidelity pass, screen three: Finance.** docs/plans/finance-fidelity.md.
One overview on the desktop (the tab row is the phone's, for PosPhone's
segments): the KPI strip on the page ground, accounts over the curve beside
what is due over the budgets, every row at the artboard's 9px with its lines.
Three drawers at the artboard's 520px, which is now the app's `Overlay`:
an account's transactions, a budget's with its limit, and Budget limits with
the alert threshold, a new Finance setting in `finance.settings` (migration
`20260911222506_finance_settings`) read by the flags, the KPI, the digest and
the headline clause. Limits are held until Done. A due subscription can be
cancelled from its Upcoming row. The table key (`DataTable`) is 11px on
rule-2 everywhere and the band search is scoped on module screens.

**The fidelity pass, screen two: Dashboard.** docs/plans/dashboard-fidelity.md.
The artboard's nine tiles first in its order, then every other module's tile
in rail order; the band is 56px full bleed with the compact search and the
DS-sized Run now (desktop only, the phone's way is pull to sync); the headline
reads the artboard's three clauses from digests through the same template
(`digestSentence` in core/orchestrator.ts, tested), falling back to the alerts
sentence; every tile is measured to the artboard, with the manifest's new
`tileHead(payload)` letting a module name its head and its right-hand line.
Finance, Tasks, Goals and Skills digests gained the keys their tiles print.

**The fidelity pass, screen one of 27: Weekly Review.** The prototypes are
matched one screen at a time now, in the app, against the artboard captured
in a browser: prototype and app side by side at 1440x900 in both themes,
structural asserts in e2e for what a screenshot cannot pin, no prototype
markup and no visual-diff dependency. The plan and the method are
docs/plans/weekly-review-fidelity.md; the next screen starts from its Task 0.

What changed for it: the rail is `PosSidebar.dc.html` on every screen (its
thirteen modules and Review in its order, Notes off the rail and in the
palette, 36px rows, the badge in the accent, Dark and Collapse as rows); the
review's first step draws the six tiles the artboard names, from digests,
with deltas against last week's digest (`core/review-glance.ts`, pure and
tested; Finance, Tasks and Skills gained the keys); the sentences that carry
numbers are built from the week's own; Tasks says how often an item rolled,
counted from its own `rescheduled` rows in `core.write_log`; the band has the
theme button. Twenty-four shots under `e2e/__screens__/weekly-review*`.

**Phase 1C: the platform screens are done.** Notifications, Agent Log and the
Settings Notifications tab, which was the last greyed one. Two migrations:
`core.notification_rules` seeded with the design's fourteen rules, and the
revert and apply payloads `core.write_log` needed for Undo to be real.

`core.write_log` had no writer before this. `callTool` now logs every agent
write and `approve()` logs every proposal the owner accepts, both with the
tool call that would put the write back. Undo re-runs the module's own tool
with that payload, so a reversal passes the same validation the write did.
A write that cannot describe its own reverse stores no revert payload and
shows no Undo button.

The sender reads the rules now: `pending()` gates on the global pause, then
the rule's mute or snooze, then quiet hours, where only an urgent rule gets
through and only while the override is on.

**Phase 2, modules 2 and 3: Tasks and Goals.** Both are complete modules:
migration, manifest, tools, jobs, UI to the prototype, seed, README and
Playwright shots.

Tasks has six views over one list plus a month grid, and a quick add parser
that leaves a token it does not recognise in the title rather than guessing.
Goals holds the status rules and the two projections in
`modules/goals/progress.ts` with their test, and every status on screen
carries the sentence that produced it.

`ModuleManifest` gained `metrics`, which is the whole cross-module read
mechanism for a live value. A module says what it will compute; Goals
enumerates the registry and stores the key. No query strings are parsed and
no schema is reached into, so deleting a module makes its key stop resolving
and the goal falls back to manual check-ins.

**Weekly Review.** Six steps, resumable, with the note shown before it is
written. It also forced the last piece of the cross-module contract:
`ModuleManifest.review`. The first version of the page queried `tasks.task`
and `goals.goal` from a core route, which the architecture forbids, so a
module now hands over its own rows and gets its own decisions back on close.
Core names no module on that screen. See docs/WEEKLY-REVIEW.md.

**Phase 2, module 1 of 13: Skill Tree.** The tree, the XP weights, the level
function and the overrides table moved out of core into a `skills` schema, and
the constellation screen is built. `register()` now classifies through an
optional `classifier` on the module manifest, so deleting `modules/skills/`
leaves a working app. See docs/plans/skills-module.md and
modules/skills/README.md.

**Phase 2, the remaining ten modules.** Finance (accounts, recurring detection,
rules-first categorisation), Onboarding, Second Brain (wikilinks, a draft that
waits), Travel (a hand-rolled orthographic globe, no d3), Fitness (integer units
at rest), Health (screening states including never), Meals (a plan is not a
log), Ideas (effort against impact on three points), Home (maintenance derived
from an interval and the last date), Insurance (encrypted numbers, revealed only
on request, and no opinion about cover). Each has a README saying what it
refuses to do and why.

## Verification

```
pnpm typecheck && pnpm lint && pnpm test    # 669 tests, 65 files
pnpm test:e2e                               # 148 specs, 1440px and 402px, both themes
pnpm setup:demo                             # idempotent bootstrap
```

`E2E_BASE_URL` moves the whole suite, the sign-in setup included. It used to
move everything except that, because `auth.setup.ts` asserted port 3000 by
hand, so any machine with something already on 3000 had to run with
`--no-deps` and skip signing in altogether.

The e2e suite runs in about 4 minutes, down from about 9. That is the
classification change: seeding used to make one blocking Haiku call per entity
the keyword rules missed, and now makes none.

Screenshots land in `e2e/__screens__/` (gitignored). The e2e seed owns
`core.job_runs` and `core.notifications` outright, for the same reason in both
cases: Run now and the nightly job add real rows on nearly every pass, and the
seeded ones fell out of the bounded window the screen reads. Tests use their own
`pos_test` database, rebuilt from migrations by a vitest globalSetup;
`core/db.ts` refuses any other database while `VITEST` is set.

## Live and connected

Anthropic, Resend and Voyage are all connected in `core.connections`. The full
pipeline is verified against real providers: entities embed through Voyage,
classification splits between keyword rules and `claude-haiku-4-5`, and
`core.llm_calls` records the spend the soft cap depends on.

## Screens built

Login, Dashboard (live, with the bento tiles), Notes, Skill Tree, Tasks,
Goals, Weekly Review, Search, Review, Notifications, Agent Log, and all five
Settings tabs:
General, Connections, Agents and MCP, Notifications, Skills. Command palette
on Cmd K.

Every screen in the design bundle is built. The ten modules added after the
foundation, in the order the owner asked for them, are Finance, Onboarding,
Second Brain, Travel, Fitness, Health, Meals, Ideas, Home and Insurance.

They are built to the handoff's layout, copy, spacing and colour, rendered in
the ComeauxVerse type and shape system that decisions 15 to 17 established.
Nothing already built was restyled to the bundle's Space Grotesk and radius 0.

Goal weight on the Skill Tree is a real number now: `core.skill_links` joined
to the entities Goals registers, rolled up the way XP is. There is still no
Notion backfill, so XP starts at zero by decision.

## The design pass, 2026-09-10

Every artboard in the handoff was measured and its screen rebuilt to match, one
at a time, in the order the owner set: Finance, Tasks, Goals, Skill Tree, Second
Brain, Insurance, Ideas, Fitness, Health, Meals, Travel, Home, then the shell
screens. Where an artboard showed something the app could not honestly produce,
the module contract grew rather than the screen faking it: `review.wins`,
`ReviewCheck.percent` and `.movement`, `ReviewItem.at`, and a `goalWeight` on
`SkillStat`. Where an artboard showed something nothing could produce, it was
left out and said so, which is why there is no semantic search field on Second
Brain: the band's one search box is the rule, and since 2026-09-14 related
notes surface beside the capture box and on each note instead.

**The Skill Tree took three passes.** The first two approximated from
screenshots and were wrong in ways the owner could see: the hover card had no
background because `bg-surface` is not a token in this app, the four digest
columns were below the fold, and nothing lit up on hover. The third read
`POS Skill Tree.dc.html` and ported its logic: the `related` set, the edge
states, the node ratios (14 / 9 / 6 / 3.5 + level, and only a leaf grows),
nebulae derived from the attribute positions, and a 1200x760 viewBox because a
square one fitted `xMidYMid meet` inside a landscape panel scales by the height
and leaves the width empty. The canvas carries `#05080c` in both themes, which
is what the artboard's section does: its stars and labels are lit for a night
sky and the whole tree vanished on the light surface.

**The phone pass, against `PosPhone.dc.html`.** The mobile project had always
run beside the desktop one, so the 402px shots existed and the specs passed,
but nobody had compared them to the artboard. What that found was chrome: 18px
body padding rather than 28, a 56px tab row on the home indicator's 26px inset,
an 18px glyph where the rail prints a two digit code, a 44px search icon where
the desktop has a field, no page description, KPIs two up at 24px, and tab rows
that scroll rather than wrap. The four phone tabs are named by the plan (Home,
Finance, Tasks, Fitness) rather than taken from nav order, and More opens the
artboard's sheet. Three artboard elements are deliberately not built, each with
its reasoning in decisions/log.md: the quick add button, the curated six tile
dashboard, and per-screen reflow for the twenty screens with no phone artboard.

## Next

**The owner's own data.** Every module ships with a demo seed and none with an
import. The Notion export, the SimpleFIN connection and the Obsidian vault are
what turn this from a working template into the owner's system.

**Step 15, deploy, is still the only Phase 1 step left, and it is entirely
owner work**: Vercel, a hosted Supabase project, and the first real nightly run in
production. The checklist is in docs/OWNER-TODO.md. Nothing in the codebase
blocks it, and nothing in Phase 2 waits on it.

**The phone shell rebuild, docs/plans/phone-shell.md, approved 2026-09-13.**
Five phases, one PR each: speed and gestures, the shell (Home, Tasks, Finance,
Browse), then Dashboard, Finance, Tasks and Goals phone passes. It supersedes
the PosPhone shell rules above; the brand layer still holds. Phase 1 (speed and
gestures) is built: a loading skeleton on every route, sheets that open on the
next render, a task that reads done before the server answers, safe-area
insets, pull to refresh, and Run now on both widths. Phase 2 (the shell) is
built: the tab bar is Home, Tasks, Finance, Browse, and Browse is a page
(search, one row per module, then Review, Notifications, Agent log, Settings)
in place of the More sheet; every screen below md has a back control off a
tab root: PageHeader screens draw one row with it, the title and one action,
and the five that draw their own band (Second Brain, Meals, Skill Tree,
Travel, Weekly review) carry it in that band; `Segments` wraps a
section row and the pane that swipes it (Meals first, Finance, Tasks and Goals
in their own passes); a drag from the left edge past 90px goes back; the
sheet's handle drags closed. Finance's Sync button is desktop only until Phase
4; Fitness's is its phone action already. Phase 3 (Dashboard) is built: Home
is the headline and five tiles on the phone. Open from it: the phone page is
2141px tall against the plan's 1800px, and only the tile bodies (out of scope
for the shell) can shorten it. Phases 4 and 5 are next.

See docs/plans/design-build.md.

The registry cycle that blocked steps 12 and 13 is fixed: both registries load
in a plain Node process, which is what lets `pnpm setup` and the cron job work
outside Next.

## v2, specified 2026-09-14, not started

docs/SPEC-v2.md and docs/plans/v2-agent-layer.md. The agent layer: per-verb
permission on integrations, an action state machine over core.proposals, run
budgets, a Postgres queue, a memory tier, a nightly suggestion pass, and plans
in the goals schema. Sixteen v2 entries were written to decisions/log.md on
2026-09-14, fourteen of them answers from the owner and two corrections made
after; none stay open.

The draft spec proposed six things that already ship under other names (the
credential vault, the connector registry, the approval gate, the audit trail,
the runs table, the push channel), so v2 extends rather than adds. It stays on
Vercel Hobby with the $10 cap, which is what fixes its shape: no long-lived
process, no external queue, and a run that advances only when something drains
the queue. Phases 0 to 4 are the product.

It starts after v1.1 and after OWNER-TODO steps 12 to 16. v1.1
(docs/plans/pos-v1-1.md) is the in-flight plan and its phase 12 hardens exactly
what v2 then builds on, so v2 waits rather than hardening the same routes
twice. Phase 0 covers the integrations that currently skip every night, so it
is worth more with real data behind them, and phase 4's approval push needs the
VAPID pair. Strava does not gate it: item 11 is deferred and v1.1 moved workouts
to Apple Health, so phase 0 wires the Strava client onto the executor without
depending on a live connection. The phone polish pass is independent and can run
either side of it.

## Open questions for the owner

- Voyage is capped at 3 requests a minute without a payment method. Search is
  built around it (words first, meaning only when words find nothing, two of
  eight queries spend a request) so it is not urgent.
- `docs/OWNER-TODO.md` holds the rest, including what step 14 and 15 need.

## Rules learned the hard way

- **`supabase db reset` destroys local data**, including every provider key.
  Use `supabase migration up`. Written into CLAUDE.md.
- **A client component must not import from a module that reaches `pg` or the
  module registry.** Turbopack reports it as a missing build manifest, not an
  import error. Vocabulary a client needs lives in a leaf module with no
  imports: `core/owner.ts`, `core/autonomy.ts`.
- **New core tables need their own trigger, RLS, both policies and three
  grants.** `core_init` does that in a loop over `pg_tables` that does not
  re-run for a later migration. `alter table ... set schema` carries rows,
  constraints, policies and triggers, but **not** grants: restate those.
- **`register()` emits the creation event on insert only.** It used to emit on
  every upsert, so each `setup:demo` and each e2e seed awarded the XP again;
  five demo notes had thirty-eight creation events each. Pass an explicit
  `eventType` for something that genuinely happens again on the same row.
- **`current_date` is the database's day, not the owner's.** The database runs
  in UTC and the app server runs wherever it runs. Every date question goes
  through `core.today()`, which reads `core.settings.timezone`, and
  `core/today.ts` reads that same function rather than the Node clock. At 19:14
  in Chicago the two answers are different dates.
- **A portal guarded by `typeof document === 'undefined'` is a hydration
  mismatch waiting for a reason.** It only appeared once a drawer's open state
  came from the URL: the server rendered nothing and the client rendered the
  panel. `Overlay` gates on mount state instead, so the first client render
  matches the server.
- **Client state does not survive the reload that switches themes.** A view, a
  tab or an open drawer that lives in `useState` screenshots as its default and
  the test still passes. Put it in the URL, which is better behaviour anyway.
- **Deleting a module row orphans its `core.entities` registration.** Nothing
  cascades, and search answers with rows whose table entry is gone. A module
  seed upserts on `(source, external_id)` for exactly this reason; deleting and
  reinserting gave every task a new uuid and left 454 orphans behind.
- **Core does not read module schemas, and that includes core screens.** The
  Weekly Review asks "what slipped", which is a Tasks question. Querying
  `tasks.task` from a core route is the violation even though it works. The
  manifest grew a `review` contribution instead: a module hands over its rows
  and gets its decisions back. Two modules implement it, so it is a contract,
  not a hook for one caller.
- **A server action is a public POST endpoint, and its TypeScript signature is
  erased at runtime.** `patchRule` built a SET clause by interpolating object
  keys, so a key of `muted = true, label` would have written a column no caller
  should reach. Anything that interpolates an identifier, or takes a key as a
  parameter, filters against a runtime whitelist. Three of them do now, each
  with a test that fails without it.
- **`var(--brand)` does not exist.** The token is `--accent`, exposed to
  Tailwind as `--color-brand`. An undefined var in an SVG `fill` is not an
  error: the shape renders black on a black background.

## Late passes, done 2026-09-09

**Push** (docs/PUSH.md). Service worker, VAPID, `core.push_subscription`, a
Devices card in Settings, and the sender honouring the push channel it has been
storing since the notifications step. Needs two keys in `.env` before it does
anything; the screen says so.

**The skills digest's third bullet** (2026-09-12). SPEC's "skills with high
goal weight but low activity" was hardcoded empty from before Goals existed.
It is now the page's "Goal weight high, low activity" column computed at
night: `modules/skills/pressure.ts` holds the rule for both, and
`goalWeightBySkill()` in `modules/skills/data.ts` is the one query. Empty on
the demo seed, whose goal-linked skills all gained XP this month.
docs/plans/skills-goal-pressure.md.

**Gestures.** Swipe between tabs, swipe a task to complete or reopen it, pull
down on the dashboard to sync, and (2026-09-12) hold a dashboard tile for
480ms to enter Arrange mode. Touch and pen only, so a mouse drag over a task
title still selects text and a slow click rearranges nothing. What counts as a
swipe or a press is decided in `core/gestures.ts` with tests; the pointer
listening is in `components/pos/gestures.ts`. The fourth gesture waited for a
stored tile order, which the Dashboard pass added; with it the late pass from
docs/plans/design-build.md is complete. docs/plans/long-press-arrange.md.

**Ideas research** (SPEC section 2). The last of the four follow-on features.
Rubric with web search, every number carrying the page it came from, and a hard
rule that deletes any number whose URL the search did not actually return.
Guarded, because it is the one thing in Ideas that spends money.

## Cost pass, done 2026-09-09

Measured before changing anything: 3,919 of the 3,977 model calls this system
has ever made were skill classification, and nearly all of them came from
`setup:demo` and e2e re-classifying the same rows. Total spend across the whole
build is $2.32. Production cost was never the problem; the dev loop was.

**Classification is rules in the write path and a model in a nightly job.**
`classify()` runs keyword rules only. What they miss parks under `unclassified`,
which was always the queue and never had a consumer: the marker's own comment
promised a nightly batch that did not exist, so 27 rows were parked with nothing
to pick them up. `modules/skills/jobs/reclassify.ts` is that job, 20 entities
per call. The tree was being resent per entity, about 90% of each call's input.

A write no longer waits on a model round trip, and a re-seed costs nothing.

**Prompt caching does not apply here and is not used.** The prefix is about 190
tokens against a 512 floor, so it would silently never cache. The Batch API's
extra 50% was declined: up to 24h on top of the nightly run puts a skill link
two days behind the write.

**skills.yaml gained `home` and `preventive_care`.** Home is the largest module
in the app and had no skill to land on at all. Measured against the real entity
set, the rule hit rate went from 31% to 58% and Home's misses from 28 to 7.

**The dashboard headline is a template.** It cannot invent a number on the most
read sentence in the app, costs nothing, works with no provider connected, and
is now testable rather than sampled. `Purpose` in `core/llm.ts` lost `headline`.

## Integrations: all four stubs are now real

Strava, the Obsidian vault and SimpleFIN were manifest-only stubs whose
`test()` returned "not verified", so none could be connected even once a
credential existed. All three have clients, real Test buttons and nightly sync
jobs. Health Auto Export (2026-09-12) is a push, so it has no job: the webhook
route hands the validated payload to `fitness.inbound.health_auto_export`
through the module contract's optional `inbound` seam, and Test reads the last
200 on that route from `core.request_log`. It needs a paid iOS app.

- **`fitness.inbound.health_auto_export`** upserts sixteen body metric kinds
  on `(kind, measured_on)` (the five originals plus steps, active energy,
  exercise minutes, stand hours, VO2 max, blood oxygen, respiratory rate,
  flights climbed, walking distance, walking and average heart rate, added
  2026-09-13 by the owner's decision to take everything from Apple Health
  rather than connect Strava first); `source = 'manual'` rows are never
  touched. Totals are summed across a day's buckets, levels keep the last
  reading. v2 workouts land in `fitness.workout` on `(source, external_id)`
  like Strava's and emit `workout_logged` once, on first insert.
  `integrations/health_auto_export/client.ts` owns the unit conversion and the
  date parsing; the metric identifier strings are marked verify until one real
  export has been seen. Both Apple Health sources write through
  `modules/fitness/inbound.ts`.
- **`fitness.inbound.apple_shortcuts`** (2026-09-13): the free route. An iOS
  Shortcut posts a flat `{ day, metrics, workouts }` payload to
  `/api/integrations/apple_shortcuts/webhook`; `integrations/apple_shortcuts/
  client.ts` maps its keys onto the same kinds. Built because Strava now needs
  a paid subscription to create an API app and Health Auto Export's REST sync
  is a paid tier. The Shortcut recipe is in docs/SETUP-INTEGRATIONS.md; a
  workout's identity is its start instant since no HealthKit id reaches a
  Shortcut.

- **`fitness.sync_strava`** upserts on `(source, external_id)` and backdates
  `workout_logged` to the activity rather than the job run.
- **`finance.sync_simplefin`** runs first in the finance order. It skips
  non-USD accounts rather than summing them into net worth, never touches an
  `is_manual` row, and does not register transactions, because this module had
  already decided the event worth recording is the categorising.
- **`brain.pull_vault`** compares git blob shas, so a settled vault costs one
  request a night and no writes. Pulled notes are published rather than draft,
  register for search without emitting events, and are never deleted when a
  file disappears.

The integration contract gained one thing: an optional `prepare()`, run on save
and never on the Test button. SimpleFIN forced it. A setup token can be claimed
exactly once, so claiming inside `test()` would store the spent token and the
next Test press would destroy a working connection.

`register()` gained `emit`, so a backfill can register without awarding XP.

None of the three is connected. Each needs an account only Nick has. See
docs/SETUP-INTEGRATIONS.md, and docs/SETUP-SUPABASE.md for step 15.

The whole nightly pipeline is 30 jobs and runs clean with nothing connected:
every sync skips and says so rather than failing the run.

## Bugs found by the 2026-09-09 audit

- **`goals.checkin` overwrote hand entered values.** It latched `is_manual` to
  true correctly and then set `value = excluded.value` anyway, so the nightly
  `pullMetrics` replaced a number the owner typed while the flag still said
  manual. Proven with a failing test, then fixed with the guard
  `core.skill_links` already used.
- **Two e2e failures were shared fixture state, not app defects.** The seeded
  "Backup complete" notification had fallen to rank 64 of 64 against
  `listAlerts()`'s limit of 60, so the e2e seed owns `core.notifications`
  outright now, the same way it already owned `core.job_runs`. And two tests
  were completing the same task: the swipe gesture has its own row now.

## Second Brain ingestion, 2026-09-09

SPEC section 6's last unbuilt half. Paste a URL on the inbox and a draft
arrives: readable text out of the page, a transcript out of a YouTube link, a
Haiku summary of whichever it got, and the source stored beside it.

**Two deviations from SPEC, both forced or argued:**

- **yt-dlp is not used.** It is a Python binary and the Vercel Node runtime
  cannot run one, so the choice was between the caption endpoint and no
  transcripts at all. SPEC is amended.
- **Extraction is hand rolled, no parser dependency.** The extracted text is
  shown beside the draft, so a bad extraction is visible and correctable rather
  than silent, which is a far lower bar than a library has to clear.

**`brain.ingest` is guarded**, alone in a module whose README said nothing
needed guarding. That reasoning still holds for every other tool, but it covers
the wrong thing here: the draft state does not guard against spending money.

**`summary` joined `research` as a capped purpose.** Reaching the cap leaves the
draft and the full source text and drops only the summary.

Three bugs the tests caught while being written, all in code that looked right:

- `<[^>]+>` is not a tag. `<a title="a > b">` ends that match early and leaves
  `b">` in the note as prose.
- A hyphen is not a title separator. "Postgres - what the planner actually
  does" was being truncated to "Postgres".
- `normaliseUrl` did not refuse `file:///etc/passwd`: it does not match
  `https?://`, so it was rewritten to `https://file:///etc/passwd`, which parses
  and has protocol `https:`. Any scheme at all is now checked, and private and
  link local addresses are refused before a request leaves the deployment.

## The outbound trust boundary, 2026-09-09

An automated review found an SSRF in the ingestion shipped an hour earlier, and
was right. Fixing it properly moved every outbound request in Second Brain into
`modules/brain/fetching.ts`, which is now the only place that decides whether a
request may leave the deployment.

**`fetch` is not used there.** Node's fetch cannot pin a connection to an
address, and without pinning the hostname is resolved once for the check and
again for the connection: a record with a short TTL fits through the gap.
`node:https` accepts a `lookup`, so the address that was checked is the address
that is dialled. There is a test with a real server proving node honours it,
because otherwise the design rests on an assumption.

Three layers, each with the test that fails if it goes:

1. **Literal rules** on the pasted URL: scheme, and the private ranges.
2. **Resolve and check every record**, not the first. One private answer among
   several is still a way in.
3. **Pin the connection** to those addresses, which is what makes layer 2 hold
   rather than being a suggestion.

Redirects are followed by hand with every hop back through all three. The loop
takes its fetcher as a parameter so it can be tested without a test-only bypass
of the checks, which would be a security switch one careless call from being
wrong in production.

DNS rebinding is closed. What is left is the ordinary residual: a host that is
public at check time and stays public is fetched, which is the feature.
- **A hardcoded origin in a test is a bug with a long fuse.** `auth.setup.ts`
  asserted `localhost:3000` and the theme cookie was set for that host, so a
  machine with anything else on 3000 could not sign in and every run needed
  `--no-deps`. The cookie worked anyway, because cookies ignore the port, which
  is the kind of accident that holds until the suite runs against a host.
- **`workers: 1` and `fullyParallel: false` are load-bearing here.** Overriding
  them on the command line races `e2e/seed.mts` against itself; the run reports
  assertion failures in whatever screen read the half-seeded state, which looks
  exactly like a regression and is not one.

