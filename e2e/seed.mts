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

console.log(`seeded ${notes} notes, indexed ${index.indexed}, embedded ${index.embedded}, 2 proposals`)
process.exit(0)
