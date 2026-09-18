import { cn } from '@/lib/utils'

// Hand-rolled SVG, no chart library. Each of these is small enough to read in
// one sitting and styled with the brand tokens directly, which a library would
// fight. They render on the server: nothing here needs to be interactive.

/** A filled area sparkline. The net worth tile and any 30 point trend. */
export function Sparkline({
  points,
  height = 36,
  className,
}: {
  points: number[]
  height?: number
  className?: string
}) {
  if (points.length < 2) return null

  const width = 100
  const min = Math.min(...points)
  const max = Math.max(...points)
  // A flat series would divide by zero, and should draw as a flat line.
  const span = max - min || 1

  const coords = points.map((value, i) => {
    const x = (i / (points.length - 1)) * width
    const y = height - ((value - min) / span) * height
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
      className={cn('h-9 w-full', className)}
    >
      <polygon points={`0,${height} ${coords.join(' ')} ${width},${height}`} fill="var(--chart-1)" fillOpacity={0.08} />
      <polyline points={coords.join(' ')} fill="none" stroke="var(--chart-1)" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** A bar with an optional pace mark, for budgets and spend against a cap. */
export function PaceBar({
  value,
  max,
  pace,
  tone = 'brand',
  className,
}: {
  value: number
  max: number
  /** 0 to 1. Where you would be if you were exactly on track. */
  pace?: number
  tone?: 'brand' | 'warn' | 'bad'
  className?: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const fill = tone === 'bad' ? 'bg-bad' : tone === 'warn' ? 'bg-warn' : 'bg-action'

  return (
    <div className={cn('relative h-1 w-full rounded-full bg-rule', className)}>
      <div className={cn('h-full rounded-full', fill)} style={{ width: `${pct}%` }} />
      {pace !== undefined && (
        <span
          aria-hidden
          className="absolute top-[-2px] h-2 w-px bg-ink-2"
          style={{ left: `${Math.min(100, pace * 100)}%` }}
        />
      )}
    </div>
  )
}

export type RadarAxis = { label: string; value: number }

/**
 * Attributes at a glance. One ring per third, one spoke per attribute.
 *
 * Polygonal, not circular: the rings join the spokes, which is what makes the
 * shape inside them readable as a share of each axis rather than as a blob on
 * a target. The prototype draws it the same way.
 */
export function Radar({ axes, size = 132 }: { axes: RadarAxis[]; size?: number }) {
  if (axes.length < 3) return null

  const c = size / 2
  const r = c - 22
  const max = Math.max(...axes.map((a) => a.value)) || 1

  const point = (i: number, scale: number) => {
    // Start at the top and go clockwise, which is how the eye reads it.
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2
    return [c + Math.cos(angle) * r * scale, c + Math.sin(angle) * r * scale] as const
  }

  const ring = (scale: number) =>
    axes.map((_, i) => point(i, scale).map((n) => n.toFixed(1)).join(',')).join(' ')

  const shape = axes
    .map((a, i) => point(i, Math.max(0.12, a.value / max)).map((n) => n.toFixed(1)).join(','))
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      className="overflow-visible"
      style={{ width: size, height: size }}
    >
      {[1, 0.66, 0.33].map((scale) => (
        <polygon key={scale} points={ring(scale)} fill="none" stroke="var(--rule)" strokeWidth={1} />
      ))}
      {axes.map((a, i) => {
        const [x, y] = point(i, 1)
        return <line key={a.label} x1={c} y1={c} x2={x} y2={y} stroke="var(--rule)" strokeWidth={1} />
      })}
      <polygon points={shape} fill="var(--chart-1)" fillOpacity={0.12} stroke="var(--chart-1)" strokeWidth={1.5} strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = point(i, 1.2)
        // Anchored away from the centre, so a label on the left does not run
        // back over its own spoke.
        const anchor = Math.abs(x - c) < r * 0.15 ? 'middle' : x > c ? 'start' : 'end'
        return (
          <text
            key={a.label}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="label"
            fontSize={size < 150 ? 7 : 8}
            fill="var(--ink-3)"
          >
            {a.label.slice(0, 6).toUpperCase()}
          </text>
        )
      })}
    </svg>
  )
}

export type TimelineItem = { day: number; label: string; tone: 'brand' | 'warn' | 'bad' }

/** Seven day axis with a dot per item. The next 7 days tile. */
export function TimelineAxis({ items, days = 7 }: { items: TimelineItem[]; days?: number }) {
  return (
    <div className="space-y-2">
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-4 h-px bg-rule" />
        {Array.from({ length: days + 1 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute top-3 h-2 w-px bg-rule-2"
            style={{ left: `${(i / days) * 100}%` }}
          />
        ))}
        {items.map((item, i) => (
          <span
            key={`${item.label}-${i}`}
            title={item.label}
            className={cn(
              'absolute top-[11px] h-2 w-2 -translate-x-1/2 rounded-full',
              item.tone === 'bad' ? 'bg-bad' : item.tone === 'warn' ? 'bg-warn' : 'bg-action',
            )}
            style={{ left: `${(Math.min(item.day, days) / days) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        <span className="label text-[9px] text-ink-4">Today</span>
        <span className="label text-[9px] text-ink-4">+{days}d</span>
      </div>
    </div>
  )
}
