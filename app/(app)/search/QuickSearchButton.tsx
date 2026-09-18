'use client'

/** The band's "Quick search ⌘K": asks the palette for itself, as the band search does. */
export function QuickSearchButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('pos:search'))}
      className="whitespace-nowrap border border-rule-2 px-2.5 py-1.5 text-[12px] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink rounded-full"
    >
      Quick search <span className="num ml-1.5 text-[11px] text-ink-3">⌘K</span>
    </button>
  )
}
