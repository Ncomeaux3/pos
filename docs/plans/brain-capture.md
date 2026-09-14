# Second Brain: capture, hubs, related

Branch `brain-capture`. Decisions logged 2026-09-14 in decisions/log.md.

## Context

The owner's Obsidian vault holds a lot he dropped in and never read again. The
module as built is a lens on that vault (pull, wikilinks, an inbox for URL
drafts). It has no capture path of its own, no notion of topic beyond the seven
`kind` folders, and nothing that brings an old note back when a new one is
about the same thing.

Research (2026-09-14, sourced in the session): every published practice names
the same failure, collecting without using. What people report actually using
is backlinks, hub notes per topic (Milo's Maps of Content), and related notes
surfaced at write time by embeddings (Reflect, Mem). The full graph view is
widely called decorative past a couple hundred notes. No published figures exist
for how many notes get reopened; treat any such number as verify.

Decisions taken with the owner this session:

- POS is the primary store from here. The vault stays a read-only archive that
  keeps being pulled. No write back (unchanged from spec).
- Capture shapes: quick text, URL or video, "what I worked on", files and
  images. All from the PWA capture box; no Shortcut webhook.
- Automatic on capture: related notes by meaning, filing into topic hubs.
  Not chosen: per-note model summaries, extending links to projects and goals.
- Resurfacing: related notes while writing. Not chosen: weekly email, hub
  summaries, random note review.
- A hub is a grouping you browse, no model prose. Owner creates hubs with
  keywords; rules file first, Haiku only for a miss; the model never creates a
  hub; unfiled notes sit in Unfiled.
- A work log entry is a note of kind `log`, dated. No XP rule beyond what
  classify_to_skills gives any note.
- A file produces extracted text only, one Haiku call, published immediately.
- Extend the brain module in place, inside the screen 08 grammar. No new
  artboard.

## What already exists and is reused

- `core.embeddings` + `integrations/voyage` + `core/search.ts`: `search()`
  hybrid retrieval with `module` and `semantic` options, `embedChanged()`
  batched embedding, `contentHash`. Voyage connected, 3 RPM free tier.
- `modules/ideas/data.ts:relatedNotes` is the nearest-neighbour SQL pattern.
- `modules/skills/classify.ts:matchByRules` is the rules-first pattern (word
  boundary keyword regex). Copy the shape, not the function: hubs are per
  module and per note, skills are per entity.
- `core/files.ts:upload` (module bucket, relative path), `signedUrl`, `remove`.
- `core/llm.ts:complete` takes `Anthropic.MessageParam[]`, so an image or a
  PDF document block passes through unchanged. Purpose `classification` for
  filing, `summary` for transcription (both capped).
- `modules/brain/manifest.ts` `write` tool: the insert, `syncLinks`,
  `resolveDanglingLinks`, `register` sequence. Capture calls the same helpers.
- `modules/brain/ingest.ts:ingestUrl` for the URL path, unchanged.
- `modules/brain/ui/actions.ts` server actions, `Brain.tsx` band/list/pane,
  `NotePane.tsx` cells (Linked skills, Backlinks), `shape.ts` `KINDS`.

## Migration: `supabase/migrations/<ts>_brain_hubs.sql`

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

alter table brain.note drop constraint note_kind_check;  -- name: verify with \d
alter table brain.note add constraint note_kind_check
  check (kind in ('article','book','video','note','project','person','daily','log','file'));
alter table brain.note add column file_path text not null default '';
```

Grants: `alter default privileges` on the schema already covers pos_readonly
select. Run `pnpm gen:types` after.

## Code

### `modules/brain/hubs.ts` (test first: `hubs.test.ts`)

- `matchHubs(text, hubs): string[]` pure, word-boundary keyword match, code
  fences masked the way `wikilinks.ts` masks them.
- `fileNote(noteId, title, body)`: rules; if hits, insert `note_hub` rows
  `('rule', 1)`. If none, one `complete({ model: haiku, purpose:
  'classification', module: 'brain' })` with hub names + keywords + first
  2000 chars, asking for JSON `[{slug, confidence}]`; insert `('model',
  confidence)`. Zero hubs or `SoftCapExceeded` or `NotConnected` leaves the
  note unfiled. Never insert over a row where `is_manual`; never delete
  manual rows.
- `refileByRules(hubId)`: after keywords change, run rules over unfiled
  published notes only.
- `setHubs(noteId, hubIds[])`: manual edit from the pane; writes
  `('manual', 1, is_manual = true)` and removes non-manual rows.

Tests: match, no match, keyword inside a code fence does not match, manual
row survives a refile, rules skip the model (mock `complete` and assert not
called).

### `modules/brain/capture.ts` (test first: `capture.test.ts`)

`capture(input)` where input is one of `{ text, log?: boolean }`, `{ url }`,
`{ file: { name, type, bytes } }`.

- url: `ingestUrl` path as the `ingest` tool does today (draft). Return id.
- text: title = first line trimmed to 120 chars, body = rest (or whole text
  when one line). kind = `log` if flagged else `note`. status published,
  source manual. Then `syncLinks`, `resolveDanglingLinks`, `register`.
- file: `upload('brain', '<noteId>/<name>', bytes, type)`; then
  `complete()` with a document block (`application/pdf`) or image block,
  system "Transcribe every word you can read. No commentary." purpose
  `summary`, model haiku; body = result, title = file name, kind `file`,
  `file_path` set, published. On cap or not connected: note saves with the
  file and an empty body plus a line saying transcription is pending; the
  nightly job retries.
- every path except url then: `fileNote`, then `embedChanged()` so the note
  is related-able now, not tomorrow.

Tests: text splits title and body; one line text; log sets kind; url routes
to ingest (mock); file path calls upload and complete with a document block
(mock both) and stores `file_path`.

### `modules/brain/related.ts`

`relatedTo(noteId, limit = 5, threshold = 0.7)`: nearest published brain
notes by `core.embeddings` cosine, the `modules/ideas/data.ts:relatedNotes`
SQL restricted to one source note. `relatedToText(text)` = `search(text, {
module: 'brain', limit: 5 })`, published only (filter hits by status via a
join, or filter in TS from the ids). Returns `{ id, title, hubs[] }`.
Threshold comment copies the calibration note from `core/search.ts`.

### Manifest

- Tools: `capture` (text | url only; files are UI only), `hub_write`
  ({ id?, name, keywords[] }), `set_hubs` ({ note_id, hub_ids[] }).
  `capture` with a url reaches `ingest`, which stays guarded; text capture is
  unguarded like `write`.
- Jobs: add `{ name: 'file_unfiled', run: fileUnfiled }` after `pull_vault`
  (retries unfiled published notes and pending transcriptions; batch cap 50 a
  night). `pull_vault` calls `fileNote` for each new note.
- `nightly-digest.ts`: add `unfiled` count and `hubsGrownThisWeek` [{name,
  added}].
- `entityTypes` unchanged. `kind` zod enum gains `log`, `file`.

### UI (screen 08 grammar, `modules/brain/ui/`)

- `actions.ts`: `captureText`, `captureUrl`, `captureFile` (FormData),
  `relatedForDraft(text)`, `saveHub`, `setNoteHubs`.
- `Brain.tsx`: band gains a "Hubs" group after the kind folders: each hub
  with count, then "Unfiled". Folder param `hub:<slug>` and `unfiled`.
  List gets `CaptureBox.tsx` pinned above rows on every folder.
- `CaptureBox.tsx`: textarea (no title field), paste detection (a lone URL
  turns the submit into "Ingest"), attach button (image/*, application/pdf),
  "worked on" toggle, submit. Below it, "Related" list: fires
  `relatedForDraft` 1s after typing stops and at 20+ chars, at most once per
  pause. Empty states: fewer than 20 chars shows nothing; Voyage not
  connected shows "Connect Voyage in Settings for related notes".
- `NotePane.tsx`: a "Hubs" chip row (click to edit, multi-select of hubs,
  saves manual) and a "Related" cell beside Linked skills and Backlinks,
  five rows, click opens the note. A `file` note shows a signed link to the
  file above the body.
- `shape.ts`: `KINDS` gains `log`, `file`; `folderLabel` for both.
- Seed (`seed.ts`, demo mode): two hubs with keywords, one log note, no file.

### Docs

- `modules/brain/README.md`: a section "Capture first" and "Hubs are
  groupings" in the existing voice.
- `docs/SPEC.md` Second Brain: amend 2026-09-14 with the decisions above.
- `docs/STATUS.md`: replace the stale "no embeddings exist for notes yet"
  line.
- `docs/SETUP-INTEGRATIONS.md`: nothing new (Voyage and Anthropic already
  documented).

## Out of scope (say so in the PR)

Per-note summaries, weekly email, hub summaries, Shortcut webhook, vault
write back, XP for log entries, a graph view, model-proposed hubs.

## Verification

1. `pnpm test` green with the four new test files. `pnpm lint`,
   `pnpm typecheck` via test-runner.
2. `supabase migration up` on the live local DB (not reset), then
   `pnpm gen:types`.
3. `pnpm dev`, then in the browser: create hub "Postgres" with keywords
   [postgres, pgvector]; capture "pgvector hnsw index notes" as text; the
   note lands in Postgres via rule (pane shows the chip, by-line "rule");
   capture a two-line text with no keywords, confirm it goes to Unfiled or a
   model hub and `core.llm_calls` has one classification row; type a third
   note mentioning hnsw and see the first note in Related before submitting;
   attach a one-page PDF and confirm body text and `core.llm_calls` summary
   row; paste a URL and confirm it lands in the inbox as before.
4. `ui-verifier` at 402 and 1440 on the Second Brain screen against the
   screen 08 artboard: band, capture box, pane cells.
5. Call `brain.capture` and `brain.hub_write` over `/api/mcp` with the bearer
   token; `brain.get_digest` shows `unfiled`.
6. `spec-reviewer` on the staged diff before the PR. PR titled
   "feat: second brain capture, hubs and related notes".

## Ceilings to mark in code (`ponytail:` comments)

- Voyage 3 RPM: related-for-draft is once per pause; if it 429s, show the
  text-only hits and say so.
- Filing calls Haiku once per unfiled capture; a 200-note vault pull could
  make 200 calls. Batch in `file_unfiled` (one call, many notes) if that day
  comes.
