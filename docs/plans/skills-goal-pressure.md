# The Skill Tree digest's third bullet

## Context

SPEC section 7 asks the skills digest for three things: skills gaining fastest, skills stagnant 60+ days, and "skills with high goal weight but low activity". The nightly digest (`modules/skills/jobs/nightly-digest.ts`) computes the first two and hardcodes the third as `underGoalPressure: never[]` with the comment "Goals does not exist yet". `docs/OWNER-TODO.md` carries that as an open decision. Both are stale: Goals exists, goals link to skills through `core.skill_links` with a weight, and the Skill Tree page already computes a `goalWeight` per skill (`modules/skills/data.ts`, the third query: `sum(sl.weight * sl.confidence)` over links whose entity is in `core.entities` with `module = 'goals'`) and draws the "Goal weight high, low activity" column from it (`modules/skills/ui/SkillTree.tsx:107`: `goalWeight > 0 && gained30d <= 0`, weight descending, top 4).

So the digest's bullet is the page's column, computed at night and written to `core.digests` where the orchestrator and the tile read it. Nick chose this item (AskUserQuestion, 2026-09-12).

Decision for `decisions/log.md`: goal weight is the sum of `weight * confidence` over the skill links of goals, the number the Skill Tree page already shows; "low activity" is no XP in 30 days, the page's rule; the digest lists up to five leaf skills, weight first. Rejected: a per-skill weight column on goals (a second number to keep in step with the links the classifier already writes); rolling parent weights into the digest (a parent under pressure is its children, and the page already rolls up for display).

## Changes

- `modules/skills/pressure.ts` (new, pure, no imports): `underGoalPressure(rows: { skillId; name; goalWeight; gained30d }[], limit)` returning the rows with weight above zero and no gain in 30 days, weight descending, cut to `limit`. `pressure.test.ts` first: filters out zero weight and out anything that gained; sorts by weight; respects the limit.
- `modules/skills/data.ts`: the goal weights query becomes an exported `goalWeightBySkill(): Promise<Map<string, number>>` used by `loadSkillTree()` (same SQL, no behaviour change).
- `modules/skills/jobs/nightly-digest.ts`: `underGoalPressure` typed `{ skillId; name; goalWeight; gained30d }[]`; computed from `goalWeightBySkill()` and the existing per-skill `gained_30d` (a linked skill with no events at all is absent from `rows`, so its gain is 0, which is the case the bullet exists for). Stale comment goes.
- `modules/skills/ui/SkillTree.tsx`: the `aimed` memo calls `underGoalPressure(leaves, 4)` instead of its inline filter, so the page and the digest cannot drift.
- `core/orchestrator.ts`: no change. The headline already names the stagnant skill; adding a second skills sentence is a different decision.
- `modules/skills/README.md`: the two digest rows gain "under goal pressure". `docs/OWNER-TODO.md`: the item is ticked with the date and what changed. `decisions/log.md` entry above.

## Tasks

1. `pressure.test.ts` red, `pressure.ts` green. Commit: `feat: which skills are under goal pressure is decided in modules/skills/pressure`.
2. `data.ts`, the digest, the page. Check: `pnpm test modules/skills`, `pnpm typecheck`, `pnpm lint`; run the job once against the local database (`pnpm exec tsx --env-file=.env -e` calling `nightlyDigest()`) and print `underGoalPressure`; the e2e `--grep "skill tree"` on desktop unchanged. Commit: `feat: the skills digest names the goal-weighted skills that have gone quiet`.
3. README, OWNER-TODO, decision, STATUS line, memory. Commit: `docs: the third skills digest bullet`.

## Verification

- `pnpm test modules/skills` (new file plus the existing skills tests), `pnpm typecheck`, `pnpm lint`.
- One run of `nightlyDigest()` locally printing the new field with the demo seed's goals.
- `E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --grep "skill tree"` both projects.

## Out of scope

- A new dashboard tile row or headline sentence for the bullet; the tile follows the Dashboard artboard.
- The other two owner decisions (`digest_hour`, the SPEC table amendment).
