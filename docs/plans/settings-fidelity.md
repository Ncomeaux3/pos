# Settings to the artboard

Superseded for styling on 2026-09-19 by the Holon redesign (docs/plans/holon-product-redesign.md, section 4): colour, type, radii, surfaces and control shapes now come from the Holon design contract and the shared components in `components/pos/`. This plan still governs what each screen shows and how it is laid out.


## Context

Screen thirteen of the fidelity pass (method: docs/plans/weekly-review-fidelity.md). `POS Settings.dc.html` captured at 1440 into `/private/tmp/pos-handoff-sources/settings/` (Connections dark and light, General dark and light, Agents & MCP, Notifications, Skills). The other session is on Home in a worktree; Settings lives under `app/(app)/settings/` with shared primitives it does not touch. This pass edits those five routes, `tabs.tsx`, two additive lines in `components/pos/TabBar.tsx` (a `tabClassName` on `TabLinks`, matching `TabBar`) and `core/mcp.ts` (`listTools()` with descriptions), plus the settings e2e tests.

The app already has every capability the artboard draws (encrypted connections with save / test / disconnect / OAuth / webhook secret, owner settings with the soft cap and the nightly job state, the MCP command with a masked token, autonomy, the tool list, per-module notification switches and quiet hours, the skills editor with rename / delete / restore / add / reset). What differs is the shape: the artboard is one page titled "Settings" on every tab with the tab row under the lede; Connections is a two-column grid of cards with a status dot, a two-cell strip and a button row; General is three cards in a 720px measure with a slider for the cap and a three-cell strip for the nightly job and a Save row; Agents & MCP is the endpoint card with the token inline in the command and a guarded-tools list with a mode mark; Notifications is Channels as a switch strip, the per-module grid without sub-lines, and Quiet hours as one line; Skills is group cards with transparent inline name inputs, a keyword mark, CUSTOM / "was X" marks and a dashed add line.

Decisions with Nick (append to `decisions/log.md`):
- The h1 is "Settings" on every tab and the band's status is "{n} of {m} connected" everywhere, as drawn; the tab is the crumb. The tab label is "Agents & MCP".
- The card strip's second cell is generic: "Connected since {D Mon YYYY}" (or "Token expires {relative}" when `expires_at` is set). The artboard's per-provider figures (calls this month, embedded entities, last send, payload counts) would need each integration to expose a metric of its own, and no integration does; a fork with other providers gets the same card.
- The webhook's shared secret is masked with a REVEAL / HIDE toggle (the value is already the owner's page; the toggle keeps it off a screen left open). The inbound URL stays a copy block.
- General: the soft cap is a range slider 5 to 100 in steps of 5 (writing `llm_soft_cap_cents` as before, clamped), the digest hour a 24-option select; the owner email is the real `OWNER_EMAIL`, read only. The nightly card's schedule cell reads "0 9 * * * UTC · {HH:MM} {tz abbreviation}" computed from the owner's timezone; the last run cell "ok · {HH:MM} · {n} jobs" (red "failed · {HH:MM}" when any job failed); the third cell is "Jobs registered · {n}", because the app holds no backup facts (2026-09-11 System tile decision). Save is the DS small button on the right with "SAVED · core.settings" after a save (via `?saved=1`).
- Agents & MCP: the token appears inline in the command, masked, with Reveal token / Hide token (the existing `revealMcpToken`); no Rotate token (the app cannot write its own .env, as the page already says). Autonomy stays as the second card (a built feature the artboard predates). The tools card reads "Guarded tools · agent writes go to Review": one collapsed row for the reads ("*.get_digest · *.query · core.search", "Read-only, 5s timeout, 500 rows", OPEN green) and one row per write tool with its description and GUARDED (amber) or OPEN (green).
- Notifications: the Channels strip's switches are real and coarse: a channel switch writes that channel onto or off every rule (a new `setChannelEverywhere` action over the existing rule writer); its state is on when every rule has it, off when none, and the in-between shows the amber border the grid already uses for `some`. The right-hand mark reads "PER MODULE BELOW" (no iOS claim). The per-module rows drop the "{n} of {m} live" sub-line. Quiet hours has no on/off switch (the app has no off state): "No push between {from} and {to}" with the urgent override control the app already has, and the sentence "Reminders due in this window are delivered at {to}." Devices stays as its own card below (a built feature).
- Skills: the artboard's rows with the transparent name input, CUSTOM and "was X" marks and the first three keywords in mono; keywords stay editable through the existing InlineEdit, styled as that mark; "Show deleted (n)" is a ghost button present only when something is deleted; "Reset to skills.yaml" is the text button and keeps the two-press confirm (destructive).

## Artboard measurements (POS Settings.dc.html lines 27 to 191; logic 195 to 279)

Band: "Settings / {tab}"; search placeholder "Search settings"; right an eyebrow with the dot "{n} of {m} connected" (green dot when any).

Title block `padding 20px 28px 0`: h1 28px "Settings"; lede 13px ink-3 `margin-top 8`: "Owner preferences and every external account the system can reach. Credentials are encrypted at rest and never live in the repo." Tabs `margin 18px 28px 0`, DS tab with `padding 10px 16px 12px` (`tabClassName="px-4 pt-2.5"`), counts on Connections and Skills.

Connections `margin 18px 28px 28px`: grid `auto-fit minmax(min(100%, 380px), 1fr)` gap 14, cards 1px rule on bg-elev `padding 18px 20px` (rule-2 on hover). Head: 16px label + chip (10px `padding 3px 8px`) TOKEN / OAUTH2 / WEBHOOK; 12px ink-3 `margin-top 6` "{purpose} · used by {modules}" (modules in ink-2); right 11px 0.08em with a 6px dot: CONNECTED green | NOT CONNECTED ink-3 (REJECTED red when the last test failed). Connected: `margin-top 14` two-cell 1px rule grid, cells `padding 10px 12px`, eyebrow + mono 12px: "Last test" in green (red when failed) "ok · {HH:MM} · {detail}", and the generic second cell. Webhook: `margin-top 10` 1px rule box `padding 10px 12px` gap 8 with "Inbound URL" (mono 11px ink-2, ellipsis) and "Shared secret" (mono 11px dots or the value, REVEAL / HIDE mini 10px 0.08em). Buttons `margin-top 14` gap 10: "Test" (13px `padding 8px 14px` 1px rule-2 ink, ink fill on hover), "Reauthorize" (oauth, ink-2), "Disconnect" right (ink-3 text, red on hover, two-press). Not connected: token fields (eyebrow + password input mono 13px `padding 9px 12px`), `margin-top 14` DS small button "Save & test →" | "Connect with {label} →" | "Enable webhook →" and a mono 11px ink-3 hint ("tests on save" | "opens {label}" | "generates URL + shared secret").

General `margin 18px 28px 28px; max-width 720`, gap 14; cards 1px rule on bg-elev `padding 18px 20px`. Owner: eyebrow; 2-col grid gap 14 `margin-top 12`: Name (12px ink-3 label, 13px input `padding 9px 12px`), "Owner email · the only login allowed" (mono, read only on bg-deep), Timezone (select), "Digest email hour · local" (mono select). Model spend: eyebrow "Model spend · soft cap" + mono 11px "MONTH TO DATE {$x}"; `margin-top 14` range + mono 14px "${cap}/mo" 56px right; 2px bar rule-2 with accent fill at spend / cap; 12px ink-3 note "Past the cap, research runs are refused and logged. Classification and headlines continue." Nightly job: eyebrow; 3-cell 1px rule strip `margin-top 12`, cells `padding 10px 12px` eyebrow + mono 12px. Save row: right, mono 11px hint + DS small "Save →".

Agents & MCP `max-width 720`: MCP endpoint card: eyebrow + green dot "LIVE · {n} TOOLS"; `margin-top 12` mono 12px ink-2 1.7 pre block on bg-deep 1px rule `padding 12px 14px` with the command and `--header "Authorization: Bearer {token|dots}"`; buttons `margin-top 12`: "Reveal token" | "Hide token" (ink, ink fill on hover). Autonomy card (app). Tools card: eyebrow "Guarded tools · agent writes go to Review"; rows `1fr auto auto` gap 16 `padding 9px 0` rule under: mono 12px name, 12px ink-3 description, mono 10px 0.08em mode.

Notifications `max-width 860`: Channels card: eyebrow + mono 11px "PER MODULE BELOW"; `margin-top 12` 1px rule grid `auto-fit minmax(200px, 1fr)`, cells `padding 12px 14px` on bg: 13px label, 11px ink-3 sub ("Once daily at {HH:00} via Resend" | "Phone + desktop, respects quiet hours" | "Warnings tile and badges"), the 34 by 20 switch. Per module: eyebrow; key row `1.2fr repeat(3, 48px) 1.6fr` gap 14 `padding 8px 0` rule-2 under 10px 0.08em: MODULE, DIGEST, PUSH, IN-APP, WHAT TRIGGERS IT; rows `padding 10px 0` rule under, 13px label, three switches, 11px ink-3 triggers. Quiet hours: eyebrow; `margin-top 12` one wrapping line gap 14: "No push between" 13px, mono time input, "and", mono time input, then 12px ink-3 "Reminders due in this window are delivered at {to}."; the urgent override button on the same line.

Skills `max-width 860`: header line: 13px ink-3 paragraph, right "Show deleted ({n})" ghost (12px `padding 6px 10px`) when any, "Reset to skills.yaml" text 12px ink-3. Group cards `padding 14px 20px`: eyebrow label + mono 11px "{n} skills"; rows grid `minmax(0,1fr) auto auto` gap 10 `padding 6px 0` rule under: name input (transparent, 1px transparent border, 13px `padding 5px 8px`, accent border and bg on focus; struck and ink-3 when deleted), marks (CUSTOM mono 9px accent outline, "was {orig}" mono 9px ink-3, keywords mono 10px ink-4 first three joined " · "), Delete mini (red on hover) | Restore mini; add line `margin-top 10`: dashed rule-2 input 12px `padding 7px 10px` "Add a skill to {group}…" + Add mini.

## Files

- `components/pos/TabBar.tsx`: `tabClassName` on `TabLinks` (as `TabBar` has).
- `core/mcp.ts`: `listTools(): { name, description }[]` beside `listToolNames()`.
- `app/(app)/settings/tabs.tsx`: label "Agents & MCP"; a shared `SettingsHeader` (band status, title, lede, tabs) so the five routes render one header.
- `app/(app)/settings/page.tsx` (General): the three cards, slider, strips, Save row; `?saved=1`.
- `app/(app)/settings/connections/page.tsx` + `Reveal.tsx` (client, the secret toggle): the grid of cards.
- `app/(app)/settings/agents/page.tsx` + `McpCommand.tsx` (client: the command block with the inline masked token and the reveal button, using `revealMcpToken`): the endpoint card, autonomy, the tools list.
- `app/(app)/settings/notifications/page.tsx`, `ChannelGrid.tsx` (rows without the sub-line, the switch column kept), `Channels.tsx` (new client strip with the three coarse switches), `actions.ts` (`setChannelEverywhere`), `QuietHours.tsx` (the one-line layout).
- `app/(app)/settings/skills/page.tsx`, `SkillsEditor.tsx`: the artboard's rows and add line; the "Show deleted (n)" button.
- `e2e/screens.spec.ts`: the five settings tests reworked (heading "Settings" on each; Connections: a card with "CONNECTED" or "NOT CONNECTED" and the strip; General: the slider and "0 9 * * * UTC"; Agents: the command with the dots inline, "GUARDED"; Notifications: the Channels switches and the grid; Skills: rename, "was TypeScript", reset).

## Tasks

### Task 0: Baseline
Plan to `docs/plans/settings-fidelity.md`, decisions logged. Failing asserts as above.

### Task 1: Shared header, tabs, core listTools
`SettingsHeader`, `tabClassName`, `listTools`. Check: typecheck. Commit: `fix: settings header and tabs to the artboard`.

### Task 2: Connections and General
Check: their asserts; pairs. Commit: `fix: settings connections and general to the artboard`.

### Task 3: Agents, Notifications, Skills
Check: their asserts; pairs. Commit: `fix: settings agents, notifications and skills to the artboard`.

### Task 4: Proof
`--grep "settings|autonomy"` both widths; typecheck, lint, unit; full e2e once. Pairs: five tabs dark, Connections and General light. Phone at 402 against the shell rules (cards one up, grids scroll). STATUS.md, memory. Commit: `docs: settings fidelity pass`.

## Verification
- `pnpm test`, `pnpm typecheck`, `pnpm lint`.
- `E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test --project=desktop --grep "settings|autonomy"` and `--project=mobile`.
- Pairs in `/private/tmp/pos-handoff-sources/settings/pairs/` sent to Nick.

## Out of scope
- Per-provider usage figures, token rotation from the app, a quiet-hours off switch, backup facts, and any other screen.
