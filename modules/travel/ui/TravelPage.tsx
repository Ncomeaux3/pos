import { PageHeader } from '@/components/pos'
import { ownerToday } from '@/core/today'
import { listItinerary, listLoyalty, listPacking, listPlaces, listTrips } from '../data'
import { Travel, type TravelData } from './Travel'

export default async function TravelPage() {
  const [trips, itinerary, packing, places, loyalty, todayIso] = await Promise.all([
    listTrips(),
    listItinerary(),
    listPacking(),
    listPlaces(),
    listLoyalty(),
    ownerToday(),
  ])

  const data: TravelData = {
    todayIso,
    trips: trips.map((t) => ({
      id: t.id,
      name: t.name,
      destination: t.destination,
      startsOn: t.starts_on,
      endsOn: t.ends_on,
      budgetCents: Number(t.budget_cents),
      spentCents: Number(t.spent_cents),
      travellers: t.travellers,
      status: t.status,
      notes: t.notes,
      itemCount: Number(t.item_count),
      pendingCount: Number(t.pending_count),
      packed: Number(t.packed),
      toPack: Number(t.to_pack),
    })),
    itinerary: itinerary.map((i) => ({
      id: i.id,
      tripId: i.trip_id,
      kind: i.kind,
      title: i.title,
      detail: i.detail,
      occursOn: i.occurs_on,
      occursAt: i.occurs_at === null ? null : i.occurs_at.slice(0, 5),
      amountCents: Number(i.amount_cents),
      confirmation: i.confirmation,
      status: i.status,
      confidence: i.confidence === null ? null : Number(i.confidence),
    })),
    packing: packing.map((p) => ({
      id: p.id,
      tripId: p.trip_id,
      label: p.label,
      packed: p.packed,
    })),
    places: places.map((p) => ({
      id: p.id,
      name: p.name,
      country: p.country,
      lat: Number(p.lat),
      lon: Number(p.lon),
      visitedOn: p.visited_on,
    })),
    loyalty: loyalty.map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind,
      balance: l.balance,
      statusTier: l.status_tier,
      updatedAt: new Date(l.updated_at).toISOString(),
    })),
  }

  const upcoming = data.trips.filter((t) => t.status === 'planned' || t.status === 'booked').length
  const waiting = data.trips.reduce((sum, t) => sum + t.pendingCount, 0)
  const countries = new Set(data.places.map((p) => p.country).filter(Boolean)).size

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`Travel / ${upcoming} upcoming / ${countries} countries`}
        dot={waiting > 0 ? 'warn' : 'brand'}
        title="Travel"
        lede="Trips, what they cost, and where you have been. A booking parsed from an email waits to be accepted; loyalty balances are numbers you type, because no loyalty site is scraped."
        actions={
          <span className="num text-[11px] text-ink-3">
            {data.places.length} place{data.places.length === 1 ? '' : 's'}
          </span>
        }
      />
      <Travel data={data} />
    </div>
  )
}
