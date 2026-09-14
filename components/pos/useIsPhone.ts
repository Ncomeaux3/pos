'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 767px)'

/**
 * True below md. True on the server and on the first client render, so the
 * phone is what hydrates and the desktop takes over on the pass after.
 *
 * Only for a section that must not render at all on one width. Everything that
 * can be a `md:` class is a `md:` class.
 */
export function useIsPhone() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(QUERY)
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => window.matchMedia(QUERY).matches,
    () => true,
  )
}
