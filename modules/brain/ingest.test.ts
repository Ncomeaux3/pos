import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const complete = vi.fn()
vi.mock('@/core/llm', async () => {
  const actual = await vi.importActual<typeof import('@/core/llm')>('@/core/llm')
  return { ...actual, complete: (...args: unknown[]) => complete(...args) }
})

const { db } = await import('@/core/db')
const { ingestUrl, isPrivateHost, normaliseUrl } = await import('./ingest')
// Through the registry rather than by importing ./manifest directly. The tool
// calls register(), which resolves the classifier through modules/_index, and
// importing this manifest first leaves that half initialised: the same cycle
// documented in core/entities.ts.
const { getModule } = await import('@/core/modules')
const manifest = getModule('brain')!

const ARTICLE = `<html><head><title>Replication | The Paper</title></head><body>
  <nav>Home Subscribe</nav>
  <article><p>${'Leaders and followers and the lag between them. '.repeat(30)}</p></article>
</body></html>`

beforeEach(() => {
  complete.mockReset()
  complete.mockResolvedValue('A summary of the piece.')
})
afterEach(async () => {
  vi.unstubAllGlobals()
  await db().query('delete from brain.link')
  await db().query('delete from brain.note')
  await db().query('delete from core.events')
  await db().query('delete from core.entities')
})
afterAll(async () => {
  await db().end()
})

const htmlResponse = (body: string) =>
  new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } })

describe('normaliseUrl', () => {
  it('assumes https for what people actually paste', () => {
    expect(normaliseUrl('example.com/a')).toBe('https://example.com/a')
    expect(normaliseUrl('  https://example.com/a  ')).toBe('https://example.com/a')
  })

  // file: and data: would otherwise be fetchable from a server action.
  it('refuses a scheme that is not http or https', () => {
    expect(() => normaliseUrl('file:///etc/passwd')).toThrow(/http/)
    expect(() => normaliseUrl('data:text/html,<b>x</b>')).toThrow(/http/)
  })

  it('refuses something that is not a URL at all', () => {
    expect(() => normaliseUrl('   ')).toThrow()
  })

  // This runs in a server action, so the request goes out from inside the
  // deployment. Cloud metadata at 169.254.169.254 is the classic target.
  it('refuses a private address', () => {
    expect(() => normaliseUrl('http://169.254.169.254/latest/meta-data/')).toThrow(/private/)
    expect(() => normaliseUrl('http://localhost:3000/admin')).toThrow(/private/)
    expect(() => normaliseUrl('http://10.0.0.5/')).toThrow(/private/)
  })
})

describe('isPrivateHost', () => {
  it('knows the ranges a server should not be talked into fetching', () => {
    expect(isPrivateHost('127.0.0.1')).toBe(true)
    expect(isPrivateHost('10.1.2.3')).toBe(true)
    expect(isPrivateHost('172.16.0.1')).toBe(true)
    expect(isPrivateHost('172.31.255.255')).toBe(true)
    expect(isPrivateHost('192.168.1.1')).toBe(true)
    expect(isPrivateHost('169.254.169.254')).toBe(true)
    expect(isPrivateHost('0.0.0.0')).toBe(true)
    expect(isPrivateHost('localhost')).toBe(true)
    expect(isPrivateHost('::1')).toBe(true)
    expect(isPrivateHost('fd00::1')).toBe(true)
  })

  // ::ffff:127.0.0.1 is loopback wearing an IPv6 hat.
  it('is not fooled by an IPv4 mapped IPv6 address', () => {
    expect(isPrivateHost('::ffff:127.0.0.1')).toBe(true)
    expect(isPrivateHost('::ffff:169.254.169.254')).toBe(true)
  })

  it('lets a normal host through', () => {
    expect(isPrivateHost('example.com')).toBe(false)
    expect(isPrivateHost('172.32.0.1')).toBe(false)
    expect(isPrivateHost('11.0.0.1')).toBe(false)
    expect(isPrivateHost('192.169.1.1')).toBe(false)
  })
})

describe('ingestUrl', () => {
  it('extracts, summarises, and keeps the source beside the summary', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse(ARTICLE)))

    const found = await ingestUrl('https://example.com/a')

    expect(found.title).toBe('Replication')
    expect(found.summary).toBe('A summary of the piece.')
    expect(found.sourceText).toContain('Leaders and followers')
    expect(found.sourceText).not.toContain('Subscribe')
    expect(found.kind).toBe('article')
  })

  // The worst thing this feature could do is write a confident note about an
  // article nobody could read.
  it('refuses a paywall stub rather than summarising it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlResponse('<body><p>Subscribe to continue.</p></body>')),
    )

    await expect(ingestUrl('https://example.com/a')).rejects.toThrow(/almost no text/)
    expect(complete).not.toHaveBeenCalled()
  })

  it('refuses something that is not a page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } })),
    )

    await expect(ingestUrl('https://example.com/a.pdf')).rejects.toThrow(/not a page/)
  })

  it('says what a failing page answered', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 404 })))

    await expect(ingestUrl('https://example.com/a')).rejects.toThrow(/404/)
  })

  // A summary is optional. The draft still arrives with the full source on it,
  // and the owner can write the note themselves, which is the point.
  it('still returns the source when the model is past the cap', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse(ARTICLE)))
    const { SoftCapExceeded } = await import('@/core/llm')
    complete.mockRejectedValue(new SoftCapExceeded(1000, 1000))

    const found = await ingestUrl('https://example.com/a')

    expect(found.summary).toBe('')
    expect(found.sourceText).toContain('Leaders and followers')
    expect(found.note).toContain('cap')
  })
})

describe('the ingest tool', () => {
  it('is guarded, because it is the one thing here that spends money', () => {
    expect(manifest.guarded).toEqual(['ingest'])
  })

  // Every other write tool publishes for the owner and drafts for an agent.
  // This one drafts for everyone: the body is something a model wrote.
  it('always produces a draft, even for the owner', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse(ARTICLE)))

    await manifest.tools.ingest.run(
      { url: 'https://example.com/a' },
      { source: 'ui' },
    )

    const { rows } = await db().query<{ status: string; source_url: string; body: string }>(
      `select status, source_url, body from brain.note`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('draft')
    expect(rows[0].source_url).toBe('https://example.com/a')
    expect(rows[0].body).toBe('A summary of the piece.')
  })

  it('emits note_ingested rather than a creation, so a draft earns nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse(ARTICLE)))

    await manifest.tools.ingest.run(
      { url: 'https://example.com/a' },
      { source: 'ui' },
    )

    const { rows } = await db().query<{ event_type: string }>(
      `select event_type from core.events where module = 'brain'`,
    )
    expect(rows.map((r) => r.event_type)).toEqual(['note_ingested'])
  })
})
