'use client'

import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// The button system. Every button is sentence case, a pill, and one of five
// sizes; the variant says what it means, never what it looks like.
//
//   sm   h24  11px   inline row actions: Snooze, Approve, Dismiss
//   md   h36  13px   the default: Arrange, Upload PDF, Edit limits
//   lg   h44  14px   a flow's primary: Continue, Start the review
//   xl   h48  15px   a page's primary: Run now, Add policy
//   pill h34  12.5px segmented options and filter chips
//
// Touch targets: sm and md are below the 44px a phone needs, so both grow to
// 44px on a coarse pointer and shrink at `sm` where a mouse is the likely input.

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border font-medium leading-none ' +
  'transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-[var(--ease)] active:scale-[.97] ' +
  'disabled:cursor-not-allowed disabled:text-ink-4 disabled:shadow-none'

const SIZE = {
  sm: 'h-11 px-3 text-[11px] sm:h-6 sm:px-2.5',
  md: 'h-11 px-4 text-[13px] sm:h-9',
  lg: 'h-11 px-[22px] text-[14px]',
  xl: 'h-12 px-6 text-[15px]',
  pill: 'h-11 px-[13px] text-[12.5px] sm:h-[34px]',
} as const

const GLASS =
  'border-glass-line bg-glass-strong text-ink shadow-[inset_0_1px_0_var(--glass-edge),var(--lift)] ' +
  'backdrop-blur-md backdrop-saturate-[180%] hover:bg-bg-elev'

const VARIANT = {
  /** The default: a glass pill. Arrange, Upload PDF, Edit limits. */
  outline: GLASS,
  /** A page's primary: the ink ground with the page colour on it. Run now. */
  solid: 'border-transparent bg-ink text-bg shadow-[var(--lift)] hover:bg-ink-2',
  /** A flow's primary: the action colour with a top highlight. Continue, Save. */
  accent:
    'border-transparent bg-[linear-gradient(180deg,color-mix(in_srgb,var(--action)_88%,white)_0%,var(--action)_100%)] text-action-fg ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_6px_16px_color-mix(in_srgb,var(--action)_35%,transparent)] hover:bg-[var(--action)]',
  /** Selected: the soft action fill. Never opacity. */
  brand: 'border-transparent bg-brand-soft text-ink',
  quiet: 'border-transparent text-ink-3 hover:bg-glass hover:text-ink',
  danger: 'border-transparent text-bad hover:bg-bad/10',
} as const

export type ActionButtonVariant = keyof typeof VARIANT
export type ActionButtonSize = keyof typeof SIZE

export function ActionButton({
  variant = 'outline',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: ActionButtonVariant; size?: ActionButtonSize }) {
  return (
    <button type={type} className={cn(BASE, SIZE[size], VARIANT[variant], className)} {...props} />
  )
}

export { BASE as actionButtonBase, SIZE as actionButtonSizes, VARIANT as actionButtonVariants }
