# Skill Tree as its own module

## Why this plan exists

Phase 1 put the skill tree in `core`. The design handoff does not: §2 lists
Skill Tree among the modules that get **own schemas**, and the entity diagram in
§6 shows `skills` as a module schema with only `skill_links` staying in core.
SPEC agrees, and so does CLAUDE.md's rule that a module is one folder with one
manifest.

So this is two jobs in one step: move what is misplaced, then build the screen.
The move has to happen first and it has to happen now, before eleven more
modules are written against the current shape.

## Decided 2026-09-08

| # | Decision |
|---|---|
| 1 | The module contract gains an optional `classifier`. `register()` asks the registry for it. No module providing one means no classification, and nothing else breaks |
| 2 | The generic tree stays committed as yaml. Nick's real tree is rows in `skills.override`, edited in the UI. The repo keeps holding nothing personal |
| 3 | XP starts at zero. No Notion backfill in this step; Tasks and Second Brain import their own history later, which is where the event volume actually is |

## What moves

| Today | Becomes | Note |
|---|---|---|
| `config/skills.yaml` | `modules/skills/skills.yaml` | generic, committed, the fork default |
| `config/xp.yaml` | `modules/skills/xp.yaml` | |
| `core/classify.ts` | `modules/skills/classify.ts` | still writes `core.skill_links` |
| `core/xp.ts` | `modules/skills/xp.ts` | |
| `core.xp_weights` | `skills.xp_weight` | `alter table ... set schema`, so rows survive |
| `core.skill_overrides` | `skills.override` | same |
| `core.skill_xp` (view) | `skills.xp` | dropped and recreated: a view cannot change schema and keep its dependency on `core.level` |
| `core.level(int)` | `skills.level(int)` | |

Staying in core, per both SPEC and the handoff: `core.entities`, `core.events`,
`core.skill_links`. `skill_links` is the generic link table every module writes
through `register()`. It is not a skills-module table that happens to live in
core.

## The classifier seam

`core/module-contract.ts` gains one field:

```ts
/**
 * Links an entity to skills. Core calls this from register() for every row
 * every module creates. At most one module may provide it.
 */
classifier?: (entityRef: string, text: string, module: string) => Promise<void>
```

`core/modules.ts` gains `getClassifier()`, which throws at registry load if two
modules declare one. Silently picking the first would be a bug nobody could see.

### The hazard, and why the import is dynamic

`core/entities.ts` cannot `import { getClassifier } from './modules'`. The
registry imports `modules/_index.ts`, which imports every manifest, and
`modules/notes/manifest.ts` imports `register` from `core/entities.ts`. That is
a cycle, and it is the exact cycle that broke `pnpm setup` and the cron job on
2026-09-08: Next's bundler hoists around it and plain Node does not, so it fails
only outside Next, which is the half that is hardest to notice.

So `register()` resolves it at call time:

```ts
// Dynamic, not static. See docs/ARCHITECTURE.md "Module contract": a static
// import here closes a cycle through modules/_index.ts back to this file, and
// the failure only shows up outside Next.
const { getClassifier } = await import('./modules')
const classifier = getClassifier()
if (classifier) await classifier(entityRef, text, module)
```

## Migration

One migration, `<ts>_skills_module.sql`.

1. `create schema skills`, plus the grant block copied whole from
   `20260905223936_notes_init.sql`, including
   `alter default privileges in schema skills grant select on tables to pos_readonly`.
2. `drop view core.skill_xp` first, because it depends on `core.level`.
3. `alter table core.xp_weights set schema skills`, then rename to `xp_weight`.
   Rows and policies follow the table; the grants do not, so restate them.
4. Same for `core.skill_overrides` to `skills.override`.
5. `create function skills.level(int)`, then `drop function core.level(int)`.
6. `create view skills.xp` over `core.events` joined to `core.skill_links`
   weighted by `skills.xp_weight`. Reading up into core is what every module
   does; it is not a cross-schema key.
7. `grant select` on both tables and the view, and `grant execute` on the
   function, to `authenticated, service_role, pos_readonly`.

`skills.override` and `skills.xp_weight` already carry their `set_updated_at`
trigger and both policies from `core_init`'s loop, and those follow the table
across a schema change. Verify that in psql rather than assuming it.

No `skills.node` table. The tree is the yaml merged with `skills.override` rows,
which is the whole point of decision 2 and one fewer table to keep in sync.

## The module

```
modules/skills/
  manifest.ts          id 'skills', nav, pages, tools, jobs, classifier
  skills.yaml          the generic tree
  xp.yaml              event type weights
  classify.ts          rules first, model second, writes core.skill_links
  tree.ts              yaml merged with skills.override, read by classify and the UI
  xp.ts                level(), weights
  jobs/nightly-digest.ts
  ui/SkillTreePage.tsx
  seed.ts
  README.md
```

Tools: `get_digest`, `write` (create or rename a skill, an `skills.override`
row), `reassign` (move a link, sets `is_manual = true`). Nothing here costs
money, so `guarded: []`.

Digest, per SPEC: skills gaining fastest, skills stagnant 60+ days, skills with
high goal weight but low activity. The third needs Goals, so it ships empty with
a comment rather than a fabricated number.

## The screen

Built to `POS Skill Tree.dc.html`. Left: constellation with the deterministic
layout from design-build decision 8, root at centre, five attributes on a
150x120 ellipse, leaves fanned on an arc at r 330-364, categories at the
midpoint. No `d3-force`. Reset view, hover, click to inspect, double-click to
zoom, scroll and drag. Legend: gaining, active, stagnant 60d+.

Right rail on selection: path, name, level, XP, XP to next level, 30 day delta,
goal weight, last event. Then XP over 90 days as weekly bars, then events over
30 days with drag to reassign, then the keyword list, then children with their
30 day delta and level.

Character panel: level, title, XP, XP to next, and the five attributes with a
radar.

Every drop that reassigns an event writes `is_manual = true` on the
`core.skill_links` row, and nothing overwrites it afterwards.

**Goal weight has no source until Goals ships.** It renders as `--`, not as a
number I invented.

## Consequence: the Dashboard tile

`app/(app)/page.tsx:31` reads `core.skill_xp` directly. That view is moving, and
a core screen reading a module schema is what design-build decision 6 forbids
anyway. The tile changes to read the skills module's digest from `core.digests`,
which is the only cross-module read mechanism.

## Also touched

`core/database.types.ts` (regenerate), `core/db.test.ts` core table list,
`core/classify.test.ts` and `core/xp.test.ts` (move with their subjects),
`scripts/setup.ts` (seeds `xp_weights` from the yaml, both paths change),
ARCHITECTURE lines 47, 77, 166, 179, 184 and 191, and SPEC section 7.

## Not in this step

`register()` still emits `<type>_created` on every upsert, so editing a row a
second time awards XP twice, and there is still no `classify: false` opt-out for
entity types with no skill node. Both are listed under design-build's "Core
module changes" and both bite Tasks harder than they bite this. They stay
together in the step that adds `update()`.

## Verification

```
pnpm typecheck && pnpm lint && pnpm test
supabase migration up                       # not reset: it would destroy the provider keys
psql "$LOCAL" -c "\dt skills.*"
psql "$LOCAL" -c "select count(*) from skills.xp_weight"    # equals the yaml
psql "$LOCAL" -c "select * from skills.xp order by xp desc limit 5"
pnpm setup:demo && pnpm test:e2e
```

Then delete `modules/skills/` in a scratch copy and confirm `pnpm setup:demo`
still completes and `register()` still writes entities and events. That is the
one test that proves the seam is a seam.

Screenshots at 1440px and 402px in both themes, compared against the prototype,
with the differences reported rather than a claim that they match.

## Risks

1. **The schema move is the risky half, not the screen.** Policies and grants
   behave differently under `set schema`, and the failure mode is a table that
   reads fine as the owner and is invisible to `authenticated`. The verification
   above checks each one in psql rather than trusting it.
2. **The dynamic import is load bearing.** If someone later "tidies" it into a
   static import, everything still works in `pnpm dev` and breaks in the cron
   job and in `pnpm setup`. The comment says so at the call site.
3. **Constellation performance at 60+ nodes** is unmeasured. The layout is
   deterministic so there is no simulation loop, but hit testing and the hover
   tooltip are not free. Measure before adding nodes, not after.
