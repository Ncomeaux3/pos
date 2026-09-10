import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ChipTone = 'neutral' | 'brand' | 'ok' | 'warn' | 'bad' | 'quiet'

// Colour carries meaning here, so every tone also differs in its wording. The
// accent is 3.8:1 on dark, which is fine for a bordered label and not enough to
// be the only signal.
const TONE: Record<ChipTone, string> = {
  neutral: 'border-rule-2 text-ink-2',
  brand: 'border-brand text-ok',
  ok: 'border-ok/60 text-ok',
  warn: 'border-warn/60 text-warn',
  bad: 'border-bad/60 text-bad',
  quiet: 'border-rule text-ink-3',
}

/**
 * The pill: 11px, 0.08em tracking, uppercase, 999px.
 * Tags, counts, kinds. Not a control.
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
        'label inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5',
        'text-[11px] uppercase tracking-[0.08em] leading-none',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * A state badge: same type, square corners. ON TRACK, GUARDED, PENDING, CLEAN.
 * Square so a state never reads as a removable tag.
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
        'label inline-flex items-center gap-1.5 rounded-md border px-2 py-1',
        'text-[10px] uppercase tracking-[0.1em] leading-none',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
