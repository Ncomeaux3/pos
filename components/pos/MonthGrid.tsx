'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { actionButtonBase, actionButtonSizes, actionButtonVariants } from './Button'

// The month grid, shared by Tasks and Calendar. Hand-rolled: a month is six
// rows of seven cells and a date arithmetic problem, which is less code than
// any calendar library's config. It draws one month and knows nothing about
// what the items are; the caller pages it and says what each item means.

const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const mini = cn(actionButtonBase, actionButtonSizes.sm, actionButtonVariants.outline)

export type GridItem = {
  id: string
  title: string
  /** HH:MM, shown before the title on desktop. */
  time?: string | null
  /** bad and warn colour the border; muted is done or projected, drawn lighter. */
  tone?: 'default' | 'bad' | 'warn' | 'muted'
  onOpen: () => void
}

/** YYYY-MM-DD for a local date, without a timezone round trip. */
export function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function MonthGrid({
  today,
  offset,
  onOffset,
  itemsOn,
  meta,
  selected,
  onSelect,
}: {
  today: Date
  /** Months from today's month. */
  offset: number
  onOffset: (offset: number) => void
  /** The items for one day, already sorted. */
  itemsOn: (iso: string) => GridItem[]
  /** The short line on the right of the header. */
  meta?: ReactNode
  /** A selected day, YYYY-MM-DD, ringed. */
  selected?: string
  /** Given, the day number is a button that selects its day. */
  onSelect?: (iso: string) => void
}) {
  const shown = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const year = shown.getFullYear()
  const month = shown.getMonth()
  const todayIso = isoDay(today.getFullYear(), today.getMonth(), today.getDate())

  const leading = shown.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (unused, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button type="button" aria-label="Previous month" onClick={() => onOffset(offset - 1)} className={mini}>
            ‹
          </button>
          <span className="min-w-[150px] text-center text-[18px] tracking-[-0.02em] text-ink">
            {MONTHS[month]} {year}
          </span>
          <button type="button" aria-label="Next month" onClick={() => onOffset(offset + 1)} className={mini}>
            ›
          </button>
          <button type="button" onClick={() => onOffset(0)} className={cn(mini, offset === 0 && 'border-ink text-ink')}>
            Today
          </button>
        </div>
        {meta && <span className="num whitespace-nowrap text-[11px] text-ink-3">{meta}</span>}
      </div>

      {/* Below md the seven columns share the pane: two letter heads, short
        * cells, a dot per item. From md up the grid is the artboard's 560px. */}
      <div className="overflow-x-auto">
        <div className="overflow-hidden rounded-[18px] border border-rule md:min-w-[560px]">
          <div className="grid grid-cols-7 gap-px bg-rule">
            {DOWS.map((d) => (
              <span key={d} className="label bg-bg-elev px-1 py-1 text-ink-3 md:px-2.5 md:py-2">
                <span className="md:hidden">{d.slice(0, 2)}</span>
                <span className="hidden md:inline">{d}</span>
              </span>
            ))}
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`pad-${i}`} className="min-h-14 bg-bg-deep md:min-h-24" />
              }

              const iso = isoDay(year, month, day)
              const isToday = iso === todayIso
              const past = iso < todayIso
              const items = itemsOn(iso)

              return (
                <div
                  key={day}
                  className={cn(
                    'min-w-0 min-h-14 px-1 py-1 md:min-h-24 md:px-2.5 md:py-2',
                    isToday ? 'bg-brand-soft' : 'bg-bg',
                    // A past day is de-emphasised by ink, never by opacity: the
                    // design's rule is that a greyed row stays readable.
                    past && 'bg-bg-deep',
                    selected === iso && 'ring-2 ring-inset ring-action',
                  )}
                >
                  <div className="flex items-baseline justify-between">
                    {onSelect ? (
                      <button
                        type="button"
                        onClick={() => onSelect(iso)}
                        aria-label={`${MONTHS[month]} ${day}, ${items.length} ${items.length === 1 ? 'item' : 'items'}`}
                        aria-pressed={selected === iso}
                        className={cn(
                          // 24px, the smallest target the guideline allows.
                          'num -mx-1 -my-1 grid min-h-6 min-w-6 place-items-center rounded-full px-1 text-[11px] hover:bg-bg-elev',
                          isToday ? 'font-semibold text-action' : past ? 'text-ink-4' : 'text-ink-3',
                        )}
                      >
                        {String(day).padStart(2, '0')}
                      </button>
                    ) : (
                      <span
                        className={cn(
                          'num text-[11px]',
                          isToday ? 'font-semibold text-action' : past ? 'text-ink-4' : 'text-ink-3',
                        )}
                      >
                        {String(day).padStart(2, '0')}
                      </span>
                    )}
                    {items.length > 3 && (
                      <span className="num text-[11px] font-medium text-ink-3">+{items.length - 3}</span>
                    )}
                  </div>

                  {/* The phone's row of dots: one 16 by 24px button per item, named by
                    * its title. ponytail: under the 24px target guideline; a day sheet
                    * listing the items is the upgrade if taps miss. */}
                  <div className="mt-1 flex md:hidden">
                    {items.slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={t.onOpen}
                        aria-label={t.title}
                        className="grid h-6 w-4 shrink-0 place-items-center"
                      >
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            t.tone === 'bad'
                              ? 'bg-bad'
                              : t.tone === 'warn'
                                ? 'bg-warn'
                                : t.tone === 'muted'
                                  ? 'bg-ink-4'
                                  : 'bg-ink-3',
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 hidden min-w-0 flex-col gap-[3px] md:flex">
                    {items.slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={t.onOpen}
                        title={t.title}
                        className={cn(
                          'block w-full truncate border bg-bg px-1.5 py-[3px] text-left text-[11px] leading-[1.3] hover:border-ink rounded-full',
                          t.tone === 'muted' ? 'text-ink-3' : 'text-ink',
                          t.tone === 'bad'
                            ? 'border-bad'
                            : t.tone === 'warn'
                              ? 'border-warn'
                              : t.tone === 'muted'
                                ? 'border-rule'
                                : 'border-rule-2',
                        )}
                      >
                        {t.time && <span className="num mr-[5px] text-ink-3">{t.time}</span>}
                        {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
