import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// The two smallest pieces of the design, and the two most repeated. Every
// screen header and every card head is an eyebrow, most of them with a dot.

export type DotTone = 'brand' | 'ok' | 'warn' | 'bad' | 'idle'

const DOT_BG: Record<DotTone, string> = {
  brand: 'bg-brand',
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
  idle: 'bg-ink-4',
}

/**
 * 6px round dot. Pulses only in brand tone, which is what the design animates;
 * a red overdue dot holding still reads as a state, not a heartbeat.
 */
export function StatusDot({ tone = 'brand', className }: { tone?: DotTone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'size-1.5 shrink-0 rounded-full',
        DOT_BG[tone],
        tone === 'brand' && 'status-dot',
        className,
      )}
    />
  )
}

/**
 * 13px, 500, sentence case, ink-3. The universal small label.
 * Pass `dot` for the leading status dot.
 */
export function Eyebrow({
  children,
  dot,
  className,
}: {
  children: ReactNode
  dot?: DotTone
  className?: string
}) {
  return (
    <span className={cn('eyebrow', className)}>
      {dot && <StatusDot tone={dot} />}
      {children}
    </span>
  )
}
