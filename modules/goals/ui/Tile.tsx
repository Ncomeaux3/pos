import { cn } from '@/lib/utils'
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
          {/* The bar and the number the artboard puts under the title, then
            * the sentence that produced the status. Goals never shows a status
            * without showing why. */}
          <div className="flex items-center gap-2.5">
            <div className="h-0.5 flex-1 bg-rule-2">
              <div
                className={cn(
                  'h-0.5',
                  g.status === 'at_risk' ? 'bg-warn' : g.status === 'stalled' ? 'bg-bad' : 'bg-ok',
                )}
                style={{ width: `${g.percent ?? 0}%` }}
              />
            </div>
            <span className="num w-8 shrink-0 text-right text-[11px] text-ink-3">
              {g.percent ?? 0}%
            </span>
          </div>
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
