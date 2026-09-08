import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Dashed box, mono headline in the imperative present (INBOX ZERO, NOTHING
 * BOOKED), then one sentence explaining what would fill it. Never a bare
 * "no results".
 */
export function EmptyState({
  headline,
  children,
  action,
  className,
}: {
  headline: string
  /** One 12px grey sentence. */
  children: ReactNode
  /** Only where the reader can actually do something about it. */
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 border border-dashed border-rule-2 px-6 py-8 text-center',
        className,
      )}
    >
      <p className="mono text-[22px] font-light uppercase leading-none tracking-[0.08em] text-ink-3">
        {headline}
      </p>
      <p className="max-w-[46ch] text-xs leading-relaxed text-ink-3">{children}</p>
      {action}
    </div>
  )
}
