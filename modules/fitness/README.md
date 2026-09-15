# Fitness

Workouts, sets, and body metrics. Screen 09 of the design bundle.

## Units are a rendering decision

Everything is stored unit free and integer: **grams** for mass, **metres** for
distance, **seconds** for time. Pounds and kilograms are both a rendering
choice, and storing either one makes the other lossy.

`units.ts` is the only file that knows about pounds, and it is tested. Two cases
worth knowing:

**Pace is derived, never stored.** It is a ratio of the distance and the
duration, so it cannot disagree with them. The test pins that it never produces
`7:60/km`, which is what naive rounding gives and is not a time.

**Best set is by weight, then reps.** 315 for five beats 315 for three, and both
beat 275 for ten. There is no one rep max estimate anywhere: that would be a
guess dressed as a number, and the screen shows what actually happened.

Body metrics use one `numeric` column with a documented unit per kind, rather
than five nullable columns. Weight in grams, sleep in minutes, heart rate in
beats, body fat in tenths of a percent.

## Training load is crude and says so

`load()` multiplies duration by a per-kind intensity factor. That is all it is.

There is a literature of training load models and every one of them needs data
this app does not have. The tile is labelled "duration by kind" rather than
"training load" alone, because a number presented as science that is really a
guess is worse than an honest guess. An unrecognised kind counts as ordinary
rather than free, so a sport nobody anticipated is not silently worth nothing.

## What is not here

SPEC asks for workout plans and a coaching agent. The design has no plan UI, and
decision 9 keeps features the design omits as a follow-on pass per module, so
there is no plan table. A table nothing writes is a table nobody maintains.

## Nothing is guarded

A workout is a record of something that already happened and a body measurement
is a reading. Neither is a decision an approval would catch, and a nightly
Strava import behind the Review inbox would fill it with two hundred rows nobody
would read.

`requires: ['strava']` is metadata, not a gate: since the module page shows a
banner rather than a wall, everything here works on hand-logged sessions.

## Metrics

`body_weight` returns **pounds**, not grams, for the same reason Finance's
metrics return dollars: a goal target is typed in the unit a person uses, and a
metric returning grams would read as a four hundred thousandfold overshoot on
the Goals screen.

## The plan, and a coach that cannot touch it

SPEC section 3 says the coaching agent proposes plan adjustments and the owner
approves. That is held literally: `write_plan` is the module's only guarded
tool, and the coach has no other path to a plan. Every suggestion becomes a row
in `core.proposals` and the plan does not move until you say so.

The rules are deterministic and live in `coach.ts` with tests. A layoff of ten
days or more, a week over week load jump of half again, a lift with no personal
best in three sessions, a week that fell short of the plan while load fell with
it. Most weeks it says nothing, and that is the point: a coach that proposes
something every week is noise, and noise in the Review inbox is how an inbox
stops being read.

No model call. "You jumped fifty percent in a week, back off" is not a
judgement worth paying for, and not one that should come out differently on two
Sundays with the same numbers.

The owner writes the plan from the Plan tab (v1.1 Phase 11): `PlanDrawer`
calls the same `write_plan` through `callTool` with the UI source, which the
guard does not stop, and rewrites the item list in the order the rows are
shown. Item notes are carried through an edit, not edited, so a note the coach
wrote survives.

## Trends, the filter row, and when Apple data arrived

The Trends tab draws one metric on a date axis through the shared `LineChart`
(`components/pos/LineChart.tsx`, the net worth chart's drawing with the money
taken out) over `spine()` from `core/series.ts`, so a reading every third day
is ten points on a thirty day axis, carried forward between them, and not ten
evenly spaced points. Thirty days of weight come with the page; 90 and 365 and
any other kind are one `readMetricSeries` action each, kept for the tab's life.

The Workouts tab's filter (kind, source, from, to) lives in the URL as a local
write and its rows come from `readWorkouts`, the same `screenWorkouts()` the
page renders from, so a link with a filter opens narrowed.

The band's "Apple data last arrived" reads `core.request_log`, the newest 200
on either Apple webhook route, rather than the rows' `created_at`: the inbound
upsert keeps `created_at` when a day is re-sent, and the log is what the
Connections card's Test already reads. It is its own line beside the Strava
clock, because "Strava · synced 07:02" for an Apple payload would name the
wrong source.

A suggestion already waiting is not repeated for a fortnight, so a nightly cron
does not become a nightly nag.

With no plan there is no target to fall short of, so the rules about missed
sessions say nothing at all rather than inventing a target you never agreed to.

`plan_item.reps` is text: '5', '8-12' and 'AMRAP' are all real, and a number
column would reject two of the three. `day_label` is free text for the same
reason a plan is not a calendar: pinning one to weekdays makes every missed
Tuesday look like a failure.
