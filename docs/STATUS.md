# Status

Where the build actually is. Updated at the end of each step. Read this first
in a fresh session, then `docs/plans/design-build.md` for what comes next.

Last updated: 2026-09-08, platform screens, Tasks, Goals and the Weekly
Review. Branch `skills-module`.

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
pnpm typecheck && pnpm lint && pnpm test    # 497 tests, 47 files
pnpm test:e2e                               # 125 specs, 1440px and 402px, both themes
pnpm setup:demo                             # idempotent bootstrap
```

Screenshots land in `e2e/__screens__/` (gitignored). The e2e seed owns
`core.job_runs` outright: the dashboard's Run now button adds a real run on
nearly every pass, and after a few the seeded ones fell out of the Agent
Log's seven-run window. Tests use their own
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

Known gaps on the Skill Tree screen: goal weight shows `--` because Goals does
not exist, and there is no Notion backfill, so XP starts at zero by decision.

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
