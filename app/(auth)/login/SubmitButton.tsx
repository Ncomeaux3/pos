'use client'

import { useFormStatus } from 'react-dom'
import { ActionButton } from '@/components/pos'

/**
 * Label flips while the action is in flight, as the prototype does.
 *
 * Sized rather than full width: the artboard's is a 190px button on the right
 * of the form, which reads as one action among the card's lines rather than as
 * a bar across the bottom of it.
 */
export function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus()
  return (
    <ActionButton
      size="lg"
      variant="solid"
      type="submit"
      disabled={pending}
      className="min-w-[190px]"
    >
      {pending ? busy : idle}
    </ActionButton>
  )
}
