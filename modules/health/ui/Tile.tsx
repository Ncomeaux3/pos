import type { HealthDigest } from '../jobs/nightly-digest'

// The Health dashboard tile. Appointments and anything overdue, because those
// are the two things that need a person rather than a number.

export function HealthTile({ payload }: { payload: Record<string, unknown> }) {
  const d = payload as Partial<HealthDigest>
  const upcoming = d.upcoming ?? []
  const screenings = d.screeningsDue ?? []
  const refills = d.refillsDue ?? []

  if (upcoming.length === 0 && screenings.length === 0 && refills.length === 0) {
    return <p className="t-caption text-ink-3">Nothing booked and nothing overdue.</p>
  }

  return (
    <div className="space-y-2.5">
      {upcoming.slice(0, 2).map((a) => (
        <div key={a.what} className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[14px] text-ink">{a.what}</span>
          <span className="num shrink-0 text-[11px] text-ink-3">
            {a.startsAt.slice(0, 10)}
          </span>
        </div>
      ))}
      {screenings.slice(0, 2).map((s) => (
        <div key={s.name} className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[14px] text-ink-2">{s.name}</span>
          <span className="eyebrow shrink-0 text-warn">{s.status}</span>
        </div>
      ))}
      {refills.length > 0 && (
        <p className="num text-[11px] text-ink-3">
          {refills.length} {refills.length === 1 ? 'refill' : 'refills'} due
        </p>
      )}
    </div>
  )
}
