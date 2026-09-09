// Wikilink parsing. No imports: the Second Brain screen is a client component
// and anything reaching core/db.ts drags pg into the browser bundle.
//
// A vault's links are its structure, and getting this wrong does not throw. It
// quietly loses the connection between two notes, which is the one thing a
// second brain exists to keep. Hence the test file.

/** Longer than this stops being a file name and starts being a paragraph. */
const MAX_SLUG = 80

/**
 * The vault file name for a title, and the target a [[link]] resolves to.
 *
 * Stable once set. Renaming a note keeps its slug, because every link pointing
 * at it was written against the old one and rewriting other people's notes to
 * suit a rename is not something this app gets to do.
 */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/, '')

  // Never empty. An empty slug collides with every other empty slug on the
  // unique index, so the first untitled note would save and the second would
  // fail with a constraint error nobody could read.
  return slug || 'untitled'
}

/**
 * Blank out fenced and inline code so the parser does not read links inside it.
 *
 * Replaced with spaces rather than removed, so every offset outside the code is
 * unchanged and anything built on top of this sees the same positions.
 */
function maskCode(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, (block) => ' '.repeat(block.length))
    .replace(/`[^`\n]*`/g, (span) => ' '.repeat(span.length))
}

/** `[[target]]` or `[[target|label]]`, not spanning a line. */
const LINK = /\[\[([^\]\n|]+)(?:\|([^\]\n]*))?\]\]/g

/**
 * Every note this one links to, as slugs, in order and without repeats.
 *
 * A link to a note that does not exist yet is kept, not dropped: an unresolved
 * link is a real thing in a vault, and it is usually how the next note gets
 * started.
 */
export function extractLinks(body: string): string[] {
  const found: string[] = []

  for (const match of maskCode(body).matchAll(LINK)) {
    // The target, never the label. Linking to the label would point at a note
    // nobody wrote.
    const slug = slugify(match[1].trim())
    if (slug !== 'untitled' && !found.includes(slug)) found.push(slug)
  }

  return found
}

/** The body as prose: links become their label, everything else is untouched. */
export function renderPreview(body: string): string {
  const masked = maskCode(body)

  let out = ''
  let cursor = 0

  for (const match of masked.matchAll(LINK)) {
    const start = match.index
    out += body.slice(cursor, start)
    out += (match[2] ?? match[1]).trim()
    cursor = start + match[0].length
  }

  return out + body.slice(cursor)
}
