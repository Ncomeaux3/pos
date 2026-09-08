'use client'

import { useTransition } from 'react'
import { ActionButton, useToast } from '@/components/pos'
import { runNow } from './run-now'

export function RunNow() {
  const [pending, start] = useTransition()
  const toast = useToast()

  return (
    <ActionButton
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await runNow()
          toast(
            result.failed > 0
              ? `Run ${result.status}, ${result.failed} job${result.failed === 1 ? '' : 's'} failed`
              : 'Run clean',
          )
        })
      }
    >
      {pending ? 'Running' : 'Run now'}
    </ActionButton>
  )
}
