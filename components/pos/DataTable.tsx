import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The column headed table: Insurance, Finance accounts and upcoming, Home,
 * Health, Meals and Travel all draw one. It is not a Card. The prototypes sit
 * it flush on the page ground with hairline dividers and a tracked uppercase
 * header row, and wrapping it in a bordered box is what made those screens
 * read as a stack of panels instead of a ledger.
 *
 * Grid rather than <table>, and the template only applies from `md` up. Below
 * that every cell stacks, which keeps the design rule that a row has to reflow
 * at 300px: a real table cannot, and neither can a grid track that is always
 * on.
 */
export function DataTable({
  head,
  cols,
  children,
  className,
}: {
  /** One label per column. An empty string leaves a gutter unlabelled. */
  head: ReactNode[]
  /** A grid-template-columns value, applied from md up. */
  cols: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      style={{ ['--cols' as string]: cols }}
      className={cn('w-full overflow-x-auto', className)}
    >
      {/* No table/row/columnheader roles: they only mean anything inside a
          real table role, and half a table's ARIA is worse than none. The
          header is a visual key, and each row below is a button when it opens
          something, which is the thing a reader actually needs to operate. */}
      {/* The artboards' column key: 11px at 0.08em on a 7px row over rule-2. */}
      <div
        aria-hidden
        data-table-head
        className="hidden border-b border-rule-2 py-[7px] md:grid md:grid-cols-[var(--cols)] md:gap-x-4"
      >
        {head.map((h, i) => (
          <span key={i} className="label text-[11px] tracking-[0.08em] text-ink-3">
            {h}
          </span>
        ))}
      </div>
      {children}
    </div>
  )
}

/**
 * One row of a DataTable. Cells are the children, in column order.
 *
 * A selected row takes the accent border and the soft fill, never opacity, and
 * a muted one drops to ink-3 at full opacity so its text and any button inside
 * stay readable.
 */
export function DataRow({
  children,
  selected,
  onClick,
  className,
  style,
}: {
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  className?: string
  style?: CSSProperties
}) {
  const interactive = Boolean(onClick)

  return (
    <div
      role={interactive ? 'button' : undefined}
      onClick={onClick}
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
      style={style}
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-rule py-3.5 transition-colors duration-150 md:grid md:grid-cols-[var(--cols)]',
        interactive && 'cursor-pointer hover:bg-bg-elev',
        selected && 'border-brand bg-brand-soft',
        className,
      )}
    >
      {children}
    </div>
  )
}
