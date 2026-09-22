import { CardHead, EmptyState } from '@/components/pos'
import { cn } from '@/lib/utils'
import { balance, compactMoney, signedMoney } from '../money'

// Six months of income against spending, with what was left over drawn across
// them. Hand rolled SVG in its own file rather than a primitive in charts.tsx:
// there is one caller, and a bar chart with a line over it is the only shape
// this screen needs. The month labels sit outside the SVG so they are not
// stretched by preserveAspectRatio.

export type MonthFlowPoint = { month: string; incomeCents: number; expenseCents: number }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Sep", and "Sep 25" in January so a year's turn is not two identical labels. */
function monthLabel(iso: string, showYear: boolean): string {
  const [year, month] = iso.split('-').map(Number)
  return showYear ? `${MONTHS[month - 1]} ${String(year).slice(2)}` : MONTHS[month - 1]
}

export function CashFlow({ months }: { months: MonthFlowPoint[] }) {
  if (months.length === 0) return null

  // A fresh install has the axis and nothing on it. Drawing six flat bars at
  // zero would read as six months of no money at all, which is a claim about
  // the months rather than about the data.
  if (months.every((m) => m.incomeCents === 0 && m.expenseCents === 0)) {
    return (
      <>
        <CardHead label={`Cash flow · ${months.length} months`} meta="nothing yet" />
        <EmptyState headline="Nothing to compare" className="mt-3 border-0">
          This fills in as transactions arrive. Income and spending are read from each
          transaction&rsquo;s category: money between your own accounts is on neither side.
        </EmptyState>
      </>
    )
  }

  const nets = months.map((m) => m.incomeCents - m.expenseCents)
  const width = 600
  const height = 140

  // The axis has to hold the bars and the net line, and the net line goes
  // below zero in a month that spent more than it earned. Zero is always on it,
  // because a bar chart that does not show its own baseline is a picture.
  const values = months.flatMap((m) => [m.incomeCents, m.expenseCents])
  const hi = Math.max(...values, ...nets, 0)
  // The bars as well as the nets: spending is expense minus credit and goes
  // below zero in a window where a refund outran the month's charges, and a
  // floor taken from the nets alone would draw that bar outside the frame.
  const lo = Math.min(...values, ...nets, 0)
  const span = hi - lo || 1
  const y = (v: number) => height - ((v - lo) / span) * height

  const slot = width / months.length
  const barWidth = Math.min(22, slot * 0.28)
  const gap = 3
  // Income sits left of centre, spending right of it, so a month reads as one
  // pair rather than as two separate series that happen to be near each other.
  const centre = (i: number) => i * slot + slot / 2
  const netLine = nets.map((n, i) => `${centre(i).toFixed(1)},${y(n).toFixed(1)}`).join(' ')

  const thisMonth = months[months.length - 1]
  const net = thisMonth.incomeCents - thisMonth.expenseCents
  const avgNet = Math.round(nets.reduce((sum, n) => sum + n, 0) / nets.length)

  return (
    <div className="flex flex-1 flex-col">
      <CardHead
        label={`Cash flow · ${months.length} months`}
        meta={`${signedMoney(net)} this month`}
        className="mb-1"
      />

      <div className="mt-2 grid flex-1 grid-cols-[1fr_56px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Income against spending over ${months.length} months. This month ${balance(
            thisMonth.incomeCents,
          )} in, ${balance(thisMonth.expenseCents)} out, net ${signedMoney(net)}.`}
          className="block h-full min-h-[150px] w-full overflow-visible"
        >
          {[hi, lo + (span * 2) / 3, lo + span / 3].map((v) => (
            <line key={v} x1="0" y1={y(v)} x2={width} y2={y(v)} stroke="var(--rule)" />
          ))}

          {months.map((m, i) => (
            <g key={m.month}>
              <rect
                x={centre(i) - barWidth - gap / 2}
                y={Math.min(y(m.incomeCents), y(0))}
                width={barWidth}
                height={Math.max(1, Math.abs(y(0) - y(m.incomeCents)))}
                fill="var(--chart-3)"
                rx={2}
              />
              <rect
                x={centre(i) + gap / 2}
                y={Math.min(y(m.expenseCents), y(0))}
                width={barWidth}
                height={Math.max(1, Math.abs(y(0) - y(m.expenseCents)))}
                fill="var(--chart-1)"
                rx={2}
              />
            </g>
          ))}

          {/* Zero, drawn over the bars: in a month that ran a deficit the net
            * line crosses it, and that crossing is the whole reading. */}
          <line x1="0" y1={y(0)} x2={width} y2={y(0)} stroke="var(--rule-2)" vectorEffect="non-scaling-stroke" />

          <polyline
            points={netLine}
            fill="none"
            stroke="var(--ink-2)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {nets.map((n, i) => (
            <circle key={months[i].month} cx={centre(i)} cy={y(n)} r={2.5} fill="var(--bg-elev)" stroke="var(--ink-2)" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        <div className="flex flex-col justify-between pl-3 text-[11px] text-ink-3">
          {[hi, lo + (span * 2) / 3, lo + span / 3, lo].map((v, i) => (
            <span key={i} className="num leading-none">
              {compactMoney(Math.round(v))}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_56px]">
        <div
          className="grid text-center text-[11px] text-ink-3"
          style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
        >
          {months.map((m, i) => (
            <span
              key={m.month}
              className={cn('num', months.length > 6 && i % 2 === 1 && 'hidden sm:inline')}
            >
              {monthLabel(m.month, m.month.endsWith('-01-01') || i === 0)}
            </span>
          ))}
        </div>
        <span />
      </div>

      <div className="label mt-2.5 flex flex-wrap gap-x-[18px] gap-y-2 border-t border-rule pt-2.5 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-chart-3" aria-hidden />
          Money in
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-chart-1" aria-hidden />
          Money out
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-ink-2" aria-hidden />
          Net
        </span>
        <span className="ml-auto">
          Average net <span className={cn('num', avgNet >= 0 ? 'text-ok' : 'text-bad')}>{signedMoney(avgNet)}</span> a month
        </span>
      </div>
    </div>
  )
}
