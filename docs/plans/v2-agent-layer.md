# v2: the agent layer

## Context

docs/SPEC-v2.md specifies v2. This is how it gets built.

The draft spec Nick brought on 2026-09-14 was written against a v1 that does
not exist any more: it proposed a credential vault, a connector registry, an
approval gate, an audit trail, a runs table and a push channel, all six of
which ship today under other names. The review found six conflicts, four of
them with logged decisions. Nine were resolved with Nick the same day
(AskUserQuestion, two rounds) and are in decisions/log.md.

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

## Phase 0: verbs and permission on what is already connected

No new provider. This phase proves the permission model against SimpleFIN, the
Obsidian vault and Apple Health, none of which needs an OAuth app.

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
  `core.connections` defaulting to `'none'`, and `core.connection_verb_grants`
  with the five statements every new core table needs (updated_at trigger, RLS,
  owner policy, read policy, three grants), per the note in core_platform.
- `core/credentials.ts`: `getPermission(integrationId)` and
  `setPermission(integrationId, level, verbId?)`. Disconnect grows into one
  transaction that also deletes grants and cancels approved-not-executed
  actions for that integration.
- `integrations/simplefin/manifest.ts`, `github_vault`, `health_auto_export`,
  `apple_shortcuts`: declare their verbs and `hosts`. All are read today, so
  every verb is `direction: 'read'`, `risk: 'none'`.
- `app/(app)/settings/connections/`: a level selector per provider card and, on
  an expanded card, a per-verb override row. The card already carries auth
  chip, status dot and the test strip; this is one more row, not a redesign.

### Tasks

1. `core/permission.test.ts` red, `core/permission.ts` green. Commit:
   `feat: one function decides whether an integration verb may run`.
2. The contract type and the migration. Check: `supabase migration up` against
   the live local database, never `db reset`. Commit:
   `feat: integrations declare verbs and carry a permission level`.
3. The four manifests plus `getPermission`/`setPermission` and the disconnect
   transaction, with a test proving a disconnect cancels an approved action.
   Commit: `feat: permission and verbs on the four integrations that exist`.
4. The Settings rows, and `ui-verifier` at 402 and 1440. Commit:
   `feat: Settings sets an integration's permission level per verb`.

### Done when

Each of the four integrations declares verbs, carries a level, and `decide()`
is enforced on every call. A level of `none` refuses a read from the UI.

## Phase 1: the ledger

### Changes

- Migration `<ts>_core_action_ledger.sql`: the twelve columns on
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
3. `core/actions.ts` with its test first: nothing executes outside `approved`;
   a duplicate key raises a Postgres unique violation, not an application
   error; an expired approval does not execute. Commit:
   `feat: the action state machine`.
4. The audit view and the Agent Log reading it. Commit:
   `feat: the audit trail is a view over the ledger`.

### Done when

An approved action executes exactly once, and a duplicate idempotency key is
rejected by Postgres rather than by application code.

## Phase 2: auto-approve and taint

### Changes

- Migration: `core.auto_approve_rules` with `max_risk` constrained to exclude
  `high`, and `derived_from_external` already added in phase 1.
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
| 5 | Gmail at `read` | Real mail fetched through `core/fetching.ts`, `cacheTtl` honoured, every message tainted |
| 6 | Google Calendar and GitHub at `propose` | Each executes one approved write verb end to end |
| 7 | `core.facts`, extraction, forget | A tombstoned fact does not reappear after a full re-extraction |
| 8 | Nightly suggestion pass, `core.suggestion_suppression` | Suggestions appear in Review; three dismissals disable the class |
| 9 | `goals.plan`, `goals.plan_step` | One goal produces a versioned plan with mixed task and action steps |
| 10 | Demo mode, persona, the personal-data pre-commit check | A clean clone runs on fixtures with zero credentials configured |

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

## Out of scope

- In-app chat, voice, and always-on listening. Decided out on 2026-09-14.
- Any hosted multi-tenant version. v2 ships as a self-host template.
- Agent-initiated payments. No verb in v2 moves money.
- Browser automation. API first; a browser connector needs a written
  justification in connections.md and a named fallback, and none is proposed.
- Work adjacent accounts of any kind.
- Replacing `core.proposals` with a better-named table. The name is wrong and
  the rename costs more than it returns.
