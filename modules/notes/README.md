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

## Schema

`notes.note`: `title`, `body`, plus the `external_id` and `source` columns every
module table carries so imports stay idempotent.

## Tools

| Tool | Guarded | Notes |
|---|---|---|
| `notes.get_digest` | no | Total, count created in the last 7 days, 3 most recent titles |
| `notes.write` | no | Creates a note. Nothing here costs money, so no review step |
| `notes.query` | no | Provided by core, read only as `pos_readonly` |

## How to copy it

1. `cp -r modules/notes modules/<your-module>`
2. Write a migration creating the `<your-module>` schema, granting `pos_readonly`
   usage and select.
3. Change `id`, `nav`, and the tools in `manifest.ts`.
4. `pnpm gen:index`.

The nav entry and the `/<id>` route appear on their own.
