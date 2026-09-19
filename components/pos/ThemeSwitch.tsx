'use client'

import { useTransition } from 'react'
import type { Theme } from '@/core/theme'
import { cn } from '@/lib/utils'

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/**
 * The three-way theme control: a sunken track with the pressed option raised.
 * `compact` shows only the pressed option, for the collapsed rail.
 */
export function ThemeSwitch({
  theme,
  onChange,
  compact = false,
  className,
}: {
  theme: Theme
  onChange: (theme: Theme) => Promise<void>
  compact?: boolean
  className?: string
}) {
  const [pending, start] = useTransition()

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn('flex gap-0.5 rounded-[10px] bg-bg-deep p-[3px]', className)}
    >
      {OPTIONS.filter((o) => !compact || o.value === theme).map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === theme}
          disabled={pending}
          onClick={() => o.value !== theme && start(() => onChange(o.value))}
          className={cn(
            'h-7 flex-1 rounded-lg px-2 text-[12px] font-medium text-ink-3 transition-colors duration-150',
            o.value === theme && 'bg-bg-elev text-ink shadow-card ring-1 ring-rule',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
