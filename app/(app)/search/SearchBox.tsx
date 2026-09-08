'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * The box rises once there is a query: tall and centred on an empty search,
 * a normal field once results are on screen. It is a real form, so Enter works
 * and the URL carries the query, which makes a search linkable.
 */
export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(initial)
  const has = initial.length > 0

  function submit(next: string) {
    const q = next.trim()
    const search = new URLSearchParams(params.toString())
    if (q) search.set('q', q)
    else search.delete('q')
    // A new query invalidates the module filter: the old scope may have no hits.
    if (q !== initial) search.delete('module')
    router.push(`/search?${search.toString()}`)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(value)
      }}
      className={cn('transition-[padding] duration-300', has ? 'pt-0' : 'pt-[14vh]')}
    >
      <div className="flex items-center gap-3 rounded-lg border border-rule-2 bg-bg-deep px-4 focus-within:border-brand">
        <span aria-hidden className="code text-ink-4">
          &gt;
        </span>
        <input
          autoFocus
          name="q"
          aria-label="Search everything"
          placeholder="Search everything"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={cn(
            'w-full bg-transparent py-4 text-ink outline-none placeholder:text-ink-4',
            has ? 'text-[17px]' : 'text-[22px]',
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              submit('')
            }}
            className="label shrink-0 text-[10px] tracking-[0.1em] text-ink-3 hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  )
}
