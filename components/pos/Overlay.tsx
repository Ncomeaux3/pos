'use client'

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Eyebrow } from './text'

/** Nothing to subscribe to: the value only ever differs between server and client. */
const subscribeToNothing = () => () => {}

/**
 * The right drawer and the mobile bottom sheet are the same object with a
 * different transform, so they are one component. There is no modal anywhere in
 * the design; this is the only overlay.
 *
 * Measured off the Finance and Insurance artboards, which draw the same drawer:
 * 520px on a 45% dim with a long soft shadow; a 56px band holding the crumb
 * and ESC · CLOSE; then the title at 26px with its lede, 22px under the band.
 */
export function Overlay({
  open,
  onClose,
  side = 'right',
  eyebrow,
  title,
  lede,
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  side?: 'right' | 'bottom'
  /** The crumb in the band: "Finance / Accounts / Checking". */
  eyebrow?: ReactNode
  title: ReactNode
  /** One line under the title, 13px ink-3. */
  lede?: ReactNode
  /** Sticky action bar at the bottom of the panel. */
  footer?: ReactNode
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  // A portal cannot render on the server, and `typeof document === 'undefined'`
  // is a server/client branch: with the open state in the URL the server
  // renders nothing and the client renders the panel, which is a hydration
  // mismatch.
  //
  // useSyncExternalStore is React's own answer to "have we hydrated yet": the
  // server snapshot is false and the client snapshot is true, so the first
  // client render matches the server and the panel appears on the pass after
  // it. An effect that calls setState would do the same thing and cost a
  // cascading render.
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false)

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
        className="absolute inset-0 bg-black/45 duration-200 animate-in fade-in"
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
            ? 'right-0 top-0 h-full w-[min(520px,100%)] border-l border-rule-2 shadow-[-24px_0_48px_rgba(0,0,0,.35)] slide-in-from-right'
            : 'bottom-0 left-0 max-h-[74vh] w-full rounded-t-xl border-t border-rule-2 slide-in-from-bottom',
        )}
      >
        {side === 'bottom' && (
          <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-ink-4" />
        )}

        <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-rule px-6">
          <div className="min-w-0 truncate">{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}</div>
          <button
            type="button"
            onClick={onClose}
            className="label shrink-0 border border-rule-2 px-[9px] py-[5px] text-[11px] tracking-[0.08em] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink"
          >
            Esc · close
          </button>
        </div>

        <div className="shrink-0 px-6 pt-[22px]">
          <p className="text-[26px] font-normal leading-none tracking-[-0.03em] text-ink">{title}</p>
          {lede && <p className="mt-2 text-[13px] leading-[1.5] text-ink-3">{lede}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-[18px]">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-rule px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
