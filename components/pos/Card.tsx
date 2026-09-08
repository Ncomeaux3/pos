import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Eyebrow, type DotTone } from './text'

/** 1px rule-2 on bg-elev, 16px padding, square. The container for everything. */
export function Card({
  children,
  className,
  selected,
}: {
  children: ReactNode
  className?: string
  /** 1px accent border plus soft fill. Never opacity. */
  selected?: boolean
  }) {
  return (
    <div
      className={cn(
        'border bg-bg-elev p-4',
        selected ? 'border-brand bg-brand-soft' : 'border-rule-2',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Eyebrow left, mono metadata right, baseline aligned. */
export function CardHead({
  label,
  dot,
  meta,
  className,
}: {
  label: ReactNode
  dot?: DotTone
  meta?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1', className)}>
      <Eyebrow dot={dot}>{label}</Eyebrow>
      {meta && <span className="mono text-[11px] uppercase tracking-[0.1em] text-ink-3">{meta}</span>}
    </div>
  )
}

export type DeltaTone = 'ok' | 'warn' | 'bad' | 'quiet'

const DELTA: Record<DeltaTone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
  quiet: 'text-ink-3',
}

/**
 * Label over a big mono number over a small coloured delta. The KPI shape on
 * Finance, Home, Health, Fitness, Agent Log and the Weekly Review glance.
 */
export function MetricTile({
  label,
  value,
  delta,
  deltaTone = 'quiet',
  className,
  children,
}: {
  label: ReactNode
  value: ReactNode
  delta?: ReactNode
  deltaTone?: DeltaTone
  className?: string
  /** A sparkline or bar, rendered under the delta. */
  children?: ReactNode
}) {
  return (
    <Card className={cn('flex flex-col gap-2', className)}>
      <Eyebrow>{label}</Eyebrow>
      <p className="mono text-[30px] font-light leading-none tracking-[-0.02em] text-ink">{value}</p>
      {delta && (
        <p className={cn('mono text-[10px] uppercase tracking-[0.1em]', DELTA[deltaTone])}>{delta}</p>
      )}
      {children}
    </Card>
  )
}
