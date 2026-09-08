'use client'

import { useTransition } from 'react'
import { ActionButton, useToast } from '@/components/pos'
import { updateSchedule } from './actions'

/**
 * The master switch. Rules keep their own mute and snooze underneath it, so
 * resuming puts the set back exactly as it was rather than turning everything
 * on.
 */
export function PauseAll({ paused }: { paused: boolean }) {
  const [pending, start] = useTransition()
  const toast = useToast()

  return (
    <ActionButton
      variant={paused ? 'brand' : 'outline'}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await updateSchedule('notifications_paused', !paused)
          if (!result.ok) toast(result.error)
          else toast(paused ? 'Notifications resumed' : 'Everything paused. Rules keep their state.')
        })
      }
    >
      {paused ? 'Resume all' : 'Pause all'}
    </ActionButton>
  )
}
