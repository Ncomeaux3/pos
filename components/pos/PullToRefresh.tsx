'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { atTop, swipeOf } from '@/core/gestures'

/**
 * Pull down from the top of any screen to fetch it again.
 *
 * Listens on the document rather than wrapping the page in a handler, because
 * the gesture belongs to the whole screen. Only from the very top: anywhere
 * else a downward drag is someone scrolling back up, and hijacking that makes
 * the page feel broken. Pull means fetch, as in every mail and money app; the
 * nightly agent runs from its own button.
 */
export function PullToRefresh() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const from = useRef<{ x: number; y: number } | null>(null)
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || !atTop(window.scrollY)) {
        from.current = null
        return
      }
      from.current = { x: event.clientX, y: event.clientY }
    }

    const move = (event: PointerEvent) => {
      if (!from.current) return
      setArmed(event.clientY - from.current.y > 40)
    }

    const up = (event: PointerEvent) => {
      const startedAt = from.current
      from.current = null
      setArmed(false)
      if (!startedAt || event.pointerType === 'mouse' || pending) return

      if (swipeOf(event.clientX - startedAt.x, event.clientY - startedAt.y, { allowDown: true }) === 'down') {
        start(() => router.refresh())
      }
    }

    document.addEventListener('pointerdown', down)
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
    }
  }, [router, pending])

  // Only rendered once the pull is far enough to mean it, so the page does not
  // carry a permanent hint about a gesture most visits will not use.
  if (!armed && !pending) return null

  return (
    <p
      aria-live="polite"
      className="label fixed inset-x-0 top-2 z-50 flex h-4 items-center justify-center gap-2 text-[10px] tracking-[0.12em] text-brand"
    >
      {pending && (
        <span
          aria-hidden="true"
          className="block size-3 animate-spin rounded-full border-[1.5px] border-brand border-t-transparent"
        />
      )}
      {pending ? 'Refreshing' : 'Release to refresh'}
    </p>
  )
}
