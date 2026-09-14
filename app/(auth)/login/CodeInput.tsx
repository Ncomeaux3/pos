'use client'

import { useState } from 'react'
import { normalizeCode } from '@/core/otp'

/**
 * The six digit field. One input rather than six boxes: six boxes need focus
 * management, paste splitting and backspace handling to behave, and a phone
 * keyboard fills a single field correctly without any of it.
 *
 * autoComplete one-time-code is what makes iOS offer the code above the
 * keyboard instead of making the owner switch to Mail and back.
 *
 * It submits itself on the sixth digit. The code is the whole form, so a Sign
 * in button pressed after it is a second tap for nothing. The button stays for
 * the keyboard, for a paste that does not fire the same events, and for anyone
 * the autosubmit misses.
 */
export function CodeInput({ invalid }: { invalid: boolean }) {
  const [code, setCode] = useState('')

  return (
    <input
      id="code"
      name="code"
      // Not type="number": a spinner, a scroll wheel that changes the value,
      // and a leading zero that some browsers drop.
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      autoFocus
      required
      placeholder="000000"
      aria-invalid={invalid || undefined}
      value={code}
      onChange={(event) => {
        const next = normalizeCode(event.target.value)
        setCode(next)
        if (next.length === 6) event.target.form?.requestSubmit()
      }}
      className={
        'num w-full rounded-md border bg-bg-deep px-3 py-3 text-center text-[26px] tracking-[0.34em] ' +
        'text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand ' +
        (invalid ? 'border-bad' : 'border-rule-2')
      }
    />
  )
}
