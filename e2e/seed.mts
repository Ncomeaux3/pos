import { db } from '@/core/db'
import { embedChanged } from '@/core/search'
import { propose } from '@/core/proposals'
import { seed } from '@/modules/notes/seed'

// Run by the Playwright setup project before any screen test. The vitest suites
// use their own pos_test database now, but this still has to be deterministic:
// the screens are asserted against it.
// Approving a proposal writes a real note, and those accumulate across runs.
// The fixture has to be the same every time, so anything that is not part of
// the demo set goes before it is rebuilt.
await db().query(`delete from core.entities where module = 'notes' and entity_id in
                    (select id::text from notes.note where source <> 'demo')`)
await db().query(`delete from notes.note where source <> 'demo'`)

const notes = await seed()
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

console.log(`seeded ${notes} notes, indexed ${index.indexed}, embedded ${index.embedded}, 2 proposals, 7 alerts`)
process.exit(0)
