'use client'

import { useState } from 'react'

/** Puts a value on the clipboard: the inbound URL and secret are typed into a phone app, never by hand. */
export function Copy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="num shrink-0 border border-rule-2 px-[7px] py-[3px] text-[10px] tracking-[0.08em] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink"
    >
      {copied ? 'COPIED' : 'COPY'}
    </button>
  )
}
