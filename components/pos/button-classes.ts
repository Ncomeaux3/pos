// The button's class tables, apart from Button.tsx so a server component can
// build a link that looks like a button. Same reason as field.ts: a client
// module's exports become client references in a production build, and a
// string interpolated from one is a thrown error, not a class list.

export const BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border font-medium leading-none ' +
  'transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-[var(--ease)] active:scale-[.97] ' +
  'disabled:cursor-not-allowed disabled:text-ink-4 disabled:shadow-none'

export const SIZE = {
  sm: 'h-11 px-3 text-[11px] sm:h-6 sm:px-2.5',
  md: 'h-11 px-4 text-[13px] sm:h-9',
  lg: 'h-11 px-[22px] text-[14px]',
  xl: 'h-12 px-6 text-[15px]',
  pill: 'h-11 px-[13px] text-[12.5px] sm:h-[34px]',
} as const

// No backdrop-blur here: bg-glass-strong is already ~80% opaque, and this is
// the one glass surface that sits on every tap (Snooze, Dismiss, Approve...).
// A blur layer under active:scale-[.97] is a recomposite on every press; the
// cards, lists and tab bar keep theirs, since those don't move on a tap.
const GLASS = 'border-glass-line bg-glass-strong text-ink shadow-[inset_0_1px_0_var(--glass-edge),var(--lift)] hover:bg-bg-elev'

export const VARIANT = {
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

