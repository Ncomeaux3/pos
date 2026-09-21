// The button's class tables, apart from Button.tsx so a server component can
// build a link that looks like a button. Same reason as field.ts: a client
// module's exports become client references in a production build, and a
// string interpolated from one is a thrown error, not a class list.

export const BASE =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border font-medium leading-none ' +
  'transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-[var(--ease)] active:scale-[.97] ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'

export const SIZE = {
  sm: 'h-11 px-3 text-[11px] sm:h-6 sm:px-2.5',
  md: 'h-11 px-4 text-[13px] sm:h-9',
  lg: 'h-11 px-[22px] text-[14px]',
  xl: 'h-12 px-6 text-[15px]',
  pill: 'h-11 px-[13px] text-[12.5px] sm:h-[34px]',
} as const

// A solid fill with the kit border, not glass: on the owner's monitor the
// glass pill's 8% hairline read as a label, not a control (v1.2 phase 3a).
// No backdrop-blur either way: this is the one surface that sits on every
// tap (Snooze, Dismiss, Approve...), and a blur layer under
// active:scale-[.97] is a recomposite on every press.
const SECONDARY = 'border-rule-2 bg-bg-elev text-ink shadow-[var(--lift)] hover:bg-bg-deep'

export const VARIANT = {
  /** The default: a bordered pill. Arrange, Upload PDF, Edit limits. */
  outline: SECONDARY,
  /** A page's primary: the ink ground with the page colour on it. Run now. */
  solid: 'border-transparent bg-ink text-bg shadow-[var(--lift)] hover:bg-ink-2',
  /** A flow's primary: the action colour with a top highlight. Continue, Save. */
  accent:
    'border-transparent bg-[linear-gradient(180deg,color-mix(in_srgb,var(--action)_88%,white)_0%,var(--action)_100%)] text-action-fg ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_6px_16px_color-mix(in_srgb,var(--action)_35%,transparent)] hover:bg-[var(--action)]',
  /** Selected: the soft action fill. Never opacity. */
  brand: 'border-transparent bg-brand-soft text-ink',
  /** Ghost: no border until hovered, so it still reads as a control. Cancel. */
  quiet: 'border-transparent text-ink-3 hover:border-rule-2 hover:bg-glass hover:text-ink',
  danger: 'border-transparent text-bad hover:bg-bad/10',
} as const

