# POS (Personal Operating System)

Single-user personal operating system: a database-backed app with modules (Finance, Skill Tree, Tasks, Goals, Insurance, Second Brain, Ideas, Fitness, Meals, Travel) plus an orchestrator agent that reads module digests. This repo is also the Claude Code workspace that builds and operates it, and it is a fork-and-fill template: the code holds nothing personal.

Owner: Nick. Solo, nights and weekends. Finish one module before starting the next.

## Read on demand, not every session
- How it is built: docs/ARCHITECTURE.md (read before touching core, a manifest, or a migration)
- Full module spec: @docs/SPEC.md (use /module <name> to load one module's section)
- Unresolved choices: @docs/DECISIONS.md (ask before scaffolding anything they affect)
- About the owner and how he works: context/owner.md
- What was decided and why: decisions/log.md (append only)

## Rules that must hold
- Ask before assuming. If an assumption changes what gets built, stop and ask with AskUserQuestion.
- Rules first, model second. Deterministic classification runs before any model call. Every model decision stores confidence and classified_by.
- Manual override wins. Never overwrite a row where is_manual = true.
- One Postgres schema per module. Cross-module links only through the core schema.
- A module or integration is one folder with one manifest. Nothing in core is edited to add one.
- Every module ships a nightly digest and exposes get_digest and write tools. Core provides query and search. The orchestrator reads digests only.
- Account credentials come from core.connections via getCredentials(). .env holds infrastructure secrets only.
- Simplest approach that works. No helper abstractions, no premature refactors.
- Never invent facts, prices, or API capabilities. Mark unverified claims "verify".
- No em dashes anywhere (code comments, docs, UI copy).

## Workflow
- Plan mode for anything touching more than one file or a migration. Write the plan to docs/plans/<name>.md, get approval, then a fresh session implements it.
- Write the test before the feature for classification rules, recurring detection, and XP calculation.
- Show evidence of verification (test output, command result), not a claim that it works.
- Commit after each completed step with a descriptive message. Log any decision to decisions/log.md.
- When compacting, preserve the list of modified files, open questions, and the test command.

## Commands
- `pnpm dev` dev server. `pnpm test` vitest. `pnpm lint`. `pnpm typecheck`.
- `pnpm setup` bootstrap a fresh database and owner user. `pnpm setup --demo` also seeds synthetic rows.
- `pnpm gen:index` regenerate module and integration indexes (runs in prebuild). `pnpm gen:types` regenerate database types.
- `supabase start` local stack. `supabase db reset` replay migrations. `supabase migration new <name>`. `supabase db push` to prod.

## Next.js 16
This is Next 16 with Turbopack and Tailwind v4. Conventions differ from older Next: there is no `tailwind.config.ts` (CSS-first config in `app/globals.css`), and `pnpm typecheck` runs `next typegen` first because route types like `LayoutProps` are generated. Read `node_modules/next/dist/docs/` before writing Next code from memory.
