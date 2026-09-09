# Second Brain

Schema `brain`, not `second_brain` (decision 14). Screen 08 of the design
bundle.

## The review step is a column

SPEC's promise is that the vault is the source of truth and the app never adds
to it without a review step. That promise is `note.status`.

An ingested note is a **draft**: a proposal about a note, not a note. It sits in
the inbox beside the text it was drawn from until the owner accepts it. `write`
called with `source: 'agent'` produces a draft whatever it asks for, and
`publish` is reached from the inbox, so an agent cannot put anything in the
vault by any path.

That is also why nothing in this module is guarded. The draft state already is
the guard, and guarding on top of it would put one decision behind two
approvals.

The source text is stored and shown **beside** the summary, not behind a
disclosure. A draft is judged against what it was drawn from, not taken on
trust.

## Links

`wikilinks.ts`, tested, because getting it wrong does not throw. It quietly
loses the connection between two notes, which is the one thing a second brain
exists to keep.

Three cases the test pins that a naive regex gets wrong:

**Code is not prose.** A note about this parser would link to itself, and a code
sample containing `[[x]]` would create a note nobody asked for. Fenced and
inline code are masked before matching, with spaces rather than deletion so
every offset outside the code is unchanged.

**A piped link points at its target, not its label.** `[[slug|what to show]]` is
standard vault syntax, and linking to the label points at a note that does not
exist.

**A slug is never empty.** An empty slug collides with every other empty slug on
the unique index, so the first untitled note would save and the second would
fail with a constraint error nobody could read. It falls back to `untitled`.

Slugs are stable once set. Renaming a note keeps its slug, because every link
pointing at it was written against the old one, and rewriting other notes to
suit a rename is not something this app gets to do.

## Unresolved links are kept

`brain.link` stores a link whose target does not exist, with a null
`to_note_id`.

That is the most useful backlog in the app: each one is a note the vault is
already asking for. The screen lists them under "links with nothing behind
them" and offers to start each one. Dropping them, which is what deriving links
on read would do, would lose exactly the thing worth keeping.

`resolveDanglingLinks()` runs when a note is created, so writing the note
someone linked to last week connects the two without either being edited. The
nightly `resolve_links` job does the same sweep, because a note created through
MCP or an import never touches the UI path.

## The vault is pulled, never pushed

`jobs/pull-vault.ts` mirrors the Obsidian vault in one direction. A file that
changed rewrites its note; nothing here can write to the vault, because
`integrations/github_vault/client.ts` has no function that could.

A pulled note is **published**, not a draft. It is already in the vault, so it
is already the owner's. The draft state exists for the other direction: things
the app proposes to add.

Three decisions worth knowing:

**A blob sha is the change detector.** Git already hashes every file, so an
unchanged sha means an unchanged file and there is no read and no write. A
nightly pull over a settled vault costs one request. Nothing needed a content
hash column because git had already computed one.

**The backfill emits nothing.** `register()` is called with `emit: false`, so
notes register for search and skills without emitting a creation event. Four
hundred notes written over five years are not four hundred notes of work
tonight, and awarding them today's XP would spike the Skill Tree for one
evening and leave it wrong forever.

**A file that has gone is not a note that has gone.** Orphans are counted and
reported, never deleted. A rename, a move, or a mistake should not silently
remove a note, and the vault is a git repo so the app is not the last copy
either way.

`external_id` is the vault path, so `unique (source, external_id)` keys a note
to its file. Slugs come from the file **name** rather than the path, because
that is how Obsidian resolves `[[DDIA]]` to `Books/Distributed/DDIA.md`.

## What is still missing

SPEC section 6 also asks for ingestion: a URL to readability text, a YouTube
transcript, and a model that drafts a summary for the owner to approve. None of
that is built. The draft state, the inbox and the review step all are, so the
half that is missing is the fetching, not the reviewing.

## Backlinks are a table, not a query

The panel asks the reverse question, and scanning every body for a title is the
one query here that would not scale. A row per direction, rewritten on save.
