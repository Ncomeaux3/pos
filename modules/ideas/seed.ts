import { db } from '@/core/db'
import { register } from '@/core/entities'

// Synthetic rows for `pnpm setup --demo`. Upserts on external_id so running it
// twice does not duplicate. Nothing here is personal; this ships in the template.
//
// One idea in each quadrant and one in each stage, including a killed one with
// its reason, so the board shows what it is for rather than a single column.

const IDEAS: {
  external_id: string
  title: string
  pitch: string
  stage: 'exploring' | 'validated' | 'building' | 'killed'
  effort: 1 | 2 | 3
  impact: 1 | 2 | 3
  killedReason?: string
  staleDays?: number
}[] = [
  { external_id: 'i-import', title: 'One click Notion import', pitch: 'Read an export and fill every module at once.', stage: 'building', effort: 2, impact: 3 },
  { external_id: 'i-digest', title: 'Weekly digest as a printable page', pitch: 'One sheet for the fridge.', stage: 'validated', effort: 1, impact: 2 },
  { external_id: 'i-share', title: 'Share a read only dashboard link', pitch: 'For a partner or an accountant.', stage: 'exploring', effort: 3, impact: 2 },
  { external_id: 'i-voice', title: 'Voice capture for tasks', pitch: 'Speak a task on a walk.', stage: 'exploring', effort: 1, impact: 3 },
  { external_id: 'i-theme', title: 'Per module colour themes', pitch: 'Cosmetic only.', stage: 'exploring', effort: 3, impact: 1 },
  // Untouched long enough to show in the "not moving" card.
  { external_id: 'i-stale', title: 'Browser extension for clipping', pitch: 'Save a page to the Second Brain inbox.', stage: 'exploring', effort: 2, impact: 2, staleDays: 95 },
  { external_id: 'i-crypto', title: 'Automatic crypto tax lots', pitch: 'Track cost basis across exchanges.', stage: 'killed', effort: 3, impact: 1, killedReason: 'Every exchange exports differently and none of it reconciles.' },
]

export async function seed(): Promise<number> {
  for (const idea of IDEAS) {
    const { rows } = await db().query<{ id: string }>(
      `insert into ideas.idea
         (title, pitch, stage, effort, impact, killed_reason, source, external_id, updated_at)
       values ($1, $2, $3, $4, $5, $6, 'demo', $7,
               now() - ($8::int || ' days')::interval)
       on conflict (source, external_id) do update
         set stage = excluded.stage, effort = excluded.effort, impact = excluded.impact,
             killed_reason = excluded.killed_reason, updated_at = excluded.updated_at
       returning id`,
      [
        idea.title,
        idea.pitch,
        idea.stage,
        idea.effort,
        idea.impact,
        idea.killedReason ?? '',
        idea.external_id,
        idea.staleDays ?? 1,
      ],
    )

    await register({
      module: 'ideas',
      entityType: 'idea',
      entityId: rows[0].id,
      title: idea.title,
      text: idea.pitch,
      eventType: idea.stage === 'building' ? 'idea_building' : 'idea_captured',
    })
  }

  return IDEAS.length
}
