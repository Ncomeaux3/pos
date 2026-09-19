// This lives alone, apart from edit.tsx, because the login page is a server
// component and interpolates this string. A client module's exports become
// client references in a production build, so the string turned into a
// function and the input's class was a thrown-error message.

/** The one input style. Forms across every screen use it. */
export const fieldClass =
  'w-full rounded-xl border border-glass-line bg-field px-3.5 py-2.5 text-[16px] text-ink outline-none md:text-sm ' +
  'shadow-[inset_0_1px_2px_rgba(0,0,0,.04)] placeholder:text-ink-4 ' +
  'focus-visible:border-action focus-visible:bg-bg-elev focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]'
