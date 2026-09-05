# Open decisions

Claude Code must ask about every unresolved item here before scaffolding. Record the answer, date, and reason in decisions/log.md, then mark it resolved.

(none open)

## Resolved
All eleven original items plus the architecture, platform, and template decisions were resolved on 2026-09-05. See decisions/log.md for each choice, its reason, and what was rejected. See docs/ARCHITECTURE.md for how they fit together.

- Orchestrator is a fresh build. The owner's existing multi-agent framework is not reused. (2026-09-05)
- Notion POS stays live until each module replaces it. Notion data is provided by the owner as an export, not pulled via MCP in phase 1. (2026-09-05)
- Claude Max plan. Auto permission mode is the default; settings.json allowlist is a backstop. (2026-09-05)
- Hosting: Supabase + Vercel. (2026-09-05)
- Stack: TypeScript, Next.js full stack, pnpm, Node 22. (2026-09-05)
- Bank provider: SimpleFIN Bridge, 4 to 7 accounts. (2026-09-05)
- Cost cap: $0 to $10 per month. (2026-09-05)
- Mobile: PWA. (2026-09-05)
- Fitness source: Strava plus Apple Health via Health Auto Export. (2026-09-05)
- Obsidian sync: private git repo, app pulls and proposes commits. (2026-09-05)
- Idea research depth: quick by default. (2026-09-05)
- Notification channel: email via Resend. (2026-09-05)
- MCP layout: one server, namespaced tools. (2026-09-05)
- Job runner: one Vercel cron. (2026-09-05)
