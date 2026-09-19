import { cn } from '@/lib/utils'
import type { GoalsDigest } from '../jobs/nightly-digest'

// The Goals dashboard tile, as POS Dashboard.dc.html draws it: three goals,
// worst first, each a 13px title with its status on the right, then a 2px bar
// in the status colour and the figure beside it ("340 / 405 lb"). The sentence
// behind each status lives on the Goals screen; the head's "1 at risk" is the
// count.

const TONE: Record<string, { text: string; bar: string }> = {
  on_track: { text: 'text-ok', bar: 'bg-ok' },
  at_risk: { text: 'text-warn', bar: 'bg-warn' },
  stalled: { text: 'text-bad', bar: 'bg-bad' },
  done: { text: 'text-ink-3', bar: 'bg-ink-3' },
}

const LABEL: Record<string, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  stalled: 'Stalled',
  done: 'Done',
}

/** "$247k / $300k", "340 / 405 lb", "7 / 12". */
function figure(g: { current: number; target: number; unit: string }): string {
  const n = (v: number) =>
    g.unit === '$'
      ? `$${Math.abs(v) >= 10_000 ? `${Math.round(v / 1000)}k` : Math.round(v).toLocaleString('en-US')}`
      : Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(1)
  const unit = g.unit && g.unit !== '$' ? ` ${g.unit}` : ''
  return `${n(g.current)} / ${n(g.target)}${unit}`
}

export function GoalsTile({ payload }: { payload: Record<string, unknown> }) {
  const d = payload as Partial<GoalsDigest>
  const goals = d.attention ?? []

  if (goals.length === 0) {
    return <p className="t-caption text-ink-3">No goals are being tracked yet.</p>
  }

  return (
    <div className="mt-2 flex flex-col gap-0.5">
      {goals.slice(0, 3).map((g) => {
        const tone = TONE[g.status] ?? TONE.done
        return (
          <div key={g.id} className="border-b border-rule py-[9px] last:border-b-0">
            <div className="flex justify-between gap-2.5 text-[13px]">
              <span className="truncate text-ink">{g.title}</span>
              <span className={cn('t-caption shrink-0 font-medium', tone.text)}>
                {LABEL[g.status] ?? g.status}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2.5">
              <div className="h-1 flex-1 rounded-full bg-rule-2">
                <div className={cn('h-1 rounded-full', tone.bar)} style={{ width: `${g.percent}%` }} />
              </div>
              <span className="num t-caption w-[88px] shrink-0 text-right text-ink-3">
                {g.current !== undefined && g.target !== undefined ? figure(g) : `${g.percent}%`}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
