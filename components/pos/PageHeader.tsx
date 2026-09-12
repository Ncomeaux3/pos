import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BandSearch, SearchButton } from './BandSearch'
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
  hideTitle = false,
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
  /**
   * The band alone. Tasks and Skill Tree draw no title block; the h1 stays for
   * the reader and the search placeholder, off screen.
   */
  hideTitle?: boolean
  className?: string
}) {
  return (
    <div className={cn(!hideTitle && 'space-y-5', className)}>
      {/* The negative margins cancel `main`'s padding, which is 18px on a
        * phone and 28 from md up. */}
      <div className="-mx-[18px] -mt-[18px] flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-rule px-[18px] py-3.5 md:-mx-7 md:-mt-7 md:h-14 md:flex-nowrap md:px-7 md:py-0">
        <Eyebrow dot={dot}>{eyebrow}</Eyebrow>
        {/* A full width search field is a desktop affordance: on the phone
          * artboard search is a 44px button in this band that opens a sheet.
          * The button asks the palette for itself through the same event the
          * field does, so there is still one query in one place. */}
        <SearchButton className="ml-auto md:hidden" />
        <BandSearch
          className="order-last hidden w-full md:order-none md:ml-auto md:flex"
          placeholder={typeof title === 'string' ? `Search ${title.toLowerCase()}` : undefined}
        />
        {status && <div className="flex items-center gap-3 md:order-last">{status}</div>}
      </div>

      {hideTitle ? (
        <h1 className="sr-only">{title}</h1>
      ) : (
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 space-y-2">
          <h1 className="t-headline text-ink">{title}</h1>
          {/* Hidden on a phone. None of the four phone artboards carries a
            * description under its title, and at 402px this paragraph was
            * costing most of a screen before any content. */}
          {lede && <p className="t-lede hidden max-w-[78ch] text-ink-3 md:block">{lede}</p>}
        </div>
        {/* ml-auto so the actions stay right aligned even after they wrap onto
            their own line, which they do as soon as the lede is long. */}
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      )}
    </div>
  )
}
