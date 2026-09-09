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
