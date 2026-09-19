import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Eyebrow, type DotTone } from './text'

/** A glass surface with an 18px radius and `16px 20px` padding: the container
 * for a summary or a form, never for a single row. */
export function Card({
  children,
  className,
  selected,
  as: Tag = 'div',
  ...rest
}: ComponentProps<'div'> & {
  children: ReactNode
  className?: string
  /** 1px accent border plus soft fill. Never opacity. */
  selected?: boolean
  /** `article` when the card is one record in a list, as the idea cards are. */
  as?: 'div' | 'article'
}) {
  return (
    <Tag
      {...rest}
      className={cn(
        'glass rounded-[18px] px-5 py-4',
        selected && 'bg-brand-soft ring-1 ring-action',
        className,
      )}
    >
      {children}
    </Tag>
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
        <span className={cn('text-[12px] text-ink-3', !plainMeta && 'label')}>{meta}</span>
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
 * The KPI strip: one glass surface whose cells are divided by hairlines, not a
 * row of separate cards with gaps between them. The 1px `gap` over the rule
 * colour is what makes the dividers survive wrapping, which `divide-x` does not.
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
        'glass grid grid-cols-2 gap-px overflow-hidden rounded-[18px] sm:grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))]',
        '[&>*]:shadow-[-1px_-1px_0_var(--rule)]',
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
  /** A short string rather than a number: a cron line, "Ok · 04:00 · 12 jobs". */
  xs: 'text-[14px] font-medium',
  sm: 'text-[24px]',
  md: 'text-[24px] sm:text-[30px]',
  lg: 'text-[24px] sm:text-[34px]',
} as const

export function MetricTile({
  label,
  value,
  delta,
  deltaTone = 'quiet',
  valueTone,
  size = 'md',
  className,
  children,
}: {
  label: ReactNode
  value: ReactNode
  delta?: ReactNode
  deltaTone?: DeltaTone
  /** Colours the number itself, as Finance's 30-day change and a stalled goal read. */
  valueTone?: Exclude<DeltaTone, 'quiet'>
  size?: keyof typeof METRIC_SIZE
  className?: string
  /** A sparkline or bar, rendered under the delta. */
  children?: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-2 px-4 py-3.5 sm:px-5 sm:py-4', className)}>
      <Eyebrow>{label}</Eyebrow>
      <p
        className={cn(
          'num font-semibold tracking-[-0.025em]',
          valueTone ? DELTA[valueTone] : 'text-ink',
          METRIC_SIZE[size],
          // After the size: tailwind-merge drops a leading-* that precedes a
          // text size, since Tailwind's own sizes carry a line-height.
          'leading-none',
        )}
      >
        {value}
      </p>
      {delta && (
        <p className={cn('text-[12px]', DELTA[deltaTone])}>{delta}</p>
      )}
      {children}
    </div>
  )
}
