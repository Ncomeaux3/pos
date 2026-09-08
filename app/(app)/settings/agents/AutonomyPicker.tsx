'use client'

import { useTransition } from 'react'
import { PillGroup, useToast } from '@/components/pos'
import { AUTONOMY_LABELS, type Autonomy } from '@/core/autonomy'
import { setAutonomy } from './actions'

const OPTIONS = (Object.keys(AUTONOMY_LABELS) as Autonomy[]).map((value) => ({
  value,
  label: AUTONOMY_LABELS[value],
}))

export function AutonomyPicker({ value }: { value: Autonomy }) {
  const [pending, start] = useTransition()
  const toast = useToast()

  return (
    <PillGroup
      label="Agent autonomy"
      value={value}
      options={OPTIONS.map((o) => ({ ...o, disabled: pending }))}
      onChange={(next) =>
        start(async () => {
          await setAutonomy(next)
          toast(`Autonomy: ${AUTONOMY_LABELS[next]}`)
        })
      }
    />
  )
}
