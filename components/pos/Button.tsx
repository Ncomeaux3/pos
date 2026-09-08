'use client'

import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// The app's button: a 30px tracked-label control on a pointer, 44px on touch,
// 8px radius per the brand's small-control rule. shadcn's Button stays for
// anything a shadcn primitive brings with it; this is the one on screen.

const BASE =
  'label inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border px-3 ' +
  'text-[10px] leading-none tracking-[0.1em] transition-colors duration-150 ' +
  'active:scale-[.985] disabled:cursor-not-allowed disabled:text-ink-4 sm:h-[30px]'

const VARIANT = {
  outline: 'border-rule-2 text-ink-2 hover:border-ink hover:text-ink',
  solid: 'border-ink bg-ink text-bg hover:border-brand hover:bg-brand hover:text-black',
  brand: 'border-brand bg-brand-soft text-ink hover:bg-brand hover:text-black',
  quiet: 'border-transparent text-ink-3 hover:text-ink',
  danger: 'border-bad/60 text-bad hover:border-bad',
} as const

export type ActionButtonVariant = keyof typeof VARIANT

export function ActionButton({
  variant = 'outline',
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: ActionButtonVariant }) {
  return <button type={type} className={cn(BASE, VARIANT[variant], className)} {...props} />
}

export { BASE as actionButtonBase, VARIANT as actionButtonVariants }
