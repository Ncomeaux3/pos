# Health to the artboard

Superseded for styling on 2026-09-19 by the Holon redesign (docs/plans/holon-product-redesign.md, section 4): colour, type, radii, surfaces and control shapes now come from the Holon design contract and the shared components in `components/pos/`. This plan still governs what each screen shows and how it is laid out.


## Context

Screen twelve of the fidelity pass (method: docs/plans/weekly-review-fidelity.md). `POS Health.dc.html` captured at 1440 into `/private/tmp/pos-handoff-sources/health/` (page dark and light at 1500 tall, the appointment drawer, the record drawer, the Log a visit form). The other session is on Fitness, Home and Review in worktrees off `e6b02b6`; this pass stays inside `modules/health/` plus its own e2e tests and seed rows.

The app has the data (providers, appointments with prep and cost, records with `fields` and `file_path`, medications with logs and refill dates, vitals with provenance, screenings with intervals) and the rules (`modules/health/screening.ts`), but draws six tabs over one list and a rail of plain rows. The artboard is one page: a title block with a status eyebrow and "Log a visit"; a left pane with vitals tiles, Appointments (Upcoming / History pills, month-day cards with a status tag), Medications & supplements (rows with refill days and Mark taken), Records (search, type filters, a keyed list); a right pane with Due & overdue cards, Insurance & cost, Care team; a 440px drawer with keyed rows for an appointment or a record, and the same drawer as the Log a visit form (type pills, title, provider, date, cost, notes, attachment) which files a future date as an appointment and a past one as a record.

Decisions with Nick (append to `decisions/log.md`):
- The shared band stays above the artboard's title block ("Health / Overview", Search health, the status eyebrow with its dot on the right); the artboard's LIGHT/DARK button is not drawn because the sidebar's Dark row is the app's theme control.
- Log a visit is real: a future date writes an appointment (`write_appointment`, which gains `provider_id`), a past date writes a record through a new `write_record` tool; the attachment is a real file input into the module's private bucket (`core/files.upload`, as Insurance does), and the record drawer's "Open the file" is a signed URL. Cost on a past entry is kept in the record's `fields` ("Cost": "$40 copay"); the artboard's "posts to Finance under Health" is not written because nothing posts.
- Rail actions are the app's: a screening card offers "Mark done" and "Snooze 3 mo" (existing tools) in place of "Request booking"; it reads SCHEDULED with "View appointment" when an upcoming appointment has the same name. The appointment drawer's action is "Mark done" for an upcoming one and nothing for a past one ("Add to calendar" and "File to Second Brain" have no path). The record drawer has no "Mark reviewed" (no such state).
- Vitals tiles are what the app holds: body weight from Fitness (tile source FITNESS), then the latest of each stored vital with its provenance as the source mark and a delta against the previous reading of the same metric when one exists, else the month it was measured. The artboard's WHOOP and WITHINGS tiles (resting HR, sleep, HRV) are not drawn: no module registers those metrics. The LDL tile's "Slightly high" is not written: the module's rule is that nothing here offers an opinion about a number (README, SPEC).
- The medications note is factual: "{taken} of {n} marked today." plus "{name} is down to {days} days." for the lowest refill at ten days or under; the artboard's "the agent will add a refill task" is not written because no job does.
- Insurance & cost keeps the lines the Insurance digest carries (premiums a year, a month, active policies, expiring); the artboard's Plan, Deductible, Out of pocket, Spend and HSA have no source. The footnote reads "Plan details live in Insurance."
- The drawer is the shared Overlay at `narrow` (480) rather than the artboard's 440: a fourth width for a 40px difference is not worth a prop, and the artboard's drawer has no band, so the crumb is the eyebrow kind ("Appointment", "Past visit", "Record · lab", "New entry").

## Artboard measurements (POS Health.dc.html lines 30 to 178; drawer 184 to 260; logic 350 to 490)

Title block (after the band): `padding 26px 28px 20px`, rule under, `align-items flex-end`, wraps: eyebrow with a dot (red when a screening is overdue, accent otherwise) "{n} screening(s) overdue · next visit {D Mon}" | "Nothing overdue · next visit {D Mon}" (or "· nothing booked"); h1 `clamp(22px, 2.2vw, 30px)` `margin-top 12`; lede 13px ink-3 1.55 `max-width 660` `margin-top 8`: "Appointments, medications, vitals and documents in one place. Vitals that Fitness already reads are pulled in rather than typed twice." Right: "Log a visit" accent-filled 40px `padding 0 16px` 13px white (`ActionButton variant="accent"` at h-10). In the app this is PageHeader's title row with the band's status carrying the eyebrow.

Two panes, wrap: left `flex 1 1 540px`, `padding 22px 28px 40px`, gap 28; right `flex 1 1 320px; max-width 400`, rule on top, `padding 22px 24px 40px`, gap 26.

Vitals: grid `auto-fit minmax(min(100%, 158px), 1fr)` gap 10; tile 1px rule-2 on bg-elev `padding 15`: 11px ink-3 name left, mono 9px 0.1em ink-3 source right; mono 25px/300 -0.02em value `margin-top 8`; mono 10px delta `margin-top 6` ink-3 (the artboard's accent deltas are judgments; ink-3 throughout).

Appointments: eyebrow "Appointments" with pills right (gap 6): Upcoming | History, the artboard's `pill`: 30px tall `padding 0 11px`, 1px rule-2 (accent + accent-soft when on), 10px 0.1em uppercase ink-3 (ink when on). Cards `margin-top 10`, 1px rule-2 (amber when HELD) on bg-elev `padding 16`, gap 12/16, wrap: a 58px block with mono 10px 0.1em month and mono 22px/300 day (accent; amber when HELD; ink-3 when past); 15px what with 11px ink-3 "{provider} · {location}" under; right mono 10px ink-3 time and a mono 9px 0.1em tag `padding 4px 7px` 1px border: CONFIRMED accent, HELD amber, DONE / CANCELLED ink-3 on rule-2. Empty: dashed rule-2 box `padding 30px 18px` centred: mono 20px/300 ink-2 "NOTHING BOOKED" and a 12px ink-3 line ("Nothing is on the calendar." rather than the artboard's sentence about two screenings, which is a count that varies). History = status done or starts_at in the past.

Medications & supplements: rows `padding 15px 0` rule under, wrap gap 12/14: 15px name ("{name} · {dose}"), 11px ink-3 detail "{schedule}[ · started {Mon YYYY}]"; mono 10px refill: "{n} DAYS LEFT" (amber at ten or under), "REFILL OVERDUE" red past it, nothing when no refill date; button: "Mark taken" small (32px `padding 0 12px` 10px 0.08em rule-2 ink-3) or "Taken today" (accent border, accent-soft, ink). Note 12px ink-3 `margin-top 12`.

Records: eyebrow "Records" with, right, a 150px search input (30px, 1px rule-2, 11px, placeholder "Search records") and the filter pills All | Labs | Visits | Imaging | Other (other = dental, vision, immunisation). Key row `padding 14px 12px 10px` rule-2 under, 10px 0.12em ink-3: "RECORD" and "TYPE · DATE · FILE". Rows `padding 15px 12px` rule under: 14px title with 11px ink-3 summary; right mono 9px 0.1em type (LAB accent, IMAGING amber, others ink-3), mono 10px ink-3 "12 MAR 2026", mono 9px 0.08em ink-3 file ("PDF" | "IMAGE" from the path's extension, "NO FILE" when none). Empty: "NO MATCHES" box with "Nothing in this filter matches "{q}"."; the query is a client filter over title, summary and kind.

Right pane. Due & overdue: cards `margin-top 10` `padding 14` on bg-elev, 1px rule-2 (red when OVERDUE): mono 9px 0.12em state (OVERDUE red, DUE SOON amber for due and soon, NEVER DONE ink-3, SCHEDULED accent) with mono 10px ink-3 "EVERY {n} MO" right; 14px name `margin-top 7`; 11px ink-3 `margin-top 4` "Last done {Mon YYYY} · {n} months ago" | "Never done" | "Booked for {D Mon}"; `margin-top 12` buttons: "View appointment" (accent border 34px, opens the drawer) when scheduled, else "Mark done" (accent border) and "Snooze 3 mo" (small). Shown: overdue, due, soon, never, scheduled; ok and snoozed are not cards. Insurance & cost: rows `padding 11px 0` rule under, 13px label, mono 12px ink-2 value; footnote 11px ink-3 `margin-top 12` "Plan details live in Insurance." with the link. Care team: rows `padding 12px 0` rule under: 13px name, mono 9px 0.1em ink-3 role uppercase right; 11px ink-3 "{phone} · {address|notes}".

Drawer (Overlay narrow): eyebrow kind in the band ("Appointment" | "Past visit" | "Record · {kind}" | "New entry"); body: 22px/400 -0.02em title, 12px ink-3 sub `margin-top 8` (appointment: "{provider} · {location}"; record: "{D MON YYYY} · {FILE} · {summary}"; form: "A date in the future lands on the appointment list; anything past goes straight to records."); rows `margin-top 22`, each `padding 13px 0` rule under: 10px 0.12em ink-3 key at 120px and 14px value. Appointment rows: When ("Fri 18 Sep 2026, 08:30"), Where, Provider, Prep, Cost estimate; NOTES block (10px key, 13px ink-2 1.6) when notes. Record rows: each `fields` entry in order, then Summary. Footer (in the body as drawn, `margin-top 26`, gap 10): appointment upcoming "Mark done" (accent 40px); record with a file "Open the file" (ctl: 40px, 11px 0.12em uppercase, rule-2); form "Save entry" (accent) and "Cancel" (ctl). Form: TYPE pills (Visit, Lab, Imaging, Dental, Vision, Immunisation), TITLE (42px input, "Annual physical"), PROVIDER select (the care team plus "Other"), DATE and COST side by side ("$40 copay"), NOTES textarea 96px ("What was decided, what to follow up on"), ATTACHMENT: a file input (PDF or image) with "No file" as the default; hint 12px ink-3: "Future date: this will appear under Appointments." | "Past date: this files under Records." ; red "A title and a date are required." when missing.

## Files

- `modules/health/data.ts`: `latestVitals()` also returns the previous reading per metric (`prev_value`, `prev_measured_at`); `listRecords()` adds `fields`, `file_path`, `appointment_id`; `listProviders()` adds `address`; `listAppointments()` adds `notes` and `provider_id`.
- `modules/health/manifest.ts`: `write_appointment` accepts `provider_id`; new `write_record` (title, kind, taken_on, summary, fields, file_path, appointment_id; registers a `record` entity type). `entityTypes` gains `record`.
- `modules/health/ui/actions.ts`: `logVisit(form: FormData)` (title, kind, provider, date, cost, notes, file; future → `write_appointment` with `cost_estimate_cents` parsed from a "$" string, past → upload then `write_record` with Cost in fields); `recordUrl(id)` (signed URL); the existing four stay.
- `modules/health/ui/HealthPage.tsx`: joins the previous reading into the tiles, the status eyebrow, `PageHeader` with the band status and the Log a visit action (a button opening `?new=1`).
- `modules/health/ui/Health.tsx`: the two panes to the measurements (tiles, appointments with the pills, meds, records with search and filters, the rail); drawer state in the URL: `?appt=<id>`, `?record=<id>`, `?new=1`.
- `modules/health/ui/HealthDrawer.tsx` (new): the keyed-rows drawer for an appointment and a record, and the Log a visit form.
- `modules/health/seed.ts`: providers gain addresses; one more record with `fields` (the lipid panel with LDL / HDL / Triglycerides) so the drawer has rows; unchanged otherwise.
- `e2e/screens.spec.ts`: the five health tests reworked (no tabs): the band status, a vitals tile with "FITNESS", the appointment card with CONFIRMED and its drawer rows, the Upcoming / History pills, Mark taken changes the note count, the records filter, the Due & overdue card with OVERDUE and NEVER DONE, Log a visit with a past date lands in Records.

## Tasks

### Task 0: Baseline
Plan to `docs/plans/health-fidelity.md`, decisions logged. Failing asserts: band `/screenings? overdue · next visit|Nothing overdue/`; "Appointments" eyebrow with the "Upcoming" and "History" pills; a card with "CONFIRMED"; "Medications & supplements"; the "Records" key row "RECORD"; rail card text "OVERDUE"; opening the physical shows "Prep" and "Cost estimate" rows; Log a visit with a past date shows the new row under Records.

### Task 1: Data and tools
data reads, `write_record`, `provider_id`, `logVisit`, `recordUrl`, seed. Check: `pnpm typecheck`, `pnpm test`. Commit: `feat: health records tool, log a visit, vitals with a previous reading`.

### Task 2: Page
Title block and band, the left pane, the rail. Check: page asserts; pairs. Commit: `fix: health page to the artboard`.

### Task 3: Drawers
`HealthDrawer.tsx`: appointment, record (Open the file), the form. Check: drawer asserts, the log a visit test. Commit: `feat: the health drawer and log a visit as the artboard draws them`.

### Task 4: Proof
`--grep health` both widths; typecheck, lint, unit; full e2e once. Pairs: page dark and light (1500 tall), the appointment drawer, the record drawer, the form. Phone at 402 against the shell rules (panes stack, tiles two up, cards wrap). STATUS.md, memory. Commit: `docs: health fidelity pass`.

## Verification
- `pnpm test`, `pnpm typecheck`, `pnpm lint`.
- `E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --project=desktop --grep "health"` and `--project=mobile`.
- Pairs in `/private/tmp/pos-handoff-sources/health/pairs/` sent to Nick.

## Out of scope
- Wearable metrics (resting HR, sleep, HRV), a calendar export, filing to the vault, booking requests, insurance plan figures, posting costs to Finance, and any other screen.
