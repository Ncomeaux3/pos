'use client'

import { useState } from 'react'
import type { Day } from '@/core/series'
import { cn } from '@/lib/utils'

// One value a day on a date axis, drawn the way the Finance artboard draws
// net worth. Its own file rather than charts.tsx, which renders on the server:
// the crosshair needs state. Two callers, net worth and the fitness trends,
// which is why it exists (v1.1 Phase 10 left it in Finance with one).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

/** "Sep", and "Sep 25" each January so a year's turn is not two "Jan"s. */
const shortMonth = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  return d.getMonth() === 0 ? `${MONTHS[0]} ${String(d.getFullYear()).slice(2)}` : MONTHS[d.getMonth()]
}

/**
 * Gridlines, the first recorded value as a dashed baseline, the average as a
 * second one, the high and the low marked, and a crosshair that says what a
 * given day was and how far from the start it had moved. The axis labels are
 * outside the plot in their own 64px column, so the line is never squeezed by
 * the width of a number.
 *
 * `days` is spine()'s output: nulls before the first reading break the line,
 * carried days draw but do not count. Needs at least one observed day.
 */
export function LineChart({
  name,
  days,
  format,
  formatCompact = format,
  formatDelta,
  downIsGood = false,
  unit = 'day',
}: {
  /** "Net worth", "Weight": the caption, the legend and the accessible name. */
  name: string
  days: Day[]
  /** The crosshair's value. */
  format: (value: number) => string
  /** The axis, High, Low and Avg. Defaults to `format`. */
  formatCompact?: (value: number) => string
  /** A signed change since the first reading. */
  formatDelta: (value: number) => string
  /** Weight and resting heart rate colour a fall green; everything else a rise. */
  downIsGood?: boolean
  /**
   * What one point is. A month axis labels its points by month, counts them as
   * months and calls the biggest move the best month. Nothing else changes:
   * `days` is still spine()'s output, one entry per point, oldest first.
   */
  unit?: 'day' | 'month'
}) {
  const [hover, setHover] = useState<number | null>(null)

  const pointLabel = unit === 'month' ? shortMonth : shortDate

  const width = 600
  const height = 160

  // Drawn values include the days carried across a missed sync; the stats
  // below count only the days a value was actually recorded. Averaging the
  // carried days would weight one measurement once per day it was repeated.
  const drawn = days.map((d) => d.cents)
  const observed = days.filter((d) => d.observed).map((d) => d.cents as number)
  const known = drawn.filter((v): v is number => v !== null)

  const max = Math.max(...observed)
  const min = Math.min(...observed)
  const avg = Math.round(observed.reduce((sum, v) => sum + v, 0) / observed.length)

  // Five percent of headroom each side so the high and the low are not drawn
  // flush against the frame. A flat month has no span to pad, so it is given
  // one and lands mid height rather than along the top edge.
  const pad = (max - min) * 0.05 || Math.max(1, Math.abs(max) * 0.05)
  // A series that never goes below zero keeps its axis there: a 40 minute
  // night under a 17 hour high was drawing a "-11m" tick, and steps a
  // "-1,578". A series with a negative reading (a net worth) still pads below.
  const lo_ = min >= 0 ? Math.max(0, min - pad) : min - pad
  const hi_ = max + pad
  const span = hi_ - lo_

  const x = (i: number) => (i / Math.max(1, days.length - 1)) * width
  const y = (v: number) => height - ((v - lo_) / span) * height

  // One move command per run of days that have a value, so the leading nulls
  // before the first sync break the line instead of drawing from zero.
  const line = drawn
    .map((v, i) => (v === null ? null : `${drawn[i - 1] == null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter((seg): seg is string => seg !== null)
    .join(' ')

  // The filled area follows the drawn run only, so it does not reach back
  // under days that were never recorded. One run is all there is to follow:
  // spine() carries a value forward once it has one, so the only nulls are the
  // leading ones before the first sync.
  const first = drawn.findIndex((v) => v !== null)
  const area =
    first === -1 ? '' : `M${x(first).toFixed(1)},${height} ${line.slice(1)} L${width},${height} Z`

  const hi = drawn.indexOf(max)
  const lo = drawn.indexOf(min)
  const start = observed[0]
  const last = known[known.length - 1]

  // The biggest single day move in each direction, over consecutive days that
  // both have a value, which is the one thing the shape does not tell you.
  const moves = drawn
    .map((v, i) => (v === null || drawn[i - 1] == null ? null : v - (drawn[i - 1] as number)))
    .filter((m): m is number => m !== null)
  const best = moves.length > 0 ? Math.max(...moves) : 0
  const worst = moves.length > 0 ? Math.min(...moves) : 0

  const at = hover === null ? null : drawn[hover]
  const tone = (delta: number) => ((delta >= 0) !== downIsGood ? 'text-ok' : 'text-bad')

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="eyebrow text-ink-3">
          {name} · {days.length} {unit}s
        </span>
        <span className="label flex gap-[18px] text-[11px] text-ink-3">
          <span>
            High <span className="num text-ink">{formatCompact(max)}</span>
          </span>
          <span>
            Low <span className="num text-ink">{formatCompact(min)}</span>
          </span>
          <span>
            Avg <span className="num text-ink">{formatCompact(avg)}</span>
          </span>
        </span>
      </div>

      <div className="mt-2.5 grid flex-1 grid-cols-[1fr_64px]">
        <div className="relative min-h-[200px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${name} over ${days.length} ${unit}s, ${observed.length} of them recorded, from ${formatCompact(start)} to ${formatCompact(last)}`}
            className="block h-full w-full cursor-crosshair overflow-visible"
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect()
              const share = (e.clientX - box.left) / box.width
              setHover(Math.max(0, Math.min(days.length - 1, Math.round(share * (days.length - 1)))))
            }}
            onMouseLeave={() => setHover(null)}
          >
            {[0, 53, 107].map((line_) => (
              <line key={line_} x1="0" y1={line_} x2={width} y2={line_} stroke="var(--rule)" />
            ))}
            <line x1="0" y1={height} x2={width} y2={height} stroke="var(--rule-2)" />

            {/* Where it stood when the first value was recorded: everything
              * above this line is the change since, and the eye reads that
              * without arithmetic. */}
            <line
              x1="0"
              y1={y(start)}
              x2={width}
              y2={y(start)}
              stroke="var(--ink-4)"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />

            {/* The average of the recorded days, so a month that ended high
              * still shows where it mostly sat. */}
            <line
              x1="0"
              y1={y(avg)}
              x2={width}
              y2={y(avg)}
              stroke="var(--chart-2)"
              strokeDasharray="4 5"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />

            {area && <path d={area} fill="var(--chart-1)" fillOpacity={0.08} />}
            <path
              d={line}
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />

            <circle cx={x(hi)} cy={y(max)} r={2.5} fill="var(--bg-elev)" stroke="var(--ink-2)" vectorEffect="non-scaling-stroke" />
            <circle cx={x(lo)} cy={y(min)} r={2.5} fill="var(--bg-elev)" stroke="var(--ink-2)" vectorEffect="non-scaling-stroke" />
            <circle cx={width} cy={y(last)} r={3.5} fill="var(--bg-elev)" stroke="var(--chart-1)" strokeWidth={2} />

            {hover !== null && at !== null && at !== undefined && (
              <g>
                <line x1={x(hover)} y1="0" x2={x(hover)} y2={height} stroke="var(--ink-2)" vectorEffect="non-scaling-stroke" />
                <circle cx={x(hover)} cy={y(at)} r={3.5} fill="var(--ink)" />
              </g>
            )}
          </svg>

          {hover !== null && at !== null && at !== undefined && (
            <div
              className="pointer-events-none absolute top-0 z-2 whitespace-nowrap border border-rule-2 bg-bg px-2.5 py-1.5 text-[11px] rounded-[18px]"
              style={{
                left: `${(hover / Math.max(1, days.length - 1)) * 100}%`,
                transform: hover > days.length / 2 ? 'translateX(-100%)' : 'none',
              }}
            >
              <span className="text-ink-3">{pointLabel(days[hover].date)}</span>{' '}
              <span className="num ml-2 text-ink">{format(at)}</span>{' '}
              {!days[hover].observed && <span className="text-ink-4">carried</span>}{' '}
              <span className={cn('num ml-2', tone(at - start))}>
                {formatDelta(at - start)}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between pl-3 text-[11px] text-ink-3">
          {[hi_, lo_ + (span * 2) / 3, lo_ + span / 3, lo_].map((v, i) => (
            <span key={i} className="num leading-none">
              {formatCompact(Math.round(v))}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-[1fr_64px]">
        <div className="flex justify-between text-[11px] text-ink-3">
          {days
            .filter((unused, i) => i % Math.max(1, Math.round(days.length / 6)) === 0)
            .map((d, i) => (
              // Six labels ran together at 360px; every other one hides below sm.
              <span key={d.date} className={cn('num', i % 2 === 1 && 'hidden sm:inline')}>
                {pointLabel(d.date)}
              </span>
            ))}
        </div>
        <span />
      </div>

      <div className="label mt-2.5 flex flex-wrap gap-x-[18px] gap-y-2 border-t border-rule pt-2.5 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-chart-1" aria-hidden />
          {unit === 'month' ? 'Monthly' : 'Daily'} {name.toLowerCase()}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t border-dashed border-ink-3" aria-hidden />
          First reading {formatCompact(start)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full border border-ink-2" aria-hidden />
          High / low
        </span>
        <span className="ml-auto">
          Best {unit} <span className={cn('num', tone(downIsGood ? worst : best))}>{formatDelta(downIsGood ? worst : best)}</span> · worst{' '}
          <span className={cn('num', tone(downIsGood ? best : worst))}>{formatDelta(downIsGood ? best : worst)}</span>
        </span>
      </div>
    </div>
  )
}
