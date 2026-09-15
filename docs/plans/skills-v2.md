# Skills v2 build plan

Rules: one phase is one branch, one PR, and one fresh session. A phase is Done only when its exit checks pass and its PR is merged. Tick task boxes as they finish so progress survives compaction. Written 2026-09-15 from the owner's Skill Tree spec (docs/SKILLS.md) and the code as it stood at main 03e4aa7; the interview decisions are in decisions/log.md under that date.

Order: after v1.1 Phases 11 and 12, before the v2 agent layer. Phases run in sequence; each depends on the one before.

## Status

| Phase | Goal | Complexity | Depends on | Status | PR |
|---|---|---|---|---|---|
| 1 Tree | New skills.yaml (9 attributes, about 180 leaves), aliases, meta, patch overrides, old ids remapped | medium | v1.1 done | Not started | |
| 2 Snapshots and XP | core.event_skill_links, XP view without confidence, xp.yaml single source, none marker, model threshold | high | 1 | Not started | |
| 3 Projects, challenges, achievements | Projects register and complete, weight 2/1 picker, two tables and three tools | high | 2 | Not started | |
| 4 Digest and review queue | New digest fields, stagnant re-sorted, active-goal pressure, resolve_unclassified | low | 3 | Not started | |
| 5 Screen | Constellation treatments, YOU stats, evidence rail, review queue, alias search | high | 4 | Not started | |
| 6 Verification and record | e2e, prod audit, docs, cost measured | low | 5 | Not started | |

Every UI phase's exit checks include: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` pass; an e2e in `e2e/screens.spec.ts` for the flow; ui-verifier at 402 and 1440 px with no Must fix; spec-reviewer before the PR. A phase with a migration carries `db push: done` in its PR description. Not repeated per phase.

## Context

The Skill Tree today has 25 leaves under 5 attributes, multiplies XP by classifier confidence, computes XP from an entity's current links (so reclassifying rewrites history), and has no notion of projects, challenges or achievements as evidence. The owner wrote a new spec (pasted 2026-09-15) that redefines the tree as 9 attributes, about 45 categories and about 180 leaves, freezes XP attribution at event time, removes confidence from the XP formula, distributes one XP budget across an event's skills, and adds projects, challenges and achievements as evidence sources plus a review queue for unclassified rows.

This plan turns that spec into a build plan. It runs after v1.1 (Phase 11 owner step and Phase 12 hardening) and before the v2 agent layer. Six phases, one session and one PR each.

Decided with the owner on 2026-09-15 (log each to decisions/log.md in Phase 1):

- Sequencing: own plan, after v1.1, before v2 agent layer.
- Old skill ids in production are remapped in a migration to their closest new leaf, then existing events are backfilled into the snapshot table from the remapped links. History shows the new names.
- Snapshot storage is a table, `core.event_skill_links`, append-only by grant.
- Late links: an event with no accepted link at emit time stores no snapshot rows. The first real placement (nightly model pass or a human `skills.link`) writes the snapshot for that entity's snapshot-less events. A first write is not a rewrite. After that the rows are immutable.
- Challenges and achievements live in the `skills` schema, no new module.
- Projects register in `core.entities`; primary skills are links with weight 2, secondary weight 1, through the shared SkillPicker. Project gains status; completion emits `project_completed`.
- No-skill-by-default entity types: transaction, subscription, policy, record. They get a `none` marker, never queue, never earn XP.
- `xp.yaml` is the single source of `skills.xp_weight`. It uses the real emitted event names. Module migrations that seeded weights are left as shipped; a new migration reseeds.
- Keywords: drafted precision-first for leaves with specific vocabulary; soft leaves ship without and go to the model.
- Screen: built from the owner's doc in the current visual language, no prototype round.
- New MCP tools: `skills.resolve_unclassified` only (plus challenge and achievement writes). `get_skill`, `get_evidence`, `review_unclassified` are not built; reads go through the page and core `query`.
- Stagnant stays 60 days, goal pressure 30 days.
- The owner's doc lands as `docs/SKILLS.md` (em dashes and arrows stripped, event names corrected); `docs/SPEC.md` section 7 gets a dated amendment line pointing at it.
- `milestone_achieved`, `skill_taught`, `system_built` are dropped from `xp.yaml` until something emits them.
- Goal skill links use the same primary/secondary toggle as projects (weight 2 and 1); goal pressure sums link weights of active goals.

Pre-existing bugs found during planning, fixed by this plan because the new weights table cannot work without it: `xp.yaml` names event types nothing emits (`goal_achieved` vs `goal_reached`, `recipe_cooked` vs `meal_cooked`, `transaction_categorized` vs `transaction_categorised`), and module migrations seed their own `skills.xp_weight` rows that disagree with `xp.yaml` (`goal_reached 120`, `task_completed 10`).

Out of scope, by the owner's doc: habits (the goals `streak` kind is the nearest thing), skill prerequisites, credentials, skill decay, historical Notion import.

## Repo rules this plan depends on

- No em dashes anywhere. The owner's doc uses them and arrows; strip them when copying text into docs, yaml or UI copy.
- Migrations are the only source of schema; never edit a shipped one; every new table grants select to pos_readonly; a PR with a migration needs `db push: done` in its description.
- Manual (`is_manual`) rows are never overwritten. Rules before model. Every model decision stores confidence and classified_by.
- Simplest approach that works. No helper abstractions.
- Tests before the feature for classification rules and XP calculation.
- ui-verifier at 402 and 1440 after any screen change; spec-reviewer before each PR; prod-auditor on the last phase.

## Findings from the code that shape the phases

- New tables need the full block from `supabase/migrations/20260909130000_core_push.sql` (RLS on, `owner_all` policy, grants to authenticated and service_role) plus the `readonly_select` policy for `pos_readonly` from `core_init.sql:280`, which `core_push.sql` forgot. The default-privileges grant is automatic; the RLS policy is not.
- `skills.xp` must be `drop view` then `create view ... with (security_invoker = on)` and the grants restated. No dependent views.
- Three places join `core.events` to `core.skill_links` and `skills.xp_weight` themselves: `modules/skills/data.ts:108`, `modules/skills/jobs/nightly-digest.ts:58`, `e2e/seed.mts:305`. All move to `core.event_skill_links` in Phase 2 or they keep the confidence factor and disagree with the view.
- `emit()` always has an `entityRef` (type `string`); no null branch. Nothing calls emit inside a transaction; two autocommit statements are fine.
- Classifier signature is in `core/module-contract.ts:83`. The `none` marker is written by the skills classifier, not by core: `register()` passes `entityType` and a `skills: false` flag through, and `classify()` writes the marker. Core never learns a skill id.
- Call sites for `skills: false`: `modules/finance/manifest.ts:56,117,148`, `modules/finance/seed.ts:234`, `modules/insurance/manifest.ts:129,159`, `modules/insurance/seed.ts:112`, `modules/health/manifest.ts:131`, `modules/health/seed.ts:143`.
- Project status: `tasks.project.archived` boolean exists with six readers. Do not add a status enum beside it. Add `completed_at timestamptz` only; status is derived (`completed_at` set: completed; `archived`: archived; else active).
- Skill names for the snapshot come from `getSkillNames()` in `core/modules.ts:53` (request-cached since v1.1 Phase 3).
- Digest field names are read by `core/orchestrator.ts:218` (`stagnant[].name`, `lastEventAt`), `core/review-glance.ts:127-135` (`xpThisWeek`, `attributes[].skillId`, `level`, `gainedThisWeek`), `modules/skills/ui/Tile.tsx` and `manifest.ts:150`. Keep every existing name; `gainedThisWeek` stays (no rename to topSkillsThisWeek), new fields are added.
- "Active goal" for goal pressure: skills may not read `goals.goal`. Active = the goal entity has no `goal_reached` event in `core.events`. Archived-but-unreached goals still count; known gap, noted in the README.
- `e2e/screens.spec.ts:304-520` hardcodes ids `engineering`, `coding`, `typescript`, `health`, `travel`, `negotiation`, `__you` and the text `Keywords · skills.yaml`. Keep those ids where the node survives (`engineering` and `health` stay as attribute ids with new names; `coding` becomes the Software category's id; `travel` becomes the Travel category's id) and update the spec's text assertions in Phase 1.
- `skills.override.kind` check constraint lives in `core_platform.sql:67`; the Phase 1 migration drops and recreates it with `patch`.
- Old id remap must be `insert ... on conflict do nothing` then `delete`, because two old ids can merge into one leaf and `unique (entity_ref, skill_id)` would reject an `update`.
- `pnpm gen:types` covers `public` and `core` only; run it after the Phase 2 core table. Skills-schema tables do not appear in it.
- Classification is not gated by `llm_soft_cap_cents` (`core/llm.ts:36` caps research and summary only). Cost with 180 leaves and descriptions is about 4.5k input tokens per batch, 10 batches a night, Haiku. Log the number in Phase 6.
- `docs/plans/skills-goal-pressure.md` recorded weight x confidence; dropping confidence changes that decision. Log it.

## Phase 0 (done in the planning session): docs

- [x] This file.
- [x] `docs/SKILLS.md`: the owner's doc with an Amendments block; `docs/SPEC.md` section 7 points at it.
- [x] Decisions appended to `decisions/log.md`.
- [ ] `docs/STATUS.md` names this plan as next once v1.1 Phase 12 merges; `modules/skills/README.md` is updated as each phase lands.

## Phase 1: the tree

Files: `modules/skills/skills.yaml`, `modules/skills/tree.ts`, `modules/skills/tree.test.ts`, `modules/skills/classify.ts`, `modules/skills/classify.test.ts`, `modules/skills/manifest.ts` (write tool gains `patch`), one migration `supabase/migrations/<ts>_skills_tree_v2.sql`.

1. New `skills.yaml`: the owner's 3.1 tree verbatim (ids snake_case, stable). Node fields: `id, parent?, name, description?, keywords?, aliases?, is_meta_skill?`. Attributes carry the doc's descriptions. `is_meta_skill: true` on the twelve listed leaves (the doc lists "Speaking", which is the category; use `public_speaking`). Keywords precision-first; carry over every existing keyword list to its surviving leaf.
2. `tree.ts`: `Override.kind` gains `'patch'` with a jsonb `patch` column (`description, keywords, aliases, is_meta_skill`); `mergeTree` applies patches after renames. `SkillNode` gains `aliases` and `isMeta`. `leaves(nodes)` helper stays inline (a filter), no new module.
3. `classify.ts`: `matchByRules` matches keywords and aliases, leaf nodes only (a node is a leaf when no node names it as parent). Word boundary rule unchanged.
4. Migration: `alter table skills.override add column patch jsonb`; drop and recreate the `kind` check with `patch`; for each old id (map below) `insert into core.skill_links (entity_ref, skill_id, weight, confidence, classified_by, is_manual) select entity_ref, '<new>', ... from core.skill_links where skill_id = '<old>' on conflict (entity_ref, skill_id) do nothing`, then `delete ... where skill_id = '<old>'`. `core.events` is untouched.
7. `e2e/screens.spec.ts` skill tree tests: update text assertions for renamed nodes; ids listed in the findings survive.
5. Old id map (owner checks in the PR): `typescript, python, sql, cloud, devops, rag, negotiation, strength, endurance, nutrition, sleep, preventive_care, cooking` keep their ids; `architecture -> systems_architecture`, `agents -> ai_agents`, `evals -> ai_evals`, `product -> product_development`, `sales -> sales_discovery`, `finance_literacy -> financial_analysis`, `marketing -> growth_marketing`, `writing -> clear_writing`, `speaking -> public_speaking`, `personal_finance -> budgeting`, `travel -> travel_planning`, `home -> home_maintenance`.
6. Tests: `tree.test.ts` (patch merge, leaf detection, meta flag, deleted parent still takes descendants, 3-level cap on custom nodes); `classify.test.ts` (alias hit, category keyword ignored, old keyword lists still hit their remapped leaf). A migration replay in CI proves the remap.

Layout needs nothing: `ui/layout.ts` divides the circle by `attributes.length` already (`wedge = 2 * Math.PI / attributes.length`), so 9 attributes place themselves. Phase 5 checks legibility at 180 leaves.

## Phase 2: snapshots and XP

Files: `core/events.ts`, `core/events.test.ts`, `core/entities.ts`, `core/modules.ts` (classifier signature), `modules/skills/classify.ts`, `modules/skills/jobs/reclassify.ts` and test, `modules/skills/xp.yaml`, `modules/skills/xp.ts`, `modules/skills/xp.test.ts`, `modules/skills/data.ts`, `scripts/setup.ts` (seeds xp_weight), the four modules that pass `skills: false` (finance transaction and subscription, insurance policy, health record), one migration `<ts>_skills_event_snapshots.sql`.

1. Migration, in order:
   - `create table core.event_skill_links (id uuid pk, event_id uuid not null references core.events on delete cascade, skill_id text not null, skill_name_snapshot text not null, weight numeric not null check (weight > 0 and weight <= 1), source_link_id uuid, classified_by_snapshot text not null, created_at timestamptz default now(), unique (event_id, skill_id))`, index on `skill_id`. RLS on, `owner_all` policy, `readonly_select` policy for pos_readonly. Grants: select and insert to authenticated, all to service_role (jobs), select to pos_readonly. No update or delete grant to authenticated: append-only by grant. No `updated_at`, no trigger.
   - Backfill: for every event with an entity, insert one row per accepted link (`skill_id not in ('unclassified','none')`), weight = `sl.weight / sum(sl.weight) over (partition by event)`, `skill_name_snapshot` from a `values` list of (id, name) generated from the new yaml and pasted into the migration, so it replays in CI with no app code; `on conflict do nothing`.
   - `truncate skills.xp_weight` and reseed from the new `xp.yaml` values (pasted as a `values` list; `scripts/setup.ts` keeps reading the yaml for fresh installs). `xp_weight` gains `kind text` (exposure, learning, practice, execution, outcome, mastery).
   - `drop view skills.xp; create view skills.xp with (security_invoker = on)` with `skill_id, xp, level, event_count, last_event_at, xp_7d, xp_30d, xp_365d`, XP = `w.weight * esl.weight`, from `core.event_skill_links esl join core.events e join skills.xp_weight w`. No confidence. Restate the grants.
2. `xp.yaml`: the owner's table with real names. `article_read 2, note_created 1, task_completed 5, workout_logged 5, meal_cooked 3, goal_checkin 3, idea_researched 5, book_finished 25, challenge_completed 25, trip_completed 20, project_completed 75, goal_reached 100, achievement_unlocked 5`. `milestone_achieved`, `skill_taught` and `system_built` are not listed until something emits them. Everything else absent, so zero. Each entry carries `kind`.
3. `core/events.ts emit()`: after `insert ... returning id`, one second statement: `insert into core.event_skill_links (event_id, skill_id, skill_name_snapshot, weight, source_link_id, classified_by_snapshot) select $1, sl.skill_id, coalesce($names->>sl.skill_id, sl.skill_id), sl.weight / sum(sl.weight) over (), sl.id, sl.classified_by from core.skill_links sl where sl.entity_ref = $2 and sl.skill_id not in ('unclassified','none')`, with names from `getSkillNames()` (`core/modules.ts:53`) passed as jsonb. Zero accepted links means zero rows, by construction.
4. `register()` passes `entityType` and an optional `skills: false` flag to the classifier. The classifier type in `core/module-contract.ts:83` becomes `(entityRef, text, module, entityType, opts?: { skills?: false }) => Promise<void>`. Core writes no skill id.
5. `classify.ts`: with `skills: false` it writes the marker `(entity_ref, 'none', confidence 0, classified_by 'none')` and returns. New `snapshotPending(entityRef)`: for events of the entity with zero `event_skill_links` rows, insert normalized rows from the current accepted links (same select as emit's). Called by `reclassify.ts` after a batch places a row, and by `skills.link`, `skills.reassign` and `skills.resolve_unclassified` when the entity had no accepted link before.
6. `reclassify.ts`: prompt gains entity type per item and `id: name (description)` per leaf; parse `{ref, skill_id, confidence}`; apply only `confidence >= 0.70` (`MODEL_ACCEPT_THRESHOLD` const beside `BATCH`); then `snapshotPending` for each placed entity. Rows the model scores under 0.70 stay parked; `unclassified` marker cleared only when at least one link was accepted. Selection excludes `none`.
7. `data.ts:108`, `nightly-digest.ts:58` and `e2e/seed.mts:305`: the events query reads `core.event_skill_links` instead of `core.skill_links` (XP per event comes from the snapshot); `xpToNext` unchanged. The digest reads `xp_7d` and `xp_30d` from the view instead of recomputing them.
9. Log to `decisions/log.md`: confidence removed from XP (supersedes the weight x confidence line in `docs/plans/skills-goal-pressure.md`).
8. Tests: `xp.test.ts` still proves TS `level()` equals SQL `skills.level()`; add a view test: one event with three links weights 2/2/1 and weight 100 yields 40/40/20 and character 100. `events.test.ts`: emit with no accepted link writes zero rows; emit with `unclassified` only writes zero rows. `reclassify.test.ts`: 0.69 stays parked, 0.70 links and snapshots the entity's earlier event; a second run does not rewrite. `entities.test.ts`: `skills: false` writes the `none` marker and nothing queues.

## Phase 3: projects, challenges, achievements

Files: `modules/tasks/manifest.ts` (write_project gains status, complete path), `modules/tasks/data.ts`, `modules/tasks/ui/ProjectsDrawer.tsx`, `components/pos/SkillPicker.tsx` (weight toggle), `core/skill-links.ts` (weight in `SkillChip`), `modules/skills/manifest.ts` (three new tools), `modules/skills/data.ts`, migrations `<ts>_tasks_project_status.sql` and `<ts>_skills_challenge_achievement.sql`.

1. `tasks.project` gains `completed_at timestamptz` only. Status is derived: `completed_at` set is completed, `archived` is archived, else active. `listProjects` (`data.ts:77`) keeps its `archived = false` filter; completed projects stay listed until archived. `PROJECT_PATCHABLE` gains `completed_at`.
2. `write_project` registers the project in `core.entities` (`entityType 'project'`, `emit: false` on create; `manifest.ts entityTypes` gains `'project'`). Passing `completed: true` sets `completed_at` once and registers with `eventType: 'project_completed'`; a second call is a no-op on the event. The classifier runs on the project name, so rules give it links; the owner sets primary and secondary in the drawer.
3. SkillPicker: an optional `weights` prop. Each chip gets a "primary" toggle that calls `skills.link` with `weight: 2` (the tool's zod schema gains optional `weight`, default 1, allowed 1 or 2; `app/(app)/settings/skills/actions.ts:52 linkSkill` passes it). `core/skill-links.ts listSkillLinks` selects `sl.weight` and `SkillChip` carries it. The other drawers pass nothing and are unchanged. ProjectsDrawer and GoalDrawer pass `weights`.
4. `skills.challenge (id, title, description, completed_at, source, external_id, created_at, updated_at, unique (source, external_id))` and `skills.achievement (id, title, description, achieved_on date, source, external_id, created_at, updated_at, unique (source, external_id))`, each with the full core_push block plus `readonly_select` and the `set_updated_at` trigger. Both register in `core.entities` (entityType `challenge`, `achievement`; `skills` manifest `entityTypes` gains both) so the SkillPicker links them. Tools: `skills.write_challenge`, `skills.complete_challenge` (emits `challenge_completed`), `skills.write_achievement` (emits `achievement_unlocked`). Unguarded: they spend nothing.
5. Tests: manifest tests for the three tools (refusals on bad status, emit on complete), `skill-links.test` for weight, a tasks test that completing a project emits once and re-completing does not.

## Phase 4: digest and review queue

Files: `modules/skills/jobs/nightly-digest.ts` and test, `modules/skills/pressure.ts`, `modules/skills/data.ts` (`goalWeightBySkill` filters active goals), `modules/skills/manifest.ts` (`resolve_unclassified`), the dashboard skills tile (`modules/skills/ui/Tile.tsx`).

1. Digest shape keeps every existing field name (`attributes[{skillId,name,level,xp}]`, `totalXp`, `characterLevel`, `gaining`, `xpThisWeek`, `gainedThisWeek`, `stagnant[{skillId,name,lastEventAt,idleDays}]`, `underGoalPressure`) and adds `attributes[].xp30d`, `recentAchievements` (last 5), `recentChallenges` (last 5 completed). `stagnant` rule changes to: xp > 0, `last_event_at` older than 60 days, sorted by xp desc then idle days desc, top 5. `gaining` reads `xp_30d` from the view.
2. `goalWeightBySkill` (`data.ts:60`) excludes goal entities that have a `goal_reached` event in `core.events`. Skills does not read `goals.goal`; archived unreached goals still count (README known gap).
3. `skills.resolve_unclassified({ entity_ref, skill_id? })`: with a skill, same as `skills.link` (manual, human, confidence 1, then `snapshotPending`); without, deletes the `unclassified` row and writes the `none` marker (`is_manual = true` so no job revives it).
4. Tests: digest test with a fixture proving sort orders and the active filter; manifest test for both branches of `resolve_unclassified`.

## Phase 5: the screen

Files: `modules/skills/ui/SkillTree.tsx`, `Constellation.tsx`, `layout.ts`, `layout.test.ts`, `WeeklyBars.tsx`, `data.ts`, a new `ReviewQueue.tsx` inside `ui/`, `components/pos/SkillPicker.tsx` (HUMAN badge label and confidence text), `e2e/screens.spec.ts`.

1. Constellation: node treatments from the owner's doc, each one attribute on the node data from `data.ts`: `isMeta` ring, `stagnant` muted, `goalLinked` marker, `pressured` marker, and one "unresolved" satellite node near the root whose size is the unclassified count. Size by level as today. Check legibility at 180 leaves at 402 and 1440; if the leaf ring overlaps, raise `LEAF_R` or stagger, decided by screenshot.
2. YOU center: `characterLevel`, `totalXp`, `xp30d` from the digest data.
3. Attribute summary: the existing `Radar` with nine axes.
4. Rail for a leaf: the doc's field list (level, XP, XP to next, xp_7d, xp_30d, last practiced, event count, goal pressure, keywords, aliases, description). Sections: recent evidence grouped by `xp_weight.kind`, active goals, projects developing this skill (projects linked to the skill via `core.skill_links`), linked entities, classification history (the entity's links with classified_by). Actions: rename, edit description, edit keywords, add alias (all through `skills.write` patch), reassign, link, unlink, delete custom, restore.
5. Review queue: a band or drawer listing entities linked to `unclassified` (type, title, created, model attempts from `core.request_log` is not worth the join; show attempts only if `reclassify` records them on the link row, else omit), actions assign (SkillPicker) and no-skill-needed (`resolve_unclassified`).
6. Search over name, aliases, description, keywords; results carry the node kind.
7. SkillPicker badge map gains `human: ['HUMAN', ...]`; keep `MANUAL` label only if the artboard says so.
8. ui-verifier at 402 and 1440; e2e: select a leaf, rail shows evidence; resolve one unclassified row from the queue.

## Phase 6: verification and record

- Full e2e run, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` through test-runner.
- prod-auditor on the branch; fix or schedule findings.
- `docs/STATUS.md`, `docs/plans/skills-v2.md` table, `modules/skills/README.md`, `decisions/log.md` final entries.
- Record cost: one night of reclassify with the bigger prompt, read from `core.request_log`.

## Platform concerns map

| Concern | Where | Phase |
|---|---|---|
| Migration must be pushed before merge (`db push: done`) | Phases 1, 2, 3 PRs | 1, 2, 3 |
| `skills.xp` view recreate drops dependents; `data.ts` and the digest read it by column name | Phase 2 migration | 2 |
| Backfill runs on production rows; run once, idempotent (`on conflict do nothing`) | Phase 2 migration | 2 |
| Old id remap on production links; `unique (entity_ref, skill_id)` collisions | Phase 1 migration | 1 |
| CI migrations job replays every migration into pos_test; both migrations must replay clean from empty | CI | 1, 2, 3 |
| `pnpm gen:types` after each migration | each migration phase | 1, 2, 3 |
| Cron `maxDuration` and reclassify prompt growth (~180 leaves x ~10 tokens plus descriptions, ~2.5k input tokens per batch, 10 batches a night, Haiku): well under `llm_soft_cap_cents 1000` | `app/api/cron`, `core/llm.ts` | 2 |
| MCP tools need zod schemas and manifest tests | Phases 3, 4 | 3, 4 |
| Phone width 402: constellation with 180 leaves, review queue band | Phase 5 | 5 |
| Dashboard tile reads digest field names | Phase 4 | 4 |
| `pos_readonly` grants on every new table and the view | each migration | 1, 2, 3 |
| Branch protection (v1.1 Phase 12) requires `check` and `screens` green | every PR | all |

## Verification

- Phase 1: `pnpm test modules/skills` green; CI migrations job green; after `db push`, `select skill_id, count(*) from core.skill_links group by 1` shows no old ids.
- Phase 2: the view test (40/40/20); after `db push`, `select sum(xp) from skills.xp` equals the sum over `core.event_skill_links` times weights; the Skill Tree page shows the same character XP before and after (allowing for the removed confidence factor, which the PR description states with the before and after numbers).
- Phase 3: complete a project in the drawer, `core.events` has one `project_completed`, `core.event_skill_links` has rows with weights summing to 1 favouring the primary skill.
- Phase 4: `curl` the cron or Run now, `core.digests` latest skills row has the new fields; the dashboard tile renders.
- Phase 5: ui-verifier screenshots at 402 and 1440; e2e screens spec green.
- Phase 6: test-runner report, prod-auditor report, STATUS updated.
