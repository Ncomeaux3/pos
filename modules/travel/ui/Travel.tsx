'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  MetricTile,
  PaceBar,
  Row,
  RowList,
  StatusChip,
  Switch,
  TabBar,
  fieldClass,
  useToast,
} from '@/components/pos'
import { cn } from '@/lib/utils'
import { centsPerPoint } from '../globe'
import { decideItem, saveLoyalty, setTripStatus, togglePacked, type ActionResult } from './actions'
import { Globe } from './Globe'

export type TravelData = {
  todayIso: string
  trips: {
    id: string
    name: string
    destination: string
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
  places: { id: string; name: string; country: string; lat: number; lon: number; visitedOn: string | null }[]
  loyalty: { id: string; name: string; kind: string; balance: number; statusTier: string; updatedAt: string }[]
}

type Tab = 'trips' | 'map' | 'inbox' | 'loyalty'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const shortDate = (iso: string | null) => {
  if (!iso) return 'no date'
  const d = new Date(`${iso}T12:00:00`)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

export function Travel({ data }: { data: TravelData }) {
  const router = useRouter()
  const params = useSearchParams()
  const tab = (params.get('tab') ?? 'trips') as Tab
  const openTrip = data.trips.find((t) => t.id === params.get('trip')) ?? null

  const setParams = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
    const query = search.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }

  const [, start] = useTransition()
  const toast = useToast()

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  const pending = data.itinerary.filter((i) => i.status === 'pending')

  return (
    <div className="space-y-5">
      {/* The globe sits above the views rather than inside one, which is what
        * the artboard does: this screen is a map of where you have been, and
        * the lists under it are the detail. */}
      {data.places.length > 0 && (
        <div className="grid h-[clamp(240px,38vh,420px)] place-items-center border border-rule bg-bg-elev p-3">
          <Globe places={data.places} className="h-full" />
        </div>
      )}

      <TabBar
        label="Travel views"
        value={tab}
        onChange={(next) => setParams({ tab: next === 'trips' ? null : next, trip: null })}
        tabs={[
          { value: 'trips', label: 'Trips', count: data.trips.length },
          { value: 'map', label: 'Map', count: data.places.length },
          { value: 'inbox', label: 'Inbox', count: pending.length },
          { value: 'loyalty', label: 'Loyalty', count: data.loyalty.length },
        ]}
      />

      {tab === 'trips' && (
        <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
          <div className="min-w-0 flex-[1_1_420px] space-y-2.5">
            {data.trips.length === 0 ? (
              <EmptyState headline="Nothing booked">
                A trip starts as an idea with no dates, and becomes planned, then booked. Only a
                booked one counts against a budget.
              </EmptyState>
            ) : (
              data.trips.map((trip) => (
                <Card key={trip.id} className="space-y-2.5" selected={openTrip?.id === trip.id}>
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <button
                      type="button"
                      onClick={() => setParams({ trip: trip.id })}
                      className="min-w-0 flex-1 basis-[200px] text-left"
                    >
                      <p className="t-body text-ink">{trip.name}</p>
                      <p className="t-caption mt-1 text-ink-3">
                        {trip.destination || 'Somewhere'} / {shortDate(trip.startsOn)}
                        {trip.endsOn ? ` to ${shortDate(trip.endsOn)}` : ''} /{' '}
                        {trip.travellers} travelling
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      {trip.pendingCount > 0 && (
                        <StatusChip tone="warn">{trip.pendingCount} waiting</StatusChip>
                      )}
                      <StatusChip tone={trip.status === 'booked' ? 'brand' : 'quiet'}>
                        {trip.status}
                      </StatusChip>
                    </div>
                  </div>

                  {trip.budgetCents > 0 && (
                    <div className="space-y-1.5">
                      <PaceBar
                        value={trip.spentCents}
                        max={trip.budgetCents}
                        tone={trip.spentCents > trip.budgetCents ? 'bad' : 'brand'}
                      />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="label text-[10px] text-ink-3">
                          {money(trip.spentCents)} of {money(trip.budgetCents)}
                        </span>
                        <span className="label text-[10px] text-ink-3">
                          {/* Only confirmed spend. A pending booking is a guess
                              about an email, and a budget moved by a guess is a
                              number that stops being trusted. */}
                          confirmed only
                        </span>
                      </div>
                    </div>
                  )}

                  {trip.toPack > 0 && (
                    <p className="t-caption text-ink-3">
                      Packed {trip.packed} of {trip.toPack}.
                    </p>
                  )}
                </Card>
              ))
            )}
          </div>

          {openTrip && (
            <aside className="min-w-0 flex-[1_1_340px] space-y-4 md:max-w-[440px]">
              <Card className="space-y-3">
                <CardHead label="Itinerary" meta={`${openTrip.itemCount} confirmed`} />
                {data.itinerary.filter((i) => i.tripId === openTrip.id && i.status === 'confirmed')
                  .length === 0 ? (
                  <EmptyState headline="Nothing planned" className="border-0">
                    No confirmed items yet.
                  </EmptyState>
                ) : (
                  <RowList>
                    {data.itinerary
                      .filter((i) => i.tripId === openTrip.id && i.status === 'confirmed')
                      .map((item) => (
                        <Row
                          key={item.id}
                          title={item.title}
                          meta={`${shortDate(item.occursOn)}${item.occursAt ? ` ${item.occursAt}` : ''} / ${item.kind}${item.detail ? ` / ${item.detail}` : ''}`}
                          right={
                            item.amountCents > 0 ? (
                              <span className="num text-[12px] text-ink-2">
                                {money(item.amountCents)}
                              </span>
                            ) : undefined
                          }
                        />
                      ))}
                  </RowList>
                )}
              </Card>

              <Card className="space-y-3">
                <CardHead
                  label="Packing"
                  meta={`${openTrip.packed} of ${openTrip.toPack}`}
                />
                {data.packing.filter((p) => p.tripId === openTrip.id).length === 0 ? (
                  <p className="t-caption text-ink-3">Nothing on the list yet.</p>
                ) : (
                  <RowList>
                    {data.packing
                      .filter((p) => p.tripId === openTrip.id)
                      .map((item) => (
                        <Row
                          key={item.id}
                          title={item.label}
                          muted={item.packed}
                          right={
                            <Switch
                              label={`Packed ${item.label}`}
                              checked={item.packed}
                              onChange={(next) => run(() => togglePacked(item.id, next))}
                            />
                          }
                        />
                      ))}
                  </RowList>
                )}
              </Card>

              <div className="flex flex-wrap gap-1.5">
                {(['idea', 'planned', 'booked', 'done'] as const).map((s) => (
                  <ActionButton
                    key={s}
                    variant={openTrip.status === s ? 'brand' : 'outline'}
                    onClick={() => run(() => setTripStatus(openTrip.id, s), `Marked ${s}`)}
                  >
                    {s}
                  </ActionButton>
                ))}
              </div>
            </aside>
          )}
        </div>
      )}

      {tab === 'map' && (
        <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
          {data.places.length === 0 && (
            <div className="min-w-0 flex-[1_1_360px]">
              <EmptyState headline="Nowhere yet">
                A place lands here when a booked trip ends, and stays even if the trip is archived:
                the map is a record of where you have been, not of what is still on the list.
              </EmptyState>
            </div>
          )}

          <div className="min-w-0 flex-[1_1_280px]">
            <RowList>
              {data.places.map((p) => (
                <Row
                  key={p.id}
                  title={p.name}
                  meta={`${p.country || 'unknown'} / ${shortDate(p.visitedOn)}`}
                  right={
                    <span className="num text-[10px] text-ink-3">
                      {p.lat.toFixed(1)}, {p.lon.toFixed(1)}
                    </span>
                  }
                />
              ))}
            </RowList>
          </div>
        </div>
      )}

      {tab === 'inbox' && (
        <div className="space-y-3">
          {pending.length === 0 ? (
            <EmptyState headline="Inbox zero">
              A booking parsed from an email lands here first. A machine reading a confirmation is
              proposing, not deciding, so nothing joins an itinerary until you accept it.
            </EmptyState>
          ) : (
            <RowList>
              {pending.map((item) => (
                <Row
                  key={item.id}
                  title={item.title}
                  meta={`${item.kind} / ${shortDate(item.occursOn)}${item.detail ? ` / ${item.detail}` : ''}`}
                  right={
                    <>
                      {item.confidence !== null && (
                        <Chip tone="warn">{Math.round(item.confidence * 100)}%</Chip>
                      )}
                      <ActionButton
                        variant="brand"
                        onClick={() => run(() => decideItem(item.id, true), 'Added to the trip')}
                      >
                        Accept
                      </ActionButton>
                      <ActionButton onClick={() => run(() => decideItem(item.id, false), 'Discarded')}>
                        Reject
                      </ActionButton>
                    </>
                  }
                />
              ))}
            </RowList>
          )}
        </div>
      )}

      {tab === 'loyalty' && <Loyalty programs={data.loyalty} onRun={run} />}
    </div>
  )
}

/**
 * Balances, and the one calculation SPEC asks for.
 *
 * Both numbers come from the owner. Nothing here knows what a point is worth,
 * because nothing can: SPEC says loyalty sites are not scraped, and a made up
 * valuation would be worse than none.
 */
function Loyalty({
  programs,
  onRun,
}: {
  programs: TravelData['loyalty']
  onRun: (action: () => Promise<ActionResult>, ok?: string) => void
}) {
  const [cash, setCash] = useState('')
  const [points, setPoints] = useState('')

  const cpp = centsPerPoint(Math.round(Number(cash) * 100) || 0, Number(points) || 0)

  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
      <div className="min-w-0 flex-[1_1_320px] space-y-3">
        {programs.length === 0 ? (
          <EmptyState headline="No balances">
            Add one and keep it current by hand. No loyalty programme publishes an API worth
            using, so this app does not pretend to read them.
          </EmptyState>
        ) : (
          <RowList>
            {programs.map((p) => (
              <Row
                key={p.id}
                title={p.name}
                meta={`${p.kind}${p.statusTier ? ` / ${p.statusTier}` : ''} / you updated this ${new Date(p.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                right={
                  <input
                    type="number"
                    min={0}
                    defaultValue={p.balance}
                    aria-label={`Balance for ${p.name}`}
                    onBlur={(e) =>
                      Number(e.target.value) !== p.balance &&
                      onRun(
                        () =>
                          saveLoyalty(
                            p.name,
                            Number(e.target.value),
                            p.kind as 'airline' | 'hotel' | 'card' | 'rail',
                          ),
                        'Saved',
                      )
                    }
                    className={cn(fieldClass, 'w-32')}
                  />
                }
              />
            ))}
          </RowList>
        )}
      </div>

      <Card className="min-w-0 flex-[1_1_280px] space-y-3 md:max-w-[380px]">
        <CardHead label="Cents per point" meta="both numbers yours" />
        <p className="t-caption text-ink-3">
          What the cash fare would have been, against the points it would cost. Above about 1.5
          cents a point is usually worth spending them; below it, pay cash and keep the points.
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="space-y-1.5">
            <Eyebrow className="text-[10px]">Cash fare</Eyebrow>
            <input
              type="number"
              min={0}
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              aria-label="Cash fare in dollars"
              placeholder="640"
              className={cn(fieldClass, 'w-full')}
            />
          </label>
          <label className="space-y-1.5">
            <Eyebrow className="text-[10px]">Points</Eyebrow>
            <input
              type="number"
              min={0}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              aria-label="Points required"
              placeholder="35000"
              className={cn(fieldClass, 'w-full')}
            />
          </label>
        </div>

        <MetricTile
          label="Value"
          value={cpp === null ? '--' : `${cpp.toFixed(2)}c`}
          delta={cpp === null ? 'enter both' : cpp >= 1.5 ? 'worth using points' : 'pay cash'}
          deltaTone={cpp === null ? 'quiet' : cpp >= 1.5 ? 'ok' : 'warn'}
        />
      </Card>
    </div>
  )
}
