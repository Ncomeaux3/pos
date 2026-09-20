import { Eyebrow } from '@/components/pos'
import type { TravelDigest } from '../jobs/nightly-digest'

// The Travel dashboard tile. The next trip and how far away it is, which is
// the only travel question worth asking most mornings.

export function TravelTile({ payload }: { payload: Record<string, unknown> }) {
  const d = payload as Partial<TravelDigest>
  const next = d.next ?? null

  if (!next) {
    return (
      <div className="space-y-2">
        <p className="t-caption text-ink-3">Nothing booked.</p>
        <p className="num text-[11px] text-ink-3">
          {d.placesVisited ?? 0} places · {d.countries ?? 0} countries
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <Eyebrow className="block text-ink-3">Next trip</Eyebrow>
        <span className="block text-[17px] text-ink">{next.destination}</span>
        <span className="num text-[11px] text-ink-3">
          {next.name} · {next.daysAway} days away
        </span>
      </div>
      <p className="num text-[11px] text-ink-3">
        {d.pending ? `${d.pending} bookings waiting · ` : ''}
        {d.placesVisited ?? 0} places · {d.countries ?? 0} countries
      </p>
    </div>
  )
}
