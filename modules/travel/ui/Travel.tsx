'use client'

import { useTransition } from 'react'
import { ActionButton, BandSearch, SearchButton, useToast } from '@/components/pos'
import { BackControl } from '@/components/pos/BackControl'
import { useSearchState } from '@/components/pos/searchState'
import { cn } from '@/lib/utils'
import { deleteTrip, setTripStatus, type ActionResult } from './actions'
import { Globe } from './Globe'
import { LoyaltyDrawer } from './LoyaltyDrawer'
import { pinsFor, pinTarget } from './pins'
import { PlaceDrawer } from './PlaceDrawer'
import { TripDrawer } from './TripDrawer'

// The Travel screen, as POS Travel.dc.html draws it: the band, the loyalty
// strip, the title with its two buttons, the globe, then Upcoming as cards
// and Past beside Wishlist. A trip opens as a drawer; a wish is a trip whose
// status is idea.

export type TravelData = {
  todayIso: string
  trips: {
    id: string
    name: string
    destination: string
    lat: number | null
    lon: number | null
    startsOn: string | null
    endsOn: string | null
    budgetCents: number
    spentCents: number
    travellers: number
    status: string
    notes: string
    itemCount: number
    pendingCount: number
    packed: number
    toPack: number
  }[]
  /** Every trip's cities, in the owner's order. Flat, joined by tripId. */
  destinations: {
    id: string
    tripId: string
    name: string
    lat: number | null
    lon: number | null
    startsOn: string | null
    endsOn: string | null
    position: number
  }[]
  itinerary: {
    id: string
    tripId: string
    kind: string
    title: string
    detail: string
    occursOn: string | null
    occursAt: string | null
    amountCents: number
    confirmation: string
    status: string
    confidence: number | null
  }[]
  packing: { id: string; tripId: string; label: string; packed: boolean }[]
  budgetLines: {
    id: string
    tripId: string
    category: string
    plannedCents: number
    actualOverrideCents: number | null
  }[]
  places: { id: string; tripId: string | null; name: string; country: string; lat: number; lon: number; visitedOn: string | null }[]
  loyalty: {
    id: string
    name: string
    kind: string
    balance: number
    previousBalance: number | null
    statusTier: string
    updatedAt: string
  }[]
  /** The unread travel notification for the band on the globe, if any. */
  alert: { id: string; title: string; body: string } | null
  /** The live flight check-in rule's trigger text, for the drawer's footer. */
  checkinTrigger: string | null
}

export type Trip = TravelData['trips'][number]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY = 86_400_000

const at = (iso: string) => new Date(`${iso}T12:00:00`)
export const money = (cents: number) =>
  `$${Math.round(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

/** "Nov 5 – Nov 14", with the year when it is not this one. */
export function dateRange(trip: Trip, todayIso: string): string {
  if (!trip.startsOn) return 'no date'
  const s = at(trip.startsOn)
  const e = trip.endsOn ? at(trip.endsOn) : null
  const year = e && e.getFullYear() !== at(todayIso).getFullYear() ? ` ${e.getFullYear()}` : ''
  const one = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return e ? `${one(s)} – ${one(e)}${year}` : `${one(s)}${year}`
}

export function nights(trip: Trip): number {
  if (!trip.startsOn || !trip.endsOn) return 0
  return Math.max(0, Math.round((at(trip.endsOn).getTime() - at(trip.startsOn).getTime()) / DAY))
}

const daysUntil = (iso: string, todayIso: string) =>
  Math.max(0, Math.round((at(iso).getTime() - at(todayIso).getTime()) / DAY))

const KINDS = ['flight', 'lodging', 'transit', 'activity'] as const
const KIND_COLOUR: Record<(typeof KINDS)[number], string> = {
  flight: 'bg-brand',
  lodging: 'bg-ink-2',
  transit: 'bg-ink-3',
  activity: 'bg-warn',
}

export function Travel({ data }: { data: TravelData }) {
  const { params, set: setParams } = useSearchState()
  const [, start] = useTransition()
  const toast = useToast()

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  const today = data.todayIso
  const isPast = (t: Trip) => t.status === 'done' || (t.endsOn !== null && t.endsOn < today)
  const upcoming = data.trips
    .filter((t) => (t.status === 'planned' || t.status === 'booked') && !isPast(t))
    .sort((a, b) => (a.startsOn ?? '').localeCompare(b.startsOn ?? ''))
  const past = data.trips.filter(isPast).sort((a, b) => (b.startsOn ?? '').localeCompare(a.startsOn ?? ''))
  const wishlist = data.trips.filter((t) => t.status === 'idea')

  const nightsAway = upcoming.reduce((sum, t) => sum + nights(t), 0)
  const pastSpend = past.reduce((sum, t) => sum + t.spentCents, 0)

  // Upcoming trips in the accent, places visited and past trips in grey, wishes
  // as dashed rings. Which trip becomes which pin is in ./pins.ts, tested.
  const pins = pinsFor({ upcoming, past, wishlist, destinations: data.destinations, places: data.places })

  const openTrip = data.trips.find((t) => t.id === params.get('trip')) ?? null
  const openPlace = data.places.find((p) => p.id === params.get('place')) ?? null
  const form = params.get('new') // 'trip' | 'wish' | null
  const loyaltyOpen = params.get('loyalty') === '1'

  return (
    <>
      <header className="-mx-[18px] -mt-[18px] flex min-h-14 flex-wrap items-center justify-between gap-4 border-b border-rule px-[18px] py-2 md:-mx-7 md:-mt-7 md:h-14 md:flex-nowrap md:px-7 md:py-0">
        <BackControl />
        <span className="eyebrow shrink-0 whitespace-nowrap text-ink-3">
          Travel <span className="text-ink-4">/</span> Trips
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
          <SearchButton className="md:hidden" />
          <BandSearch className="hidden min-w-[160px] flex-1 md:flex" placeholder="Search travel" />
          <span className="eyebrow hidden shrink-0 whitespace-nowrap text-ink-3 md:inline-flex">
            <span className="status-dot" data-tone={upcoming.length > 0 ? 'brand' : 'idle'} aria-hidden />
            {upcoming.length} upcoming · {nightsAway} nights away
          </span>
        </div>
      </header>

      {/* The loyalty strip: one cell per program, the balance with its move
        * since the last entry, and Manage on the last cell. */}
      {data.loyalty.length > 0 && (
        <div
          data-testid="travel-loyalty"
          className="-mx-[18px] grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-px border-b border-rule bg-rule md:-mx-7"
        >
          {data.loyalty.map((l, i) => {
            const delta = l.previousBalance === null ? null : l.balance - l.previousBalance
            return (
              <div key={l.id} className="flex min-w-0 flex-col gap-0.5 bg-bg px-5 py-2.5">
                <span className="flex justify-between gap-2 truncate text-[11px] text-ink-3">
                  <span className="truncate">{l.name}</span>
                  {i === data.loyalty.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setParams({ loyalty: '1' }, { push: true })}
                      className="shrink-0 text-ink-4 hover:text-ink"
                    >
                      Manage →
                    </button>
                  )}
                </span>
                <span className="num whitespace-nowrap text-[14px] text-ink">
                  {l.balance.toLocaleString('en-US')}
                  {delta !== null && delta !== 0 && (
                    <span className={cn('ml-1 text-[10px]', delta > 0 ? 'text-ok' : 'text-bad')}>
                      {delta > 0 ? '+' : ''}
                      {delta.toLocaleString('en-US')}
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-normal leading-none tracking-[-0.03em] text-ink">Travel</h1>
          <p className="mt-2 hidden text-[13px] text-ink-3 md:block">
            Upcoming trips in green, past in grey, wishlist dotted. Drag to rotate, scroll to zoom,
            tap a pin to open it, double-click to fly in.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setParams({ new: 'wish', trip: null }, { push: true })}
            className="whitespace-nowrap border border-rule-2 px-3 py-2 text-[12px] text-ink-3 transition-colors duration-150 hover:border-ink hover:text-ink"
          >
            Add to wishlist
          </button>
          <ActionButton variant="solid" size="xl" className="h-11 gap-2 px-3.5 text-[13px] md:h-[51px] md:px-[22px] md:text-[15px]" onClick={() => setParams({ new: 'trip', trip: null }, { push: true })}>
            New trip <span aria-hidden="true">&rarr;</span>
          </ActionButton>
        </div>
      </div>

      <div data-testid="travel-globe" className="relative mt-[18px] h-[clamp(240px,38vh,420px)] border border-rule bg-bg-elev">
        <Globe
          pins={pins}
          onPick={(id) => {
            const target = pinTarget(id, data.places, (t) => data.trips.some((trip) => trip.id === t))
            if (target && 'trip' in target) setParams({ trip: target.trip, new: null, place: null }, { push: true })
            else if (target) setParams({ place: target.place, trip: null, new: null }, { push: true })
          }}
          alert={
            data.alert && (
              <div className="flex items-center gap-2.5 border border-warn bg-bg px-3 py-2">
                <span className="label shrink-0 text-[9px] tracking-[0.08em] text-warn">Alert</span>
                <span className="min-w-0 text-[12px] text-ink">{data.alert.title}</span>
              </div>
            )
          }
        />
      </div>

      <div data-testid="travel-sections" className="mt-[18px] flex flex-col gap-5 pb-7">
        <section>
          <SectionHead title="Upcoming" meta={upcoming.length === 0 ? 'nothing booked' : `${upcoming.length} ${upcoming.length === 1 ? 'trip' : 'trips'} · next in ${daysUntil(upcoming[0].startsOn ?? today, today)} days`} className="mb-3" />
          {upcoming.length === 0 ? (
            <p className="text-[12px] text-ink-4">No trip is planned. New trip starts one.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3.5">
              {upcoming.map((t) => {
                const items = data.itinerary.filter((i) => i.tripId === t.id && i.status === 'confirmed')
                const booked = KINDS.filter((k) => items.some((i) => i.kind === k))
                const toPack = t.toPack - t.packed
                const next =
                  t.pendingCount > 0
                    ? `Approve ${t.pendingCount} parsed ${t.pendingCount === 1 ? 'booking' : 'bookings'}`
                    : !items.some((i) => i.kind === 'lodging')
                      ? 'Book lodging'
                      : toPack > 0
                        ? `Pack · ${toPack} ${toPack === 1 ? 'item' : 'items'} left`
                        : ''
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setParams({ trip: t.id, new: null }, { push: true })}
                    className="border border-rule bg-bg-elev px-[18px] py-4 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-rule-2"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <span className="block text-[16px] leading-[1.3] tracking-[-0.01em] text-ink">{t.name}</span>
                        <span className="mt-1 block text-[12px] text-ink-3">
                          {dateRange(t, today)} · {nights(t)} nights
                        </span>
                      </div>
                      {t.startsOn && (
                        <span className="num shrink-0 text-[18px] font-light leading-none text-brand">
                          {daysUntil(t.startsOn, today)}
                          <span className="text-[10px] text-ink-3"> d</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-3.5 flex gap-px bg-rule">
                      {KINDS.map((k) => (
                        <span
                          key={k}
                          title={`${k} · ${booked.includes(k) ? 'booked' : 'open'}`}
                          className={cn('h-[3px] flex-1', booked.includes(k) ? KIND_COLOUR[k] : 'bg-bg-elev')}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between gap-2.5 text-[11px] text-ink-3">
                      <span>
                        {booked.length}/4 booked{t.pendingCount > 0 ? ` · ${t.pendingCount} in inbox` : ''}
                      </span>
                      <span>
                        {money(t.spentCents)} / {money(t.budgetCents)}
                      </span>
                    </div>
                    {next && (
                      <div className="mt-2.5 truncate border-t border-rule pt-2.5 text-[12px] text-ink-2">
                        <span className="text-ink-4">Next · </span>
                        {next}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5">
          <section>
            <SectionHead title="Past" meta={`${past.length} ${past.length === 1 ? 'trip' : 'trips'} · ${money(pastSpend)} total`} className="mb-1.5" />
            {past.length === 0 && <p className="py-2.5 text-[12px] text-ink-4">Nothing yet.</p>}
            {past.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setParams({ trip: t.id, new: null }, { push: true })}
                className="grid w-full grid-cols-[1fr_auto] gap-2.5 border-b border-rule py-2.5 text-left text-ink transition-colors duration-150 hover:text-brand"
              >
                <span className="min-w-0 text-[13px]">
                  <span className="block">{t.name}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-3">
                    {dateRange(t, today)} · {nights(t)} nights
                  </span>
                </span>
                <span className="num whitespace-nowrap text-[12px] text-ink-3">{money(t.spentCents)}</span>
              </button>
            ))}
          </section>

          <section>
            <SectionHead title="Wishlist" meta={`${wishlist.length} ${wishlist.length === 1 ? 'place' : 'places'}`} className="mb-1.5" />
            {wishlist.length === 0 && <p className="py-2.5 text-[12px] text-ink-4">Nothing yet. Add to wishlist keeps a place for later.</p>}
            {wishlist.map((w) => (
              <div key={w.id} className="grid grid-cols-[1fr_auto] items-center gap-2.5 border-b border-rule py-2.5">
                <button type="button" onClick={() => setParams({ trip: w.id, new: null }, { push: true })} className="min-w-0 text-left text-[13px] text-ink hover:text-brand">
                  <span className="block">{w.name}</span>
                  {w.notes && <span className="mt-0.5 block text-[11px] text-ink-3">{w.notes}</span>}
                </button>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => run(() => setTripStatus(w.id, 'planned'), `${w.name} is planned`)}
                    className="border border-brand px-[9px] py-1 text-[11px] text-ink transition-colors duration-150 hover:bg-brand hover:text-bg"
                  >
                    Plan
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${w.name}`}
                    onClick={() => {
                      if (window.confirm(`Remove ${w.name} from the wishlist?`)) run(() => deleteTrip(w.id), 'Removed')
                    }}
                    className="border border-rule-2 px-[9px] py-1 text-[11px] text-ink-3 transition-colors duration-150 hover:border-ink hover:text-ink"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>

      {(openTrip || form) && (
        <TripDrawer
          key={openTrip?.id ?? form}
          trip={openTrip}
          mode={form === 'wish' ? 'wish' : form === 'trip' ? 'trip' : null}
          data={data}
          tab={params.get('tab')}
          onTab={(tab) => setParams({ tab: tab === 'itin' ? null : tab })}
          onClose={() => setParams({ trip: null, new: null, tab: null })}
        />
      )}
      {openPlace && <PlaceDrawer place={openPlace} onClose={() => setParams({ place: null })} />}
      {loyaltyOpen && <LoyaltyDrawer loyalty={data.loyalty} onClose={() => setParams({ loyalty: null })} />}
    </>
  )
}

function SectionHead({ title, meta, className }: { title: string; meta: string; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between border-b border-rule-2 pb-2', className)}>
      <span className="text-[15px] text-ink">{title}</span>
      <span className="num text-[11px] text-ink-3">{meta}</span>
    </div>
  )
}
