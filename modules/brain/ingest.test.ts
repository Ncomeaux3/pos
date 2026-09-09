import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const lookup = vi.fn()
// Mocked so the suite does not depend on a real name resolving. localtest.me
// pointing at 127.0.0.1 is exactly the case being guarded, but a test that
// needs DNS fails on a CI runner that has none.
vi.mock('node:dns/promises', () => ({ lookup: (...args: unknown[]) => lookup(...args) }))

const complete = vi.fn()
vi.mock('@/core/llm', async () => {
  const actual = await vi.importActual<typeof import('@/core/llm')>('@/core/llm')
  return { ...actual, complete: (...args: unknown[]) => complete(...args) }
})

const { db } = await import('@/core/db')
const { checkedUrl, fetchFollowing, ingestUrl, isPrivateHost, normaliseUrl } = await import(
  './ingest'
)
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
  lookup.mockReset()
  // Public by default. A test that cares says otherwise.
  lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
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

// The guard on the pasted URL is only half of it. `redirect: 'follow'` would
// check the first link and then chase a 302 anywhere, which needs no DNS
// control at all and was the easiest way past normaliseUrl by some distance.
describe('following redirects', () => {
  const redirect = (to: string) =>
    new Response(null, { status: 302, headers: { location: to } })

  it('follows an ordinary redirect', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirect('https://example.com/moved'))
      .mockResolvedValueOnce(htmlResponse(ARTICLE))
    vi.stubGlobal('fetch', fetchMock)

    const res = await fetchFollowing('https://example.com/a')

    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[1][0]).toBe('https://example.com/moved')
  })

  it('refuses a redirect into a private address', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => redirect('http://169.254.169.254/latest/meta-data/')),
    )

    await expect(fetchFollowing('https://example.com/a')).rejects.toThrow(/private/)
  })

  // A Location header is allowed to be relative, and resolving it against the
  // wrong base is another way to end up somewhere unchecked.
  it('resolves a relative redirect against the current URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirect('/elsewhere'))
      .mockResolvedValueOnce(htmlResponse(ARTICLE))
    vi.stubGlobal('fetch', fetchMock)

    await fetchFollowing('https://example.com/deep/a')

    expect(fetchMock.mock.calls[1][0]).toBe('https://example.com/elsewhere')
  })

  it('refuses a redirect to a scheme that is not http', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => redirect('file:///etc/passwd')))

    await expect(fetchFollowing('https://example.com/a')).rejects.toThrow(/http/)
  })

  it('gives up rather than looping forever', async () => {
    const fetchMock = vi.fn(async () => redirect('https://example.com/next'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchFollowing('https://example.com/a')).rejects.toThrow(/too many/)
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(7)
  })

  it('says so when a redirect names nowhere to go', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 302 })))

    await expect(fetchFollowing('https://example.com/a')).rejects.toThrow(/nowhere/)
  })

  // An ingest goes through the same path, so the whole chain is covered.
  it('stops an ingest that is redirected at cloud metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => redirect('http://169.254.169.254/latest/meta-data/')),
    )

    await expect(ingestUrl('https://example.com/a')).rejects.toThrow(/private/)
  })
})

// A public hostname pointing at a private address is free and needs no attacker
// infrastructure, so the literal check alone is not enough.
describe('checkedUrl', () => {
  it('refuses a hostname that resolves to loopback', async () => {
    lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }])
    await expect(checkedUrl('http://localtest.me/')).rejects.toThrow(/private/)
  })

  // One private record among several is still a way in.
  it('refuses when any record is private', async () => {
    lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ])
    await expect(checkedUrl('https://mixed.example/')).rejects.toThrow(/private/)
  })

  it('lets a hostname that resolves publicly through', async () => {
    await expect(checkedUrl('https://example.com/a')).resolves.toBe('https://example.com/a')
  })

  // An unresolvable host fails at the fetch with a better message than this
  // could give, so it is not treated as an attack.
  it('does not treat a lookup failure as private', async () => {
    lookup.mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }))
    await expect(checkedUrl('https://nowhere.invalid/a')).resolves.toContain('invalid')
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
