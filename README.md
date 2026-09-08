# POS

Personal Operating System. Single user, modular, fork and fill.

- docs/ARCHITECTURE.md: how it is built and how a module or integration plugs in.
- docs/SPEC.md: what each module does.
- docs/plans/: approved build plans, one per phase or module.
- SETUP.md: workspace setup and the per-module loop.
- CLAUDE.md: rules for Claude Code sessions in this repo.

Quickstart for a fork (available once Phase 1 ships):

```
pnpm i && cp .env.example .env   # fill Supabase keys, OWNER_EMAIL, ENCRYPTION_KEY, CRON_SECRET, MCP_TOKEN
pnpm setup:demo                # migrations, owner user, synthetic rows
pnpm dev                         # log in, open Settings > Connections
```

MIT licensed.
