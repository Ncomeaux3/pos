import { db } from '@/core/db'
import { embedChanged } from '@/core/search'
import { propose } from '@/core/proposals'
import { seed } from '@/modules/notes/seed'
import { seed as seedTasks } from '@/modules/tasks/seed'
import { seed as seedGoals } from '@/modules/goals/seed'
import { seed as seedFinance } from '@/modules/finance/seed'
import { seed as seedBrain } from '@/modules/brain/seed'
import { seed as seedTravel } from '@/modules/travel/seed'

// Run by the Playwright setup project before any screen test. The vitest suites
// use their own pos_test database now, but this still has to be deterministic:
// the screens are asserted against it.
// Approving a proposal writes a real note, and those accumulate across runs.
// The fixture has to be the same every time, so anything that is not part of
// the demo set goes before it is rebuilt.
await db().query(`delete from core.entities where module = 'notes' and entity_id in
                    (select id::text from notes.note where source <> 'demo')`)
await db().query(`delete from notes.note where source <> 'demo'`)

// The weekly review saves answers as you go, so a review left half finished
// by an earlier pass would be loaded back and added to. The wizard resuming is
// the feature; the fixture has to start from nothing.
await db().query(`delete from core.reviews`)

// Requested providers are first run's output, and the onboarding test toggles
// one. A request left behind by an earlier pass turns the next click into a
// removal, so the fixture starts with none. Real connections, which hold
// credentials, are never touched here.
await db().query(`delete from core.connections where status = 'requested'`)
await db().query(`delete from core.entities where module = 'core' and entity_type = 'review'`)

const notes = await seed()
// No delete first. The module seed upserts on (source, external_id), so the
// ids are stable and the fixture is already the same every run. Deleting and
// reinserting gave every task a new uuid and orphaned its core.entities row,
// and after a few passes search was answering with hundreds of rows whose
// tasks no longer existed.
const taskCount = await seedTasks()
const goalCount = await seedGoals()
const txCount = await seedFinance()
const brainCount = await seedBrain()
const travelCount = await seedTravel()

// The detector runs against the seeded history rather than the fixture listing
// its own answers: the screen has to show what detectRecurring actually found.
const { detectSubscriptions, snapshotBalances } = await import('@/modules/finance/jobs/nightly-digest')
await snapshotBalances()
const detected = await detectSubscriptions()
const index = await embedChanged()

// Two proposals so the Review screen has both shapes: one a module marked
// guarded, one it did not.
await db().query(`delete from core.proposals where agent in ('orchestrator', 'notes.tidy')`)

await propose({
  module: 'notes',
  tool: 'write',
  payload: { title: 'Weekly summary of what you wrote', body: 'Drafted from the last seven days.' },
  agent: 'orchestrator',
  reason: 'Five notes landed this week and none of them link to each other.',
  guarded: true,
  title: 'Draft a weekly summary note',
  confidence: 0.86,
  evidence: '5 notes created in the last 7 days',
  affects: 'Notes, Skill Tree',
  diff: [{ field: 'title', before: null, after: 'Weekly summary of what you wrote' }],
})

await propose({
  module: 'notes',
  tool: 'write',
  payload: { title: 'Sharpen the kitchen knives', body: 'Recurring: every 3 months.' },
  agent: 'notes.tidy',
  reason: 'This note has no body and reads like a recurring chore.',
  guarded: false,
  title: 'Add a body to an empty note',
  confidence: 0.64,
  evidence: '1 note with an empty body',
  affects: 'Notes',
  diff: [{ field: 'body', before: '', after: 'Recurring: every 3 months.' }],
})

// Alerts for the Notifications screen, tied back to the seeded rules so the
// alert centre shows a module and a channel rather than bare rows. Five
// unread and two read, which is what makes both halves of the screen render.
// Every seeded alert carries a rule_id; nothing else in the fixture does, so
// this is the whole demo set and the reseed stays idempotent.
await db().query(`delete from core.notifications where rule_id is not null`)
await db().query(
  `insert into core.notifications (rule_id, channel, title, body, due_at, urgency, read_at)
   select r.id, v.channel, v.title, v.body, now() - v.age, v.urgency, v.read
     from (values
       ('finance', 'statement_due',  'push',  'Chase Sapphire due in 3 days',
        '$1,842 statement, autopay is off', interval '3 hours',  'urgent', null::timestamptz),
       ('system',  'job_failed',     'email', 'Fidelity sync failed twice',
        'Last good pull 5 Sep 04:00, balances may be stale', interval '5 hours', 'urgent', null),
       ('insurance', 'policy_renewal', 'email', 'Landlord policy renews 21 Sep',
        'Premium up 8%, $1,284 for the year', interval '20 hours', 'normal', null),
       ('finance', 'budget_pacing',  'inapp', 'Dining budget at 94%',
        '$47 left with 23 days to go', interval '28 hours', 'normal', null),
       ('goals',   'pace_at_risk',   'email', 'Ship POS v1 projects to 12 Nov',
        'Three weeks past target at the current pace', interval '30 hours', 'normal', null),
       ('travel',  'flight_checkin', 'push',  'Check in for UA 1422 opened',
        'SFO to DEN, 07:40 tomorrow', interval '3 days', 'normal', now()),
       ('system',  'backup_summary', 'inapp', 'Backup complete, 30 snapshots kept',
        '04:10, 1.4 GB, no integrity warnings', interval '4 days', 'normal', now())
     ) as v(module, key, channel, title, body, age, urgency, read)
     join core.notification_rules r on r.module = v.module and r.key = v.key`,
)

// Two nightly runs with their writes, so the Agent Log has an accordion to
// open. The first is partial with a failed job; the second is clean. Every
// entry that carries a revert payload gets an Undo button, and the notes ones
// genuinely revert: they call notes.write with the previous title.
// Every prior run goes, not just the demo ones. The Agent Log shows the last
// seven, the dashboard's Run now button adds a real one on nearly every e2e
// pass, and after a few passes the seeded runs fall out of the window and the
// screen has nothing to show. These are local run logs, the same class of
// throwaway as the notes and proposals cleared above.
//
// write_log.run_id and notifications.digest_run_id are both on delete set
// null, so nothing else is lost with them.
await db().query(`delete from core.write_log where actor = 'demo'`)
await db().query(`delete from core.job_runs`)

const { rows: runRows } = await db().query<{ id: string }>(
  `insert into core.job_runs (trigger_source, status, started_at, finished_at, duration_ms, log)
   values
     ('demo', 'partial', now() - interval '10 minutes', now() - interval '10 minutes' + interval '221 seconds', 221000,
      $1::jsonb),
     ('demo', 'clean', now() - interval '12 minutes', now() - interval '12 minutes' + interval '178 seconds', 178000,
      $2::jsonb)
   returning id`,
  [
    JSON.stringify({
      jobs: [
        { module: 'notes', name: 'nightly-digest', status: 'ok', durationMs: 31000 },
        { module: 'skills', name: 'nightly-digest', status: 'ok', durationMs: 6000 },
        { module: 'core', name: 'embed', status: 'ok', durationMs: 22000 },
        {
          module: 'core',
          name: 'brokerage-sync',
          status: 'failed',
          durationMs: 82000,
          detail: 'auth_expired: refresh token rejected (401), account 8830',
        },
        { module: 'core', name: 'digest-notify', status: 'ok', durationMs: 3000 },
      ],
    }),
    JSON.stringify({
      jobs: [
        { module: 'notes', name: 'nightly-digest', status: 'ok', durationMs: 28000 },
        { module: 'skills', name: 'nightly-digest', status: 'ok', durationMs: 5000 },
        { module: 'core', name: 'embed', status: 'ok', durationMs: 19000 },
      ],
    }),
  ],
)

const [recent, older] = runRows.map((r) => r.id)

await db().query(
  `insert into core.write_log
     (run_id, module, tool, kind, title, reason, diff, actor, revert_payload, apply_payload, created_at)
   values
     ($1, 'skills', 'write', 'classified',
      'Assigned skills to 3 notes',
      'Two matched keyword rules from skills.yaml; one went to the model at 0.71 confidence.',
      $3::jsonb, 'demo', null, null, now() - interval '10 minutes'),
     ($1, 'notes', 'write', 'created',
      'Drafted the weekly summary note',
      'Five notes landed this week and none of them linked to each other.',
      $4::jsonb, 'demo', null,
      $5::jsonb, now() - interval '10 minutes' + interval '40 seconds'),
     ($2, 'notes', 'write', 'updated',
      'Gave an empty note a body',
      'The note had a title and nothing under it, and read like a recurring chore.',
      $6::jsonb, 'demo',
      $7::jsonb, $8::jsonb, now() - interval '12 minutes')`,
  [
    recent,
    older,
    JSON.stringify([
      { field: 'Skill links', before: '11', after: '14' },
      { field: 'Unclassified', before: '3', after: '0' },
    ]),
    JSON.stringify([{ field: 'title', before: null, after: 'Weekly summary of what you wrote' }]),
    JSON.stringify({ title: 'Weekly summary of what you wrote', body: 'Drafted from the last seven days.' }),
    JSON.stringify([{ field: 'body', before: '', after: 'Recurring: every 3 months.' }]),
    JSON.stringify({ title: 'Sharpen the kitchen knives', body: '' }),
    JSON.stringify({ title: 'Sharpen the kitchen knives', body: 'Recurring: every 3 months.' }),
  ],
)

console.log(`seeded ${notes} notes, indexed ${index.indexed}, embedded ${index.embedded}, 2 proposals, 7 alerts, 2 runs, ${taskCount} tasks, ${goalCount} goals, ${txCount} transactions, ${detected.found} subscriptions detected, ${brainCount} notes, ${travelCount} travel rows`)
process.exit(0)
