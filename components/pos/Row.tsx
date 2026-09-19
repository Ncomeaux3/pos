import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The list row. Title and meta on the left; `amount` or `date` in a fixed,
 * tabular right column; `right` for tags and actions, which wrap under on a
 * narrow screen. Wrapping flex on purpose, never a grid track: the design says
 * it has to reflow at 300px, and a fixed track cannot.
 *
 * Inside a RowList the rows share one glass surface and an inset hairline. A
 * greyed row keeps full opacity and drops to ink-3, so its text and any button
 * inside stay readable.
 */
export function Row({
  title,
  meta,
  amount,
  date,
  right,
  children,
  selected,
  muted,
  onClick,
  expanded,
  className,
}: {
  title: ReactNode
  /** 12.5px ink-3 line under the title. */
  meta?: ReactNode
  /** A number, right aligned and tabular: a balance, a count, a duration. */
  amount?: ReactNode
  /** A date or time, right aligned under or instead of the amount. */
  date?: ReactNode
  /** Tags and actions, right aligned, wraps under on narrow screens. */
  right?: ReactNode
  /** Expanded detail, rendered full width below the row. */
  children?: ReactNode
  selected?: boolean
  muted?: boolean
  onClick?: () => void
  /** For a row that toggles its `children`: announced as expanded or collapsed. */
  expanded?: boolean
  className?: string
}) {
  const interactive = Boolean(onClick)

  return (
    <div
      className={cn(
        'relative px-4 py-2.5 transition-colors duration-150 ease-[var(--ease)]',
        // The inset hairline between rows, drawn by the row below the first.
        'before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-rule first:before:hidden',
        interactive && 'cursor-pointer hover:bg-glass-strong',
        selected && 'bg-brand-soft before:hidden [&+*]:before:hidden',
        className,
      )}
    >
      {/* The click target is the header, never the wrapper. An expander's
          content sits in `children` below, and a button that contained it
          would both nest buttons and read its whole subtree as its name. */}
      <div
        onClick={onClick}
        role={interactive ? 'button' : undefined}
        aria-expanded={interactive ? expanded : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                // A button in `right` handles its own keys; only the row
                // itself, when focused, opens on Enter or Space.
                if (e.target !== e.currentTarget) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onClick?.()
                }
              }
            : undefined
        }
        // 44px on touch for a row that opens something; 28 on a pointer.
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2',
          interactive ? 'min-h-11 sm:min-h-7' : 'min-h-7',
        )}
      >
        <div className="min-w-0 flex-1 basis-[180px]">
          <p className={cn('text-[14.5px] font-medium leading-[1.35]', muted ? 'text-ink-3' : 'text-ink')}>
            {title}
          </p>
          {meta && <p className="t-caption mt-0.5 text-ink-3">{meta}</p>}
        </div>
        {(amount !== undefined || date !== undefined) && (
          <div className="num min-w-[88px] text-right">
            {amount !== undefined && (
              <p className={cn('text-[14px] leading-[1.35]', muted ? 'text-ink-3' : 'text-ink')}>{amount}</p>
            )}
            {date !== undefined && <p className="t-caption text-ink-3">{date}</p>}
          </div>
        )}
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

/** The grouped surface a list of rows sits in. */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('glass overflow-hidden rounded-[18px]', className)}>{children}</div>
}
