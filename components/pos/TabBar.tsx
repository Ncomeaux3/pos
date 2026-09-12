'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSwipe } from './gestures'

export type Tab<T extends string> = {
  value: T
  label: ReactNode
  count?: number
  /** Amber for a count that is waiting on the owner: Review's agent tasks. */
  countTone?: 'warn'
}

// The DS tab, as every artboard draws it: 13px, a 1px underline sitting on the
// row's rule, 8px over and 12px under, the tabs touching with their own side
// padding. Only that padding varies between screens (10 to 16), which is what
// `tabClassName` is for.
const TAB_BASE =
  '-mb-px flex shrink-0 items-center border-b px-2.5 pb-3 pt-2 text-[13px] whitespace-nowrap transition-colors duration-150'
const TAB_ON = 'border-brand text-ink'
const TAB_OFF = 'border-transparent text-ink-3 hover:text-ink'
const TAB_SOON = 'border-transparent text-ink-4 cursor-not-allowed'
// Scrolls rather than wraps. Five tabs at 402px wrapped onto two lines with
// the underline of the first row cutting through the second, where the phone
// artboard runs its segmented control off the edge of the screen instead.
const TAB_ROW =
  'flex overflow-x-auto border-b border-rule [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible'

function TabCount({ count, tone }: { count?: number; tone?: 'warn' }) {
  if (count === undefined) return null
  return (
    <span className={cn('num ml-1.5 text-[10px]', tone === 'warn' ? 'text-warn' : 'text-ink-3')}>
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

  return (
    <div role="tablist" aria-label={label} className={cn(TAB_ROW, className)} {...swipe}>
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
            <span className="label ml-1.5 text-[9px] tracking-[0.1em] text-ink-4">soon</span>
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
