# Connections registry

Every external system the POS or Claude Code can reach. Update when a connection is added or removed. Each provider row becomes an `integrations/<name>/` folder with a manifest; credentials are entered on Settings > Connections and stored encrypted in `core.connections`, never in `.env`.

Status as of the end of Phase 1, 2026-09-08.

| System | Purpose | How connected | Status |
|---|---|---|---|
| Supabase | Postgres, pgvector, storage, auth | MCP + supabase-js + CLI | local stack live; hosted project is step 15 |
| Vercel | hosting, cron, firewall | MCP + Git integration | not yet created, step 15 |
| GitHub | repo, CI, backups repo | gh CLI + Actions | live: `pos` and the private `pos-backups` |
| Anthropic API | classification, headlines, research | integrations/anthropic (token) | connected 2026-09-08 |
| Voyage AI | embeddings | integrations/voyage (token) | connected 2026-09-08, 3 requests a minute until a card is on file |
| Resend | daily digest email | integrations/resend (token) | connected 2026-09-08, sends from `onboarding@resend.dev` to the `digest_email` setting |
| SimpleFIN Bridge | bank and card transactions | integrations/simplefin (token) | manifest defined, Test is a stub, connected with Finance |
| Strava | workouts | integrations/strava (oauth2) | manifest defined, needs an app registration, connected with Fitness |
| Health Auto Export | Apple Health metrics | integrations/health_auto_export (webhook) | manifest defined, connected with Fitness |
| Obsidian vault repo | second brain source of truth | integrations/github_vault (token) | manifest defined, connected with Second Brain |
| Notion | current working POS; per-module export for import scripts | export files only | live, being replaced |
| Google Calendar | not planned; email covers the digest | none | dropped |
