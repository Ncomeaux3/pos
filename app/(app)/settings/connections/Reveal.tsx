'use client'

import { useState } from 'react'
import { ActionButton } from '@/components/pos'
import { Copy } from './Copy'

/** The webhook's shared secret: dots until asked for, so it is not on a screen left open. */
export function Reveal({ value }: { value: string }) {
  const [shown, setShown] = useState(false)
  return (
    <span className="flex items-center justify-between gap-2.5">
      <span className="num min-w-0 flex-1 break-all text-[12px] text-ink-2">
        {shown ? value : '••••••••••••••••'}
      </span>
      <ActionButton size="sm" onClick={() => setShown((s) => !s)}>
        {shown ? 'Hide' : 'Reveal'}
      </ActionButton>
      <Copy value={value} />
    </span>
  )
}
