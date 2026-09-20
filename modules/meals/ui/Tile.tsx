import { Eyebrow } from '@/components/pos'
import type { MealsDigest } from '../jobs/nightly-digest'

// The Meals dashboard tile. Gaps in the week, because an empty slot is the
// thing that needs a decision.

export function MealsTile({ payload }: { payload: Record<string, unknown> }) {
  const d = payload as Partial<MealsDigest>
  const gaps = d.gaps ?? 0

  return (
    <div className="space-y-3">
      <div>
        <Eyebrow className="block text-ink-3">Gaps in the next week</Eyebrow>
        <span className="num block text-[26px] font-light leading-tight text-ink">{gaps}</span>
        <span className="num text-[11px] text-ink-3">
          {d.plannedThisWeek ?? 0} planned · {d.eatenThisWeek ?? 0} eaten
        </span>
      </div>
      {d.kcalTarget ? (
        <p className="num text-[11px] text-ink-3">
          {d.kcalEaten ?? 0} of {d.kcalTarget} kcal · {d.kcalStanding}
        </p>
      ) : null}
    </div>
  )
}
