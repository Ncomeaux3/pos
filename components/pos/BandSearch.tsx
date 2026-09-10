'use client'

import { cn } from '@/lib/utils'

/**
 * The search box in the page band. A button dressed as an input, because the
 * command palette already owns the query and a second real input would let a
 * half typed search exist in two places at once. Clicking it opens the palette,
 * which is the same thing Cmd K does.
 */
export function BandSearch({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('pos:search'))}
      className={cn(
        'flex h-[34px] w-full max-w-[320px] items-center justify-between gap-3 border border-rule-2 bg-bg-deep px-3 text-left text-ink-3 transition-colors duration-150 hover:border-ink-4 hover:text-ink-2',
        className,
      )}
    >
      <span className="truncate text-[12px]">Search</span>
      <span className="label shrink-0 text-[10px] tracking-[0.1em] text-ink-4">⌘K</span>
    </button>
  )
}
