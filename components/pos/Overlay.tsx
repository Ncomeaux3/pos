'use client'

import { useEffect, useEffectEvent, useId, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useSwipe } from './gestures'
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
  wide = false,
  narrow = false,
  eyebrow,
  title,
  lede,
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  side?: 'right' | 'bottom'
  /** 560px instead of 520: the Travel artboard's trip drawer. */
  wide?: boolean
  /** 480px: the Tasks artboard's task drawer. */
  narrow?: boolean
  /** The crumb in the band: "Finance / Accounts / Checking". */
  eyebrow?: ReactNode
  /** Absent, the body starts 22px under the band: the Tasks form drawer. */
  title?: ReactNode
  /** One line under the title, 13px ink-3. */
  lede?: ReactNode
  /** Sticky action bar at the bottom of the panel. */
  footer?: ReactNode
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const headingId = useId()
  // Dragging the sheet's handle down closes it, as every phone sheet does. On
  // the handle and the band only: the body scrolls, and a pull there is that.
  const drag = useSwipe({ onDown: onClose })

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

  // Escape goes through an effect event so the effect below depends on `open`
  // alone. Most callers pass a fresh closure every render, and with `onClose`
  // in the deps the effect re-ran, and refocused the panel, on every keystroke
  // in a drawer that owns its own input state.
  const onEscape = useEffectEvent(() => onClose())

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
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
  }, [open])

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
        // Named by its heading when it has one, so a title built from nodes
        // still names the dialog; the eyebrow text is the fallback.
        aria-labelledby={title !== undefined ? headingId : undefined}
        aria-label={title === undefined && typeof eyebrow === 'string' ? eyebrow : undefined}
        tabIndex={-1}
        className={cn(
          'absolute flex flex-col bg-bg-elev outline-none',
          'duration-[260ms] ease-[cubic-bezier(.2,.8,.2,1)] animate-in',
          // Below md every drawer is PosPhone's sheet: full width on the
          // bottom edge, at most 74% of the screen. The side prop only
          // decides the desktop.
          'max-md:bottom-0 max-md:left-0 max-md:max-h-[74vh] max-md:w-full max-md:rounded-t-xl max-md:border-t max-md:border-rule-2 max-md:slide-in-from-bottom',
          side === 'right'
            ? cn(
                'md:right-0 md:top-0 md:h-full md:border-l md:border-rule-2 md:shadow-[-24px_0_48px_rgba(0,0,0,.35)] md:slide-in-from-right',
                wide ? 'md:w-[min(560px,100%)]' : narrow ? 'md:w-[min(480px,100%)]' : 'md:w-[min(520px,100%)]',
              )
            : 'md:bottom-0 md:left-0 md:max-h-[74vh] md:w-full md:rounded-t-xl md:border-t md:border-rule-2 md:slide-in-from-bottom',
        )}
      >
        <div className="shrink-0 [touch-action:none]" {...drag}>
          <div
            aria-hidden
            className={cn('mx-auto mt-2 h-1 w-[38px] rounded-full bg-rule-2', side === 'right' && 'md:hidden')}
          />

          <div className="flex h-14 items-center justify-between gap-4 border-b border-rule px-[18px] md:px-6">
            <div className="min-w-0 truncate">{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}</div>
            <button
              type="button"
              onClick={onClose}
              className="label shrink-0 border border-rule-2 px-[9px] py-[5px] text-[11px] tracking-[0.08em] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink"
            >
              <span className="md:hidden">Close</span>
              <span className="hidden md:inline">Esc · close</span>
            </button>
          </div>
        </div>

        {title !== undefined && (
          <div className="shrink-0 px-[18px] pt-[22px] md:px-6">
            <h2
              id={headingId}
              className="text-[20px] font-normal leading-none tracking-[-0.03em] text-ink md:text-[26px]"
            >
              {title}
            </h2>
            {lede && <p className="mt-2 text-[13px] leading-[1.5] text-ink-3">{lede}</p>}
          </div>
        )}

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain] px-[18px] pb-[calc(18px+var(--inset-b))] md:px-6 md:pb-6',
            title === undefined ? 'pt-[22px]' : 'pt-[18px]',
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-rule px-[18px] pb-[calc(18px+var(--inset-b))] pt-4 md:px-6 md:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
