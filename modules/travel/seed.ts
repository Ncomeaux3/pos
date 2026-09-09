import { db } from '@/core/db'
import { register } from '@/core/entities'

// Synthetic rows for `pnpm setup --demo`. Upserts on external_id so running it
// twice does not duplicate. Nothing here is personal; this ships in the template.
//
// Coordinates are real so the globe shows a real spread. The places are chosen
// across four continents, because a globe whose dots all sit in one hemisphere
// does not show that it spins.

const TRIPS = [
  {
    external_id: 'trip-tokyo',
    name: 'Tokyo, November',
    destination: 'Tokyo',
    lat: 35.69,
    lon: 139.69,
    startsIn: 54,
    days: 9,
    budget: 480_000,
    travellers: 2,
    status: 'booked' as const,
    items: [
      { kind: 'flight' as const, title: 'SFO to HND', detail: 'Seat 34K', day: 0, at: '11:05', cents: 151_000, status: 'confirmed' as const },
      { kind: 'lodging' as const, title: 'Check in, Shibuya', detail: '8 nights', day: 1, at: '15:00', cents: 138_000, status: 'confirmed' as const },
      { kind: 'activity' as const, title: 'Market walk', detail: 'Guided, 3h', day: 2, at: '09:00', cents: 18_000, status: 'confirmed' as const },
      { kind: 'transit' as const, title: 'Train to Kyoto', detail: 'Reserved car 7', day: 4, at: '08:12', cents: 0, status: 'confirmed' as const },
      // Two parsed from booking emails, waiting in the inbox. This is the whole
      // reason the inbox tab has anything in it.
      { kind: 'lodging' as const, title: 'Check in, Kyoto', detail: '2 nights, prepaid', day: 4, at: '15:00', cents: 78_000, status: 'pending' as const, confidence: 0.94 },
      { kind: 'activity' as const, title: 'Museum tickets, 2', detail: 'E-tickets attached', day: 3, at: '14:00', cents: 5_600, status: 'pending' as const, confidence: 0.88 },
    ],
    packing: ['Passport', 'Rail pass', 'Rain shell', 'Layers', 'Walking shoes', 'Power adapter'],
  },
  {
    external_id: 'trip-denver',
    name: 'Denver, ski weekend',
    destination: 'Denver',
    lat: 39.74,
    lon: -104.99,
    startsIn: 131,
    days: 4,
    budget: 190_000,
    travellers: 4,
    status: 'planned' as const,
    items: [
      { kind: 'flight' as const, title: 'SFO to DEN', detail: 'Group of 4', day: 0, at: '07:40', cents: 39_800, status: 'confirmed' as const },
    ],
    packing: ['Ski pants', 'Goggles', 'Base layers', 'Season pass'],
  },
  {
    external_id: 'trip-reykjavik',
    name: 'Reykjavik, someday',
    destination: 'Reykjavik',
    lat: 64.15,
    lon: -21.94,
    startsIn: null,
    days: 0,
    budget: 0,
    travellers: 2,
    status: 'idea' as const,
    items: [],
    packing: [],
  },
]

/** Where the owner has been. Four continents, so the globe is worth spinning. */
const PLACES = [
  { external_id: 'place-lisbon', name: 'Lisbon', country: 'Portugal', lat: 38.72, lon: -9.14, daysAgo: 330 },
  { external_id: 'place-mexico', name: 'Mexico City', country: 'Mexico', lat: 19.43, lon: -99.13, daysAgo: 540 },
  { external_id: 'place-austin', name: 'Austin', country: 'United States', lat: 30.27, lon: -97.74, daysAgo: 102 },
  { external_id: 'place-seoul', name: 'Seoul', country: 'South Korea', lat: 37.57, lon: 126.98, daysAgo: 700 },
  { external_id: 'place-capetown', name: 'Cape Town', country: 'South Africa', lat: -33.92, lon: 18.42, daysAgo: 900 },
  { external_id: 'place-vancouver', name: 'Vancouver', country: 'Canada', lat: 49.28, lon: -123.12, daysAgo: 1200 },
]

const LOYALTY = [
  { name: 'Airline A miles', kind: 'airline' as const, balance: 84_200, tier: 'Silver' },
  { name: 'Airline B miles', kind: 'airline' as const, balance: 21_450, tier: '' },
  { name: 'Hotel points', kind: 'hotel' as const, balance: 132_000, tier: 'Gold' },
  { name: 'Card points', kind: 'card' as const, balance: 96_800, tier: '' },
]

export async function seed(): Promise<number> {
  for (const trip of TRIPS) {
    const { rows } = await db().query<{ id: string }>(
      `insert into travel.trip
         (name, destination, lat, lon, starts_on, ends_on, budget_cents, travellers,
          status, source, external_id)
       values ($1, $2, $3, $4,
               case when $5::int is null then null else core.today() + $5::int end,
               case when $5::int is null then null else core.today() + $5::int + $6::int end,
               $7, $8, $9, 'demo', $10)
       on conflict (source, external_id) do update
         set name = excluded.name, status = excluded.status,
             starts_on = excluded.starts_on, ends_on = excluded.ends_on
       returning id`,
      [
        trip.name,
        trip.destination,
        trip.lat,
        trip.lon,
        trip.startsIn,
        trip.days,
        trip.budget,
        trip.travellers,
        trip.status,
        trip.external_id,
      ],
    )
    const tripId = rows[0].id

    for (const [i, item] of trip.items.entries()) {
      await db().query(
        `insert into travel.itinerary_item
           (trip_id, kind, title, detail, occurs_on, occurs_at, amount_cents,
            status, confidence, source, external_id)
         values ($1, $2, $3, $4, core.today() + $5::int, $6, $7, $8, $9, 'demo', $10)
         on conflict (source, external_id) do update
           set status = excluded.status, amount_cents = excluded.amount_cents`,
        [
          tripId,
          item.kind,
          item.title,
          item.detail,
          (trip.startsIn ?? 0) + item.day,
          item.at,
          item.cents,
          item.status,
          'confidence' in item ? item.confidence : null,
          `${trip.external_id}-item-${i}`,
        ],
      )
    }

    // Packing has no external_id, so it is cleared and rewritten. It is a
    // checklist, not a record, and nothing outside the trip points at a row.
    await db().query(`delete from travel.packing_item where trip_id = $1`, [tripId])
    for (const [i, label] of trip.packing.entries()) {
      await db().query(
        `insert into travel.packing_item (trip_id, label, packed, position)
         values ($1, $2, $3, $4)`,
        [tripId, label, i < 2, i],
      )
    }

    await register({
      module: 'travel',
      entityType: 'trip',
      entityId: tripId,
      title: trip.name,
      text: trip.destination,
    })
  }

  for (const place of PLACES) {
    await db().query(
      `insert into travel.place_visited
         (name, country, lat, lon, visited_on, source, external_id)
       values ($1, $2, $3, $4, core.today() - $5::int, 'demo', $6)
       on conflict (source, external_id) do update set visited_on = excluded.visited_on`,
      [place.name, place.country, place.lat, place.lon, place.daysAgo, place.external_id],
    )
  }

  for (const program of LOYALTY) {
    await db().query(
      `insert into travel.loyalty_program (name, kind, balance, status_tier)
       values ($1, $2, $3, $4)
       on conflict (name) do update set balance = excluded.balance`,
      [program.name, program.kind, program.balance, program.tier],
    )
  }

  return TRIPS.length + PLACES.length
}
