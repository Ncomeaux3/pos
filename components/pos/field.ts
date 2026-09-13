// This lives alone, apart from edit.tsx, because the login page is a server
// component and interpolates this string. A client module's exports become
// client references in a production build, so the string turned into a
// function and the input's class was a thrown-error message.

/** The one input style. Forms across every screen use it. */
export const fieldClass =
  'w-full rounded-md border border-rule-2 bg-bg-deep px-2.5 py-2 text-sm text-ink outline-none ' +
  'placeholder:text-ink-4 focus-visible:border-brand'
