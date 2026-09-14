'use client'

import { useEdgeBack } from './gestures'
import { useIsPhone } from './useIsPhone'

const back = () => window.history.back()

/**
 * An installed PWA on iOS has no browser edge swipe, so the app owns it: a
 * drag from the left edge past 90px goes back, mirroring the header's back
 * control. Renders nothing; phone only.
 */
export function EdgeBack() {
  const phone = useIsPhone()
  useEdgeBack(phone ? back : null)
  return null
}
