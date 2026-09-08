# Status

Where the build actually is. Updated at the end of each step. Read this first
in a fresh session, then `docs/plans/design-build.md` for what comes next.

Last updated: 2026-09-08, end of step 11. Branch `phase-1-core`, 26 commits
ahead of `main`.

## Done

**Phase 1 steps 1 to 11 of 16.** Steps 1 to 7 shipped 2026-09-05; the design
bundle landed 2026-09-07 and steps 0, 7.5 and 8 to 11 followed.

| Step | What exists |
|---|---|
| 1 to 7 | Scaffold, core migration, auth, crypto/settings/llm, module registry with the `notes` stub, entities/events/xp/classify, integration registry and Connections |
| 0 | Design bundle adopted as the screen spec, 17 decisions logged |
| 7.5 | ComeauxVerse brand layer: tokens, Manrope, type scale, radius, ~20 primitives in `components/pos/`, sidebar and mobile tab bar, login rebuilt |
| 8 | Hybrid search, Search page, command palette |
| 9 | Proposals, the guard, the Review screen, migration `core_platform` |
| 10 | Query tool, rate limiter, request log, storage buckets |
| 11 | MCP endpoint at `/api/mcp`, Settings Agents and MCP tab |

## Verification

```
pnpm typecheck && pnpm lint && pnpm test    # 229 tests, 22 files
pnpm test:e2e                               # 29 specs, 1440px and 402px, both themes
```

Screenshots land in `e2e/__screens__/` (gitignored). Tests use their own
`pos_test` database, rebuilt from migrations by a vitest globalSetup;
`core/db.ts` refuses any other database while `VITEST` is set.

## Live and connected

Anthropic, Resend and Voyage are all connected in `core.connections`. The full
pipeline is verified against real providers: entities embed through Voyage,
classification splits between keyword rules and `claude-haiku-4-5`, and
`core.llm_calls` records the spend the soft cap depends on.

## Screens built

Login, Dashboard (placeholder), Notes, Search, Review, Settings General,
Settings Connections, Settings Agents and MCP. Command palette on Cmd K.

Not yet built: the real Dashboard tiles, Notifications, Agent Log, Onboarding,
Weekly Review, and every module beyond the `notes` stub.

## Next: step 12

Job runner, notifications, orchestrator, and the Dashboard with its nine bento
tiles. This is the nightly run and the first digest email.

**Known blocker for step 12 and 13.** The module registry cannot load in a
plain Node process: a manifest imports its React pages, and the tsx transform
fails on it (`__name is not a function`). Worked around once in
`core/proposals.ts` by importing `getModule` lazily inside `approve()`. The
cron route runs inside Next so it may be unaffected, but `scripts/setup.ts` in
step 13 is not, and this needs solving properly rather than working around
again. Likely shape: split the manifest so `pages` is loaded separately from
`tools` and `jobs`.

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
  re-run for a later migration.
