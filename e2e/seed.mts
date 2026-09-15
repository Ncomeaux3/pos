import { db } from '@/core/db'
import { embedChanged } from '@/core/search'
import { propose } from '@/core/proposals'
import { seed } from '@/modules/notes/seed'
import { seed as seedTasks } from '@/modules/tasks/seed'
import { seed as seedGoals } from '@/modules/goals/seed'
import { seed as seedFinance } from '@/modules/finance/seed'
import { seed as seedBrain } from '@/modules/brain/seed'
import { seed as seedTravel } from '@/modules/travel/seed'
import { seed as seedFitness } from '@/modules/fitness/seed'
import { seed as seedHealth } from '@/modules/health/seed'
import { seed as seedMeals } from '@/modules/meals/seed'
import { seed as seedIdeas } from '@/modules/ideas/seed'
import { seed as seedHome } from '@/modules/home/seed'
import { seed as seedInsurance } from '@/modules/insurance/seed'

// A local database or nothing. This file deletes outright: core.notifications,
// core.job_runs, core.reviews, every note that is not demo, and several module
// rows besides. It is run with --env-file=.env and the app it seeds is `pnpm
// dev` on the same .env, so the only thing standing between the fixture and
// the production pooler is which DATABASE_URL happens to be in that file.
// Same shape of check, and the same reason, as applyMigrations in
// scripts/setup.ts.
if (!/^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost)[:/]/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error(
    'e2e/seed.mts refuses to run: DATABASE_URL is not a local database, and this seed deletes rows. ' +
      'Start the local stack with `supabase start` and point DATABASE_URL at it.',
  )
}

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
// The inline add test creates this goal on every run; without this the Life
// ops group grows by one card a run.
await db().query(`delete from goals.goal where title = 'Swim 2km without stopping'`)
// The health log a visit test files this record on every run.
await db().query(
  `delete from core.entities where module = 'health' and entity_type = 'record'
      and entity_id in (select id::text from health.record where title = 'Ferritin')`,
)
await db().query(`delete from health.record where title = 'Ferritin'`)
// The ideas capture test deletes its own capture at the end, but a run killed
// midway leaves it, and the next run then finds two cards with its title.
await db().query(
  `delete from core.entities where module = 'ideas'
      and entity_id in (select id::text from ideas.idea where title = 'Pocket receipt scanner')`,
)
await db().query(`delete from ideas.idea where title = 'Pocket receipt scanner'`)
// Tasks seed before goals exist, so the links between them are drawn here:
// the Goals drawer lists a goal's tasks and the card names the next one.
for (const [task, goal] of [
  ['demo-1', 'demo-4'],
  ['demo-6', 'demo-4'],
  ['demo-14', 'demo-4'],
  ['demo-4', 'demo-1'],
  ['demo-10', 'demo-1'],
  ['demo-3', 'demo-2'],
  ['demo-2', 'demo-3'],
]) {
  await db().query(
    `update tasks.task t set goal_ref = en.id
       from goals.goal g
       join core.entities en on en.module = 'goals' and en.entity_type = 'goal' and en.entity_id = g.id::text
      where g.source = 'demo' and g.external_id = $2
        and t.source = 'demo' and t.external_id = $1`,
    [task, goal],
  )
}
const txCount = await seedFinance()
const brainCount = await seedBrain()
const travelCount = await seedTravel()
const fitCount = await seedFitness()
const healthCount = await seedHealth()
const mealCount = await seedMeals()
const ideaCount = await seedIdeas()
const homeCount = await seedHome()
const policyCount = await seedInsurance()

// The coach runs against the seeded history for the same reason the subscription
// detector does: the Plan tab has to show what the rules actually produced. It
// proposes rather than writes, so what this leaves behind is one pending row in
// the Review inbox. Cleared first, because its own repeat guard would otherwise
// make the fixture depend on whether a previous run left one.
await db().query(`delete from core.proposals where module = 'fitness'`)
const { coachReview } = await import('@/modules/fitness/jobs/coach')
const coached = await coachReview()

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
// The seed owns this table outright, the same way it owns core.job_runs and
// for the same reason. Deleting only `rule_id is not null` left every digest a
// real nightly run had queued, and listAlerts() takes the newest 60: after
// enough Run now presses the seeded rows fell off the end of the window and
// the alert centre test failed on a row that was still in the table.
await db().query(`delete from core.notifications`)
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

// The nightly roll logs every move it makes, and the review counts those
// entries to say "rolled twice". Cleared and two put back for the one overdue
// demo task, so the number is the fixture's and not the count of nightly runs
// this database has seen.
await db().query(`delete from core.write_log where module = 'tasks' and kind = 'rescheduled'`)
const { rows: overdueDemo } = await db().query<{ id: string; title: string }>(
  `select id, title from tasks.task where external_id = 'demo-1'`,
)
for (const [i, task] of overdueDemo.entries()) {
  for (const daysAgo of [2, 1]) {
    await db().query(
      `insert into core.write_log
         (module, tool, kind, title, reason, diff, actor, apply_payload, created_at)
       values ('tasks', 'write', 'rescheduled', $1, $2, '[]'::jsonb, 'agent', $3::jsonb,
               now() - make_interval(days => $4))`,
      [
        `Rolled "${task.title}" to today`,
        'It was open past its due date, unstarted, and had no time of day.',
        JSON.stringify({ id: task.id }),
        daysAgo + i,
      ],
    )
  }
}

// One skill that has gone quiet: the headline's third clause and the Skill
// Tree tile's idle row both need a skill whose last linked event is over sixty
// days old, and a seed that writes everything tonight has none. The skill with
// the fewest linked entities has its events moved back 74 days.
const { rows: quiet } = await db().query<{ skill_id: string; entity_ref: string }>(
  `select sl.skill_id, min(sl.entity_ref::text) as entity_ref
     from core.skill_links sl
     join core.events e on e.entity_ref = sl.entity_ref
     join skills.xp_weight w on w.event_type = e.event_type
    group by sl.skill_id
   having count(distinct sl.entity_ref) = 1
    order by sl.skill_id
    limit 1`,
)
if (quiet[0]) {
  await db().query(
    `update core.events set occurred_at = now() - interval '74 days' where entity_ref = $1`,
    [quiet[0].entity_ref],
  )
}

// The review's first step reads digests, and its delta lines read last week's.
// Written from the seeded rows rather than listed here, so the tiles show what
// the modules actually compute; then copied back a week with a few numbers
// moved, so every kind of delta line the artboard draws has something to draw.
const { writeDigests } = await import('@/core/digests')
await db().query(`delete from core.digests`)
await writeDigests()
const { rows: fresh } = await db().query<{ module: string; payload: Record<string, unknown> }>(
  `select distinct on (module) module, payload from core.digests order by module, run_at desc`,
)
const lastWeekOf = (module: string, payload: Record<string, unknown>): Record<string, unknown> => {
  const n = (key: string) => (typeof payload[key] === 'number' ? (payload[key] as number) : 0)
  if (module === 'tasks') return { ...payload, completedThisWeek: Math.max(0, n('completedThisWeek') - 4), overdue: n('overdue') + 1 }
  if (module === 'skills') {
    const attributes = (payload.attributes as { level: number }[] | undefined) ?? []
    return { ...payload, attributes: attributes.map((a, i) => (i === 0 ? { ...a, level: a.level - 1 } : a)) }
  }
  return payload
}
for (const d of fresh) {
  await db().query(
    `insert into core.digests (module, run_at, payload) values ($1, now() - interval '8 days', $2::jsonb)`,
    [d.module, JSON.stringify(lastWeekOf(d.module, d.payload))],
  )
}

// One provider connected, so the Connections screen has a CONNECTED card
// beside the NOT CONNECTED ones. Enabling a webhook is the one connection
// the app makes with no outside service: exactly what the card's "Enable
// webhook" button does. Only when the row is absent, so an owner's own
// secret is never replaced.
const { rows: hae } = await db().query(
  `select 1 from core.connections where integration_id = 'health_auto_export'`,
)
if (hae.length === 0) {
  const { randomBytes } = await import('node:crypto')
  const { saveCredentials } = await import('@/core/credentials')
  await saveCredentials('health_auto_export', { secret: randomBytes(24).toString('base64url') })
}

// The dashboard draws one tile per module in the last summary, and the
// screen tests assert the tiles before anything has pressed Run now. A fresh
// database has no summary, so the orchestrate stage runs here against the
// digests written above. It writes one core.dashboard_summary row and, when
// the summary has alerts, replaces the unsent digest notification.
const { assembleSummary } = await import('@/core/orchestrator')
await assembleSummary()

console.log(`seeded ${notes} notes, indexed ${index.indexed}, embedded ${index.embedded}, 2 proposals, 7 alerts, 2 runs, ${taskCount} tasks, ${goalCount} goals, ${txCount} transactions, ${detected.found} subscriptions detected, ${brainCount} notes, ${travelCount} travel rows, ${fitCount} workouts, ${healthCount} health rows, ${mealCount} meal rows, ${ideaCount} ideas, ${homeCount} home rows, ${policyCount} policies, ${coached.proposed} coach proposal`)
process.exit(0)
