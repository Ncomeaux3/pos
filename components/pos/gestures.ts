'use client'

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { isLongPress, LONG_PRESS_MS, swipeOf } from '@/core/gestures'

// The pointer half of the gestures. The decision about what counts as a swipe
// lives in core/gestures.ts, where it can be tested without a browser.
//
// Four gestures: swipe between tabs, swipe a task to complete it, pull down to
// sync, and long press a dashboard tile to arrange.

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

export type LongPressHandlers = SwipeHandlers & {
  onPointerMove: (event: ReactPointerEvent) => void
  onPointerLeave: () => void
}

/**
 * Long press handlers for one element. Touch and pen only, as above: a slow
 * mouse click is not a request to rearrange anything.
 *
 * The timer runs from pointer down; moving past the slop, lifting, leaving or
 * a cancel clears it, so a scroll that started on a tile never fires.
 */
export function useLongPress(onFire: () => void): LongPressHandlers {
  const from = useRef<{ x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    from.current = null
  }
  useEffect(() => {
    const t = timer
    return () => {
      if (t.current) clearTimeout(t.current)
    }
  }, [])

  return {
    onPointerDown: (event) => {
      if (event.pointerType === 'mouse') return
      clear()
      from.current = { x: event.clientX, y: event.clientY }
      timer.current = setTimeout(() => {
        // Still down, and still: anything else cleared this timer already.
        clear()
        onFire()
      }, LONG_PRESS_MS)
    },
    onPointerMove: (event) => {
      const start = from.current
      if (!start) return
      // Would this still be a press once the time is up? If not, stop waiting.
      if (!isLongPress(LONG_PRESS_MS, event.clientX - start.x, event.clientY - start.y)) clear()
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
  }
}
