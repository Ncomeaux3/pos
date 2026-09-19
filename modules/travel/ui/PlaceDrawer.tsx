'use client'

import { Eyebrow, Overlay } from '@/components/pos'
import type { TravelData } from './Travel'

// A grey pin whose trip is gone, or never was: the place as itself. Every
// pin with a trip opens that trip instead, so this only shows what the row
// holds and edits nothing.

export function PlaceDrawer({ place, onClose }: { place: TravelData['places'][number]; onClose: () => void }) {
  const visited = place.visitedOn
    ? new Date(`${place.visitedOn}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'no date'
  return (
    <Overlay open onClose={onClose} eyebrow="Travel / Places" title={place.name} lede={place.country || undefined} narrow>
      <div className="grid grid-cols-2 gap-px border border-rule bg-rule rounded-[18px]">
        <div className="bg-bg px-3 py-2.5">
          <Eyebrow>Visited</Eyebrow>
          <div className="mt-1 text-[15px] text-ink">{visited}</div>
        </div>
        <div className="bg-bg px-3 py-2.5">
          <Eyebrow>Where</Eyebrow>
          <div className="mt-1 text-[15px] text-ink">
            {place.lat.toFixed(2)}, {place.lon.toFixed(2)}
          </div>
        </div>
      </div>
      <p className="mt-3.5 text-[12px] text-ink-4">This place is not part of a trip.</p>
    </Overlay>
  )
}
