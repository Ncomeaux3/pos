import { db } from '@/core/db'
import { register } from '@/core/entities'

// Synthetic rows for `pnpm setup --demo`. Upserts on external_id so running it
// twice does not duplicate. Nothing here is personal; this ships in the
// template, so the address, the plates and the phone numbers are invented.

type Asset = {
  external_id: string
  kind: 'property' | 'vehicle' | 'equipment'
  name: string
  subtitle: string
  valueCents: number
  annualCostCents: number
  facts: [string, string][]
}

const ASSETS: Asset[] = [
  {
    external_id: 'a-house',
    kind: 'property',
    name: '2412 Example Street',
    subtitle: 'Austin, TX / 2,140 sq ft / built 1994 / owned since 2019',
    valueCents: 68_400_000,
    annualCostCents: 1_428_000,
    facts: [
      ['Purchase price', '$438,000 in Jun 2019'],
      ['Estimated value', '$684,000, your own figure'],
      ['Annual carrying cost', '$14,280 tax, insurance and upkeep'],
      ['Property tax', '$9,840 on the 2026 assessment'],
      ['Roof', 'Composite, replaced 2016, about 14 years left'],
      ['HVAC', 'Four ton, installed 2018'],
      ['Water heater', '50 gallon, installed 2021'],
    ],
  },
  {
    external_id: 'a-truck',
    kind: 'vehicle',
    name: '2021 pickup',
    subtitle: '68,420 mi / owned outright',
    valueCents: 3_480_000,
    annualCostCents: 394_000,
    facts: [
      ['Purchase', '$44,200 in Mar 2021'],
      ['Mileage', '68,420, about 11,000 a year'],
      ['Annual cost', '$3,940 fuel, insurance and service'],
      ['Registration', 'Renews Mar 2027'],
      ['Tyres', '62% tread'],
      ['Next major', '90k service, estimated $1,100'],
    ],
  },
  {
    external_id: 'a-car',
    kind: 'vehicle',
    name: '2018 hatchback',
    subtitle: '94,180 mi / second car / owned outright',
    valueCents: 1_420_000,
    annualCostCents: 241_000,
    facts: [
      ['Purchase', '$22,900 in Aug 2018'],
      ['Mileage', '94,180, about 7,000 a year'],
      ['Registration', 'Renews Aug 2027'],
      ['Notes', 'Rear shocks getting soft'],
    ],
  },
  {
    external_id: 'a-hvac',
    kind: 'equipment',
    name: 'HVAC, four ton',
    subtitle: 'Installed 2018 / ten year parts warranty',
    valueCents: 940_000,
    annualCostCents: 62_000,
    facts: [
      ['Installed', 'May 2018'],
      ['Replacement cost', '$9,400 today'],
      ['Filter', 'MERV 11, 20x25x1, every 90 days'],
      ['Service', 'Twice a year, spring and autumn'],
    ],
  },
  {
    external_id: 'a-mower',
    kind: 'equipment',
    name: 'Mower and blower',
    subtitle: 'Battery / bought 2022 / five year warranty',
    valueCents: 74_000,
    annualCostCents: 6_000,
    facts: [
      ['Bought', 'Apr 2022 for $1,040'],
      ['Warranty', 'Tool 5 years, battery 3 years'],
      ['Notes', 'Second battery bought Mar 2024'],
    ],
  },
]

const VENDORS: { external_id: string; name: string; trade: string; contact: string }[] = [
  { external_id: 'v-air', name: 'City Air Co', trade: 'HVAC', contact: '(555) 010-0121' },
  { external_id: 'v-plumb', name: 'Example Plumbing', trade: 'Plumbing', contact: '(555) 010-0164' },
  { external_id: 'v-gutter', name: 'Gutter Pros', trade: 'Exterior', contact: '(555) 010-0198' },
  { external_id: 'v-auto', name: 'Northside Auto', trade: 'Vehicle', contact: '(555) 010-0133' },
  { external_id: 'v-roof', name: 'Lone Star Roofing', trade: 'Roofing', contact: '(555) 010-0107' },
]

/**
 * Services, dated relative to today so the demo always has something overdue,
 * something due this month and a year of the calendar filled in.
 *
 * `lastDoneMonthsAgo` plus the interval is what puts each one where it lands.
 * Nothing here stores a future date: that is the module's whole point.
 */
const SERVICES: {
  external_id: string
  asset: string
  title: string
  vendor?: string
  intervalMonths: number
  lastDoneMonthsAgo: number
  costCents: number
}[] = [
  { external_id: 's-truck-oil', asset: 'a-truck', title: 'Oil change and rotation', vendor: 'v-auto', intervalMonths: 6, lastDoneMonthsAgo: 7, costCents: 11_800 },
  { external_id: 's-gutter', asset: 'a-house', title: 'Gutter clean before the autumn', vendor: 'v-gutter', intervalMonths: 12, lastDoneMonthsAgo: 12, costCents: 34_000 },
  { external_id: 's-hvac-service', asset: 'a-hvac', title: 'HVAC service and filter', vendor: 'v-air', intervalMonths: 6, lastDoneMonthsAgo: 6, costCents: 18_000 },
  { external_id: 's-chimney', asset: 'a-house', title: 'Chimney sweep and inspection', intervalMonths: 24, lastDoneMonthsAgo: 23, costCents: 22_000 },
  { external_id: 's-irrigation', asset: 'a-house', title: 'Irrigation blowout', intervalMonths: 12, lastDoneMonthsAgo: 10, costCents: 9_500 },
  { external_id: 's-timing', asset: 'a-car', title: 'Timing belt inspection', vendor: 'v-auto', intervalMonths: 12, lastDoneMonthsAgo: 8, costCents: 18_000 },
  { external_id: 's-blade', asset: 'a-mower', title: 'Blade sharpen', intervalMonths: 12, lastDoneMonthsAgo: 7, costCents: 3_800 },
  { external_id: 's-pressure', asset: 'a-house', title: 'Pressure wash drive and patio', intervalMonths: 24, lastDoneMonthsAgo: 18, costCents: 28_000 },
  { external_id: 's-pest', asset: 'a-house', title: 'Pest control, perimeter', intervalMonths: 3, lastDoneMonthsAgo: 1, costCents: 14_000 },
  { external_id: 's-dryer', asset: 'a-house', title: 'Dryer vent clean', intervalMonths: 12, lastDoneMonthsAgo: 4, costCents: 12_000 },
  { external_id: 's-truck-75k', asset: 'a-truck', title: '75k service', vendor: 'v-auto', intervalMonths: 12, lastDoneMonthsAgo: 3, costCents: 64_000 },
]

const LOG: {
  external_id: string
  asset: string
  what: string
  monthsAgo: number
  costCents: number | null
  vendor?: string
}[] = [
  { external_id: 'l-heater', asset: 'a-house', what: 'Water heater anode and flush', monthsAgo: 0, costCents: 86_000, vendor: 'v-plumb' },
  { external_id: 'l-coil', asset: 'a-hvac', what: 'Coil clean and charge check', monthsAgo: 2, costCents: 18_000, vendor: 'v-air' },
  { external_id: 'l-gutter', asset: 'a-house', what: 'Gutter clean and reseal', monthsAgo: 12, costCents: 34_000, vendor: 'v-gutter' },
  { external_id: 'l-oil', asset: 'a-truck', what: 'Oil, filter and rotation', monthsAgo: 7, costCents: 11_800, vendor: 'v-auto' },
  { external_id: 'l-brakes', asset: 'a-truck', what: 'Front brake pads', monthsAgo: 10, costCents: 42_000, vendor: 'v-auto' },
  { external_id: 'l-coolant', asset: 'a-car', what: 'Coolant flush', monthsAgo: 6, costCents: 14_000 },
  // No cost: the job was done, the receipt is not to hand. Not the same claim
  // as free, which is why the column is null rather than zero.
  { external_id: 'l-blade', asset: 'a-mower', what: 'Blade replaced', monthsAgo: 6, costCents: null },
]

const WARRANTIES: {
  external_id: string
  asset?: string
  name: string
  detail: string
  cover: string
  expiresMonths: number | null
  facts: [string, string][]
}[] = [
  { external_id: 'w-hvac', asset: 'a-hvac', name: 'HVAC parts', detail: 'Registered, claim through the installer', cover: '10 yr parts', expiresMonths: 20, facts: [['Covers', 'Compressor, coil, board'], ['Excludes', 'Labour after year two'], ['Registered', 'Jun 2018']] },
  { external_id: 'w-heater', asset: 'a-house', name: 'Water heater', detail: 'Tank six years, parts six years', cover: '6 yr tank', expiresMonths: 11, facts: [['Covers', 'Tank and parts'], ['Installed', 'Aug 2021']] },
  { external_id: 'w-mower', asset: 'a-mower', name: 'Mower and blower', detail: 'Tool five years, battery three, receipt attached', cover: '5 yr tool', expiresMonths: 7, facts: [['Covers', 'Tool 5 years, battery 3 years'], ['Battery cover', 'Expired Apr 2025']] },
  { external_id: 'w-roof', asset: 'a-house', name: 'Roof workmanship', detail: 'Material warranty is separate and runs to 2046', cover: '10 yr labour', expiresMonths: 0, facts: [['Covers', 'Workmanship only'], ['Installed', 'Sep 2016'], ['Material warranty', '30 year shingle']] },
  // No expiry is a real state, not a missing date.
  { external_id: 'w-docs', name: 'Deed, survey and permits', detail: 'Closing packet, survey, two permits', cover: 'Documents', expiresMonths: null, facts: [['Deed', 'Recorded Jun 2019'], ['Survey', 'Fence line noted'], ['Stored', 'Second Brain, Home / Documents']] },
]

export async function seed(): Promise<number> {
  const assetIds = new Map<string, string>()
  const vendorIds = new Map<string, string>()

  for (const vendor of VENDORS) {
    const { rows } = await db().query<{ id: string }>(
      `insert into home.vendor (name, trade, contact, source, external_id)
       values ($1, $2, $3, 'demo', $4)
       on conflict (source, external_id) do update set name = excluded.name
       returning id`,
      [vendor.name, vendor.trade, vendor.contact, vendor.external_id],
    )
    vendorIds.set(vendor.external_id, rows[0].id)
  }

  for (const asset of ASSETS) {
    const { rows } = await db().query<{ id: string }>(
      `insert into home.asset
         (kind, name, subtitle, value_cents, annual_cost_cents, value_as_of, facts,
          source, external_id)
       values ($1, $2, $3, $4, $5, core.today(), $6, 'demo', $7)
       on conflict (source, external_id) do update
         set value_cents = excluded.value_cents,
             annual_cost_cents = excluded.annual_cost_cents,
             facts = excluded.facts
       returning id`,
      [
        asset.kind,
        asset.name,
        asset.subtitle,
        asset.valueCents,
        asset.annualCostCents,
        JSON.stringify(asset.facts.map(([label, value]) => ({ label, value }))),
        asset.external_id,
      ],
    )
    assetIds.set(asset.external_id, rows[0].id)

    await register({
      module: 'home',
      entityType: 'asset',
      entityId: rows[0].id,
      title: asset.name,
      text: asset.subtitle,
      eventType: 'asset_added',
    })
  }

  for (const service of SERVICES) {
    await db().query(
      `insert into home.service
         (asset_id, title, vendor_id, interval_months, last_done_on,
          cost_estimate_cents, source, external_id)
       values ($1, $2, $3, $4, (core.today() - ($5::int || ' months')::interval)::date,
               $6, 'demo', $7)
       on conflict (source, external_id) do update
         set last_done_on = excluded.last_done_on,
             interval_months = excluded.interval_months,
             cost_estimate_cents = excluded.cost_estimate_cents,
             due_on = null, snooze_until = null`,
      [
        assetIds.get(service.asset),
        service.title,
        service.vendor ? vendorIds.get(service.vendor) : null,
        service.intervalMonths,
        service.lastDoneMonthsAgo,
        service.costCents,
        service.external_id,
      ],
    )
  }

  for (const entry of LOG) {
    const { rows } = await db().query<{ id: string }>(
      `insert into home.service_log
         (asset_id, vendor_id, what, done_on, cost_cents, source, external_id)
       values ($1, $2, $3, (core.today() - ($4::int || ' months')::interval)::date,
               $5, 'demo', $6)
       on conflict (source, external_id) do update
         set done_on = excluded.done_on, cost_cents = excluded.cost_cents
       returning id`,
      [
        assetIds.get(entry.asset),
        entry.vendor ? vendorIds.get(entry.vendor) : null,
        entry.what,
        entry.monthsAgo,
        entry.costCents,
        entry.external_id,
      ],
    )

    await register({
      module: 'home',
      entityType: 'service_log',
      entityId: rows[0].id,
      title: entry.what,
      eventType: 'service_logged',
    })
  }

  for (const warranty of WARRANTIES) {
    await db().query(
      `insert into home.warranty
         (asset_id, name, detail, cover, expires_on, facts, source, external_id)
       values ($1, $2, $3, $4,
               case when $5::int is null then null
                    else (core.today() + ($5::int || ' months')::interval)::date end,
               $6, 'demo', $7)
       on conflict (source, external_id) do update
         set expires_on = excluded.expires_on, facts = excluded.facts`,
      [
        warranty.asset ? assetIds.get(warranty.asset) : null,
        warranty.name,
        warranty.detail,
        warranty.cover,
        warranty.expiresMonths,
        JSON.stringify(warranty.facts.map(([label, value]) => ({ label, value }))),
        warranty.external_id,
      ],
    )
  }

  return ASSETS.length + SERVICES.length + LOG.length + WARRANTIES.length + VENDORS.length
}
