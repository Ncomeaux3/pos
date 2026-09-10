import { Radar } from '@/components/pos'
import type { SkillsDigest } from '../jobs/nightly-digest'

// The Skill Tree dashboard tile, as the artboard draws it: the shape of the
// character on the left, what moved this week on the right.
//
// A level is a slow number and says nothing about the week, so it is the small
// print here rather than the headline.

export function SkillsTile({ payload }: { payload: Record<string, unknown> }) {
  const d = payload as Partial<SkillsDigest>
  const gaining = d.gaining ?? []
  const axes = (d.attributes ?? []).slice(0, 6).map((a) => ({ label: a.name, value: a.level }))

  // The bars are relative to the biggest gain, not to any absolute: the tile
  // says which skill moved most this week, which is the only comparison here
  // that means anything.
  const most = Math.max(...gaining.slice(0, 3).map((s) => s.gained), 1)

  return (
    <div className="flex flex-1 gap-3.5">
      {axes.length >= 3 ? (
        <div className="shrink-0">
          <Radar axes={axes} size={120} />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <div>
          <span className="num block text-[26px] font-light leading-none text-ink">
            Lv {d.characterLevel ?? 0}
          </span>
          <span className="num text-[11px] text-ink-3">
            {Math.round(d.totalXp ?? 0).toLocaleString()} XP
          </span>
        </div>

        {gaining.length === 0 ? (
          <p className="t-caption text-ink-3">Nothing gained XP in the last 30 days.</p>
        ) : (
          gaining.slice(0, 3).map((s) => (
            <div key={s.skillId}>
              <div className="flex justify-between gap-2 text-[12px]">
                <span className="truncate text-ink-2">{s.name}</span>
                <span className="num shrink-0 text-[11px] text-brand">
                  +{Math.round(s.gained)}
                </span>
              </div>
              <div className="mt-1.5 h-0.5 bg-rule-2">
                <div
                  className="h-0.5 bg-brand"
                  style={{ width: `${Math.round((s.gained / most) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
