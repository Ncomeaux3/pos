import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BandSearch } from './BandSearch'
import { Eyebrow, type DotTone } from './text'

/**
 * The two bands every prototype opens with.
 *
 * Band one is the thin strip across the top of the column: a breadcrumb
 * eyebrow on the left, the search box in the middle, and the module's status
 * or its one primary action on the right. It is full bleed, so the negative
 * margins cancel the padding `main` puts around the page.
 *
 * Band two is the page proper: a 400 weight title at 28px, one grey sentence
 * under it, and the record making actions right aligned against it.
 *
 * Both bands live here rather than in the layout because the status on the
 * right of band one is the page's own, and a layout has no way to read it.
 */
export function PageHeader({
  eyebrow,
  dot,
  title,
  lede,
  actions,
  status,
  className,
}: {
  /** The breadcrumb in band one. "Finance / Overview". */
  eyebrow: ReactNode
  dot?: DotTone
  title: ReactNode
  lede?: ReactNode
  /** Record making actions, right of the title. */
  actions?: ReactNode
  /** Sync state or a count, right of band one. Falls back to nothing. */
  status?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="-mx-7 -mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-rule px-7 py-3.5">
        <Eyebrow dot={dot}>{eyebrow}</Eyebrow>
        <BandSearch className="order-last w-full md:order-none md:ml-auto" />
        {status && <div className="flex items-center gap-3 md:order-last">{status}</div>}
      </div>

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 space-y-2">
          <h1 className="t-headline text-ink">{title}</h1>
          {lede && <p className="t-lede max-w-[78ch] text-ink-3">{lede}</p>}
        </div>
        {/* ml-auto so the actions stay right aligned even after they wrap onto
            their own line, which they do as soon as the lede is long. */}
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
    </div>
  )
}
