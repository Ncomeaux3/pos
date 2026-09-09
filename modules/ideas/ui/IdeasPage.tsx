import { PageHeader } from '@/components/pos'
import { db } from '@/core/db'
import { Ideas, type IdeasData } from './Ideas'
import type { Level } from '../quadrant'

export default async function IdeasPage() {
  const { rows } = await db().query<{
    id: string
    title: string
    pitch: string
    notes: string
    stage: string
    effort: number
    impact: number
    killed_reason: string
    goal_title: string | null
    days: number
  }>(
    `select i.id, i.title, i.pitch, i.notes, i.stage, i.effort, i.impact, i.killed_reason,
            g.title as goal_title,
            (core.today() - i.updated_at::date)::int as days
       from ideas.idea i
       -- The goal's title comes from the core registry, so this works before
       -- the goals module exists and needs no change when it lands.
       left join core.entities g on g.id = i.goal_ref
      order by i.updated_at desc`,
  )

  const data: IdeasData = {
    ideas: rows.map((r) => ({
      id: r.id,
      title: r.title,
      pitch: r.pitch,
      notes: r.notes,
      stage: r.stage,
      effort: r.effort as Level,
      impact: r.impact as Level,
      killedReason: r.killed_reason,
      goalTitle: r.goal_title,
      daysSinceTouched: r.days,
    })),
  }

  const building = data.ideas.filter((i) => i.stage === 'building').length
  const exploring = data.ideas.filter((i) => i.stage === 'exploring').length

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`Ideas / ${exploring} exploring / ${building} building`}
        dot={building > 0 ? 'brand' : 'idle'}
        title="Ideas"
        lede="Effort against impact, on a three point scale because the difference between a six and a seven is not a judgement anyone makes twice the same way. A killed idea is kept: the reason you dropped it is the most useful note about it."
        actions={<span className="num text-[11px] text-ink-3">{data.ideas.length} total</span>}
      />
      <Ideas data={data} />
    </div>
  )
}
