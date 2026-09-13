'use client'

import { useRouter, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation'
import { useSyncExternalStore } from 'react'

// The search params as UI state: which tab, which drawer, which row is open.
//
// The URL changes at once and the screen follows on the next render; the
// router fetches behind them, queued in order with any server action so the
// data it brings is fresh. A drawer opens within a frame and its list
// refreshes behind it.

// What was asked for, and the router's params at the time. Once the router
// hands out a new object it has caught up and the override is spent. One
// store, not one per hook: the button that opens a sheet and the component
// that renders it are often not the same one.
let override: { search: URLSearchParams; over: ReadonlyURLSearchParams } | null = null
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const snapshot = () => override

export function useSearchState() {
  const params = useSearchParams()
  const router = useRouter()
  const pending = useSyncExternalStore(subscribe, snapshot, snapshot)
  const current = pending && pending.over === params ? pending.search : params

  /**
   * Merge `next` into the URL. A null value removes the key.
   *
   * `push` adds a history entry, so the phone's Back closes what was opened.
   * Use it for sheets and drawers; tabs, views and modes inside a drawer
   * replace, so Back leaves the page rather than walking through every
   * segment visited.
   */
  const set = (next: Record<string, string | null>, options: { push?: boolean } = {}) => {
    const search = new URLSearchParams(current.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
    override = { search, over: params }
    for (const fn of listeners) fn()
    const query = search.toString()
    const url = `${window.location.pathname}${query ? `?${query}` : ''}`
    // The URL changes now, not when the fetch lands: a reload or a share in
    // between must find the drawer. Writing it with the router's own history
    // state attached makes the router treat the entry as one of its own, so it
    // does not restore a cached page for it; the navigation below fetches the
    // data and settles the entry on commit. Before hydration there is no such
    // state, and the router does the whole thing itself.
    const own = window.history.state?.__NA ? window.history.state : null
    if (own) {
      if (options.push) window.history.pushState(own, '', url)
      else window.history.replaceState(own, '', url)
      router.replace(url, { scroll: false })
    } else if (options.push) router.push(url, { scroll: false })
    else router.replace(url, { scroll: false })
  }

  return { params: current, set }
}
