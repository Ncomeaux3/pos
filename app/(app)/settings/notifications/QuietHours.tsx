'use client'

import { useTransition } from 'react'
import { ActionButton, useToast } from '@/components/pos'
import { setQuiet } from './actions'

const timeField =
  'h-[34px] border border-rule-2 bg-bg px-2.5 text-[13px] text-ink num rounded-xl ' +
  'outline-none focus-visible:border-brand ' +
  '[&::-webkit-calendar-picker-indicator]:opacity-55 ' +
  '[&::-webkit-calendar-picker-indicator]:invert ' +
  'light:[&::-webkit-calendar-picker-indicator]:invert-0'

export function QuietHours({
  from,
  to,
  urgentOverride,
}: {
  from: string
  to: string
  urgentOverride: boolean
}) {
  const [pending, start] = useTransition()
  const toast = useToast()

  const save = (key: 'quiet_from' | 'quiet_to' | 'quiet_urgent_override', value: string | boolean) =>
    start(async () => {
      const result = await setQuiet(
        key,
        value as never,
      )
      if (!result.ok) toast(result.error)
    })

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3.5">
        <span className="text-[13px] text-ink">No push between</span>
        <input
          type="time"
          aria-label="Quiet hours start"
          defaultValue={from}
          disabled={pending}
          onBlur={(e) => save('quiet_from', e.target.value)}
          className={timeField}
        />
        <span className="text-[13px] text-ink-3">and</span>
        <input
          type="time"
          aria-label="Quiet hours end"
          defaultValue={to}
          disabled={pending}
          onBlur={(e) => save('quiet_to', e.target.value)}
          className={timeField}
        />
        <span className="text-[12px] text-ink-3">Reminders due in this window are delivered at {to}.</span>
      </div>

      <ActionButton
        variant={urgentOverride ? 'brand' : 'outline'}
        disabled={pending}
        onClick={() => save('quiet_urgent_override', !urgentOverride)}
      >
        {urgentOverride ? 'Urgent breaks through' : 'Nothing breaks through'}
      </ActionButton>

      <p className="text-[12px] text-ink-3">
        Held, not dropped: a queued alert goes out on the next run after the window closes.
        {urgentOverride
          ? ' A rule marked urgent is the exception, and there are four of them.'
          : ' Nothing is excepted right now, including a failed nightly job.'}
      </p>
    </div>
  )
}
