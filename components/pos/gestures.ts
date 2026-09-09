'use client'

import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { swipeOf } from '@/core/gestures'

// The pointer half of the gestures. The decision about what counts as a swipe
// lives in core/gestures.ts, where it can be tested without a browser.
//
// Three gestures are used: swipe between tabs, swipe a task to complete it, and
// pull down to sync. The fourth from the plan, long press to arrange the
// dashboard, is not here: the dashboard has no stored tile order to arrange.

export type SwipeHandlers = {
  onPointerDown: (event: ReactPointerEvent) => void
  onPointerUp: (event: ReactPointerEvent) => void
  onPointerCancel: () => void
}

/**
 * Swipe handlers for one element.
 *
 * Touch and pen only. A mouse drag across a task list is a text selection, and
 * completing someone's task because they highlighted its title would be the
 * kind of bug that gets a gesture removed rather than fixed.
 */
export function useSwipe(
  handlers: { onLeft?: () => void; onRight?: () => void; onDown?: () => void },
  options: { minDistance?: number } = {},
): SwipeHandlers {
  const from = useRef<{ x: number; y: number } | null>(null)

  return {
    onPointerDown: (event) => {
      if (event.pointerType === 'mouse') return
      from.current = { x: event.clientX, y: event.clientY }
    },
    onPointerUp: (event) => {
      const start = from.current
      from.current = null
      if (!start || event.pointerType === 'mouse') return

      const direction = swipeOf(event.clientX - start.x, event.clientY - start.y, {
        allowDown: handlers.onDown !== undefined,
        minDistance: options.minDistance,
      })

      if (direction === 'left') handlers.onLeft?.()
      if (direction === 'right') handlers.onRight?.()
      if (direction === 'down') handlers.onDown?.()
    },
    onPointerCancel: () => {
      from.current = null
    },
  }
}
