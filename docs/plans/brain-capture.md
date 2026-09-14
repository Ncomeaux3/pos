# Second Brain: capture, hubs, related (cheapest build)

Branch `brain-capture` (exists, cut from origin/main, holds this plan and the
decisions). Supersedes the 2026-09-14 first draft of this file on two points,
both to make the build cheaper: a "worked on" entry is kind `daily` rather
than a new `log` kind, and a file is kind `note` with `file_path` set rather
than a new `file` kind. No constraint change, no e2e change.

## Context

The owner's Obsidian vault holds a lot he dropped in and never read again. The
module as built is a lens on that vault (pull, wikilinks, an inbox for URL
drafts). It has no capture path of its own, no topic beyond the seven `kind`
folders, and nothing that brings an old note back when a new one is about the
same thing.

Research (2026-09-14): every published practice names the same failure,
collecting without using. What people report using is backlinks, hub notes
per topic, and related notes surfaced at write time by embeddings. The graph
view is widely called decorative. No published reopen rates exist (verify).

Decisions with the owner (logged in decisions/log.md 2026-09-14): POS is the
primary store, vault stays a read-only pulled archive. One capture box for
text, URL, "worked on", file. Hubs are owner-named keyword groupings, rules
first, model only for a miss, no model prose, no model-created hubs. Related
notes while writing is the one resurfacing mechanism. Files produce
transcribed text only. Extend in place inside screen 08. Not built: per-note
summaries, weekly email, hub summaries, Shortcut webhook, vault write back,
XP for log entries, graph view.

## Running cost, per month, single user

- Embeddings: Voyage free tier, 200M tokens, already connected. $0.
- Related while typing: `search()` runs full text first and embeds the query
  only when text is thin; once per typing pause. $0.
- Hub filing at capture: keyword rules. $0.
- Hub filing for misses: one batched Haiku call a night for every unfiled
  published note (cap 50 notes, 2000 chars each), not one call per capture.
  Under $0.01 a night at Haiku input pricing in `core/llm.ts`. Delete the job
  and it is $0.
- Files: one Haiku call per file. Roughly $0.002 for a photo, $0.015 for a
  ten page PDF (estimate from Haiku input price, verify against
  `core.llm_calls` after the first one). Phase 3 only, so the rest ships
  without it.
- Storage: Supabase free tier, private `brain` bucket through `core/files.ts`.

## Reused, unchanged

`core/search.ts` (`search`, `embedChanged`), `core.embeddings`,
`integrations/voyage`, `modules/ideas/data.ts:relatedNotes` SQL shape,
`modules/skills/classify.ts:matchByRules` shape, `core/files.ts:upload` and
`signedUrl`, `core/llm.ts:complete` (takes `Anthropic.MessageParam[]`, so a
document or image block passes through), `modules/brain/ingest.ts:ingestUrl`,
`modules/brain/data.ts` (`syncLinks`, `resolveDanglingLinks`, `uniqueSlug`),
`core/entities.ts:register`, the `write` tool's insert sequence in
`modules/brain/manifest.ts:105-150`.

## Phase 1: data, hubs, capture logic. Complexity low. quick-builder.

Migration `supabase/migrations/<ts>_brain_hubs.sql`:

```sql
create table brain.hub (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  keywords text[] not null default '{}',
  created_at timestamptz not null default now()
);
-- Same shape as core.skill_links. A note can sit in more than one hub, which
-- is the whole reason a hub is not a folder.
create table brain.note_hub (
  note_id uuid not null references brain.note (id) on delete cascade,
  hub_id uuid not null references brain.hub (id) on delete cascade,
  confidence real not null default 1,
  classified_by text not null check (classified_by in ('rule', 'model', 'manual')),
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (note_id, hub_id)
);
create index note_hub_hub_idx on brain.note_hub (hub_id);
-- Relative to the brain bucket. Empty for a note with no file.
alter table brain.note add column file_path text not null default '';
```

`pos_readonly` select is covered by the schema's default privileges. Apply
with `supabase migration up` (never reset), then `pnpm gen:types`.

`modules/brain/hubs.ts` with `hubs.test.ts` written first:
- `matchHubs(text, hubs: {id, keywords}[]): string[]`. Pure. Word boundary,
  case insensitive, code fences and inline code masked the way
  `wikilinks.ts` does. Copy the regex escape from `classify.ts`.
- `fileByRules(noteId, title, body)`: `matchHubs` over `title + '\n' + body`
  against every hub; insert `note_hub (note_id, hub_id, 1, 'rule')` with
  `on conflict do nothing` (so a manual row is never overwritten).
- `refileByRules(hubId)`: after a hub's keywords change, run `fileByRules`
  over published notes that have no `note_hub` row at all.
- `setHubs(noteId, hubIds[])`: delete rows where `not is_manual`, insert
  `(…, 1, 'manual', true)` for each id.
- `fileUnfiledNightly()`: select up to 50 published notes with no `note_hub`
  row; if zero hubs exist or zero notes, return. One `complete({ model:
  'claude-haiku-4-5', purpose: 'classification', module: 'brain' })` with the
  hub list (slug, name, keywords) and each note as `id, title, first 2000
  chars`, asking for JSON `[{ note_id, hub_slug, confidence }]`. Insert
  `('model', confidence)` on conflict do nothing. `SoftCapExceeded` or
  `NotConnected` returns `{ filed: 0, reason }` and leaves them unfiled.

Tests (vitest, `db` mocked the way `ingest.test.ts` mocks): match, no match,
keyword inside a code fence does not match, `on conflict` path leaves a
manual row, `fileUnfiledNightly` makes no model call when nothing is unfiled.

`modules/brain/capture.ts` with `capture.test.ts` first:
- `captureText({ text, worked: boolean })`: title = first line trimmed to
  120 chars; body = the rest, or the whole text when one line. `kind =
  worked ? 'daily' : 'note'`. `status 'published'`, `source 'manual'`,
  `uniqueSlug`, insert, `syncLinks`, `resolveDanglingLinks`, `register`
  (no eventType), `fileByRules`, then `embedChanged()` so the note is
  related-able now rather than after the nightly run.
- URL is not here: the UI calls the existing `ingestFromUrl` action.
- Tests: title and body split; one line text; `worked` sets `daily`;
  `fileByRules` and `embedChanged` are called (mocked).

`modules/brain/related.ts`:
- `relatedTo(noteId, limit = 5, threshold = 0.7)`: the
  `modules/ideas/data.ts:relatedNotes` SQL restricted to one source entity
  and to `brain.note.status = 'published'`, excluding itself. Returns `{ id,
  slug, title, similarity }`. Threshold comment copied from
  `core/search.ts`. Empty when the source has no embedding yet.
- `relatedToText(text)`: `search(text, { module: 'brain', limit: 6 })`,
  filtered to published notes. Returns the same shape with `similarity` from
  `score`.

Manifest (`modules/brain/manifest.ts`): tool `capture` (input `{ text,
worked? }`, calls `captureText` with `ctx.source`; when the source is
`agent` the note is a `draft`, the same rule `write` applies, so an agent
still cannot publish). Job `{ name:
'file_unfiled', run: fileUnfiledNightly }` after `pull_vault`. `pull-vault.ts`
calls `fileByRules` after each `register`. `nightly-digest.ts` adds
`unfiled: number` and `hubs: { name, count }[]`.

No `hub_write` or `set_hubs` MCP tools. Hubs are made in the UI. No seed
changes.

Exit: `pnpm test` green with the two new test files, `pnpm lint`, `pnpm
typecheck`, `supabase migration up` applied locally, `brain.get_digest` over
`/api/mcp` returns `unfiled`. One PR.

## Phase 2: screen 08 changes. Complexity medium. Opus.

`modules/brain/ui/actions.ts`: `captureText`, `relatedForDraft(text)`,
`saveHub({ id?, name, keywords })` (slug from `uniqueSlug`'s helper or a
plain slugify; `refileByRules` after), `setNoteHubs(noteId, hubIds)`. Each
returns `ActionResult` like the neighbours and calls `revalidatePath`.

`modules/brain/ui/Brain.tsx`:
- Band: after the existing `brain-folders` group (untouched, so
  `e2e/screens.spec.ts:1916` keeps passing), a second group `data-testid=
  "brain-hubs"`: each hub as a chip with count, then "Unfiled", then a "+
  Hub" chip that opens a two-field form (name, keywords comma separated) in
  the existing drawer pattern (`IngestDrawer.tsx` is the shape to copy).
  Folder param values `hub:<slug>` and `unfiled`. List filter for those two.
- List: `CaptureBox.tsx` pinned above the rows on every folder.

`modules/brain/ui/CaptureBox.tsx` (client): one textarea, no title field; a
"worked on" checkbox; submit. If the trimmed text is a single URL
(`/^https?:\/\/\S+$/`), the button reads "Ingest" and calls the existing
`ingestFromUrl`. Otherwise "Save" calls `captureText`. Below the box a
"Related" list: a `setTimeout` of 1000ms reset on each change, fires
`relatedForDraft` when text is 20+ chars, never more than one in flight.
Rows are title plus hub names; click opens the note. Under 20 chars: nothing.
On an error from `relatedForDraft`: one line "Related notes unavailable" (a
429 from Voyage lands here; `search()` already falls back to text).
Attach button is Phase 3; do not draw it yet.

`modules/brain/ui/NotePane.tsx`: a "Hubs" chip row under the head (each
hub, plus "Edit" that turns the row into checkboxes over every hub and saves
with `setNoteHubs`; by-line "rule" / "model" / "manual" the way Linked skills
shows `byLine`). A "Related" cell beside Linked skills and Backlinks, up to
five rows from `relatedTo`, "None yet" when empty. Both cells follow the
cell spec in docs/plans/brain-fidelity.md L42.

`modules/brain/shape.ts`: nothing. `daily` already has a folder label.

Docs: `modules/brain/README.md` gains "Capture first" and "Hubs are
groupings" (short, in the existing voice). `docs/SPEC.md` Second Brain: one
amendment paragraph dated 2026-09-14. `docs/STATUS.md`: replace the stale
"no embeddings exist for notes yet" sentence at L543.

e2e: one test appended to `e2e/screens.spec.ts` after the existing brain
test: type 25 characters into the capture box, expect the Related heading;
save; expect the note as the first row. Under 40 lines.

Exit: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm test:e2e` (the two
brain tests), `ui-verifier` once at 402 and 1440 on `/brain` against the
screen 08 artboard, `spec-reviewer` on the staged diff. One PR.

## Phase 3: files. Complexity medium. Opus. Optional, ship without it.

`modules/brain/capture.ts` gains `captureFile({ name, type, bytes })`:
insert the note first (title = file name, kind `note`, body `''`,
published), `upload('brain', '<noteId>/<name>', bytes, type)`, set
`file_path`, then one `complete({ model: 'claude-haiku-4-5', purpose:
'summary', module: 'brain', system: 'Transcribe every word you can read.
No commentary.', messages: [{ role: 'user', content: [<document or image
block>] }] })`; document block for `application/pdf`, image block for
`image/*`; reject anything else and files over 10 MB before upload. Body =
the text. On `SoftCapExceeded` or `NotConnected` the body is one line,
"Transcription pending", and `fileUnfiledNightly` also retries notes whose
`file_path` is set and body is that line (one file per night, so a cap is
not hit twice). Then `fileByRules` and `embedChanged`.

Test: `captureFile` calls `upload` and `complete` with a document block for
a PDF and an image block for a PNG (both mocked), stores `file_path`.

UI: attach button in `CaptureBox.tsx` (`accept="image/*,application/pdf"`),
`captureFile` action over `FormData`. `NotePane.tsx`: for a note with
`file_path`, a "File" link above the body from `signedUrl`.

Exit: `pnpm test`, `pnpm lint`, `pnpm typecheck`; attach a one page PDF and
a photo locally, confirm body text and two rows in `core.llm_calls` with
`purpose = 'summary'`. `ui-verifier` on `/brain` at 402 and 1440. One PR.

## Ceilings (`ponytail:` comments in code)

- `hubs.ts fileUnfiledNightly`: 50 notes per call; page it if Unfiled ever
  holds more.
- `CaptureBox.tsx`: related fires once per pause against a 3 RPM Voyage
  ceiling; text-only hits when it 429s.
- `capture.ts captureFile`: 10 MB and one call per file; chunk PDFs by page
  if a large one ever matters.

## Build instructions

Run from `~/VsCode/pos`. One Claude Code session per phase, Opus, effort at
the default. Do not open a session for Phase 3 unless files are wanted now.

Before each phase:

```
git switch brain-capture && git pull --ff-only 2>/dev/null; git status --short
```

Phase 1 session. Paste as the first message:

```
Implement Phase 1 of docs/plans/brain-capture.md. Branch brain-capture is
checked out; branch phase-1 from it as brain-capture-1. Read the plan, then
modules/brain/README.md, modules/brain/manifest.ts, modules/brain/data.ts,
modules/brain/ingest.test.ts (for the db mock), modules/skills/classify.ts,
modules/ideas/data.ts lines 60 to 110, and core/search.ts lines 300 to 350.
Do not read anything else unless a step needs it. Delegate the migration,
shape of hubs.ts and related.ts, and the digest change to quick-builder with
the plan text as the brief; write hubs.test.ts and capture.test.ts yourself
before their code. Do not touch modules/brain/ui. Run pnpm test on the two
new files yourself; send the full suite, lint and typecheck to test-runner
once at the end. Apply the migration with supabase migration up, never
reset, then pnpm gen:types. Commit after each file pair with a conventional
message. Open a PR with gh titled "feat: second brain hubs and capture
logic", body lists what Phase 2 and 3 still owe. Do not merge. Stop at the
PR.
```

Merge the PR yourself after CI is green. Then Phase 2 session, first
message:

```
Implement Phase 2 of docs/plans/brain-capture.md on a branch
brain-capture-2 from origin/main (Phase 1 is merged). Read the plan, then
modules/brain/ui/Brain.tsx, NotePane.tsx, IngestDrawer.tsx, actions.ts,
docs/plans/brain-fidelity.md, and e2e/screens.spec.ts lines 1904 to 1940.
Nothing else unless a step needs it. Build CaptureBox.tsx, the hubs band
group, the two NotePane cells and the four actions exactly as the plan
describes; no attach button. Add the one e2e test. Update the README, SPEC
amendment and the STATUS line. Send test, lint, typecheck and test:e2e to
test-runner once at the end; run ui-verifier once on /brain at 402 and 1440
against the screen 08 artboard and fix Must fix items only; then
spec-reviewer on the staged diff. Commit per component. PR titled "feat:
second brain capture box, hubs and related notes". Do not merge. Stop at
the PR.
```

Phase 3 session, only if wanted, first message:

```
Implement Phase 3 of docs/plans/brain-capture.md on brain-capture-3 from
origin/main. Read the plan, modules/brain/capture.ts and its test,
modules/brain/ui/CaptureBox.tsx, NotePane.tsx, core/files.ts and core/llm.ts
lines 86 to 112. Write the captureFile test first. Send the suite, lint and
typecheck to test-runner once; ui-verifier once on /brain at 402 and 1440.
PR titled "feat: second brain file capture with transcription". Do not
merge. Stop at the PR.
```

What each session must not do: run `supabase db reset`; add a dependency;
start agents beyond quick-builder, test-runner, ui-verifier and
spec-reviewer; build anything from the Out of scope list.
