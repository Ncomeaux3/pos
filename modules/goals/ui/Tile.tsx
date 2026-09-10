import type { GoalsDigest } from '../jobs/nightly-digest'

// The Goals dashboard tile. The design shows the goals that need a look, with
// a bar and the status word, rather than four counters: "3 at risk" tells you
// there is a problem and nothing about which one.

const TONE: Record<string, string> = {
  on_track: 'text-ok',
  at_risk: 'text-warn',
  stalled: 'text-bad',
  done: 'text-ink-3',
}

const LABEL: Record<string, string> = {
  on_track: 'ON TRACK',
  at_risk: 'AT RISK',
  stalled: 'STALLED',
  done: 'DONE',
}

export function GoalsTile({ payload }: { payload: Record<string, unknown> }) {
  const d = payload as Partial<GoalsDigest>
  const attention = d.attention ?? []
  const counts = [
    { label: 'on track', n: d.onTrack ?? 0 },
    { label: 'at risk', n: d.atRisk ?? 0 },
    { label: 'stalled', n: d.stalled ?? 0 },
  ].filter((c) => c.n > 0)

  if (attention.length === 0 && counts.length === 0) {
    return <p className="t-caption text-ink-3">No goals are being tracked yet.</p>
  }

  return (
    <div className="space-y-3">
      {attention.slice(0, 3).map((g) => (
        <div key={g.id} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[14px] text-ink">{g.title}</span>
            <span className={`eyebrow shrink-0 ${TONE[g.status] ?? 'text-ink-3'}`}>
              {LABEL[g.status] ?? g.status}
            </span>
          </div>
          {/* The sentence that produced the status, which is the module's own
            * rule text. Goals never shows a status without showing why. */}
          <p className="t-caption text-ink-3">{g.rule}</p>
        </div>
      ))}

      {counts.length > 0 && (
        <p className="num text-[11px] text-ink-3">
          {counts.map((c) => `${c.n} ${c.label}`).join(' · ')}
        </p>
      )}
    </div>
  )
}
