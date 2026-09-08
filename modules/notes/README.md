# Notes

The smallest module that still exercises the whole contract. It exists as the
worked example: copy this folder to start a new module, and nothing in `core/`
needs editing.

## What it does

Stores plain notes with a title and a body. That is all. It is not the Second
Brain module, which owns the Obsidian vault, embeddings, and summarisation.

## Layout

| Path | Purpose |
|---|---|
| `manifest.ts` | The whole registration: id, nav entry, pages, tools, jobs |
| `ui/NotesPage.tsx` | The index page, reached at `/notes` with no route file |
| `jobs/nightly-digest.ts` | Counts, written to `core.digests` nightly |
| `seed.ts` | Five synthetic notes for `pnpm setup:demo` |

`gen:index` writes `modules/index.generated.ts` from the folders present, which
is what lets the registry load in a plain Node process as well as in Next.

## Schema

`notes.note`: `title`, `body`, plus the `external_id` and `source` columns every
module table carries so imports stay idempotent.

## Tools

| Tool | Guarded | Notes |
|---|---|---|
| `notes.get_digest` | no | Total, count created in the last 7 days, 3 most recent titles |
| `notes.write` | no | Creates a note. Nothing here costs money, so no review step |
| `notes.query` | no | Provided by core, read only as `pos_readonly` |
| `core.search` | no | One search over every module. Provided by core, words first then meaning |

`guarded: []` means no tool here needs review. A tool named in that list lands
in `core.proposals` when an agent calls it, subject to the `agent_autonomy`
setting. `entityTypes` is what the search scope chips and the Review screen use
to label a row.

## How to copy it

1. `cp -r modules/notes modules/<your-module>`
2. Write a migration creating the `<your-module>` schema. Copy the whole grant
   and RLS block from `20260905223936_notes_init.sql`, including
   `alter default privileges ... to pos_readonly`. Core's setup loop does not
   re-run for a later migration, so a table without it is unreadable.
3. Change `id`, `nav`, and the tools in `manifest.ts`.
4. `pnpm gen:index`.

The nav entry and the `/<id>` route appear on their own. The nav entry is
hidden when the module id is switched off in the `modules_enabled` setting;
its jobs, tools, and direct URL keep working.
