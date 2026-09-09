import { db } from '@/core/db'

// Reads for the screen and the digest. The projection and the cents per point
// arithmetic live in ./globe.ts, which has no imports and can be pulled into a
// client component.

export type TripRow = {
  id: string
  name: string
  destination: string
  lat: string | null
  lon: string | null
  starts_on: string | null
  ends_on: string | null
  budget_cents: string
  travellers: number
  status: string
  notes: string
  spent_cents: string
  item_count: string
  pending_count: string
  packed: string
  to_pack: string
}

/**
 * Every trip with what it has cost so far and how the packing is going.
 *
 * Spend is summed from the itinerary rather than stored on the trip: a booking
 * cancelled is a row removed, and a denormalised total would have to be kept
 * honest by something. Nothing here is big enough for that to be slow.
 */
export async function listTrips(): Promise<TripRow[]> {
  const { rows } = await db().query<TripRow>(
    `select t.id, t.name, t.destination, t.lat::text, t.lon::text,
            t.starts_on::text, t.ends_on::text, t.budget_cents::text,
            t.travellers, t.status, t.notes,
            coalesce(sum(i.amount_cents) filter (where i.status = 'confirmed'), 0)::text
              as spent_cents,
            count(i.id) filter (where i.status = 'confirmed')::text as item_count,
            count(i.id) filter (where i.status = 'pending')::text as pending_count,
            (select count(*)::text from travel.packing_item p
              where p.trip_id = t.id and p.packed) as packed,
            (select count(*)::text from travel.packing_item p where p.trip_id = t.id) as to_pack
       from travel.trip t
       left join travel.itinerary_item i on i.trip_id = t.id
      group by t.id
      order by
        -- Upcoming first, then ideas, then what is over. A past trip is a
        -- record; an upcoming one is a thing you still have to do.
        case t.status when 'booked' then 0 when 'planned' then 1
                      when 'idea' then 2 else 3 end,
        t.starts_on nulls last`,
  )
  return rows
}

export type ItineraryRow = {
  id: string
  trip_id: string
  kind: string
  title: string
  detail: string
  occurs_on: string | null
  occurs_at: string | null
  amount_cents: string
  confirmation: string
  status: string
  confidence: string | null
}

export async function listItinerary(tripId?: string): Promise<ItineraryRow[]> {
  const { rows } = await db().query<ItineraryRow>(
    `select id, trip_id, kind, title, detail, occurs_on::text, occurs_at::text,
            amount_cents::text, confirmation, status, confidence::text
       from travel.itinerary_item
      where ($1::uuid is null or trip_id = $1)
      order by occurs_on nulls last, occurs_at nulls last`,
    [tripId ?? null],
  )
  return rows
}

export async function listPacking(tripId?: string): Promise<
  { id: string; trip_id: string; label: string; packed: boolean }[]
> {
  const { rows } = await db().query<{
    id: string
    trip_id: string
    label: string
    packed: boolean
  }>(
    `select id, trip_id, label, packed from travel.packing_item
      where ($1::uuid is null or trip_id = $1)
      order by packed, position, label`,
    [tripId ?? null],
  )
  return rows
}

export type PlaceRow = {
  id: string
  name: string
  country: string
  lat: string
  lon: string
  visited_on: string | null
}

export async function listPlaces(): Promise<PlaceRow[]> {
  const { rows } = await db().query<PlaceRow>(
    `select id, name, country, lat::text, lon::text, visited_on::text
       from travel.place_visited order by visited_on desc nulls last`,
  )
  return rows
}

export async function listLoyalty(): Promise<
  { id: string; name: string; kind: string; balance: number; status_tier: string; updated_at: Date }[]
> {
  const { rows } = await db().query<{
    id: string
    name: string
    kind: string
    balance: number
    status_tier: string
    updated_at: Date
  }>(
    `select id, name, kind, balance, status_tier, updated_at
       from travel.loyalty_program order by kind, name`,
  )
  return rows
}
