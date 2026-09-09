'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSwipe } from './gestures'

export type Tab<T extends string> = { value: T; label: ReactNode; count?: number }

const TAB_BASE =
  'flex items-center gap-2 border-b-2 pb-2.5 pt-1 text-sm transition-colors duration-150'
const TAB_ON = 'border-brand text-ink'
const TAB_OFF = 'border-transparent text-ink-3 hover:text-ink-2'
const TAB_SOON = 'border-transparent text-ink-4 cursor-not-allowed'
const TAB_ROW = '-mb-px flex flex-wrap gap-6 border-b border-rule'

function TabCount({ count }: { count?: number }) {
  if (count === undefined) return null
  return <span className="num text-[10px] tracking-[0.1em] text-ink-3">{count}</span>
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
}: {
  tabs: Tab<T>[]
  value: T
  onChange: (next: T) => void
  label: string
  className?: string
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
            className={cn(TAB_BASE, on ? TAB_ON : TAB_OFF)}
          >
            {t.label}
            <TabCount count={t.count} />
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
}: {
  tabs: TabLink[]
  /** The href of the active tab. */
  current: string
  label: string
  className?: string
}) {
  return (
    <nav aria-label={label} className={cn(TAB_ROW, className)}>
      {tabs.map((t) =>
        t.soon ? (
          <span key={t.href} className={cn(TAB_BASE, TAB_SOON)}>
            {t.label}
            <span className="label text-[9px] tracking-[0.1em] text-ink-4">soon</span>
          </span>
        ) : (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.href === current ? 'page' : undefined}
            className={cn(TAB_BASE, t.href === current ? TAB_ON : TAB_OFF)}
          >
            {t.label}
            <TabCount count={t.count} />
          </Link>
        ),
      )}
    </nav>
  )
}
