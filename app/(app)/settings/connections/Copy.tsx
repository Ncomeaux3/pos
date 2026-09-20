'use client'

import { useState } from 'react'
import { ActionButton } from '@/components/pos'

/** Puts a value on the clipboard: the inbound URL and secret are typed into a phone app, never by hand. */
export function Copy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <ActionButton
      size="sm"
      variant={copied ? 'brand' : 'outline'}
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </ActionButton>
  )
}
