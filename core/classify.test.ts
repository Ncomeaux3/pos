import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const complete = vi.fn()
vi.mock('./llm', () => ({ complete: (...args: unknown[]) => complete(...args) }))

const { db } = await import('./db')
const { classify, loadSkills, matchByRules } = await import('./classify')

async function anEntity(title: string): Promise<string> {
  const { rows } = await db().query<{ id: string }>(
    `insert into core.entities (module, entity_type, entity_id, title)
     values ('notes', 'note', gen_random_uuid()::text, $1) returning id`,
    [title],
  )
  return rows[0].id
}

const linksFor = async (ref: string) =>
  (
    await db().query<{ skill_id: string; classified_by: string; confidence: string; is_manual: boolean }>(
      'select skill_id, classified_by, confidence, is_manual from core.skill_links where entity_ref = $1 order by skill_id',
      [ref],
    )
  ).rows

beforeEach(() => {
  complete.mockReset()
})
afterEach(async () => {
  await db().query('delete from core.entities')
})
afterAll(async () => {
  await db().end()
})

describe('loadSkills', () => {
  it('parses the tree and gives every node a unique id', () => {
    const nodes = loadSkills()
    expect(nodes.length).toBeGreaterThan(20)
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length)
  })

  it('points every parent at a node that exists', () => {
    const nodes = loadSkills()
    const ids = new Set(nodes.map((n) => n.id))
    for (const n of nodes) {
      if (n.parent) expect(ids, `${n.id} parent`).toContain(n.parent)
    }
  })
})

describe('matchByRules', () => {
  it('matches a keyword regardless of case', () => {
    expect(matchByRules('Deadlift form check')).toContain('strength')
    expect(matchByRules('DEADLIFT')).toContain('strength')
  })

  it('matches on word boundaries, not substrings', () => {
    // 'ran' is an endurance keyword; 'branch' and 'grandiose' must not hit it.
    expect(matchByRules('merged the branch')).not.toContain('endurance')
    expect(matchByRules('ran a 5k')).toContain('endurance')
  })

  it('can return several skills for one piece of text', () => {
    const hits = matchByRules('Wrote a postgres migration and deployed it to vercel')
    expect(hits).toEqual(expect.arrayContaining(['sql', 'cloud']))
  })

  it('returns nothing for text with no keyword in it', () => {
    expect(matchByRules('the quiet afternoon passed')).toEqual([])
  })

  it('matches multi word keywords', () => {
    expect(matchByRules('spent the day on system design')).toContain('architecture')
  })
})

describe('classify', () => {
  it('writes a rule link with full confidence on a keyword hit, without calling the model', async () => {
    const ref = await anEntity('Deadlift form check')
    await classify(ref, 'Deadlift form check')

    const links = await linksFor(ref)
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ skill_id: 'strength', classified_by: 'rule', is_manual: false })
    expect(Number(links[0].confidence)).toBe(1)
    expect(complete).not.toHaveBeenCalled()
  })

  it('falls back to the model when no keyword hits, and records which model decided', async () => {
    complete.mockResolvedValue('[{"skill_id":"writing","confidence":0.7}]')
    const ref = await anEntity('The quiet afternoon passed')
    await classify(ref, 'The quiet afternoon passed')

    const links = await linksFor(ref)
    expect(links).toHaveLength(1)
    expect(links[0].skill_id).toBe('writing')
    expect(links[0].classified_by).toMatch(/^model:/)
    expect(Number(links[0].confidence)).toBeCloseTo(0.7)
    expect(complete).toHaveBeenCalledOnce()
  })

  it('ignores a skill id the model invented', async () => {
    complete.mockResolvedValue('[{"skill_id":"underwater_basket_weaving","confidence":0.9}]')
    const ref = await anEntity('The quiet afternoon passed')
    await classify(ref, 'The quiet afternoon passed')

    // Nothing real came back, so this is unclassified rather than a bad link.
    const links = await linksFor(ref)
    expect(links).toHaveLength(1)
    expect(links[0].classified_by).toBe('unclassified')
  })

  it('retries the model once, then gives up and marks it unclassified', async () => {
    complete.mockRejectedValue(new Error('overloaded'))
    const ref = await anEntity('The quiet afternoon passed')
    await classify(ref, 'The quiet afternoon passed')

    expect(complete).toHaveBeenCalledTimes(2)
    const links = await linksFor(ref)
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ skill_id: 'unclassified', classified_by: 'unclassified' })
  })

  it('succeeds on the retry when the first call fails', async () => {
    complete
      .mockRejectedValueOnce(new Error('overloaded'))
      .mockResolvedValueOnce('[{"skill_id":"writing","confidence":0.5}]')
    const ref = await anEntity('The quiet afternoon passed')
    await classify(ref, 'The quiet afternoon passed')

    expect(complete).toHaveBeenCalledTimes(2)
    expect((await linksFor(ref))[0].skill_id).toBe('writing')
  })

  // The rule that matters most: a human decision is never overwritten by a job.
  it('leaves a manual link alone even when the rules disagree', async () => {
    const ref = await anEntity('Deadlift form check')
    await db().query(
      `insert into core.skill_links (entity_ref, skill_id, confidence, classified_by, is_manual)
       values ($1, 'strength', 0.2, 'human', true)`,
      [ref],
    )

    await classify(ref, 'Deadlift form check')

    const links = await linksFor(ref)
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ classified_by: 'human', is_manual: true })
    expect(Number(links[0].confidence)).toBeCloseTo(0.2)
  })

  it('is idempotent: classifying twice does not duplicate links', async () => {
    const ref = await anEntity('Deadlift form check')
    await classify(ref, 'Deadlift form check')
    await classify(ref, 'Deadlift form check')
    expect(await linksFor(ref)).toHaveLength(1)
  })
})
