import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Eyebrow, type DotTone } from './text'

/** 1px rule-2 on bg-elev, 16px vertical and 20px horizontal padding, no radius.
 * The container for everything. The padding is measured off the prototypes,
 * which run `16px 20px`; a flat 16px was squeezing every card's contents
 * against its border. */
export function Card({
  children,
  className,
  selected,
  ...rest
}: ComponentProps<'div'> & {
  children: ReactNode
  className?: string
  /** 1px accent border plus soft fill. Never opacity. */
  selected?: boolean
}) {
  return (
    <div
      {...rest}
      className={cn(
        'border bg-bg-elev px-5 py-4',
        selected ? 'border-brand bg-brand-soft' : 'border-rule-2',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Eyebrow left, metadata right, baseline aligned. */
export function CardHead({
  label,
  dot,
  meta,
  plainMeta = false,
  className,
}: {
  label: ReactNode
  dot?: DotTone
  meta?: ReactNode
  /** 11px ink-3 in sentence case, as the dashboard artboard's tile heads read
   * ("5 open", "2 budgets flagged →"), instead of the tracked label. */
  plainMeta?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1', className)}>
      <Eyebrow dot={dot}>{label}</Eyebrow>
      {meta && (
        <span className={cn('text-[11px] text-ink-3', !plainMeta && 'label tracking-[0.1em]')}>
          {meta}
        </span>
      )}
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
 * The KPI strip: one bordered container whose cells are divided by hairlines,
 * not a row of separate cards with gaps between them. Every prototype that
 * carries KPIs draws them joined, and the 1px `gap` over a `--rule-2` ground is
 * what makes the dividers survive wrapping, which `divide-x` does not.
 */
export function MetricStrip({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        // Two up on a phone. One per row put a 34px number in a full width
        // block and pushed everything else off the screen; the phone artboard
        // lays its KPIs out `1fr 1fr` and steps the numbers down to 24.
        'grid grid-cols-2 gap-px border border-rule-2 bg-rule-2 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))]',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Label over a big number over a small coloured delta. The KPI shape on
 * Finance, Home, Health, Fitness, Agent Log and the Weekly Review glance.
 *
 * A cell, not a card: it carries no border of its own because MetricStrip
 * draws the one border around the whole strip.
 */
/**
 * The number sizes the artboards use for a KPI strip.
 *
 * Not one size everywhere: Finance leads with 34, Insurance with 24, and the
 * Weekly Review's glance cards sit between them. The strip is the loudest thing
 * on a screen and how loud it is belongs to the screen.
 */
const METRIC_SIZE = {
  sm: 'text-[24px]',
  md: 'text-[24px] sm:text-[30px]',
  lg: 'text-[24px] sm:text-[34px]',
} as const

export function MetricTile({
  label,
  value,
  delta,
  deltaTone = 'quiet',
  size = 'md',
  className,
  children,
}: {
  label: ReactNode
  value: ReactNode
  delta?: ReactNode
  deltaTone?: DeltaTone
  size?: keyof typeof METRIC_SIZE
  className?: string
  /** A sparkline or bar, rendered under the delta. */
  children?: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-2 bg-bg-elev px-4 py-3.5 sm:px-5 sm:py-4', className)}>
      <Eyebrow>{label}</Eyebrow>
      <p
        className={cn(
          'num font-light tracking-[-0.02em] text-ink',
          METRIC_SIZE[size],
          // After the size: tailwind-merge drops a leading-* that precedes a
          // text size, since Tailwind's own sizes carry a line-height.
          'leading-none',
        )}
      >
        {value}
      </p>
      {delta && (
        <p className={cn('label text-[10px] tracking-[0.1em]', DELTA[deltaTone])}>{delta}</p>
      )}
      {children}
    </div>
  )
}
