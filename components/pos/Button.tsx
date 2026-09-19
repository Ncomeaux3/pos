'use client'

import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { BASE, SIZE, VARIANT } from './button-classes'

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
