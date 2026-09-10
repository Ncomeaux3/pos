import { loadSkillTree } from '../data'
import { SkillTree } from './SkillTree'

export default async function SkillTreePage() {
  const data = await loadSkillTree()
  const linked = data.stats.filter((s) => s.xp > 0).length

  return (
    <div className="space-y-5">
      {/* No page title and no lede on this screen, which is the one deviation
        * from the standard module header. The design treats the constellation
        * as the page: a heading and a paragraph above it push the canvas below
        * the fold and say nothing the breadcrumb does not. Every other module
        * keeps PageHeader. */}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-rule pb-3">
        <span className="eyebrow text-ink-3">
          <span
            className="status-dot"
            data-tone={data.totalXp > 0 ? 'brand' : 'idle'}
            aria-hidden="true"
          />
          Skill Tree / Constellation
        </span>
        <span className="num text-[11px] text-ink-3">
          Lv {data.characterLevel} · {Math.round(data.totalXp).toLocaleString()} XP · {linked} skills
          active
        </span>
      </header>
      <SkillTree data={data} now={data.now} />
    </div>
  )
}
