'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Every control here is 44px tall on touch and 32px on a pointer, per the
// design's hit target rule, and selected is always the soft action fill with
// the ink colour rather than a change in opacity.

const PILL_BASE =
  'inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-medium leading-none ' +
  'transition-[background-color,color,transform] duration-150 ease-[var(--ease)] active:scale-[.97] sm:h-8'

const PILL_OFF = 'bg-glass-strong text-ink-3 shadow-[inset_0_0_0_1px_var(--glass-line)] hover:text-ink'
const PILL_ON = 'bg-brand-soft text-ink shadow-[inset_0_0_0_1px_var(--action)]'

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
 * The switch: a 44x26 pill track with a round knob, action-coloured when on.
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
        // The track is 44x26; the pseudo element widens the hit area to 44px
        // tall without changing what is drawn.
        'relative h-[26px] w-11 shrink-0 rounded-full transition-colors duration-200 ease-[var(--ease)]',
        'before:absolute before:-inset-x-0 before:-inset-y-[9px] before:content-[""]',
        checked ? 'bg-action' : 'bg-ink-4/60',
        disabled && 'cursor-not-allowed opacity-100',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-[3px] block size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left] duration-200 ease-[var(--ease)]',
          checked ? 'left-[21px]' : 'left-[3px]',
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
