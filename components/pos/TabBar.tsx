'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Tab<T extends string> = { value: T; label: ReactNode; count?: number }

/**
 * Underlined tabs with counts, sitting on the rule below them. Review and
 * Settings both use this; it is not the filter chip row, which selects a
 * subset rather than a page.
 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: Tab<T>[]
  value: T
  onChange: (next: T) => void
  label: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('-mb-px flex flex-wrap gap-6 border-b border-rule', className)}
    >
      {tabs.map((t) => {
        const on = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(
              'flex items-center gap-2 border-b-2 pb-2.5 pt-1 text-sm transition-colors duration-150',
              on ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:text-ink-2',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="mono text-[10px] tracking-[0.1em] text-ink-3">{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
