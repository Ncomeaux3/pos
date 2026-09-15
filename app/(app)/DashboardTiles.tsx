import Link from 'next/link'
import { cn } from '@/lib/utils'

// The dashboard tile that reads core and nothing else. A plain server
// component: what it draws is a fact from a table, and nothing on it is
// clicked except a link.

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The colour a module's marks take on the strip, from its own nav colour. */
const TONE: Record<string, string> = {
  finance: 'bg-brand',
  insurance: 'bg-warn',
  travel: 'bg-ink-2',
  tasks: 'bg-brand',
  home: 'bg-warn',
  health: 'bg-warn',
}

type Item = { id: string; title: string; meta: string; at: string; module: string; href?: string }

/**
 * The week ahead as a line with marks on it, then the same items as rows.
 *
 * Measured off POS Dashboard.dc.html: a 44px strip with the rule at 10px,
 * eight ticks at sevenths labelled TODAY, the two letter days, then +7, one
 * 8px square per item stacked when a day has several; then rows of 6px 4px
 * with a 56px "Today" / "Tmrw" / "Mon 14" column, a 6px square, the title
 * and the module's own line on the right. A picture of density, not a chart.
 */
export function SevenDays({ items, today }: { items: Item[]; today: string }) {
  // Whole days, from the owner's today. Everything on the strip is a date
  // rather than a moment, so no clock and no timezone comes into it.
  const day = (iso: string) => new Date(`${iso}T12:00:00`)
  const offset = (iso: string) =>
    Math.min(7, Math.max(0, Math.round((day(iso).getTime() - day(today).getTime()) / 86_400_000)))
  const plus = (days: number) => new Date(day(today).getTime() + days * 86_400_000)

  const when = (iso: string) => {
    const days = offset(iso)
    if (days === 0) return 'Today'
    if (days === 1) return 'Tmrw'
    return `${DOW[day(iso).getDay()]} ${day(iso).getDate()}`
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative mt-1 h-11">
        <div className="absolute inset-x-0 top-2.5 h-px bg-rule-2" />
        {Array.from({ length: 8 }, (unused, i) => (
          <span key={i}>
            <span
              className="absolute top-[7px] h-[7px] w-px bg-ink-4"
              style={{ left: `${(i / 7) * 100}%` }}
              aria-hidden
            />
            <span
              className={cn(
                'label absolute top-6 text-[9px] tracking-[0.06em] text-ink-4',
                i === 0 ? '' : i === 7 ? '-translate-x-full' : '-translate-x-1/2',
              )}
              style={{ left: `${(i / 7) * 100}%` }}
            >
              {i === 0 ? 'Today' : i === 7 ? '+7' : DOW[plus(i).getDay()].slice(0, 2)}
            </span>
          </span>
        ))}
        {items.map((item, i) => {
          const sameDay = items.filter((o, j) => j < i && offset(o.at) === offset(item.at)).length
          return (
            <Link
              key={item.id}
              href={item.href ?? `/${item.module}`}
              title={item.title}
              className={cn('absolute size-2', TONE[item.module] ?? 'bg-ink-3')}
              style={{ left: `calc(${(offset(item.at) / 7) * 100}% - 4px)`, top: 6 + sameDay * 10 }}
            />
          )
        })}
      </div>

      {items.length === 0 ? (
        <p className="t-caption mt-1.5 text-ink-3">
          Nothing is scheduled. Modules put their dated things here as they queue them.
        </p>
      ) : (
        <div className="mt-1.5 flex flex-col">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href ?? `/${item.module}`}
              className="flex items-center gap-2.5 border-b border-rule px-1 py-1.5 hover:bg-brand-soft"
            >
              <span className="num w-14 shrink-0 text-[11px] text-ink-3">{when(item.at)}</span>
              <span className={cn('size-1.5 shrink-0', TONE[item.module] ?? 'bg-ink-3')} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.title}</span>
              <span className="num shrink-0 truncate text-[11px] text-ink-2">{item.meta}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
