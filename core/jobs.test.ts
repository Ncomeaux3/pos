import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { pruneRequestLog, runJob } from './jobs'
import { pending, queue, renderEmail } from './notify'
import { buildSummary } from './orchestrator'

beforeEach(async () => {
  await db().query('delete from core.jobs')
  await db().query('delete from core.notifications')
  await db().query('delete from core.proposals')
  await db().query('delete from core.llm_calls')
  await db().query('delete from core.digests')
  await db().query('delete from core.request_log')
  await db().query('delete from core.settings')

  // Quiet hours default to 22:00, and these tests are about what is queued, not
  // about the delivery window. Without this they pass or fail on the clock.
  // From and to being equal is an empty window, so nothing is held back.
  await db().query(
    `insert into core.settings (key, value)
     values ('quiet_from', '"00:00"'), ('quiet_to', '"00:00"')`,
  )
})

describe('runJob', () => {
  it('records a job that succeeded', async () => {
    const result = await runJob('notes', 'nightly_digest', async () => ({ total: 5 }))

    expect(result.status).toBe('ok')
    const { rows } = await db().query<{ last_status: string }>(
      `select last_status from core.jobs where module = 'notes' and name = 'nightly_digest'`,
    )
    expect(rows).toMatchObject([{ last_status: 'ok' }])
  })

  it('records a job that threw as failed rather than propagating', async () => {
    const result = await runJob('finance', 'sync', async () => {
      throw new Error('auth_expired: refresh token rejected')
    })

    expect(result.status).toBe('failed')
    expect(result.detail).toMatch(/auth_expired/)

    const { rows } = await db().query<{ last_status: string; log: { error: string } }>(
      `select last_status, log from core.jobs where module = 'finance' and name = 'sync'`,
    )
    expect(rows[0].last_status).toBe('failed')
    // The error text is kept, because it is what the Retry card shows.
    expect(rows[0].log.error).toMatch(/auth_expired/)
  })

  it('runs the next job after one fails', async () => {
    const order: string[] = []

    await runJob('a', 'one', async () => {
      order.push('one')
      throw new Error('boom')
    })
    await runJob('a', 'two', async () => {
      order.push('two')
    })

    // A bank sync that cannot reach its provider must not cost you the digest.
    expect(order).toEqual(['one', 'two'])
  })
})

describe('pruneRequestLog', () => {
  it('deletes rows older than ninety days and keeps the rest', async () => {
    await db().query(
      `insert into core.request_log (route, method, status, duration_ms, occurred_at)
       values ('/api/old', 'GET', 200, 1, now() - interval '100 days'),
              ('/api/new', 'GET', 200, 1, now())`,
    )

    const { deleted } = await pruneRequestLog()
    expect(deleted).toBe(1)

    const { rows } = await db().query<{ route: string }>('select route from core.request_log')
    expect(rows).toMatchObject([{ route: '/api/new' }])
  })
})

describe('notifications', () => {
  it('holds a notification until it is due', async () => {
    await queue({ title: 'Later', body: '', dueAt: new Date(Date.now() + 86_400_000) })
    expect(await pending()).toHaveLength(0)
  })

  it('puts urgent items first', async () => {
    await queue({ title: 'Ordinary', body: '' })
    await queue({ title: 'Urgent one', body: '', urgency: 'urgent' })

    const items = await pending()
    expect(items[0].title).toBe('Urgent one')
  })

  it('renders every alert into one email, with the rest counted', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      title: `Alert ${i}`,
      body: 'detail',
      urgency: 'normal',
      channel: 'email',
    }))

    const body = renderEmail('Two things need you.', items, 482)

    // One email a day, never a flood: the top three, then a count.
    expect(body).toContain('Two things need you.')
    expect(body).toContain('Alert 0')
    expect(body).toContain('Alert 2')
    expect(body).not.toContain('Alert 3')
    expect(body).toContain('and 2 more.')
    expect(body).toContain('$4.82')
  })

  it('says so plainly when there is nothing', () => {
    expect(renderEmail(null, [], 0)).toContain('Nothing needs you today.')
  })
})

describe('buildSummary', () => {
  it('is empty and calm when nothing is wrong', async () => {
    const summary = await buildSummary()
    expect(summary.alerts).toEqual([])
    expect(summary.failedJobs).toEqual([])
  })

  it('raises a failed job as an alert', async () => {
    await runJob('finance', 'sync', async () => {
      throw new Error('nope')
    })

    const summary = await buildSummary()
    expect(summary.failedJobs).toMatchObject([{ module: 'finance', name: 'sync' }])
    expect(summary.alerts[0]).toMatchObject({ tone: 'bad' })
    expect(summary.alerts[0].title).toContain('finance.sync')
  })

  it('raises waiting proposals', async () => {
    await db().query(
      `insert into core.proposals (module, tool, agent, reason)
       values ('notes', 'write', 'orchestrator', 'because')`,
    )

    const summary = await buildSummary()
    expect(summary.pendingProposals).toBe(1)
    expect(summary.alerts.some((a) => a.title.includes('proposal'))).toBe(true)
  })

  it('raises spend past the cap', async () => {
    await db().query(
      `insert into core.settings (key, value) values ('llm_soft_cap_cents', '10'::jsonb)`,
    )
    await db().query(
      `insert into core.llm_calls (model, purpose, cost_cents) values ('claude-haiku-4-5', 'research', 50)`,
    )

    const summary = await buildSummary()
    expect(summary.spendCents).toBe(50)
    expect(summary.alerts.some((a) => a.title.includes('past the cap'))).toBe(true)
  })

  it('carries each module digest through without understanding it', async () => {
    await db().query(
      `insert into core.digests (module, payload) values ('notes', '{"total": 5}'::jsonb)`,
    )

    const summary = await buildSummary()
    // The orchestrator reads digests and never a module's own tables.
    expect(summary.modules).toMatchObject([{ module: 'notes', payload: { total: 5 } }])
  })
})

describe('assembleSummary', () => {
  it('queues nothing on a night with nothing wrong', async () => {
    const { assembleSummary } = await import('./orchestrator')
    const result = await assembleSummary()

    expect(result.queued).toBe(false)
    expect(await pending()).toHaveLength(0)
  })

  it('queues exactly one notification however many alerts there are', async () => {
    await runJob('a', 'one', async () => {
      throw new Error('boom')
    })
    await runJob('b', 'two', async () => {
      throw new Error('boom')
    })
    await db().query(
      `insert into core.proposals (module, tool, agent, reason)
       values ('notes', 'write', 'orchestrator', 'because')`,
    )

    const { assembleSummary } = await import('./orchestrator')
    const result = await assembleSummary()

    expect(result.queued).toBe(true)
    // Three alerts, one notification: the sender bundles, and the unread count
    // should grow by nights rather than by however much went wrong.
    const items = await pending()
    expect(items).toHaveLength(1)
    expect(items[0].urgency).toBe('urgent')
    expect(items[0].body).toContain('a.one failed')
    expect(items[0].body).toContain('b.two failed')
  })
})

describe('sendPending', () => {
  it('skips quietly when nothing is waiting', async () => {
    const { sendPending } = await import('./notify')
    expect(await sendPending()).toMatchObject({ sent: 0, emails: 0 })
  })

  it('skips rather than failing when OWNER_EMAIL is unset', async () => {
    await queue({ title: 'Something', body: '' })

    const original = process.env.OWNER_EMAIL
    delete process.env.OWNER_EMAIL
    try {
      const { sendPending } = await import('./notify')
      const result = await sendPending()
      // Nothing is wrong yet: the rows wait for configuration rather than being
      // marked sent and lost.
      expect(result).toMatchObject({ sent: 0, emails: 0 })
      expect(result.skipped).toMatch(/OWNER_EMAIL/)
      expect(await pending()).toHaveLength(1)
    } finally {
      if (original) process.env.OWNER_EMAIL = original
    }
  })
})

describe('digest notifications do not stack', () => {
  it('supersedes an unread digest rather than queueing beside it', async () => {
    await db().query(
      `insert into core.proposals (module, tool, agent, reason)
       values ('notes', 'write', 'orchestrator', 'because')`,
    )
    const { assembleSummary } = await import('./orchestrator')

    await assembleSummary()
    await assembleSummary()
    await assembleSummary()

    // Three runs, one waiting digest: pressing Run now repeatedly must not bury
    // the dashboard in near-identical warnings.
    expect(await pending()).toHaveLength(1)
  })

  it('leaves a module alert alone', async () => {
    await queue({ title: 'Bill due Thursday', body: '' })
    await db().query(
      `insert into core.proposals (module, tool, agent, reason)
       values ('notes', 'write', 'orchestrator', 'because')`,
    )

    const { assembleSummary } = await import('./orchestrator')
    await assembleSummary()

    const titles = (await pending()).map((p) => p.title)
    expect(titles).toContain('Bill due Thursday')
    expect(titles).toHaveLength(2)
  })

  it('keeps a digest that already went out, because that is history', async () => {
    await db().query(
      `insert into core.notifications (channel, title, body, sent_at)
       values ('digest', 'Last night', '', now())`,
    )
    await db().query(
      `insert into core.proposals (module, tool, agent, reason)
       values ('notes', 'write', 'orchestrator', 'because')`,
    )

    const { assembleSummary } = await import('./orchestrator')
    await assembleSummary()

    const { rows } = await db().query<{ n: string }>(
      `select count(*)::text as n from core.notifications where channel = 'digest'`,
    )
    expect(Number(rows[0].n)).toBe(2)
  })
})
