'use client'

import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// The button system, measured off the prototypes rather than invented.
//
// The app had one button: 30px tall, 10px, uppercase, tracked 0.1em. The
// design has almost none of those. Every button in every artboard is sentence
// case at 11 to 15px with no tracking, and the tracked uppercase treatment is
// reserved for the theme toggle and for labels that are not buttons at all.
// One control shape rendered everywhere is the single biggest reason the built
// screens read differently from the design.
//
//   sm   h23, 3px 8px,  11px  inline row actions: Snooze, Approve, Dismiss
//   md   h35, 8px 12px, 12px  the default: Arrange, Upload PDF, Edit limits
//   lg   h46, 0 22px,   14px  a flow's primary: Continue, Start the review
//   xl   h51, 14px 22px, 15px/500  a page's primary: Run now, Add policy
//   pill h34, 0 13px,   12px  segmented options and filter chips
//
// Touch targets: sm and md are below the 44px the design asks for on mobile,
// so both grow to 44px on a coarse pointer and shrink at `sm` where a mouse is
// the likely input. lg and xl already clear it.

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 border leading-none ' +
  'transition-colors duration-150 active:scale-[.985] ' +
  'disabled:cursor-not-allowed disabled:text-ink-4'

const SIZE = {
  sm: 'h-11 px-2 text-[11px] sm:h-[23px] sm:px-2 sm:py-[3px]',
  md: 'h-11 px-3 text-[12px] sm:h-[35px]',
  lg: 'h-[46px] px-[22px] text-[14px]',
  xl: 'h-[51px] px-[22px] text-[15px] font-medium',
  pill: 'h-11 px-[13px] text-[12px] sm:h-[34px]',
} as const

const VARIANT = {
  /** 1px rule-2, ink-2. Arrange, Upload PDF, Edit limits. */
  outline: 'border-rule-2 text-ink-2 hover:border-ink hover:text-ink',
  /** A page's primary: the ink ground with the page colour on it. Run now. */
  solid: 'border-ink bg-ink text-bg hover:border-ink-2 hover:bg-ink-2',
  /** A flow's primary: filled accent, white text. Continue, Start the review. */
  accent: 'border-brand bg-brand text-white hover:brightness-110',
  /** Selected: 1px accent and the soft fill. Never opacity. */
  brand: 'border-brand bg-brand-soft text-ink',
  quiet: 'border-transparent text-ink-3 hover:text-ink',
  danger: 'border-bad/60 text-bad hover:border-bad',
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
