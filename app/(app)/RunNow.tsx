'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { ActionButton, useToast } from '@/components/pos'
import { atTop, swipeOf } from '@/core/gestures'
import { runNow } from './run-now'

export function RunNow() {
  const [pending, start] = useTransition()
  const toast = useToast()

  const run = () =>
    start(async () => {
      const result = await runNow()
      toast(
        result.failed > 0
          ? `Run ${result.status}, ${result.failed} job${result.failed === 1 ? '' : 's'} failed`
          : 'Run clean',
      )
    })

  return (
    <>
      <PullToSync onPull={run} disabled={pending} />
      <ActionButton disabled={pending} onClick={run}>
        {pending ? 'Running' : 'Run now'}
      </ActionButton>
    </>
  )
}

/**
 * Pull down from the top of the dashboard to run the nightly jobs.
 *
 * Listens on the document rather than wrapping the page in a handler, because
 * the gesture belongs to the whole screen and the button it duplicates lives in
 * the header. Only from the very top: anywhere else a downward drag is someone
 * scrolling back up, and hijacking that makes the page feel broken.
 */
function PullToSync({ onPull, disabled }: { onPull: () => void; disabled: boolean }) {
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
      if (!startedAt || event.pointerType === 'mouse' || disabled) return

      if (swipeOf(event.clientX - startedAt.x, event.clientY - startedAt.y, { allowDown: true }) === 'down') {
        onPull()
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
  }, [onPull, disabled])

  // Only rendered once the pull is far enough to mean it, so the page does not
  // carry a permanent hint about a gesture most visits will not use.
  if (!armed) return null

  return (
    <p
      aria-live="polite"
      className="label fixed inset-x-0 top-2 z-50 text-center text-[10px] tracking-[0.12em] text-brand"
    >
      Release to sync
    </p>
  )
}
