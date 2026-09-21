'use client'

import { useEffect, useEffectEvent, useId, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useSwipe } from './gestures'
import { Eyebrow } from './text'

const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'

/** Nothing to subscribe to: the value only ever differs between server and client. */
const subscribeToNothing = () => () => {}

/**
 * The floating drawer and the phone's bottom sheet are the same object with a
 * different transform, so they are one component. There is no modal anywhere in
 * the design; this is the only overlay.
 *
 * A glass panel inset 12px from the desktop edge with a 24px radius; a band
 * holding the crumb, the record's own actions and one close control; the
 * title at 22px with its lede; the body; and a footer that holds Save and
 * Cancel, right aligned, primary last. Focus goes into the panel on open and
 * back to what opened it on close.
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
  actions,
  footer,
  dirty = false,
  children,
}: {
  open: boolean
  onClose: () => void
  /** Unsaved edits in the body. Escape and a tap on the dim then ask before closing;
   * the close control, Cancel and Save stay direct, since a click is not an accident. */
  dirty?: boolean
  side?: 'right' | 'bottom'
  /** 560px instead of 520: the Travel artboard's trip drawer. */
  wide?: boolean
  /** 480px: the Tasks artboard's task drawer. */
  narrow?: boolean
  /** The crumb in the band: "Finance / Accounts / Checking". */
  eyebrow?: ReactNode
  /** Names the dialog. Absent, the crumb names it and the body starts under
   * the band; the module passes move every drawer's heading here. */
  title?: ReactNode
  /** One line under the title, 13px ink-3. */
  lede?: ReactNode
  /** Per-record actions in the band, left of the close control: Delete, Open project. */
  actions?: ReactNode
  /** Sticky action bar at the bottom of the panel: Cancel, then Save. */
  footer?: ReactNode
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  // What had focus when the drawer opened, so closing puts it back there.
  const opener = useRef<HTMLElement | null>(null)
  const headingId = useId()
  const eyebrowId = useId()
  // Escape, the dim and the sheet's handle are the accidental ways out, so
  // they ask first when the form has unsaved edits.
  const dismiss = () => {
    if (dirty && !window.confirm('Discard your changes?')) return
    onClose()
  }
  // Dragging the sheet's handle down closes it, as every phone sheet does. On
  // the handle and the band only: the body scrolls, and a pull there is that.
  const drag = useSwipe({ onDown: dismiss })

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
  const onEscape = useEffectEvent(dismiss)

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
      // Tab stays inside the dialog: past the last control it wraps to the
      // first and Shift+Tab from the first wraps to the last. The dim behind is
      // aria-hidden by aria-modal already; this makes the keyboard agree.
      if (e.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
        )
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || active === panel.current)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        } else if (!(active instanceof Node) || !panel.current.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)

    // Stop the page behind from scrolling, and put focus on the first field
    // so a form drawer is ready to type into; a drawer with no field takes
    // focus on the panel so the next Tab lands inside it rather than back in
    // the list.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const field = panel.current?.querySelector<HTMLElement>('input, select, textarea')
    ;(field ?? panel.current)?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      // Escape, the dim, the close control and the footer all pass through
      // onClose, so this one cleanup returns focus for every way out.
      opener.current?.focus()
    }
  }, [open])

  if (!open || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={dismiss}
        className="absolute inset-0 bg-[light-dark(rgba(32,41,39,.28),rgba(0,0,0,.45))] duration-200 animate-in fade-in"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        // Named by its heading when it has one, so a title built from nodes
        // still names the dialog; the eyebrow element is the fallback, so a
        // crumb built from nodes ("Tasks / Edit") names a form drawer too.
        aria-labelledby={title !== undefined ? headingId : eyebrow ? eyebrowId : undefined}
        tabIndex={-1}
        className={cn(
          'glass-panel absolute flex flex-col outline-none shadow-[inset_0_1px_0_var(--glass-edge),var(--pop)]',
          'duration-[260ms] ease-[var(--ease)] animate-in',
          // Below md every drawer is the phone's sheet: full width on the
          // bottom edge, at most 78% of the screen, and dvh so the keyboard
          // shrinks it and the footer stays above the keys. The side prop
          // only decides the desktop.
          'max-md:bottom-0 max-md:left-0 max-md:max-h-[min(78dvh,100%)] max-md:w-full max-md:rounded-t-[24px] max-md:border-0 max-md:slide-in-from-bottom',
          side === 'right'
            ? cn(
                'md:inset-y-3 md:right-3 md:rounded-[24px] md:slide-in-from-right-4 md:fade-in',
                wide ? 'md:w-[min(560px,calc(100%-24px))]' : narrow ? 'md:w-[min(480px,calc(100%-24px))]' : 'md:w-[min(520px,calc(100%-24px))]',
              )
            : 'md:inset-x-3 md:bottom-3 md:max-h-[74vh] md:rounded-[24px] md:slide-in-from-bottom-4 md:fade-in',
        )}
      >
        <div className="shrink-0 [touch-action:none]" {...drag}>
          <div
            aria-hidden
            className={cn('mx-auto mt-2 h-[5px] w-9 rounded-full bg-rule-2', side === 'right' && 'md:hidden')}
          />

          <div className="flex h-12 items-center gap-1.5 pl-[18px] pr-3 md:h-14 md:pl-6 md:pr-3.5">
            <div id={eyebrowId} className="min-w-0 flex-1 truncate">{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}</div>
            {actions}
            <kbd className="hidden rounded-md bg-bg-deep/70 px-1.5 py-[3px] font-sans text-[11px] font-medium text-ink-3 md:inline">
              Esc
            </kbd>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-9 shrink-0 place-items-center rounded-full border border-transparent text-ink-3 transition-[background-color,border-color,color] duration-150 hover:border-rule-2 hover:bg-glass hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </div>

        {title !== undefined && (
          <div className="shrink-0 px-[18px] pt-1 md:px-6">
            <h2
              id={headingId}
              className="text-[20px] font-semibold leading-[1.2] tracking-[-0.02em] text-ink md:text-[22px]"
            >
              {title}
            </h2>
            {lede && <p className="mt-1.5 text-[13px] leading-[1.5] text-ink-3">{lede}</p>}
          </div>
        )}

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain] px-[18px] pb-[calc(18px+var(--inset-b))] md:px-6 md:pb-6',
            title === undefined ? 'pt-2' : 'pt-4',
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-glass-line px-[18px] pb-[max(env(safe-area-inset-bottom),12px)] pt-3 md:px-6 md:py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
