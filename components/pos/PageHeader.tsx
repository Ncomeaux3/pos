import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Eyebrow, type DotTone } from './text'

/**
 * On every module page: eyebrow with an optional status dot, a 400 weight
 * title, one grey sentence, and one or two outline actions on the right.
 * Bottom border 1px rule.
 */
export function PageHeader({
  eyebrow,
  dot,
  title,
  lede,
  actions,
  className,
}: {
  eyebrow: ReactNode
  dot?: DotTone
  title: ReactNode
  lede?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-rule pb-4', className)}>
      <div className="min-w-0 space-y-2">
        <Eyebrow dot={dot}>{eyebrow}</Eyebrow>
        <h1 className="text-[clamp(22px,2.2vw,30px)] font-normal leading-[1.1] tracking-[-0.03em] text-ink">
          {title}
        </h1>
        {lede && <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-3">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
