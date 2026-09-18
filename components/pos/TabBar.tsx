'use client'

import Link from 'next/link'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSwipe } from './gestures'

export type Tab<T extends string> = {
  value: T
  label: ReactNode
  count?: number
  /** Amber for a count that is waiting on the owner: Review's agent tasks. */
  countTone?: 'warn'
}

// The segmented control: a sunken glass track holding the tabs, the selected
// one raised as a pill. 13.5px, 32px tall on desktop and 36 on a phone.
const TAB_BASE =
  'flex h-9 shrink-0 items-center rounded-[9px] px-3.5 text-[13.5px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 ease-[var(--ease)] md:h-8'
const TAB_ON = 'bg-glass-strong text-ink font-semibold shadow-[inset_0_1px_0_var(--glass-edge),0_2px_6px_rgba(0,0,0,.08)]'
const TAB_OFF = 'text-ink-3 hover:text-ink'
const TAB_SOON = 'text-ink-4 cursor-not-allowed'
// Scrolls rather than wraps: five tabs at 402px run off the edge of the track.
const TAB_ROW =
  'glass inline-flex max-w-full gap-0.5 self-start overflow-x-auto rounded-[12px] p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,.06)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

function TabCount({ count, tone }: { count?: number; tone?: 'warn' }) {
  if (count === undefined) return null
  return (
    <span className={cn('num ml-1.5 text-[11px] font-normal', tone === 'warn' ? 'text-warn' : 'text-ink-3')}>
      {count}
    </span>
  )
}

/**
 * Underlined tabs with counts, sitting on the rule below them. Review and
 * Settings both use this; it is not the filter chip row, which selects a
 * subset rather than a page.
 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
  tabClassName,
}: {
  tabs: Tab<T>[]
  value: T
  onChange: (next: T) => void
  label: string
  className?: string
  tabClassName?: string
}) {
  // Swiping the tab row moves one tab, which is the gesture every phone app
  // has and the reason the row is reachable with a thumb at all. Bounded at
  // both ends rather than wrapping: a swipe that jumps from the last tab to
  // the first reads as a mis-tap, not as navigation.
  const index = tabs.findIndex((t) => t.value === value)
  const swipe = useSwipe({
    onLeft: () => index < tabs.length - 1 && onChange(tabs[index + 1].value),
    onRight: () => index > 0 && onChange(tabs[index - 1].value),
  })

  // Five tabs at 402px run off the edge, so a change made by swipe or by a
  // deep link brings the active tab into view. By hand rather than
  // scrollIntoView, which would also scroll the page to the row.
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = row.current
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!el || !tab) return
    const left = tab.offsetLeft - el.offsetLeft
    const right = left + tab.offsetWidth
    if (left < el.scrollLeft) el.scrollLeft = left
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth
  }, [value])

  return (
    <div ref={row} role="tablist" aria-label={label} className={cn(TAB_ROW, className)} {...swipe}>
      {tabs.map((t) => {
        const on = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(TAB_BASE, on ? TAB_ON : TAB_OFF, tabClassName)}
          >
            {t.label}
            <TabCount count={t.count} tone={t.countTone} />
          </button>
        )
      })}
    </div>
  )
}

export type TabLink = {
  href: string
  label: ReactNode
  count?: number
  /** Renders greyed with a SOON mark. For tabs whose step has not landed. */
  soon?: boolean
}

/**
 * The same tabs when each one is its own route, so they work without client
 * JavaScript and stay linkable. Settings uses this; Review uses the button
 * version, because its three tabs are one page's state.
 */
export function TabLinks({
  tabs,
  current,
  label,
  className,
  tabClassName,
}: {
  tabs: TabLink[]
  /** The href of the active tab. */
  current: string
  label: string
  className?: string
  tabClassName?: string
}) {
  return (
    <nav aria-label={label} className={cn(TAB_ROW, className)}>
      {tabs.map((t) =>
        t.soon ? (
          <span key={t.href} className={cn(TAB_BASE, TAB_SOON, tabClassName)}>
            {t.label}
            <span className="ml-1.5 text-[10px] text-ink-4">soon</span>
          </span>
        ) : (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.href === current ? 'page' : undefined}
            className={cn(TAB_BASE, t.href === current ? TAB_ON : TAB_OFF, tabClassName)}
          >
            {t.label}
            <TabCount count={t.count} />
          </Link>
        ),
      )}
    </nav>
  )
}
