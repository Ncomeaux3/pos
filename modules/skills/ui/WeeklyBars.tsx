'use client'

/** XP by week over 90 days. Hand rolled SVG: no chart library in this repo. */
export function WeeklyBars({ weeks }: { weeks: number[] }) {
  const max = Math.max(...weeks, 1)
  const w = 100 / weeks.length

  return (
    <div className="space-y-1">
      <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="h-[34px] w-full" role="img" aria-label="XP by week over 90 days">
        {weeks.map((value, i) => (
          <rect
            key={i}
            x={i * w + w * 0.15}
            y={34 - (value / max) * 34}
            width={w * 0.7}
            height={Math.max(value > 0 ? 1 : 0, (value / max) * 34)}
            fill={value > 0 ? 'var(--accent)' : 'var(--rule-2)'}
          />
        ))}
      </svg>
      <div className="eyebrow flex justify-between text-ink-3">
        <span>&minus;90D</span>
        <span>&minus;45D</span>
        <span>NOW</span>
      </div>
    </div>
  )
}
