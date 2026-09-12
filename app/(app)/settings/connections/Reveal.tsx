'use client'

import { useState } from 'react'

/** The webhook's shared secret: dots until asked for, so it is not on a screen left open. */
export function Reveal({ value }: { value: string }) {
  const [shown, setShown] = useState(false)
  return (
    <span className="flex items-center gap-2.5">
      <span className="num break-all text-[11px] text-ink-2">{shown ? value : '••••••••••••••••'}</span>
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="num shrink-0 border border-rule-2 px-[7px] py-[3px] text-[10px] tracking-[0.08em] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink"
      >
        {shown ? 'HIDE' : 'REVEAL'}
      </button>
    </span>
  )
}
