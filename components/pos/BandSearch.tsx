'use client'

import { cn } from '@/lib/utils'

/**
 * The search box in the page band. A button dressed as an input, because the
 * command palette already owns the query and a second real input would let a
 * half typed search exist in two places at once. Clicking it opens the palette,
 * which is the same thing Cmd K does.
 */
export function BandSearch({
  className,
  placeholder = 'What are you looking for?',
}: {
  className?: string
  /** PosSearch's scoped placeholder on a module screen: "Search finance". */
  placeholder?: string
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('pos:search'))}
      className={cn(
        'flex h-[34px] w-full max-w-[320px] items-center gap-2.5 border border-rule-2 bg-bg pl-3 pr-3 text-left text-ink-4 transition-colors duration-150 hover:border-ink-4 hover:text-ink-3',
        className,
      )}
    >
      {/* PosSearch compact: a chevron in ink-4, then the placeholder at 12px.
          No shortcut hint; the artboard's bar carries none. */}
      <span aria-hidden className="label shrink-0 text-[12px]">›</span>
      <span className="truncate text-[12px]">{placeholder}</span>
    </button>
  )
}

/**
 * The same thing as a 44px square, for the phone band.
 *
 * The artboard's header has no room for a field: it carries a search icon
 * beside the title at a 44px touch target, and the query itself belongs to the
 * palette either way, so this asks for the palette through the same event.
 */
export function SearchButton({ className, href }: { className?: string; href?: string }) {
  const shape = cn(
    'grid size-11 shrink-0 place-items-center border border-rule-2 text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink',
    className,
  )
  const glyph = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden>
      <circle cx="7" cy="7" r="4.6" />
      <path d="M10.5 10.5 L14.5 14.5" />
    </svg>
  )

  // A link where the page's own search is a form that works without
  // javascript, so shrinking it to an icon does not quietly make it need any.
  return href ? (
    <a href={href} aria-label="Search" className={shape}>
      {glyph}
    </a>
  ) : (
    <button
      type="button"
      aria-label="Search"
      onClick={() => window.dispatchEvent(new Event('pos:search'))}
      className={shape}
    >
      {glyph}
    </button>
  )
}
