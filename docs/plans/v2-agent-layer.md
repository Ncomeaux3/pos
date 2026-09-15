# v2: the agent layer

## Context

docs/SPEC-v2.md specifies v2. This is how it gets built.

The draft spec Nick brought on 2026-09-14 was written against a v1 that does
not exist any more: it proposed a credential vault, a connector registry, an
approval gate, an audit trail, a runs table and a push channel, all six of
which ship today under other names. The review found six conflicts, four of
them with logged decisions. Fourteen questions were put to Nick the same day
(AskUserQuestion, two rounds); those answers plus two corrections I made after
them are the sixteen 2026-09-14 v2 entries in decisions/log.md, and the table
below is that list.

What that leaves is genuinely new: per-verb permission on integrations, an
action state machine over the existing proposals table, run budgets, a Postgres
queue, a memory tier, and a nightly suggestion pass.

The shape of the whole thing follows from one decision: v2 stays on Vercel
Hobby with one daily cron and the $10 cap. So there is no long-lived agent
process, no external queue, and no runner-level egress policy. Every run is
either nightly batch work or a single approved action that drains its own queue
in the request that approved it.

## Decisions carried in (2026-09-14, all in decisions/log.md)

| Decision | Chosen | Rejected |
|---|---|---|
| Runner | Vercel Hobby plus a Postgres queue drained by cron and explicit triggers | Vercel Pro frequent crons; a VPS; cutting long runs |
| Ledger | Extend `core.proposals` and `core.write_log` | A new `core.actions`; a third table for external actions only |
| Integrations | Extend `defineIntegration` with verbs, level on `core.connections` | A parallel connector registry with YAML manifests and a second credential store |
| Cost cap | $10 a month, unchanged | $25; $50; split model and infra caps |
| Plans | `goals.plan`, `goals.plan_step` | `core.plans`; a new agent module |
| Chat | No in-app chat. Review and Agent Log grow | A full chat thread; deferring the question |
| First integrations | The three already written, then Gmail read, Calendar and GitHub propose | Gmail first |
| Voice | Out of v2 | Web Speech; hosted STT; self-hosted |
| Default level | The migration backfills `read` for rows already connected, `none` for everything else and everything future | `none` for all four (breaks three live syncs for a day); `read` as the default (drops the guarantee) |
| Sync scope | Every outbound verb goes through one executor, nightly syncs included | agent-initiated calls only; syncs read-only by construction |
| Start | After v1.1 ships and OWNER-TODO 12 to 16, the owner's own data | phone polish first; phase 0 now |
| Gmail | `gmail.readonly`, publishing status In production and unverified, client query scoped to one label | whole mailbox; `gmail.metadata` (headers only); swapping Calendar into phase 5 |
| Auto-approve | `core.auto_approve_rules` ships empty, rules written after four weeks of manual approval | seeding rules for the read verbs on day one |
| Secret store and queue | Secrets stay in `core.connections`; the queue is a Postgres table | A second credential store; Redis or a hosted queue |
| Phase 0 scope (correction) | The three outbound clients are SimpleFIN, `github_vault` and Strava; the two Apple Health routes are inbound and gated at the webhook | Apple Health as the third outbound client, which was my framing error |
| Phase 1 fixture (correction) | `integrations/fixture/` ships in the repo so phases 1, 2 and 4 have a write verb to prove themselves against | Proving the ledger on module tool proposals only; pulling Calendar forward |

## When this starts

Two things come first, and neither was in view when this was written on
2026-09-14.

**v1.1.** docs/plans/pos-v1-1.md is twelve phases of bug fixes, speed work and
features on the modules that already ship, and it is the in-flight plan. v2
starts after it. Phase 12 of v1.1 is the hardening pass (error pages, `pnpm
audit` in CI, `maxDuration` on the API routes, a secret rotation note), and v2
adds API routes and a queue on top of exactly those, so taking it first means
not doing it twice.

**OWNER-TODO steps 12 to 16** (2026-09-14): the Obsidian vault, SimpleFIN, the
Health readings Shortcut, workouts, and push on the phone. All owner work. Step
17 was on this list when it was written and is already settled, so it is off it.
Phase 0 is worth more once the integrations it covers carry real data rather
than skipping every night, and phase 4 needs the VAPID pair that step 16 adds,
or its approval push is dark.

Strava is the exception and does not gate anything. Item 11 is deferred, and
v1.1 moved workouts to Apple Health because a Strava API app now needs a paid
Strava subscription. Phase 0 still wires `integrations/strava/client.ts` onto
`runVerb`, because the client is written and the rule is that every outbound
client goes through the executor; it just may never carry real data, so nothing
in phase 0's done condition depends on a live Strava connection.

The phone polish pass and the per-module phone passes are independent of this
and can run in either order around it.

## Phase 0: verbs, permission and the verb executor

No new provider. This phase proves the permission model against the three
integrations with outbound clients (SimpleFIN, the Obsidian vault, Strava) and
gates the two inbound ones (`health_auto_export`, `apple_shortcuts`) at the
webhook route. None needs an OAuth app to be registered. The 2026-09-14 answer
named "Apple Health" among the outbound three; that was my framing error, since
both Apple Health routes are pushes with no outbound call. Strava is the third
outbound client and takes that place.

The three infrastructure providers core uses directly (anthropic, voyage,
resend) declare no verbs and are untouched. See SPEC-v2 4.5.

### Changes

- `core/integration-contract.ts`: `IntegrationVerb` type (`id`, `direction`,
  `risk`, `reversible?`, `cacheTtl?`), and `verbs?`, `hosts?`, `rateLimit?` on
  `IntegrationManifest`. Optional throughout, so an integration that declares
  nothing behaves as it does today.
- `core/permission.ts` (new, pure, no imports beyond types): `decide()` per
  SPEC-v2 4.4, returning `'execute' | 'propose' | 'refuse'`. Its test is
  written first and covers all seven rules plus the two that are easy to get
  wrong: `none` refuses a UI call, and `autonomy = 'act'` does not raise a
  `propose` level integration.
- Migration `<ts>_core_integration_verbs.sql`: `permission_level` on
  `core.connections` defaulting to `'none'`, one `update ... where status =
  'connected'` backfilling those rows to `'read'` so the nightly run keeps
  working, and `core.connection_verb_grants` with the five statements every new
  core table needs (updated_at trigger, RLS, owner policy, read policy, three
  grants), per the note in core_platform.
- `core/credentials.ts`: `getPermission(integrationId)` and
  `setPermission(integrationId, level, verbId?)`. Disconnect grows into one
  transaction that also deletes grants and cancels approved-not-executed
  actions for that integration.
- `core/fetching.ts`: `request(url, { method, headers, body, ... })` with the
  same three layers `get()` has; `get()` becomes a call to it. Needed because
  the file is GET-only today and SimpleFIN claims its token with a POST.
  `fetching.test.ts` gains the POST and header cases against the same real
  local server the GET tests already use.
- `core/verbs.ts` (new): `runVerb(integrationId, verbId, args)`, the one path
  to the network for an integration that declares verbs. Consults `decide()`,
  resolves credentials, enforces `rateLimit` and `cacheTtl`, sends through
  `request()` against the manifest's `hosts`, records the call. A refusal is
  an error the caller reports, which for a sync job means the job records why
  it did nothing, the same way an unconnected sync already skips.
- `integrations/simplefin/client.ts`, `github_vault/client.ts`,
  `strava/client.ts`: their `fetch` calls move onto `runVerb`. This is most of
  the phase, and it is what makes revocation actually stop a sync.
- `integrations/simplefin/manifest.ts`, `github_vault`, `strava`: declare
  their verbs and `hosts`. All are read today, so every verb is
  `direction: 'read'`, `risk: 'none'`.
- `app/api/integrations/[id]/webhook/route.ts`: a push for an integration at
  level `none` is refused with 403 and logged to `core.request_log` before the
  secret check, so a disabled inbound integration cannot be probed for its
  secret either. `health_auto_export` and `apple_shortcuts` declare no verbs.
- `app/(app)/settings/connections/`: a level selector per provider card and, on
  an expanded card, a per-verb override row. The card already carries auth
  chip, status dot and the test strip; this is one more row, not a redesign.

### Tasks

1. `core/permission.test.ts` red, `core/permission.ts` green. Commit:
   `feat: one function decides whether an integration verb may run`.
2. The contract type and the migration. Check: `supabase migration up` against
   the live local database, never `db reset`. Commit:
   `feat: integrations declare verbs and carry a permission level`.
3. `core/verbs.ts` with its test first: a verb at `none` refuses; a refused
   sync records why rather than throwing past the runner; a client cannot reach
   the network except through it. Commit:
   `feat: one executor for every outbound integration call`.
4. The three manifests and clients, the webhook gate, `getPermission` and
   `setPermission`, and the disconnect transaction, with a test proving a
   disconnect cancels an approved action and one proving a level `none` push
   is refused before the secret is compared. Check: one nightly run locally,
   all three syncs behaving as before. Commit:
   `feat: permission and verbs on the integrations that exist`.
5. The Settings rows, and `ui-verifier` at 402 and 1440. Commit:
   `feat: Settings sets an integration's permission level per verb`.

### Done when

SimpleFIN, the vault and Strava declare verbs, carry a level, and reach the
network only through `runVerb`; both Apple Health routes carry a level that
gates their webhook. A level of `none` refuses a read from the UI, refuses a
nightly sync (which records why), and refuses a push with a 403. The nightly
run is otherwise unchanged, proven by one full local run.

## Phase 1: the ledger and the fixture integration

No write verb exists before phase 6, so this phase and the two after it need
something to execute. `integrations/fixture/` is that: a real manifest with
`hosts: []`, a client that writes to `fixture.call` in its own schema instead
of the network, and verbs `read_rows` (read, none), `write_row` (write, low,
reversible), `write_medium` (write, medium) and `send` (write, high, not
reversible). Phase 10's demo mode is this integration with seeded rows. It
ships in the repo, because a fork's tests and demo need it for the same two
reasons.

### Changes

- `integrations/fixture/manifest.ts`, `client.ts`, and migration
  `<ts>_fixture_init.sql` for its one table. It appears on Settings >
  Connections like any provider; its Test always passes.
- Migration `<ts>_core_action_ledger.sql`: the thirteen columns on
  `core.proposals` from SPEC-v2 5.1, the widened status check, the unique index
  on `idempotency_key` where not null, and `proposal_id` on `core.write_log`.
  Additive only. Existing rows get `risk = 'none'` and nulls, which is what
  they are: module tool proposals with no integration.
- `core/actions.ts` (new): `proposeAction()`, `approveAction()`,
  `executeAction()`, `expireActions()`. The state machine lives here and
  nowhere else. `executeAction()` refuses anything not in `approved`, refuses
  an expired approval by predicate in the SQL rather than by reading and
  checking, and writes `core.write_log` through `logWrite()` on success.
- `core/idempotency.ts`: the key is a hash of integration, verb and a canonical
  JSON of the payload. Tested against key ordering, so `{a,b}` and `{b,a}` are
  one key.
- `core/proposals.ts`: `approve()` keeps working for module tool proposals and
  delegates to `core/actions.ts` when `integration_id` is set.
- `core.action_audit` view in the same migration.

### Tasks

1. `core/idempotency.test.ts` red, then green. Commit:
   `feat: the same intent proposed twice is one idempotency key`.
2. The migration. Commit: `feat: core.proposals carries an action through to its result`.
3. The fixture integration. Commit:
   `feat: a fixture integration so the ledger has something to execute`.
4. `core/actions.ts` with its test first, every case against the fixture:
   nothing executes outside `approved`; a duplicate key raises a Postgres
   unique violation, not an application error; an expired approval does not
   execute; a fixture `write_row` approved once executes once. Commit:
   `feat: the action state machine`.
5. The audit view and the Agent Log reading it. Commit:
   `feat: the audit trail is a view over the ledger`.

### Done when

An approved fixture write executes exactly once, and a duplicate idempotency
key is rejected by Postgres rather than by application code.

## Phase 2: auto-approve and taint

### Changes

- Migration: `core.auto_approve_rules` with `max_risk` constrained to exclude
  `high`, and `derived_from_external` already added in phase 1. No seed rows:
  decided 2026-09-14, rules get written after four weeks of manual approval.
- `core/permission.ts`: rule matching, the daily limit counted through
  `core.today()`, and the two refusals (high risk, tainted).
- `core/actions.ts`: a run marks itself tainted when a read verb returns
  external content; actions proposed by a tainted run carry the flag.
- `core/writelog.ts`: undoing a write that an auto-approve rule produced
  disables that rule.

### Tasks

1. Tests first, all four red: high risk cannot auto-approve; a tainted action
   cannot auto-approve; the daily limit drops the verb to manual for the rest
   of the owner's day; undo disables the rule. Then the code. Commit:
   `feat: what may approve itself, and what may never`.
2. The Settings surface for rules. Commit: `feat: auto-approve rules in Settings`.

### Done when

Both refusals are proven by tests that fail without the code.

## Phases 3 to 10

Each is a plan of its own, written when the phase starts. Deliverable and done
condition only, so the order and the stopping points are fixed now.

| Phase | Deliverable | Done when |
|---|---|---|
| 3 | Run budgets on `core.job_runs`, `core.run_queue`, `/api/agent/tick` | A runaway run terminates on each of the three budgets and records `termination_reason` |
| 4 | Review and Agent Log grow the action surface; three notification rules | An approval from the phone executes the action and the Agent Log shows it |
| 5 | Gmail at `read`, scoped to one label | Real mail fetched from the POS label through `runVerb`, `cacheTtl` honoured, every message tainted |
| 6 | Google Calendar and GitHub at `propose` | Each executes one approved write verb end to end |
| 7 | `core.facts`, extraction, forget | A tombstoned fact does not reappear after a full re-extraction |
| 8 | Nightly suggestion pass, `core.suggestion_suppression` | Suggestions appear in Review; three dismissals disable the class |
| 9 | `goals.plan`, `goals.plan_step` | One goal produces a versioned plan with mixed task and action steps |
| 10 | Demo mode, persona, the personal-data pre-commit check | A clean clone runs on the fixture integration with zero credentials configured |

Phases 0 to 4 are the product. Stopping there leaves an agent doing real work
on real accounts under approval.

## Verification

Per phase, and the suite in full before each PR:

```
pnpm typecheck && pnpm lint && pnpm test
pnpm test:e2e
```

Plus, for any phase touching a screen, `ui-verifier` at 402 and 1440 px in both
themes, and `spec-reviewer` before the PR. `prod-auditor` on phase 10.

Every phase that adds a migration applies it with `supabase migration up`
against the live local database. `supabase db reset` destroys the provider keys
in `core.connections` and is not used.

Since 2026-09-15, CI fails a PR that adds a file under `supabase/migrations`
until the PR description carries `db push: done` or `db push: not needed`.
Phases 0, 1, 2, 3, 7 and 9 each add one, so each of those PRs carries the line,
and `supabase db push` is run by hand before the merge that deploys the code
reading the new schema.

## Phase 5 prerequisite, owner work

Gmail needs a Google Cloud project before phase 5 starts, and one setting in it
decides whether the nightly sync survives its first week. OWNER-TODO item 22
carries it. The short version: create the project, add the Gmail API, request
`gmail.readonly`, set publishing status to **In production**, do not submit for
verification, and click through the unverified screen when connecting. Left at
Testing, every refresh token expires after 7 days.

Research is in docs/SPEC-v2.md section 14, and every claim in it is marked
verify: Google's documentation domains were blocked by the session's egress
proxy, so it rests on secondary sources.

## Out of scope

- In-app chat, voice, and always-on listening. Decided out on 2026-09-14.
- Any hosted multi-tenant version. v2 ships as a self-host template.
- Agent-initiated payments. No verb in v2 moves money.
- Browser automation. API first; a browser connector needs a written
  justification in connections.md and a named fallback, and none is proposed.
- Work adjacent accounts of any kind.
- Replacing `core.proposals` with a better-named table. The name is wrong and
  the rename costs more than it returns.
