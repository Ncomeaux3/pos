import type { SkillsDigest } from '../jobs/nightly-digest'

// The Skill Tree dashboard tile. What is moving, which is the only thing that
// changes overnight: a level is a slow number.

export function SkillsTile({ payload }: { payload: Record<string, unknown> }) {
  const d = payload as Partial<SkillsDigest>
  const gaining = d.gaining ?? []

  return (
    <div className="space-y-3">
      <div>
        <span className="eyebrow block text-ink-3">Character</span>
        <span className="num block text-[26px] font-light leading-tight text-ink">
          Lv {d.characterLevel ?? 0}
        </span>
        <span className="num text-[11px] text-ink-3">
          {Math.round(d.totalXp ?? 0).toLocaleString()} XP
        </span>
      </div>

      {gaining.length === 0 ? (
        <p className="t-caption text-ink-3">Nothing gained XP in the last 30 days.</p>
      ) : (
        <div className="space-y-1.5">
          {gaining.slice(0, 3).map((s) => (
            <div key={s.skillId} className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[14px] text-ink-2">{s.name}</span>
              <span className="num shrink-0 text-[11px] text-ok">
                +{Math.round(s.gained)} XP
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
