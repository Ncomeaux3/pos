# Status

Where the build actually is. Updated at the end of each step. Read this first
in a fresh session, then `docs/plans/design-build.md` for what comes next.

Last updated: 2026-09-10, the design pass over every screen, the Skill Tree
rework and the phone pass. Branch `main`.

## Done

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
Brain: no embeddings exist for notes yet.

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

See docs/plans/design-build.md.

The registry cycle that blocked steps 12 and 13 is fixed: both registries load
in a plain Node process, which is what lets `pnpm setup` and the cron job work
outside Next.

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

**Gestures.** Swipe between tabs, swipe a task to complete or reopen it, pull
down on the dashboard to sync. Touch and pen only, so a mouse drag over a task
title still selects text. The decision about what counts as a swipe is in
`core/gestures.ts` with tests; the pointer listening is in
`components/pos/gestures.ts`.

The plan's fourth gesture, long press to arrange the dashboard, is not built:
the dashboard has no stored tile order, so there is nothing to arrange yet.

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

## Integrations: three of four stubs are now real

Strava, the Obsidian vault and SimpleFIN were manifest-only stubs whose
`test()` returned "not verified", so none could be connected even once a
credential existed. All three have clients, real Test buttons and nightly sync
jobs. Health Auto Export is the one left, and it needs a paid iOS app.

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

