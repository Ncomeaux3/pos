import { Radar } from '@/components/pos'
import { cn } from '@/lib/utils'
import type { SkillsDigest } from '../jobs/nightly-digest'

// The Skill Tree dashboard tile, as POS Dashboard.dc.html draws it: the shape
// of the character on the left, three moves on the right, each a name, a
// figure and a 2px bar. The gains this week come first; a skill that has gone
// quiet fills the last row, in amber, so the tile says what moved and what
// did not. The level is the head's "level 14", not a figure in here.

export function SkillsTile({ payload }: { payload: Record<string, unknown> }) {
  const d = payload as Partial<SkillsDigest>
  const gained = (d.gainedThisWeek?.length ? d.gainedThisWeek : d.gaining) ?? []
  const stagnant = d.stagnant ?? []
  const axes = (d.attributes ?? []).slice(0, 6).map((a) => ({ label: a.name, value: a.level }))

  // The bars are relative to the biggest gain, not to any absolute: the tile
  // says which skill moved most this week, which is the only comparison here
  // that means anything.
  // Two gains and the quietest skill when there is one, as the artboard has
  // it; three gains otherwise.
  const quiet = stagnant.filter((s) => typeof s.idleDays === 'number').slice(0, 1)
  const shownGains = gained.slice(0, quiet.length > 0 ? 2 : 3)
  const most = Math.max(...shownGains.map((s) => s.gained), 1)
  const rows = [
    ...shownGains.map((s) => ({
      key: s.skillId,
      name: s.name,
      figure: `+${Math.round(s.gained).toLocaleString('en-US')} XP`,
      width: Math.round((s.gained / most) * 100),
      tone: 'ok' as const,
    })),
    ...quiet.map((s) => ({
      key: s.skillId,
      name: s.name,
      figure: `${s.idleDays}d idle`,
      width: 8,
      tone: 'warn' as const,
    })),
  ]

  return (
    <div className="mt-1 grid min-h-0 flex-1 grid-cols-[120px_1fr] gap-3.5">
      {axes.length >= 3 ? <Radar axes={axes} size={120} /> : <span />}

      <div className="flex min-w-0 flex-col justify-center gap-2">
        {rows.length === 0 ? (
          <p className="t-caption text-ink-3">Nothing gained XP in the last 30 days.</p>
        ) : (
          rows.map((r) => (
            <div key={r.key}>
              <div className="flex justify-between gap-2 text-[12px]">
                <span className="truncate text-ink">{r.name}</span>
                <span className={cn('num shrink-0 text-[11px]', r.tone === 'ok' ? 'text-ok' : 'text-warn')}>
                  {r.figure}
                </span>
              </div>
              <div className="mt-[5px] h-0.5 bg-rule-2">
                <div className={cn('h-0.5', r.tone === 'ok' ? 'bg-brand' : 'bg-warn')} style={{ width: `${r.width}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
