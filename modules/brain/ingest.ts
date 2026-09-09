import { complete, NotConnected, SoftCapExceeded } from '@/core/llm'
import { extract, looksEmpty } from './extract'
import { fetchTranscript, isYouTube, videoId, videoTitle } from './youtube'

// SPEC section 6's ingestion: a URL becomes readable text, a YouTube link
// becomes a transcript, and the model drafts a summary the owner approves.
//
// Nothing here writes a note. It returns what it found, and the caller hands
// that to the module's own `write` tool, which produces a draft because that is
// what `write` does. The review step stays exactly where it was.

export type Ingested = {
  title: string
  /** The drafted summary, or empty when there is no model to draft one. */
  summary: string
  /** What the summary was drawn from. Stored and shown beside it. */
  sourceText: string
  sourceUrl: string
  kind: 'article' | 'video'
  /** One line for the owner about anything that did not go to plan. */
  note: string
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/** Enough for a long article. Past this the tail is navigation and comments. */
const MAX_SOURCE_CHARS = 60_000

/** A page larger than this is not an article. Guards against a huge download. */
const MAX_BYTES = 5_000_000

const SYSTEM = `You summarise something the reader has decided to keep, for their own notes.

Write markdown. Open with two or three sentences on what it actually says, then the specific points worth remembering as bullets. Prefer the concrete: a number, a name, a claim someone made.

Rules:
- Only what the text says. If it does not say something, do not supply it from what you know.
- No preamble, no "this article discusses", no closing summary of your summary.
- Keep the author's own terms rather than translating them into general ones.
- If the text is truncated or clearly incomplete, say so in one line at the end.`

/**
 * Fetch a URL and return what it holds.
 *
 * Throws only for a failure the owner has to see: an unreachable page, or a
 * page that turned out to hold nothing worth summarising. Everything softer
 * comes back in `note` alongside a usable result.
 */
export async function ingestUrl(rawUrl: string): Promise<Ingested> {
  const url = normaliseUrl(rawUrl)
  return isYouTube(url) ? ingestVideo(url) : ingestArticle(url)
}

/**
 * A pasted URL, tidied.
 *
 * A bare `example.com/x` is what people paste, and `new URL` rejects it, so
 * https is assumed rather than the paste being refused. Only http and https
 * are allowed through: `file:` and `data:` would otherwise be fetchable.
 */
export function normaliseUrl(input: string): string {
  const trimmed = input.trim()

  // Any scheme at all has to be one of the two allowed. Testing for `https?://`
  // and prepending otherwise is the obvious version and it is wrong: it turns
  // `file:///etc/passwd` into `https://file:///etc/passwd`, which parses, has
  // protocol `https:`, and sails straight through the check below.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) {
    throw new Error('Only http and https URLs can be read.')
  }

  let parsed: URL
  try {
    parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`)
  } catch {
    throw new Error(`That does not look like a URL: ${input}`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http and https URLs can be read.')
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error('That address is on a private network, so it will not be fetched.')
  }
  return parsed.toString()
}

/**
 * Addresses a server must not be talked into fetching.
 *
 * This runs inside a server action, so the URL is attacker-controllable in the
 * general case and the request goes out from inside the deployment. Cloud
 * metadata at 169.254.169.254 is the classic target; loopback and the private
 * ranges are the rest of it.
 *
 * A hostname that resolves to a private address is not caught here, and cannot
 * be without resolving it first and pinning the result through the fetch. This
 * blocks the literal forms, which is the difference between an accident and a
 * deliberate attack, and the deliberate case is bounded by there being one user
 * who has to be signed in to reach this at all.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return true
  // IPv6 loopback and the unique-local and link-local ranges.
  if (host === '::1' || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe80:/.test(host)) return true
  // IPv4-mapped IPv6, so ::ffff:127.0.0.1 is not a way around the rules below.
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]

  const octets = (mapped ?? host).split('.')
  if (octets.length !== 4 || !octets.every((o) => /^\d{1,3}$/.test(o))) return false
  const [a, b] = octets.map(Number)
  if (octets.some((o) => Number(o) > 255)) return false

  return (
    a === 0 || // this network
    a === 10 || // private
    a === 127 || // loopback
    (a === 169 && b === 254) || // link local, and cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 100 && b >= 64 && b <= 127) // carrier grade NAT
  )
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) throw new Error(`That page answered ${res.status}.`)

  const type = res.headers.get('content-type') ?? ''
  if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) {
    throw new Error(`That is a ${type.split(';')[0]}, not a page. Nothing to read.`)
  }

  const size = Number(res.headers.get('content-length') ?? 0)
  if (size > MAX_BYTES) throw new Error('That page is too large to read.')

  return (await res.text()).slice(0, MAX_BYTES)
}

async function ingestArticle(url: string): Promise<Ingested> {
  const { title, text } = extract(await fetchText(url))

  // A paywall stub, a cookie wall and a JavaScript-only page all look like
  // this. Summarising one produces a confident note about something nobody
  // read, which is the worst thing this feature could do.
  if (looksEmpty(text)) {
    throw new Error(
      'That page had almost no text in it. It may be paywalled, or it may render in the browser. Paste the text in by hand instead.',
    )
  }

  const source = text.slice(0, MAX_SOURCE_CHARS)
  const drafted = await summarise(title || url, source)

  return {
    title: title || url,
    summary: drafted.summary,
    sourceText: source,
    sourceUrl: url,
    kind: 'article',
    note: [text.length > MAX_SOURCE_CHARS ? 'The article was long and was trimmed.' : '', drafted.note]
      .filter(Boolean)
      .join(' '),
  }
}

async function ingestVideo(url: string): Promise<Ingested> {
  const id = videoId(url)!
  const transcript = await fetchTranscript(id)

  if (!transcript) {
    throw new Error(
      'That video has no captions this can read. YouTube only exposes a transcript when captions exist, and some videos have none.',
    )
  }

  // The watch page is fetched a second time for the title. One extra request
  // against a page already warm in YouTube's cache, versus threading the title
  // back through a function whose job is captions.
  let title = ''
  try {
    title = videoTitle(await fetchText(url))
  } catch {
    // A title is a nicety. A transcript is the thing.
  }

  const source = transcript.text.slice(0, MAX_SOURCE_CHARS)
  const drafted = await summarise(title || url, source)

  return {
    title: title || `YouTube ${id}`,
    summary: drafted.summary,
    sourceText: source,
    sourceUrl: url,
    kind: 'video',
    note: [
      transcript.automatic
        ? "The transcript is YouTube's automatic one, so names and terms may be wrong."
        : '',
      transcript.text.length > MAX_SOURCE_CHARS ? 'The transcript was long and was trimmed.' : '',
      drafted.note,
    ]
      .filter(Boolean)
      .join(' '),
  }
}

/**
 * The draft.
 *
 * Haiku, and capped: this is owner-initiated and optional enough to stop. A
 * summary that cannot be written is not a failure, because the draft still
 * arrives with the full source text on it and the owner can write the note
 * themselves. That is what a second brain is for.
 */
async function summarise(title: string, text: string): Promise<{ summary: string; note: string }> {
  try {
    const summary = await complete({
      model: 'claude-haiku-4-5',
      purpose: 'summary',
      module: 'brain',
      system: SYSTEM,
      messages: [{ role: 'user', content: `Title: ${title}\n\n${text}` }],
      maxTokens: 1500,
    })
    return { summary: summary.trim(), note: '' }
  } catch (error) {
    if (error instanceof SoftCapExceeded) {
      return { summary: '', note: 'No summary: the model spend cap has been reached this month.' }
    }
    if (error instanceof NotConnected) {
      return { summary: '', note: 'No summary: Anthropic is not connected.' }
    }
    return { summary: '', note: 'No summary: the model could not be reached.' }
  }
}
