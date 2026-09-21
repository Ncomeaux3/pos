'use client'

import type { Theme } from '@/core/theme'
import { applyTheme, useTheme } from '@/core/theme-client'
import { cn } from '@/lib/utils'

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/**
 * The three-way theme control: a sunken track with the pressed option raised.
 *
 * `theme` is only the server's first-paint value; applyTheme() writes
 * <html data-theme> and the cookie directly, and useTheme() reads that
 * attribute back, so this control and any other ThemeSwitch on the page move
 * together the instant a tap lands, with no server round trip.
 */
export function ThemeSwitch({ theme, className }: { theme: Theme; className?: string }) {
  const current = useTheme(theme)

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn('flex gap-0.5 rounded-[10px] bg-bg-deep p-[3px]', className)}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === current}
          onClick={() => o.value !== current && applyTheme(o.value)}
          className={cn(
            'h-11 flex-1 rounded-lg px-2 text-[12px] sm:h-7 font-medium text-ink-3 transition-colors duration-150',
            o.value === current && 'bg-bg-elev text-ink shadow-card ring-1 ring-rule',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
