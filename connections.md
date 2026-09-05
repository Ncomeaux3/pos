# Connections registry

Every external system the POS or Claude Code can reach. Update when a connection is added or removed. Each provider row becomes an `integrations/<name>/` folder with a manifest; credentials are entered on Settings > Connections and stored encrypted in `core.connections`, never in `.env`.

| System | Purpose | How connected | Status |
|---|---|---|---|
| Supabase | Postgres, pgvector, storage, auth | MCP + supabase-js + CLI | to add |
| Vercel | hosting, cron, firewall | MCP + Git integration | to add |
| GitHub | repo, CI, backups repo | gh CLI + Actions | to add |
| Anthropic API | classification, headlines, research | integrations/anthropic (token) | to add |
| Voyage AI | embeddings | integrations/voyage (token) | to add |
| Resend | daily digest email | integrations/resend (token) | to add |
| SimpleFIN Bridge | bank and card transactions | integrations/simplefin (token) | defined in Phase 1, connected with Finance |
| Strava | workouts | integrations/strava (oauth2) | defined in Phase 1, connected with Fitness |
| Health Auto Export | Apple Health metrics | integrations/health_auto_export (webhook) | defined in Phase 1, connected with Fitness |
| Obsidian vault repo | second brain source of truth | integrations/github_vault (token) | defined in Phase 1, connected with Second Brain |
| Notion | current working POS; per-module export for import scripts | export files only | live, being replaced |
| Google Calendar | not planned; email covers the digest | none | dropped |
