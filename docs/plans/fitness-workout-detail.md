# Fitness: sync visibility and workout detail

Rules: one phase is one branch, one PR, and one fresh session, cut from `origin/main` after the Holon release PR has merged. A phase is Done only when its exit checks pass and its PR is merged. Tick task boxes as they finish. Written 2026-09-20 after the Sep 19 run went missing: the phone had posted a stale secret for three days (401s from 09-17 11:40) and then a metrics-only automation for two, and the Fitness screen read "syncing" through both. The owner's answers are in decisions/log.md under 2026-09-20.

## Status

| Phase | Goal | Complexity | Depends on | Status | PR |
|---|---|---|---|---|---|
| 1 Sync visibility | The band says what arrived and what was refused; the nightly email says when the phone stops getting through | low | Holon release merged | | |
| 2 Workout detail | Every scalar Health Auto Export sends is kept and shown in a drawer; the row shows the start time | medium | 1 (band wording), migration pushed | | |
| 3 Backfill | The 217 existing workouts carry stats | owner step | 2 deployed | | |

Every UI phase's exit checks include: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` pass; an e2e in `e2e/screens.spec.ts` for the flow (workers 1); ui-verifier at 402 and 1440 px with no Must fix; spec-reviewer before the PR. Not repeated per phase.

## Phase 1: sync visibility

Goal: a rejected post, and a stretch with no accepted post, are visible on the Fitness band and raised by the nightly digest. No schema change.
Complexity: low
Files: `modules/fitness/data.ts`, `components/pos/SyncBand.tsx`, `modules/fitness/ui/FitnessPage.tsx`, `modules/fitness/jobs/nightly-digest.ts`, `integrations/health_auto_export/manifest.ts`, `e2e/seed.mts`, `e2e/screens.spec.ts`, `docs/SETUP-INTEGRATIONS.md`.

Today `lastArrived()` reads `max(occurred_at)` of 200s on the two Apple webhook routes. Both automations post to the same route, and the request log has no body, so the route alone cannot say whether readings or workouts came. The rows can: the inbound upsert runs `on conflict do update` on every push, the `set_updated_at` trigger fires on every update, so `max(updated_at) where source in ('health_auto_export', 'apple_shortcuts')` on `fitness.body_metric` and on `fitness.workout` is when each kind last arrived.

- [ ] `data.ts`: `lastArrived()` becomes `arrivals()` returning `{ readings: string | null, workouts: string | null, rejected: number, lastAccepted: string | null }`. `readings` and `workouts` from the two tables' `updated_at`; `rejected` counts request_log rows on the two routes with `status <> 200` after `lastAccepted` (the newest 200, or the last 7 days when there is none).
- [ ] `SyncBand`: `arrived` becomes `arrivals`; the line reads "Readings 11:04 · workouts Sep 19 06:42" through `syncClock` (owner timezone from `core/clock.ts`, never `toLocaleTimeString` without one), "never" for a null. When `rejected > 0` a second run in the warn tone: "3 posts rejected since then. Check the secret in both automations." linking to `/settings/connections`.
- [ ] `nightly-digest.ts`: after the digest, when `rejected > 0`, or `lastAccepted` is older than 2 days and the integration is connected, `queue({ title: 'Apple Health is not getting through', body, href: '/settings/connections' })`. One row a night at most: the sender bundles, and the orchestrator's dedupe only touches the `digest` channel, so this uses the default channel like insurance's reminders and is written only when the condition holds.
- [ ] `health_auto_export` manifest `test()`: "Last payload received {when}; {n} rejected since" when n > 0, so the Connections card says it too.
- [ ] `docs/SETUP-INTEGRATIONS.md`: one line under the Health Auto Export section on what the band and the email now say.
- [ ] e2e: the seed inserts two 401 rows on the webhook route after a 200 and one `health_auto_export` workout; `/fitness` shows both arrival times and the rejected line; the line is absent when the seed has no 401s (one assertion each).

Exit checks: `data.test.ts` or `inbound.test.ts` covers `arrivals()` against seeded rows (rejected count, the 7-day fallback); suites green.
Out of scope: distinguishing the two automations by name (the route cannot), a per-integration alert rule in Settings.

## Phase 2: workout detail

Goal: a workout keeps every scalar Health Auto Export v2 sends, the row shows the start time, and a drawer shows the lot.
Complexity: medium
Files: new migration `fitness_workout_stats`, `integrations/health_auto_export/client.ts` and test, `modules/fitness/inbound.ts` and test, `modules/fitness/data.ts`, `modules/fitness/units.ts` and test, `modules/fitness/ui/Fitness.tsx`, new `modules/fitness/ui/WorkoutDrawer.tsx`, `modules/fitness/manifest.ts` (query tool returns stats), `core/database.types.ts` (regenerated), `e2e/seed.mts`, `e2e/screens.spec.ts`, `modules/fitness/README.md`.

Storage is one column, `fitness.workout.stats jsonb not null default '{}'`. Nothing sorts or filters by any of these fields, so none is promoted to a column; the two the row needs, start time and duration, are already columns. Promote later if a filter wants one.

The keys, normalised to the app's units at parse time so the UI never converts twice (seconds, metres, kcal, bpm, degrees C, percent, MET; the HAE units field decides the conversion, as `length()` and `energy()` do today):

| key | from HAE v2 | note |
|---|---|---|
| `endedAt` | `end` | ISO with offset, the same `DATE` check as `start` |
| `location` | `location` | Indoor, Outdoor, Pool, Open Water; `isIndoor` when `location` is absent |
| `totalKcal` | `totalEnergy` | active stays in `detail` for the row and lands here too as `activeKcal` |
| `met` | `intensity` | |
| `avgSpeedMps`, `maxSpeedMps` | `avgSpeed`, `maxSpeed` (or `speed`) | mph and kmph to m/s |
| `elevationUpM`, `elevationDownM` | `elevationUp`, `elevationDown` | ft and m |
| `tempC`, `humidityPct` | `temperature`, `humidity` | degF and degC |
| `minHr`, `maxHr` | `heartRate.min`, `heartRate.max` (or `maxHeartRate`) | avg stays in `avg_hr` |
| `steps` | `stepCount` when scalar; the sum of `qty` when an array | verify the array shape against a real export |
| `cadenceSpm` | `stepCadence` | |
| `flights` | `flightsClimbed` | |
| `lapLengthM`, `stroke`, `swolf`, `strokes` | `lapLength`, `strokeStyle`, `swolfScore`, `totalSwimmingStrokeCount` | swims only |

Arrays (`heartRateData`, `heartRateRecovery`, `route`, `activeEnergy`, `basalEnergy`, the cycling and swim series, `walkingAndRunningDistance`) are dropped at parse. A key HAE did not send is absent, not null. Manual, agent and Shortcut workouts have `{}`.

- [ ] Migration: `alter table fitness.workout add column stats jsonb not null default '{}'`. `pnpm gen:types`.
- [ ] `client.ts`: `Workout` gains `stats: WorkoutStats`; `toWorkouts` fills it; `WorkoutStats` is the table above as a type with every key optional. Test: the pinned real shape in `client.test.ts` gains the optional fields (from a workout in the owner's export, numbers only, no personal data beyond what the fixture already carries) and asserts each key and its unit conversion; a v1 workout still writes nothing; an array in `stepCount` sums.
- [ ] `inbound.ts`: the upsert writes and updates `stats`. Test: a re-send replaces stats; a manual `log_workout` row keeps `{}`.
- [ ] `data.ts`: `listWorkouts` returns `stats` and `endedAt`; `manifest.ts` `query` passes it through.
- [ ] `units.ts`: `speed(mps, unitSystem)` (min/mi pace already exists for runs; speed in mph or km/h for rides), `elevation(m)`, `temperature(c)`. Unit tests beside the existing ones.
- [ ] `Fitness.tsx`: the date cell shows the date over the start time (`shortDate` plus a `clock` from `core/clock.ts`, two lines at 13 and 11px, the column stays 72px). Row click opens the drawer instead of expanding; the inline `Linked skills` block moves into the drawer.
- [ ] `WorkoutDrawer.tsx`: `Overlay` like `PlanDrawer`. Head: name, kind chip, source chip. Sections in `MetricStrip` and `DiffRow`s: Time (date, start to end, duration), Effort (distance, pace or speed, avg and max speed, MET), Heart rate (min, avg, max), Energy (active, total), Terrain and conditions (elevation up and down, temperature, humidity; hidden when every key is absent), Steps (steps, cadence, flights), Swim (lap length, stroke, SWOLF, strokes; swims only), Linked skills (`SkillPicker`). A section whose keys are all absent is not rendered; a workout with `{}` shows Time, Effort as today, and skills. Sentence case, no tracked uppercase, Holon tokens only.
- [ ] e2e: the seed writes one `health_auto_export` run with a full `stats` object; the row shows "6:42 am" under the date; clicking opens the drawer; three assertions (max HR, elevation, end time); a seeded manual workout opens with no Terrain section.

Exit checks: `client.test.ts` green against the extended fixture; suites green; PR description carries `db push: done` before merge.
Depends on: 1 (the band's wording is set there). Out of scope: heart rate curve, route map, editing stats by hand, Strava stats (its sync keeps writing `{}` until someone maps its fields).

## Phase 3: backfill

Owner step, after Phase 2 is deployed and its migration pushed.

- [ ] In Health Auto Export, Manual Export: custom range 2026-01-01 to today, Workouts, export version 2, Include Workout Metrics on, Include Route Data off, JSON. Share to this machine.
- [ ] From `~/VsCode/pos-baseline` (main, fast-forwarded): `HAE_SECRET=<Reveal on the card> pnpm exec tsx scripts/hae-backfill.mts <file>`; the upsert fills `stats` on every existing row and earns no XP twice. Rotate the secret afterwards if it was pasted into the transcript.
- [ ] Verify in production: a January workout opens with a heart rate section; the Workouts badge still reads 217 plus whatever arrived since.

## Platform concerns

- Both automations post to one route. The request log cannot tell them apart; the tables' `updated_at` can, because the upsert always updates and the trigger always fires. A workout post on a rest day carries no workouts and moves nothing, so "workouts last arrived" is the last workout, not the last post; the 2-day alert reads the request log, which counts either post.
- The orchestrator deletes unsent `digest`-channel rows each run. The fitness alert must use the default channel or it is wiped before the sender reads it.
- `stats jsonb default '{}'` adds a column to a 217-row table; the migration is instant. The PR goes red until `db push: done`; merging deploys code that writes `stats`, so push before merge or every push 500s on the missing column.
- Include Workout Metrics on adds `heartRateData` arrays to each workout. A 30-minute run is a few hundred points; a 7-day post stays well under Vercel's 4.5 MB request body limit (verify with one real post; the backfill script already chunks by month and 20 workouts).
- Dates: the row's clock and the drawer's times go through `core/clock.ts` with the owner's timezone. A client component renders on the server in UTC.
- `scripts/hae-backfill.mts` is on main only; Phase 3 runs from `pos-baseline`.
- The Holon release PR (holon to main) merges first; both phases cut from `origin/main` after it, never from the `holon` checkout at `~/VsCode/pos`.

## Open decisions

None. Five closed in the interview on 2026-09-20: summary fields only (no time series); start time on the row; history backfilled by a re-run; band plus nightly email; build on main after the Holon release. One assumption to confirm: stats as one jsonb column with nothing promoted, where the interview suggested max HR and elevation as columns. Nothing reads them by column, so they are not.
