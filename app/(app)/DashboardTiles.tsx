import Link from 'next/link'
import { RowList } from '@/components/pos'

// The week ahead, reading core and nothing else. A plain server component:
// what it draws is a fact from a table, and nothing on it is clicked except a
// link.

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Item = { id: string; title: string; meta: string; at: string; module: string; href?: string }

/**
 * The next seven days as rows: the day in a narrow column, the title, and the
 * module's own line under it. Each row opens the item's own drawer when the
 * module named one, else the module root.
 */
export function SevenDays({ items, today }: { items: Item[]; today: string }) {
  // Whole days, from the owner's today. Everything here is a date rather
  // than a moment, so no clock and no timezone comes into it.
  const day = (iso: string) => new Date(`${iso}T12:00:00`)
  const offset = (iso: string) =>
    Math.round((day(iso).getTime() - day(today).getTime()) / 86_400_000)

  // The seventh day out shares today's weekday name, so it carries its date.
  const when = (iso: string) => {
    const days = offset(iso)
    if (days === 0) return 'Today'
    if (days === 1) return 'Tmrw'
    const d = day(iso)
    return days < 7 ? DOW[d.getDay()] : `${DOW[d.getDay()]} ${d.getDate()}`
  }

  if (items.length === 0) {
    return (
      <p className="t-caption px-1 text-ink-3">
        Nothing is scheduled. Modules put their dated things here as they queue them.
      </p>
    )
  }

  return (
    <RowList>
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href ?? `/${item.module}`}
          className="relative flex items-start gap-3 px-4 py-2.5 transition-colors duration-150 before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-rule first:before:hidden hover:bg-glass-strong"
        >
          <span className="num w-11 shrink-0 pt-px text-[12px] text-ink-3">{when(item.at)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-medium leading-[1.35] text-ink">
              {item.title}
            </span>
            <span className="t-caption mt-0.5 block truncate text-ink-3">{item.meta}</span>
          </span>
        </Link>
      ))}
    </RowList>
  )
}
