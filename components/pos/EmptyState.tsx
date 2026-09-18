import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A quiet glass surface, a short headline in the imperative present (Inbox
 * zero, Nothing booked), then one sentence explaining what would fill it and
 * what to do. Never a bare "no results".
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
        'glass flex flex-col items-center gap-3 rounded-[18px] p-[30px] text-center',
        className,
      )}
    >
      <p className="text-[18px] font-semibold leading-none tracking-[-0.01em] text-ink-2">
        {headline}
      </p>
      <p className="t-caption max-w-[46ch] text-ink-3">{children}</p>
      {action}
    </div>
  )
}
