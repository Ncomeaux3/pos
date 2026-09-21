'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSwipe } from './gestures'

export type SwipeAction = {
  /** The word behind the row while it moves: Done, Snooze, Approve. */
  label: string
  tone?: 'action' | 'bad'
  onCommit: () => void
}

/**
 * A row that takes a swipe. `right` is the finger moving right (its word
 * shows on the left), `left` the reverse; a row with neither is a plain row.
 * The row follows the finger up to 80px in a direction that means something,
 * the word it is about to earn showing behind it, and snaps back on release
 * whether or not the swipe committed. The caller owns its optimistic state,
 * as the task board does. Touch and pen only, as useSwipe enforces: a mouse
 * drag across the text still selects it.
 *
 * Lifted out of modules/tasks/ui/Board.tsx (v1.2 phase 3c) for Review and
 * Notifications.
 */
export function SwipeRow({
  left,
  right,
  className,
  rowClassName,
  children,
}: {
  left?: SwipeAction
  right?: SwipeAction
  /** The outer wrapper, where a list's hairline or selected fill goes. */
  className?: string
  /** The moving surface: a card passes its radius so the fill behind it does not square its corners. */
  rowClassName?: string
  children: ReactNode
}) {
  const [dx, setDx] = useState(0)
  const swipe = useSwipe({
    onRight: right?.onCommit,
    onLeft: left?.onCommit,
    onMove: (d) => setDx(Math.max(left ? -80 : 0, Math.min(right ? 80 : 0, d))),
  })
  const action = dx > 0 ? right : dx < 0 ? left : undefined

  return (
    // Clipped only while it moves: at rest a card's ring, lift and focus
    // outline sit outside its box and must show.
    <div className={cn('relative', dx !== 0 && 'overflow-hidden', className)}>
      {action && (
        <span
          aria-hidden="true"
          // Hugging the edge the row uncovers first, so a six-letter word is
          // whole by the 56px that commits the swipe, not only at the 80px cap.
          className={cn(
            'absolute inset-y-0 flex w-20 items-center px-3 text-[12px] font-medium',
            dx > 0 ? 'left-0 justify-start' : 'right-0 justify-end',
            action.tone === 'bad' ? 'text-bad' : 'text-action',
          )}
        >
          {action.label}
        </span>
      )}
      <div
        data-swipes
        {...swipe}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        // The fill while it moves keeps the word from showing through a
        // transparent row.
        className={cn(
          'relative [touch-action:pan-y]',
          !dx && 'transition-transform',
          dx && 'bg-bg-elev',
          rowClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
