import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ChipTone = 'neutral' | 'brand' | 'ok' | 'warn' | 'bad' | 'quiet'

// Colour carries meaning here, so every tone also differs in its wording. A
// tinted fill rather than a coloured border, so the chip reads as a pill.
const TONE: Record<ChipTone, string> = {
  neutral: 'bg-glass-strong text-ink-2 shadow-[inset_0_0_0_1px_var(--glass-line)]',
  brand: 'bg-brand-soft text-ink',
  ok: 'bg-ok/12 text-ok',
  warn: 'bg-warn/14 text-warn',
  bad: 'bg-bad/12 text-bad',
  quiet: 'bg-bg-deep/70 text-ink-3',
}

/**
 * The pill: 12px, 500, sentence case, 999px. Tags, counts, kinds. Not a control.
 */
export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: ChipTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5',
        'text-[12px] font-medium leading-none',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * A state badge: same type, 6px corners. On track, Guarded, Pending, Clean.
 * Squarer so a state never reads as a removable tag.
 */
export function StatusChip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: ChipTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1',
        'text-[11px] font-medium leading-none',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
