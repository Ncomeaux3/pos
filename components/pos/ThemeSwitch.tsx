'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTransition } from 'react'
import type { Theme } from '@/core/theme'
import { cn } from '@/lib/utils'

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
]

/**
 * The three-way theme control: a sunken track with the pressed option raised.
 * `compact` is one button for the collapsed rail: the pressed option's icon,
 * and a click moves to the next. A word did not fit the 50px the rail leaves.
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

  if (compact) {
    const at = OPTIONS.findIndex((o) => o.value === theme)
    const next = OPTIONS[(at + 1) % OPTIONS.length]
    const { label, Icon } = OPTIONS[at]
    return (
      <div role="group" aria-label="Theme" className={cn('rounded-[10px] bg-bg-deep p-[3px]', className)}>
        <button
          type="button"
          aria-label={`Theme: ${label}. Switch to ${next.label}`}
          title={`Theme: ${label}`}
          disabled={pending}
          onClick={() => start(() => onChange(next.value))}
          className="grid h-7 w-full place-items-center rounded-lg bg-bg-elev text-ink shadow-card ring-1 ring-rule"
        >
          <Icon size={16} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    )
  }

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
            'h-11 flex-1 rounded-lg px-2 text-[12px] sm:h-7 font-medium text-ink-3 transition-colors duration-150',
            o.value === theme && 'bg-bg-elev text-ink shadow-card ring-1 ring-rule',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
