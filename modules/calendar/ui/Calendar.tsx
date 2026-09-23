'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ActionButton, Eyebrow, Row, RowList, useToast } from '@/components/pos'
import { MonthGrid, type GridItem } from '@/components/pos/MonthGrid'
import { NAV_ICON } from '@/components/pos/Sidebar'
import { useSearchState } from '@/components/pos/searchState'
import type { CalendarItem } from '@/core/module-contract'
import { cn } from '@/lib/utils'
import { addDays, monthRange, weekStart } from '../range'
import { itemsFor, saveHidden } from './actions'
import { EventDrawer } from './EventDrawer'

type Source = { id: string; label: string }

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const keyOf = (i: CalendarItem) => `${i.module}:${i.id}`

/** "Thursday, 24 September" for a YYYY-MM-DD. */
function longDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

/** YYYY-MM, `offset` months from `month`. */
function shiftMonth(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + offset, 1))
  return d.toISOString().slice(0, 7)
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

/** All-day first, then by time. */
const byTime = (a: CalendarItem, b: CalendarItem) =>
  Number(!a.allDay) - Number(!b.allDay) || a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title)

export function NewEventButton({ phone = false }: { phone?: boolean }) {
  const { set } = useSearchState()
  const open = () => set({ event: 'new' }, { push: true })
  if (phone) {
    return (
      <ActionButton variant="solid" aria-label="New event" className="h-11 w-11 gap-0 rounded-full p-0" onClick={open}>
        <Plus size={18} aria-hidden />
      </ActionButton>
    )
  }
  return (
    <ActionButton variant="accent" size="lg" onClick={open}>
      New event
    </ActionButton>
  )
}

export function Calendar({
  today,
  month,
  initial,
  hidden: hiddenAtLoad,
  sources,
}: {
  today: string
  /** Today's month, YYYY-MM: what `initial` covers. */
  month: string
  initial: CalendarItem[]
  hidden: string[]
  sources: Source[]
}) {
  const router = useRouter()
  const toast = useToast()
  const { params, set } = useSearchState()
  const [, start] = useTransition()

  const [store, setStore] = useState<Record<string, CalendarItem>>(() =>
    Object.fromEntries(initial.map((i) => [keyOf(i), i])),
  )
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set([month]))
  const [hidden, setHidden] = useState(hiddenAtLoad)
  const [selected, setSelected] = useState(today)
  const [offset, setOffset] = useState(0)

  const [ty, tm, td] = today.split('-').map(Number)
  const todayDate = new Date(ty, tm - 1, td)

  /** The months a view needs: the grid's, and both ends of the phone's week. */
  const monthsFor = (iso: string, gridOffset: number) => {
    const week = weekStart(iso)
    return [...new Set([shiftMonth(month, gridOffset), week.slice(0, 7), addDays(week, 6).slice(0, 7)])]
  }
  const week = weekStart(selected)

  /** Fetch the months not held yet. Called where the view moves, not in an effect. */
  const ensure = (months: string[]) => {
    const missing = months.filter((m) => !loaded.has(m))
    if (missing.length === 0) return
    setLoaded((prev) => new Set([...prev, ...missing]))
    for (const m of missing) {
      itemsFor(monthRange(m))
        .then((items) =>
          setStore((prev) => ({ ...prev, ...Object.fromEntries(items.map((i) => [keyOf(i), i])) })),
        )
        .catch(() => {
          // Unmarked, so paging back to it tries again.
          setLoaded((prev) => new Set([...prev].filter((k) => k !== m)))
          toast(`Could not load ${m}`)
        })
    }
  }

  /** After a write: the months on screen again, replacing what was held. */
  const reload = async () => {
    const needed = monthsFor(selected, offset)
    try {
      const lists = await Promise.all(needed.map((m) => itemsFor(monthRange(m))))
      setStore(Object.fromEntries(lists.flat().map((i) => [keyOf(i), i])))
      setLoaded(new Set(needed))
    } catch {
      // The write landed; only the refresh failed. A reload shows it.
      toast('Saved, but the calendar could not refresh')
    }
  }

  const visible = Object.values(store).filter((i) => !hidden.includes(i.module))
  const on = (iso: string) => visible.filter((i) => i.startsAt.slice(0, 10) === iso).sort(byTime)

  const select = (iso: string) => {
    const next = monthsBetween(month, iso.slice(0, 7))
    setSelected(iso)
    setOffset(next)
    ensure(monthsFor(iso, next))
  }

  const pageMonth = (next: number) => {
    setOffset(next)
    // Keep the selection inside the month on screen: today on its own month,
    // the first otherwise.
    const shown = shiftMonth(month, next)
    const iso = shown === month ? today : `${shown}-01`
    setSelected(iso)
    ensure(monthsFor(iso, next))
  }

  const toggle = (id: string) => {
    const next = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]
    const before = hidden
    setHidden(next)
    start(async () => {
      const result = await saveHidden(next)
      if (!result.ok) {
        setHidden(before)
        toast(result.error)
      }
    })
  }

  const open = (item: CalendarItem) => {
    if (item.kind === 'event') set({ event: item.id }, { push: true })
    else router.push(item.href)
  }

  const eventParam = params.get('event')
  // Only an event typed here opens the drawer; a feed's is the feed's.
  const found = eventParam && eventParam !== 'new' ? store[`calendar:${eventParam}`] : undefined
  const editing = found?.kind === 'event' ? found : undefined
  const label = (id: string) => sources.find((s) => s.id === id)?.label ?? id

  const dayItems = on(selected)
  const groups = sources
    .map((s) => ({ ...s, items: dayItems.filter((i) => i.module === s.id) }))
    .filter((g) => g.items.length > 0)

  const gridItem = (i: CalendarItem): GridItem => ({
    id: keyOf(i),
    title: i.title,
    time: i.allDay ? null : i.startsAt.slice(11, 16),
    tone: i.done || i.projected ? 'muted' : 'default',
    onOpen: () => select(i.startsAt.slice(0, 10)),
  })

  return (
    <div className="space-y-5">
      {/* The chips: a module switched off stays off, on both widths. One
        * scrolling row on the phone, where ten wrapped chips took four rows. */}
      <div
        role="group"
        aria-label="Modules shown"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        {sources.map((s) => {
          const Icon = NAV_ICON[`/${s.id}`]
          const shown = !hidden.includes(s.id)
          return (
            <ActionButton
              key={s.id}
              size="pill"
              variant={shown ? 'brand' : 'outline'}
              aria-pressed={shown}
              onClick={() => toggle(s.id)}
              // Shown is the selected state, so it carries the action border;
              // brand alone is borderless and read as the off one on the canvas.
              className={cn('shrink-0 gap-1.5', shown ? 'border-action' : 'text-ink-3')}
            >
              {Icon && <Icon size={14} aria-hidden />}
              {s.label}
            </ActionButton>
          )
        })}
      </div>

      <div className="hidden md:block">
        <MonthGrid
          today={todayDate}
          offset={offset}
          onOffset={pageMonth}
          itemsOn={(iso) => on(iso).map(gridItem)}
          selected={selected}
          onSelect={select}
        />
      </div>

      {/* The phone: a week of day pills over the day's list. */}
      <div className="space-y-3 md:hidden">
        <div className="flex items-center justify-between gap-2">
          <ActionButton size="sm" aria-label="Previous week" onClick={() => select(addDays(selected, -7))}>
            ‹
          </ActionButton>
          <span className="text-[15px] text-ink">
            {MONTHS[Number(week.slice(5, 7)) - 1]} {week.slice(0, 4)}
          </span>
          <div className="flex gap-2">
            <ActionButton size="sm" onClick={() => select(today)} className={cn(selected === today && 'border-ink text-ink')}>
              Today
            </ActionButton>
            <ActionButton size="sm" aria-label="Next week" onClick={() => select(addDays(selected, 7))}>
              ›
            </ActionButton>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (unused, i) => {
            const iso = addDays(week, i)
            const count = on(iso).length
            const isSelected = iso === selected
            return (
              <button
                key={iso}
                type="button"
                onClick={() => select(iso)}
                aria-pressed={isSelected}
                aria-label={`${longDay(iso)}, ${count} ${count === 1 ? 'item' : 'items'}`}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 rounded-[12px] border',
                  isSelected ? 'border-action bg-brand-soft' : 'border-rule bg-bg hover:border-ink',
                )}
              >
                <span className="label text-ink-3">{DOW[i].slice(0, 2)}</span>
                <span className={cn('num text-[15px]', iso === today ? 'font-semibold text-action' : 'text-ink')}>
                  {Number(iso.slice(8))}
                </span>
                <span className="num h-3 text-[10px] leading-3 text-ink-3">{count > 0 ? count : ''}</span>
              </button>
            )
          })}
        </div>
      </div>

      <section aria-labelledby="calendar-day" data-day={selected} className="space-y-3">
        <h2 id="calendar-day" className="text-[17px] tracking-[-0.01em] text-ink">
          {longDay(selected)}
        </h2>
        {groups.length === 0 ? (
          <p className="t-caption text-ink-3">
            Nothing on this day{hidden.length > 0 ? ' in the modules shown' : ''}.
          </p>
        ) : (
          groups.map((g) => {
            const Icon = NAV_ICON[`/${g.id}`]
            return (
              <div key={g.id} className="space-y-1.5">
                <h3>
                  <Eyebrow className="flex items-center gap-1.5">
                    {Icon && <Icon size={13} aria-hidden />}
                    {label(g.id)}
                  </Eyebrow>
                </h3>
                <RowList>
                  {g.items.map((i) => (
                    <Row
                      key={keyOf(i)}
                      title={i.title}
                      meta={[i.meta, i.done && 'Done', i.projected && 'Expected, from its schedule'].filter(Boolean).join(' · ') || undefined}
                      date={i.allDay ? 'All day' : `${i.startsAt.slice(11, 16)}${i.endsAt ? ` to ${i.endsAt.slice(11, 16)}` : ''}`}
                      muted={i.done || i.projected}
                      onClick={() => open(i)}
                    />
                  ))}
                </RowList>
              </div>
            )
          })
        )}
      </section>

      {eventParam && (eventParam === 'new' || editing) && (
        <EventDrawer
          event={editing}
          day={selected}
          onClose={() => set({ event: null })}
          onSaved={() => {
            set({ event: null })
            void reload()
          }}
        />
      )}
    </div>
  )
}

