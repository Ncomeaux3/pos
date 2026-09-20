'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSwipe } from './gestures'
import { TabBar, type Tab } from './TabBar'

/**
 * A module's sections: the tab row, then a pane holding the one section that
 * is showing. Swiping the pane moves one section, so the whole screen is the
 * gesture's target rather than the 40px row. Bounded at both ends, as the row
 * is: a swipe that wrapped would read as a mis-tap.
 *
 * `pan-y` leaves vertical scrolling to the browser and takes only the
 * horizontal drag. `useSwipe` already refuses a start inside the edge strip,
 * which belongs to swipe-back.
 */
export function Segments<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
  tabClassName,
  end,
  children,
}: {
  tabs: Tab<T>[]
  value: T
  onChange: (next: T) => void
  label: string
  /** The row's classes. */
  className?: string
  tabClassName?: string
  /** Something that sits right of the row: Meals's week arrows. */
  end?: ReactNode
  children: ReactNode
}) {
  const index = tabs.findIndex((t) => t.value === value)
  const swipe = useSwipe({
    onLeft: () => index < tabs.length - 1 && onChange(tabs[index + 1].value),
    onRight: () => index > 0 && onChange(tabs[index - 1].value),
  })

  return (
    <>
      {end ? (
        <div className={cn('flex flex-wrap items-center justify-between gap-2', className)}>
          <TabBar tabs={tabs} value={value} onChange={onChange} label={label} tabClassName={tabClassName} />
          {end}
        </div>
      ) : (
        <TabBar tabs={tabs} value={value} onChange={onChange} label={label} className={className} tabClassName={tabClassName} />
      )}
      {/* A row that swipes for itself (a task) marks itself data-swipes, and a
        * finger that lands on one is its alone: the pane never records the
        * press, so nothing bubbles up to move a segment as well. */}
      <div
        data-segments-pane
        className="[touch-action:pan-y]"
        {...swipe}
        onPointerDown={(event) => {
          if ((event.target as Element).closest('[data-swipes]')) return
          swipe.onPointerDown(event)
        }}
      >
        {children}
      </div>
    </>
  )
}
