import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The list row. Wrapping flex on purpose, never a grid track: the design says
 * it has to reflow at 300px, and a fixed track cannot.
 *
 * A greyed row keeps full opacity and drops to ink-3, so its text and any
 * button inside stay readable.
 */
export function Row({
  title,
  meta,
  right,
  children,
  selected,
  muted,
  onClick,
  className,
}: {
  title: ReactNode
  /** 11px ink-3 line under the title. */
  meta?: ReactNode
  /** Mono tags and actions, right aligned, wraps under on narrow screens. */
  right?: ReactNode
  /** Expanded detail, rendered full width below the row. */
  children?: ReactNode
  selected?: boolean
  muted?: boolean
  onClick?: () => void
  className?: string
}) {
  const interactive = Boolean(onClick)

  return (
    <div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        'border-b border-rule px-1 py-3.5 transition-colors duration-150',
        interactive && 'cursor-pointer hover:bg-bg-elev',
        selected && 'border-brand bg-brand-soft',
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3.5 gap-y-3">
        <div className="min-w-0 flex-1 basis-[180px] space-y-1">
          <p className={cn('t-body', muted ? 'text-ink-3' : 'text-ink')}>{title}</p>
          {meta && <p className="t-caption text-ink-3">{meta}</p>}
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

/** Wraps rows so the last one loses its divider. */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('[&>*:last-child]:border-b-0', className)}>{children}</div>
}
