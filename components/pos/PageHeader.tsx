import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AvatarMenu } from './AvatarMenu'
import { BackControl } from './BackControl'
import { BandSearch } from './BandSearch'
import { Eyebrow, type DotTone } from './text'

/**
 * The two bands every prototype opens with, and the phone's one row.
 *
 * Below md there is no band: a 44px back control when the screen is not a tab
 * root, the title, at most one action on the right, and on a tab root the
 * avatar that holds the utilities. Breadcrumb, search, lede and status are
 * the desktop's; the phone reaches search through Browse and the palette.
 *
 * Band one is the thin row across the top of the column: a breadcrumb on the
 * left, the search box in the middle, the module's status or its one primary
 * action, and the avatar at the far right. No rule under it: the page ground
 * is one surface and the glass below is what separates.
 *
 * Band two is the page proper: a 600 weight title at 30px, one grey sentence
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
  /** The phone's one action, top right. Falls back to `actions`. */
  phoneAction,
  hideTitle = false,
  search = true,
  searchPlaceholder,
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
  phoneAction?: ReactNode
  /**
   * The band alone. Tasks and Skill Tree draw no title block; the h1 stays for
   * the reader and the search placeholder, off screen.
   */
  hideTitle?: boolean
  /** False on the Search page, where the box below is the search. */
  search?: boolean
  /** Home's artboard asks a question; every other band says "Search <title>". */
  searchPlaceholder?: string
  className?: string
}) {
  return (
    <div className={cn(!hideTitle && 'space-y-3 md:space-y-5', className)}>
      {/* The phone row. The h1 is this one below md and the band's from md up;
        * a screen has one heading either way. */}
      <div className="flex min-h-11 items-center gap-2 md:hidden">
        <BackControl />
        <h1 className="line-clamp-3 min-w-0 flex-1 text-[24px] font-semibold leading-[1.1] tracking-[-0.022em] text-ink">
          {title}
        </h1>
        {/* One action top right. A module with no phone pass keeps its
          * desktop buttons here, so nothing it can do on a laptop is out of
          * reach on the phone. */}
        {(phoneAction ?? actions) && (
          <div className="ml-auto flex shrink-0 items-center gap-2">{phoneAction ?? actions}</div>
        )}
        <AvatarMenu phone className="-mr-1.5" />
      </div>

      <div className="-mt-3 hidden min-h-10 flex-wrap items-center gap-x-4 gap-y-2 md:flex">
        <Eyebrow dot={dot} className="whitespace-nowrap">
          {eyebrow}
        </Eyebrow>
        {search && (
          <BandSearch
            className="ml-auto"
            placeholder={searchPlaceholder ?? (typeof title === 'string' ? `Search ${title.toLowerCase()}` : undefined)}
          />
        )}
        {status && <div className="ml-auto flex shrink-0 items-center gap-3 whitespace-nowrap">{status}</div>}
        <AvatarMenu className={cn(!search && !status && 'ml-auto')} />
      </div>

      {hideTitle ? (
        <h1 className="sr-only hidden md:block">{title}</h1>
      ) : (
      <header className="hidden flex-wrap items-end justify-between gap-x-6 gap-y-4 md:flex">
        <div className="min-w-0 space-y-1.5">
          <h1 className="t-headline text-ink">{title}</h1>
          {lede && <p className="t-lede max-w-[78ch] text-ink-3">{lede}</p>}
        </div>
        {/* ml-auto so the actions stay right aligned even after they wrap onto
          * their own line, which they do as soon as the lede is long. */}
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      )}
    </div>
  )
}
