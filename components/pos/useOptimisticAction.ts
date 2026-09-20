'use client'

import { useOptimistic, useTransition } from 'react'
import { useToast } from './Toast'

type Result = { ok: true } | { ok: false; error: string }

/**
 * The apply-then-await-then-toast-on-failure shape SkillPicker and Board
 * already hand-roll with useOptimistic + useTransition, pulled out once
 * because the switches and pill groups under Settings and Notifications
 * repeat it. `reducer` is the same one useOptimistic takes: an identity
 * replace for a value bound 1:1 to a server prop (a switch, a pill group),
 * or a real patch for a list-wide flip (Mark all read).
 *
 * Revert on failure is implicit, the same way it already is in SkillPicker
 * and Board: the server prop only changes when the action calls
 * revalidatePath, so a failed action leaves it stale and the optimistic
 * value snaps back once the transition settles.
 */
export function useOptimisticAction<S, P, R extends Result = Result>(
  value: S,
  reducer: (state: S, patch: P) => S,
) {
  const [state, apply] = useOptimistic(value, reducer)
  const [, start] = useTransition()
  const toast = useToast()
  const run = (patch: P, action: () => Promise<R>) =>
    start(async () => {
      apply(patch)
      const result = await action()
      if (!result.ok) toast(result.error)
    })
  return [state, run] as const
}
