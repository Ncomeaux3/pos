'use client'

import { useFormStatus } from 'react-dom'
import { MonoButton } from '@/components/pos'

/** Label flips while the action is in flight, as the prototype does. */
export function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus()
  return (
    <MonoButton variant="solid" type="submit" disabled={pending} className="w-full">
      {pending ? busy : idle}
    </MonoButton>
  )
}
