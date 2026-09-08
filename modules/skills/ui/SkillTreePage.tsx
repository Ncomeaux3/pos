import { PageHeader } from '@/components/pos'
import { loadSkillTree } from '../data'
import { SkillTree } from './SkillTree'

export default async function SkillTreePage() {
  const data = await loadSkillTree()
  const linked = data.stats.filter((s) => s.xp > 0).length

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Skill Tree / Constellation"
        dot={data.totalXp > 0 ? 'brand' : 'idle'}
        title="Skill Tree"
        lede="Every event any module writes links to a skill and contributes XP. Rules match keywords first; only what they miss costs a model call. Drag an event onto another skill to overrule it."
        actions={
          <span className="num text-[11px] text-ink-3">
            Lv {data.characterLevel} · {Math.round(data.totalXp).toLocaleString()} XP · {linked}{' '}
            skills active
          </span>
        }
      />
      <SkillTree data={data} now={data.now} />
    </div>
  )
}
