'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Every control here is 44px tall on touch and 30px on a pointer, per the
// design's hit target rule, and selected is always a 1px accent border plus the
// soft fill rather than a change in opacity.

const PILL_BASE =
  'mono inline-flex h-11 items-center gap-2 border px-3 text-[11px] uppercase leading-none tracking-[0.1em] ' +
  'transition-colors duration-150 active:scale-[.985] sm:h-[30px]'

const PILL_OFF = 'border-rule-2 text-ink-3 hover:border-rule-2 hover:text-ink'
const PILL_ON = 'border-brand bg-brand-soft text-ink'

export type PillOption<T extends string> = {
  value: T
  label: ReactNode
  /** Rendered as a dimmer trailing number, as the filter rows do. */
  count?: number
  disabled?: boolean
}

/**
 * The segmented control, the filter chip row and every multi-select pill group
 * in the design are the same object. `multiple` is the only difference, and a
 * count is what makes it read as a filter.
 */
export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  multiple,
  label,
  className,
}: {
  options: PillOption<T>[]
  /** A single value, or the selected set when `multiple`. */
  value: T | T[]
  onChange: (next: T) => void
  multiple?: boolean
  /** Screen reader name for the group. */
  label: string
  className?: string
}) {
  const selected = Array.isArray(value) ? value : [value]

  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-label={label}
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {options.map((o) => {
        const on = selected.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              PILL_BASE,
              on ? PILL_ON : PILL_OFF,
              o.disabled && 'cursor-not-allowed text-ink-4',
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="text-ink-3">{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/**
 * 34x20 square knob. The prototypes ship two sizes; one is enough.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-[34px] shrink-0 border transition-colors duration-150',
        checked ? 'border-brand bg-brand-soft' : 'border-rule-2 bg-bg-deep',
        disabled && 'cursor-not-allowed opacity-100',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-[3px] block h-3 w-3 transition-[left] duration-150',
          checked ? 'left-[17px] bg-brand' : 'left-[3px] bg-ink-4',
        )}
      />
    </button>
  )
}

/**
 * 1d, 7d, dismiss. On dashboard warnings, notification rules and the mobile
 * warnings tile, which is three affordances in the prototypes and one here.
 */
export function SnoozeControl({
  onSnooze,
  onDismiss,
  className,
}: {
  onSnooze: (days: number) => void
  onDismiss?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {[1, 7].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onSnooze(d)}
          className={cn(PILL_BASE, PILL_OFF, 'px-2')}
        >
          {d}d
        </button>
      ))}
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className={cn(PILL_BASE, PILL_OFF, 'px-2')}
        >
          &#215;
        </button>
      )}
    </div>
  )
}
