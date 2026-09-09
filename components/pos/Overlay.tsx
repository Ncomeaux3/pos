'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Eyebrow } from './text'

/**
 * The right drawer and the mobile bottom sheet are the same object with a
 * different transform, so they are one component. There is no modal anywhere in
 * the design; this is the only overlay.
 */
export function Overlay({
  open,
  onClose,
  side = 'right',
  eyebrow,
  title,
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  side?: 'right' | 'bottom'
  eyebrow?: ReactNode
  title: ReactNode
  /** Sticky action bar at the bottom of the panel. */
  footer?: ReactNode
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  // A portal cannot render on the server, and `typeof document === 'undefined'`
  // is a server/client branch: with the open state in the URL the server
  // renders nothing and the client renders the panel, which is a hydration
  // mismatch. Mounting is state, so the first client render matches the server
  // and the panel appears on the pass after it.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    // Stop the page behind from scrolling, and put focus in the panel so the
    // next Tab lands inside it rather than back in the list.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  if (!open || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 duration-200 animate-in fade-in"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cn(
          'absolute flex flex-col bg-bg-elev outline-none',
          'duration-[260ms] ease-[cubic-bezier(.2,.8,.2,1)] animate-in',
          side === 'right'
            ? 'right-0 top-0 h-full w-[min(440px,92vw)] border-l border-rule-2 slide-in-from-right'
            : 'bottom-0 left-0 max-h-[74vh] w-full rounded-t-xl border-t border-rule-2 slide-in-from-bottom',
        )}
      >
        {side === 'bottom' && (
          <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-ink-4" />
        )}

        <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4">
          <div className="min-w-0 space-y-1.5">
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <p className="t-title text-ink">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="label shrink-0 text-[10px] tracking-[0.1em] text-ink-3 hover:text-ink"
          >
            Close esc
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
