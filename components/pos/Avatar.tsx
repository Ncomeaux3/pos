import { cn } from '@/lib/utils'

/**
 * The owner's initials in a 32px accent-soft circle with a quarter-strength
 * action ring: the soft fill alone is one shade off the light canvas and the
 * circle vanished. Decorative on its own: the button around it (AvatarMenu)
 * carries the accessible name.
 */
export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-semibold leading-none tracking-[0.01em] text-action ring-1 ring-inset ring-action/25',
        className,
      )}
    >
      {initials}
    </span>
  )
}
