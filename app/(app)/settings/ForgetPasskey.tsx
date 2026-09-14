'use client'

import { useTransition } from 'react'
import { ActionButton, useToast } from '@/components/pos'
import { forgetPasskey } from './passkeys'

export function ForgetPasskey({ id }: { id: string }) {
  const [, start] = useTransition()
  const toast = useToast()

  return (
    <ActionButton
      onClick={() =>
        start(async () => {
          const result = await forgetPasskey(id)
          toast(result.ok ? 'Passkey removed.' : result.error)
        })
      }
    >
      Remove
    </ActionButton>
  )
}
