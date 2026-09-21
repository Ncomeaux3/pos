'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  CHEVRON,
  Chip,
  EmptyState,
  Eyebrow,
  MetricStrip,
  MetricTile,
  Overlay,
  STRETCH,
  STRETCH_WRAP,
  SkillPicker,
  StatusChip,
  TabBar,
  fieldClass,
  useToast,
  type ChipTone,
} from '@/components/pos'
import { parseNumber } from '@/core/numbers'
import { cn } from '@/lib/utils'
import { actualFor, budgetTotals, parseCategory } from '../budget'
import type { Hit } from '../geocode'
import {
  decideItem,
  deleteBudgetLine,
  deleteItem,
  deleteTrip,
  mergeTrip,
  saveBudgetLine,
  saveItem,
  savePacking,
  saveTrip,
  suggestPlaces,
  type ActionResult,
} from './actions'
import { blankRow, rowsFor, toDestinations, type Row } from './rows'
import { dateRange, money, nights, type Trip, type TravelData } from './Travel'

// The trip drawer, as POS Travel.dc.html draws it: the trip's name and line,
// Edit details and a status pill, then Itinerary, Budget, Packing and Inbox.
// The same drawer in form mode is New trip, Add to wishlist and Edit details.
// Every row edits in place; nothing here is a modal on a modal.

type Tab = 'itin' | 'budget' | 'packing' | 'inbox'
type Kind = 'flight' | 'lodging' | 'transit' | 'activity' | 'food'

const KIND_TONE: Record<string, ChipTone> = {
  flight: 'brand',
  lodging: 'neutral',
  transit: 'quiet',
  activity: 'warn',
  food: 'warn',
}
const STATUS_TONE: Record<string, ChipTone> = {
  idea: 'quiet',
  planned: 'neutral',
  booked: 'brand',
  done: 'quiet',
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const at = (iso: string) => new Date(`${iso}T12:00:00`)
const isoPlus = (iso: string, days: number) => {
  const d = at(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
const shortDate = (iso: string) => `${MONTHS[at(iso).getMonth()]} ${at(iso).getDate()}`
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// The one field style at the drawer's inline density: a row edits in place.
const inlineInput = cn(fieldClass, 'px-2 py-1 md:text-[12px]')

/** "day 2 19:30 Dinner at Narisawa": which day, what time, what. */
export function parseItem(text: string): { day: number | null; time: string | null; title: string } | null {
  const t = text.trim()
  if (!t) return null
  const m = t.match(/^(?:day\s*(\d+)\s*)?(?:(\d{1,2}:\d{2})\s*)?(.+)$/i)
  if (!m) return { day: null, time: null, title: t }
  return { day: m[1] ? Number(m[1]) : null, time: m[2] ?? null, title: m[3].trim() }
}

export function TripDrawer({
  trip,
  mode,
  data,
  tab: tabParam,
  onTab,
  onClose,
}: {
  trip: Trip | null
  /** New trip or new wish when no trip is open. */
  mode: 'trip' | 'wish' | null
  data: TravelData
  /** The open tab, from the URL so a reload and a link keep it. */
  tab: string | null
  onTab: (tab: Tab) => void
  onClose: () => void
}) {
  const tab: Tab = tabParam === 'budget' || tabParam === 'packing' || tabParam === 'inbox' ? tabParam : 'itin'
  const setTab = onTab
  const [editing, setEditing] = useState(false)
  // Held rather than read off the event so the select can be put back when the
  // confirm is declined; leaving it showing a trip that was not merged reads
  // as though it had been.
  const [mergeInto, setMergeInto] = useState('')
  const [, start] = useTransition()
  const toast = useToast()
  const run = (action: () => Promise<ActionResult>, ok?: string, then?: () => void) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else {
        if (ok) toast(ok)
        then?.()
      }
    })

  if (!trip || editing) {
    const formMode = editing && trip ? (trip.status === 'idea' ? 'wish' : 'trip') : (mode ?? 'trip')
    return (
      <TripForm
        trip={editing ? trip : null}
        destinations={
          editing && trip ? data.destinations.filter((d) => d.tripId === trip.id) : []
        }
        mode={formMode}
        onClose={editing ? () => setEditing(false) : onClose}
        run={run}
      />
    )
  }

  const items = data.itinerary.filter((i) => i.tripId === trip.id)
  const confirmed = items.filter((i) => i.status === 'confirmed')
  // Everything but this trip, by name, because the select is read rather than
  // scanned for a date.
  const others = data.trips
    .filter((t) => t.id !== trip.id)
    .sort((a, b) => a.name.localeCompare(b.name))
  const pending = items.filter((i) => i.status === 'pending')
  const packing = data.packing.filter((p) => p.tripId === trip.id)
  const lines = data.budgetLines.filter((l) => l.tripId === trip.id)
  const tabs: { value: Tab; label: string; count?: number; countTone?: 'warn' }[] = [
    { value: 'itin', label: 'Itinerary' },
    { value: 'budget', label: 'Budget' },
    { value: 'packing', label: 'Packing' },
    { value: 'inbox', label: 'Inbox', count: pending.length || undefined, countTone: 'warn' },
  ]

  return (
    <Overlay
      open
      wide
      onClose={onClose}
      eyebrow={`Travel / ${trip.name}`}
      title={
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[22px] leading-[1.2]">{trip.name}</span>
            <span className="mt-1.5 block text-[12px] font-normal tracking-normal text-ink-3">
              {trip.destination ? `${trip.destination} · ` : ''}
              {dateRange(trip, data.todayIso)} · {nights(trip)} nights · {trip.travellers}{' '}
              {trip.travellers === 1 ? 'traveler' : 'travelers'}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-normal tracking-normal">
            <ActionButton size="sm" onClick={() => setEditing(true)}>
              Edit details
            </ActionButton>
            <StatusChip tone={STATUS_TONE[trip.status] ?? 'neutral'}>{cap(trip.status)}</StatusChip>
          </span>
        </span>
      }
      footer={
        <>
          <span className="text-[11px] text-ink-3">
            {data.checkinTrigger ? (
              <>
                Check-in reminders: <span className="text-ink-2">{data.checkinTrigger.toLowerCase()}</span> ·{' '}
                <Link href="/notifications" className="hover:text-ink">
                  Notifications
                </Link>
              </>
            ) : (
              'Check-in reminders are off in Notifications.'
            )}
          </span>
          {/* Four trips to the same country were four trips because a trip
            * held one destination. Merging folds one into another as a
            * destination rather than deleting it, so nothing that was planned
            * under it is lost. */}
          {others.length > 0 && (
            <select
              value={mergeInto}
              aria-label="Merge into"
              onChange={(e) => {
                const into = e.target.value
                if (!into) return
                const target = others.find((t) => t.id === into)
                if (
                  target &&
                  window.confirm(
                    `Merge ${trip.name} into ${target.name}? Its destinations, itinerary, packing and budget move across, and ${trip.name} is deleted.`,
                  )
                ) {
                  run(() => mergeTrip(trip.id, into), 'Trips merged', onClose)
                  return
                }
                setMergeInto('')
              }}
              className={cn(fieldClass, 'w-auto py-1.5 text-ink-3')}
            >
              <option value="">Merge into…</option>
              {others.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <ActionButton
            variant="danger"
            onClick={() => {
              if (window.confirm(`Delete ${trip.name} and everything under it?`)) run(() => deleteTrip(trip.id), 'Trip deleted', onClose)
            }}
          >
            Delete trip
          </ActionButton>
        </>
      }
    >
      <TabBar label="Trip" value={tab} onChange={setTab} tabs={tabs} />

      <div className="mt-[18px] flex flex-col gap-4">
        {tab === 'itin' && <Itinerary trip={trip} items={confirmed} run={run} />}
        {tab === 'budget' && <Budget trip={trip} items={items} lines={lines} run={run} />}
        {tab === 'packing' && <Packing trip={trip} packing={packing} run={run} />}
        {tab === 'inbox' && <Inbox pending={pending} run={run} />}
      </div>

      <div className="mt-5">
        <Eyebrow>Linked skills</Eyebrow>
        {trip.entityRef ? (
          <SkillPicker entityRef={trip.entityRef} links={trip.skills} skills={data.skills} className="mt-2" />
        ) : (
          <p className="mt-2 text-[12px] text-ink-4">Nothing matched yet.</p>
        )}
      </div>
    </Overlay>
  )
}

type Run = (action: () => Promise<ActionResult>, ok?: string, then?: () => void) => void

function Itinerary({ trip, items: allItems, run }: { trip: Trip; items: TravelData['itinerary']; run: Run }) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  // An item leaves the moment ✕ is pressed, same shape as Inbox.tsx's act():
  // optimistic, reverted with a toast on failure.
  const [gone, setGone] = useState<string[]>([])
  const items = allItems.filter((i) => !gone.includes(i.id))
  const remove = (id: string) => {
    setGone((g) => [...g, id])
    run(async () => {
      const result = await deleteItem(id)
      if (!result.ok) setGone((g) => g.filter((x) => x !== id))
      return result
    }, 'Removed')
  }
  const n = trip.startsOn && trip.endsOn ? Math.max(1, nights(trip) + 1) : 0
  const days = trip.startsOn
    ? Array.from({ length: Math.max(n, 1) }, (_, i) => isoPlus(trip.startsOn!, i))
    : []
  const undated = items.filter((i) => !i.occursOn || !days.includes(i.occursOn))
  const sortByTime = (a: { occursAt: string | null }, b: { occursAt: string | null }) =>
    (a.occursAt ?? '').localeCompare(b.occursAt ?? '')

  const add = () => {
    const parsed = parseItem(draft)
    if (!parsed) return
    const occursOn =
      parsed.day && trip.startsOn ? isoPlus(trip.startsOn, parsed.day - 1) : (trip.startsOn ?? null)
    run(
      () => saveItem({ trip_id: trip.id, title: parsed.title, occurs_on: occursOn, occurs_at: parsed.time, kind: guessKind(parsed.title) }),
      'Added',
      () => setDraft(''),
    )
  }

  const Row = ({ it }: { it: TravelData['itinerary'][number] }) =>
    editingId === it.id ? (
      <ItemEditor
        item={it}
        days={days}
        onDone={() => setEditingId(null)}
        run={run}
      />
    ) : (
      <div className={cn(STRETCH_WRAP, 'grid grid-cols-[44px_1fr_auto] items-start gap-2.5 border-b border-rule py-2')}>
        <span className="num pt-0.5 text-[11px] text-ink-3">{it.occursAt ?? ''}</span>
        <button type="button" title="Edit" onClick={() => setEditingId(it.id)} className={cn(STRETCH, 'min-w-0 text-left')}>
          <span className="block text-[13px] text-ink">{it.title}</span>
          {(it.detail || it.confirmation) && (
            <span className="mt-0.5 block text-[11px] text-ink-3">
              {[it.detail, it.confirmation ? `conf. ${it.confirmation}` : ''].filter(Boolean).join(' · ')}
            </span>
          )}
        </button>
        <span className="relative z-10 flex items-center gap-2">
          <Chip tone={KIND_TONE[it.kind] ?? 'quiet'}>{cap(it.kind)}</Chip>
          <ActionButton variant="danger" size="sm" aria-label={`Remove ${it.title}`} onClick={() => remove(it.id)} className="h-6 w-6 px-0 text-[11px] sm:px-0">
            ✕
          </ActionButton>
          <span aria-hidden="true" className={CHEVRON}>
            &rsaquo;
          </span>
        </span>
      </div>
    )

  return (
    <>
      {days.map((day, i) => {
        const today = items.filter((it) => it.occursOn === day).sort(sortByTime)
        return (
          <div key={day}>
            <div className="flex items-baseline justify-between border-b border-rule-2 pb-1.5">
              <span className="text-[13px] text-ink">Day {i + 1}</span>
              <span className="num text-[11px] text-ink-3">{shortDate(day)}</span>
            </div>
            {today.length === 0 ? (
              <span className="block py-2 text-[12px] text-ink-4">Free day</span>
            ) : (
              today.map((it) => <Row key={it.id} it={it} />)
            )}
          </div>
        )
      })}
      {undated.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between border-b border-rule-2 pb-1.5">
            <span className="text-[13px] text-ink">{days.length === 0 ? 'Itinerary' : 'Undated'}</span>
          </div>
          {undated.sort(sortByTime).map((it) => (
            <Row key={it.id} it={it} />
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex flex-wrap gap-1.5"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Add an itinerary item"
          placeholder="Add: day 2 19:30 Dinner at Narisawa"
          className={cn(fieldClass, 'min-w-[180px] flex-1 py-1.5')}
        />
        <ActionButton type="submit" size="sm" className="self-center">
          Add
        </ActionButton>
      </form>
    </>
  )
}

/** A flight is a flight whatever you call it; everything else is an activity until you say. */
function guessKind(title: string): Kind {
  const t = title.toLowerCase()
  if (/flight|\b[a-z]{2}\s?\d{2,4}\b|airport|→/.test(t)) return 'flight'
  if (/hotel|check.?in|airbnb|ryokan|hostel/.test(t)) return 'lodging'
  if (/train|shinkansen|bus|taxi|transfer|metro/.test(t)) return 'transit'
  if (/dinner|lunch|breakfast|restaurant|cafe|coffee/.test(t)) return 'food'
  return 'activity'
}

function ItemEditor({
  item,
  days,
  onDone,
  run,
}: {
  item: TravelData['itinerary'][number]
  days: string[]
  onDone: () => void
  run: Run
}) {
  const [time, setTime] = useState(item.occursAt ?? '')
  const [title, setTitle] = useState(item.title)
  const [kind, setKind] = useState<Kind>((item.kind as Kind) ?? 'activity')
  const [day, setDay] = useState(item.occursOn && days.includes(item.occursOn) ? String(days.indexOf(item.occursOn) + 1) : '')
  const [detail, setDetail] = useState(item.detail)
  const save = () =>
    run(
      () =>
        saveItem({
          id: item.id,
          title,
          kind,
          detail,
          occurs_at: time || null,
          occurs_on: day && days[Number(day) - 1] ? days[Number(day) - 1] : item.occursOn,
        }),
      'Saved',
      onDone,
    )
  return (
    <div className="grid grid-cols-[56px_1fr_90px] items-center gap-1.5 border-b border-rule py-2">
      <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="19:30" aria-label="Time" className={cn(inlineInput, 'num')} />
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" className={inlineInput} />
      <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} aria-label="Kind" className={inlineInput}>
        {(['flight', 'lodging', 'transit', 'activity', 'food'] as const).map((k) => (
          <option key={k} value={k}>
            {cap(k)}
          </option>
        ))}
      </select>
      <input value={day} onChange={(e) => setDay(e.target.value)} placeholder="Day" aria-label="Day" className={cn(inlineInput, 'num')} />
      <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Details · confirmation" aria-label="Details" className={inlineInput} />
      <span className="flex gap-1.5">
        <ActionButton size="sm" variant="accent" onClick={save}>
          Save
        </ActionButton>
        <ActionButton size="sm" onClick={onDone}>
          Cancel
        </ActionButton>
      </span>
    </div>
  )
}

const DEFAULT_LINES = ['Flights', 'Lodging', 'Food', 'Transit', 'Activities']

function Budget({
  trip,
  items,
  lines: allLines,
  run,
}: {
  trip: Trip
  items: TravelData['itinerary']
  lines: TravelData['budgetLines']
  run: Run
}) {
  const [draft, setDraft] = useState('')
  // A line leaves the moment ✕ is pressed, same shape as Inbox.tsx's act():
  // optimistic, reverted with a toast on failure.
  const [gone, setGone] = useState<string[]>([])
  const lines = allLines.filter((l) => !gone.includes(l.id))
  const removeLine = (l: TravelData['budgetLines'][number]) => {
    setGone((g) => [...g, l.id])
    run(async () => {
      const result = await deleteBudgetLine(trip.id, l.category)
      if (!result.ok) setGone((g) => g.filter((x) => x !== l.id))
      return result
    }, 'Removed')
  }
  const shaped = lines.map((l) => ({ ...l, planned_cents: l.plannedCents, actual_override_cents: l.actualOverrideCents }))
  const itemShapes = items.map((i) => ({ kind: i.kind, status: i.status, amount_cents: i.amountCents }))
  const totals = budgetTotals(shaped, itemShapes, trip.budgetCents)
  const dollars = (cents: number) => String(Math.round(cents / 100))

  const add = () => {
    const parsed = parseCategory(draft)
    if (!parsed) return
    run(
      () => saveBudgetLine({ trip_id: trip.id, category: parsed.category, planned_cents: Math.round(parsed.dollars * 100) }),
      'Added',
      () => setDraft(''),
    )
  }

  return (
    <>
      <MetricStrip className="grid-cols-3 sm:grid-cols-3">
        <MetricTile
          size="sm"
          label="Planned · total"
          value={
            <input
              inputMode="decimal"
              defaultValue={dollars(trip.budgetCents)}
              aria-label="Planned total in dollars"
              onBlur={(e) => {
                const typed = parseNumber(e.target.value)
                const next = typed === null ? null : Math.round(typed * 100)
                if (next !== null && next !== trip.budgetCents) run(() => saveTrip({ id: trip.id, budget_cents: next }), 'Budget saved')
              }}
              className="num w-full border-0 border-b border-rule-2 bg-transparent font-semibold text-ink outline-none focus-visible:border-action"
            />
          }
        />
        <MetricTile size="sm" label="Committed" value={money(totals.committed)} valueTone={totals.committed > totals.planned ? 'bad' : undefined} />
        <MetricTile size="sm" label="Remaining" value={money(totals.remaining)} valueTone={totals.remaining < 0 ? 'bad' : undefined} />
      </MetricStrip>

      <div className="label grid grid-cols-[1fr_90px_90px_20px] gap-2.5 text-ink-3">
        <span>Category</span>
        <span className="text-right">Actual</span>
        <span className="text-right">Planned</span>
        <span />
      </div>
      <div className="-mt-3 flex flex-col">
        {shaped.map((l) => {
          const actual = actualFor(l, itemShapes)
          const pct = l.planned_cents > 0 ? Math.min(100, (actual / l.planned_cents) * 100) : 0
          return (
            <div key={l.id} className="border-b border-rule py-2">
              <div className="grid grid-cols-[1fr_90px_90px_20px] items-center gap-2.5 text-[12px]">
                <span className="text-ink">{l.category}</span>
                <input
                  inputMode="decimal"
                  key={`a-${l.id}-${l.actual_override_cents}`}
                  defaultValue={dollars(actual)}
                  aria-label={`${l.category} actual in dollars`}
                  title={l.actual_override_cents === null ? 'Summed from the confirmed itinerary; type to override' : 'Typed over; clear to sum again'}
                  onBlur={(e) => {
                    const raw = e.target.value.trim()
                    const typed = parseNumber(raw)
                    // Empty clears the override; anything else that is not a number is ignored.
                    if (raw !== '' && typed === null) return
                    const next = typed === null ? null : Math.round(typed * 100)
                    if (next === l.actual_override_cents) return
                    if (next !== null && next === actual && l.actual_override_cents === null) return
                    run(() => saveBudgetLine({ trip_id: trip.id, category: l.category, actual_override_cents: next }), 'Saved')
                  }}
                  className={cn(inlineInput, 'num text-right', l.actual_override_cents === null && 'text-ink-2')}
                />
                <input
                  inputMode="decimal"
                  key={`p-${l.id}-${l.planned_cents}`}
                  defaultValue={dollars(l.planned_cents)}
                  aria-label={`${l.category} planned in dollars`}
                  onBlur={(e) => {
                    const typed = parseNumber(e.target.value)
                    const next = typed === null ? null : Math.round(typed * 100)
                    if (next !== null && next !== l.planned_cents) run(() => saveBudgetLine({ trip_id: trip.id, category: l.category, planned_cents: next }), 'Saved')
                  }}
                  className={cn(inlineInput, 'num text-right')}
                />
                <ActionButton variant="danger" size="sm" aria-label={`Remove ${l.category}`} onClick={() => removeLine(l)} className="h-6 w-6 px-0 text-[11px] sm:px-0">
                  ✕
                </ActionButton>
              </div>
              <div className="mt-1.5 h-[3px] bg-rule-2">
                <div className={cn('h-[3px]', actual > l.planned_cents && l.planned_cents > 0 ? 'bg-bad' : 'bg-brand')} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
        {shaped.length === 0 && (
          <button
            type="button"
            onClick={() =>
              run(async () => {
                for (const category of DEFAULT_LINES) {
                  const result = await saveBudgetLine({ trip_id: trip.id, category, planned_cents: 0 })
                  if (!result.ok) return result
                }
                return { ok: true }
              }, 'Five lines to fill in')
            }
            className="rounded-[18px] border border-dashed border-rule py-4 text-[12px] text-ink-3 hover:text-ink"
          >
            No lines yet. Start with flights, lodging, food, transit and activities.
          </button>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex gap-1.5"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Add a budget category"
          placeholder="Add a category, e.g. Gifts 200"
          className={cn(fieldClass, 'min-w-0 flex-1 py-1.5')}
        />
        <ActionButton type="submit" size="sm" className="self-center">
          Add
        </ActionButton>
      </form>
      <p className="text-[11px] text-ink-4">
        Actuals are the trip&apos;s confirmed itinerary by kind; you can type over any number.
      </p>
    </>
  )
}

function Packing({ trip, packing: allPacking, run }: { trip: Trip; packing: TravelData['packing']; run: Run }) {
  const [draft, setDraft] = useState('')
  // The checkbox flips and a removed row leaves immediately, reverted with a
  // toast on failure, same shape as Inbox.tsx's act().
  const [packedOverride, setPackedOverride] = useState<Record<string, boolean>>({})
  const [gone, setGone] = useState<string[]>([])
  const packing = allPacking
    .filter((p) => !gone.includes(p.id))
    .map((p) => ({ ...p, packed: packedOverride[p.id] ?? p.packed }))
  const toggle = (p: (typeof packing)[number]) => {
    const next = !p.packed
    setPackedOverride((o) => ({ ...o, [p.id]: next }))
    run(async () => {
      const result = await savePacking({ id: p.id, packed: next })
      if (!result.ok) setPackedOverride((o) => ({ ...o, [p.id]: !next }))
      return result
    })
  }
  const remove = (p: (typeof packing)[number]) => {
    setGone((g) => [...g, p.id])
    run(async () => {
      const result = await savePacking({ id: p.id, remove: true })
      if (!result.ok) setGone((g) => g.filter((x) => x !== p.id))
      return result
    }, 'Removed')
  }
  const packed = packing.filter((p) => p.packed).length
  return (
    <>
      <div className="flex items-baseline justify-between">
        <Eyebrow>Packing list</Eyebrow>
        <span className="num text-[11px] text-ink-3">
          {packed} / {packing.length} packed
        </span>
      </div>
      <div className="-mt-2 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-5">
        {packing.map((p) => (
          <div key={p.id} className="flex items-center gap-1.5 border-b border-rule">
            <button
              type="button"
              role="checkbox"
              aria-checked={p.packed}
              onClick={() => toggle(p)}
              className="flex min-w-0 flex-1 items-center gap-2.5 py-[7px] text-left"
            >
              <span aria-hidden className={cn('grid size-3.5 shrink-0 place-items-center border rounded-full', p.packed ? 'border-brand bg-brand' : 'border-ink-3')}>
                {p.packed && <span className="size-1.5 bg-bg" />}
              </span>
              <span className={cn('truncate text-[12px]', p.packed ? 'text-ink-4 line-through' : 'text-ink')}>{p.label}</span>
            </button>
            <ActionButton variant="danger" size="sm" aria-label={`Remove ${p.label}`} onClick={() => remove(p)} className="h-6 w-6 px-0 text-[11px] sm:px-0">
              ✕
            </ActionButton>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const label = draft.trim()
          if (label) run(() => savePacking({ trip_id: trip.id, label }), 'Added', () => setDraft(''))
        }}
        className="flex gap-1.5"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Add a packing item"
          placeholder="Add an item"
          className={cn(fieldClass, 'min-w-0 flex-1 py-1.5')}
        />
        <ActionButton type="submit" size="sm" className="self-center">
          Add
        </ActionButton>
      </form>
    </>
  )
}

function Inbox({ pending: allPending, run }: { pending: TravelData['itinerary']; run: Run }) {
  // A parsed booking leaves the inbox the moment Add or Dismiss is pressed,
  // same shape as Inbox.tsx's act(): optimistic, reverted with a toast on
  // failure.
  const [gone, setGone] = useState<string[]>([])
  const pending = allPending.filter((m) => !gone.includes(m.id))
  const decide = (id: string, accept: boolean) => {
    setGone((g) => [...g, id])
    run(async () => {
      const result = await decideItem(id, accept)
      if (!result.ok) setGone((g) => g.filter((x) => x !== id))
      return result
    }, accept ? 'Added to the trip' : 'Dismissed')
  }
  return (
    <>
      <p className="text-[12px] leading-[1.5] text-ink-3">
        Confirmations an agent parsed wait here as itinerary items. Approve to add; nothing is
        added without you.
      </p>
      {pending.map((m) => (
        <Card key={m.id} className="flex flex-col gap-2 px-3.5 py-3">
          <div className="flex justify-between gap-2.5">
            <span className="min-w-0 truncate text-[11px] text-ink-3">Parsed booking · {m.kind}</span>
            <StatusChip tone="warn">Pending</StatusChip>
          </div>
          <div className="text-[13px] text-ink">{m.title}</div>
          <div className="text-[11px] text-ink-3">
            {[m.occursOn ? shortDate(m.occursOn) : '', m.detail, m.amountCents > 0 ? money(m.amountCents) : '']
              .filter(Boolean)
              .join(' · ')}
            {m.confidence !== null ? ` · confidence ${Math.round(m.confidence * 100)}%` : ''}
          </div>
          <div className="flex gap-1.5">
            <ActionButton size="sm" variant="accent" onClick={() => decide(m.id, true)}>
              Add
            </ActionButton>
            <ActionButton size="sm" onClick={() => decide(m.id, false)}>
              Dismiss
            </ActionButton>
          </div>
        </Card>
      ))}
      {pending.length === 0 && <EmptyState headline="Inbox is clear">A parsed confirmation waits here until you add or dismiss it.</EmptyState>}
    </>
  )
}

/**
 * One destination: where, its coordinates, and when you are there.
 *
 * A component per row rather than one bag of state in the form, because the
 * suggestion list is per field: it is debounced, it arrives late, and a slow
 * answer for row one must not land in row three's datalist. Owning it here
 * makes each row exactly the single-destination form this used to be.
 */
function DestinationFields({
  row,
  index,
  canRemove,
  showDates,
  onChange,
  onRemove,
}: {
  row: Row
  index: number
  canRemove: boolean
  showDates: boolean
  /** A patch, not a whole row: see the handler in TripForm. */
  onChange: (patch: Partial<Row>) => void
  onRemove: () => void
}) {
  const [hits, setHits] = useState<Hit[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestQuery = useRef('')
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const listId = `destination-hits-${row.key}`
  const field = cn(fieldClass, 'w-full')

  // Picking a suggestion exactly fills lat and lon too, but a typed number
  // still wins, because Lat and Lon stay plain inputs.
  const onName = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const picked = hits.find((h) => h.label === value)
    onChange({
      name: picked ? picked.label.split(',')[0] : value,
      ...(picked ? { lat: String(picked.lat), lon: String(picked.lon) } : {}),
    })
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (picked) {
      // The field now holds "Paris" and the list still held "Paris, France",
      // so the browser matched it and popped the list back up over the pick.
      latestQuery.current = value
      setHits([])
      return
    }
    debounceRef.current = setTimeout(() => {
      // A slow answer to an earlier query must not replace a newer list.
      suggestPlaces(value).then((found) => {
        if (value === latestQuery.current) setHits(found)
      })
    }, 300)
    latestQuery.current = value
  }

  return (
    <div data-testid="destination-row" className="flex flex-col gap-3 border-l border-rule pl-3">
      <div className="grid grid-cols-[1fr_96px_96px] gap-3">
        <label className="flex flex-col gap-1.5">
          <Eyebrow>{index === 0 ? 'Destination' : `Destination ${index + 1}`}</Eyebrow>
          <input
            value={row.name}
            onChange={onName}
            placeholder="City, country"
            list={listId}
            className={field}
          />
          <datalist id={listId}>
            {hits.map((h) => (
              <option key={`${h.label} ${h.lat} ${h.lon}`} value={h.label} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5">
          <Eyebrow>Lat</Eyebrow>
          <input
            value={row.lat}
            onChange={(e) => onChange({ lat: e.target.value })}
            placeholder="35.69"
            className={cn(field, 'num')}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <Eyebrow>Lon</Eyebrow>
          <input
            value={row.lon}
            onChange={(e) => onChange({ lon: e.target.value })}
            placeholder="139.69"
            className={cn(field, 'num')}
          />
        </label>
      </div>
      {showDates && (
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Arrive</Eyebrow>
            <input
              type="date"
              value={row.start}
              onChange={(e) => onChange({ start: e.target.value })}
              className={cn(field, 'num')}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Leave</Eyebrow>
            <input
              type="date"
              value={row.end}
              onChange={(e) => onChange({ end: e.target.value })}
              className={cn(field, 'num')}
            />
          </label>
          {canRemove && (
            <ActionButton
              variant="danger"
              onClick={onRemove}
              aria-label={`Remove ${row.name || `destination ${index + 1}`}`}
              className="h-[38px]"
            >
              Remove
            </ActionButton>
          )}
        </div>
      )}
      {!showDates && canRemove && (
        <ActionButton
          variant="danger"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove ${row.name || `destination ${index + 1}`}`}
          className="self-start"
        >
          Remove
        </ActionButton>
      )}
    </div>
  )
}

function TripForm({
  trip,
  destinations,
  mode,
  onClose,
  run,
}: {
  trip: Trip | null
  /** This trip's destinations, so the form opens on what it already has. */
  destinations: TravelData['destinations']
  mode: 'trip' | 'wish'
  onClose: () => void
  run: Run
}) {
  const [f, setF] = useState({
    name: trip?.name ?? '',
    budget: trip ? String(Math.round(trip.budgetCents / 100)) : '',
    travellers: trip ? String(trip.travellers) : '2',
    notes: trip?.notes ?? '',
  })
  const set = (key: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [key]: e.target.value }))

  // The destination list. Initialised once, from the trip's rows or, for a
  // trip that predates them, from its own place; never from nothing, or the
  // first save would wipe what the trip already said.
  const [rows, setRows] = useState<Row[]>(() => rowsFor(trip, destinations))
  const title = trip ? 'Edit details' : mode === 'wish' ? 'Add to wishlist' : 'New trip'

  // The wishlist is one place you would like to go, not an itinerary, so it
  // keeps a single row and no dates.
  const many = mode === 'trip'

  const save = () => {
    if (!f.name.trim()) return
    run(
      () =>
        saveTrip({
          id: trip?.id,
          name: f.name.trim(),
          notes: f.notes,
          // The trip's own destination, lat, lon and dates are not sent:
          // write_trip derives them from this set, and sending both would put
          // two answers in one call.
          destinations: toDestinations(rows),
          ...(many
            ? {
                budget_cents: Math.round((Number(f.budget) || 0) * 100),
                travellers: Math.max(1, Number(f.travellers) || 1),
                status: trip ? undefined : ('planned' as const),
              }
            : { status: trip ? undefined : ('idea' as const) }),
        }),
      trip ? 'Saved' : mode === 'wish' ? 'Added to the wishlist' : 'Trip created',
      onClose,
    )
  }
  const field = cn(fieldClass, 'w-full')

  return (
    <Overlay
      open
      wide
      onClose={onClose}
      eyebrow={`Travel / ${title}`}
      title={title}
      footer={
        <>
          <div className="flex flex-col items-start gap-1">
            <ActionButton variant="quiet" onClick={onClose}>
              Cancel
            </ActionButton>
            <span className="text-[11px] leading-none text-ink-2">Location search by Open-Meteo and GeoNames</span>
          </div>
          <ActionButton variant="solid" size="lg" className="h-[38px] gap-2 px-3.5 text-[13px]" onClick={save}>
            {trip ? 'Save' : mode === 'wish' ? 'Add' : 'Create'} <span aria-hidden="true">&rarr;</span>
          </ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <Eyebrow>{mode === 'wish' ? 'Place' : 'Trip'}</Eyebrow>
          <input value={f.name} onChange={set('name')} placeholder="e.g. Tokyo · November" className={cn(field, 'text-[15px]')} />
        </label>

        {rows.map((row, i) => (
          <DestinationFields
            key={row.key}
            row={row}
            index={i}
            canRemove={rows.length > 1}
            showDates={many}
            // The patch is merged into the row as it stands in state, not into
            // the one this render closed over. Two fields changed faster than a
            // re-render would otherwise have the second revert the first.
            onChange={(patch) => setRows((all) => all.map((r) => (r.key === row.key ? { ...r, ...patch } : r)))}
            onRemove={() => setRows((all) => all.filter((r) => r.key !== row.key))}
          />
        ))}

        {many && (
          <ActionButton
            variant="quiet"
            size="sm"
            onClick={() => setRows((all) => [...all, blankRow()])}
            className="self-start"
          >
            + Add destination
          </ActionButton>
        )}

        {many ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <Eyebrow>Budget</Eyebrow>
              <input value={f.budget} onChange={set('budget')} placeholder="$" className={cn(field, 'num')} />
            </label>
            <label className="flex flex-col gap-1.5">
              <Eyebrow>Travelers</Eyebrow>
              <input value={f.travellers} onChange={set('travellers')} className={cn(field, 'num')} />
            </label>
          </div>
        ) : (
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Why · when</Eyebrow>
            <input value={f.notes} onChange={set('notes')} placeholder="Cherry blossoms, late March" className={field} />
          </label>
        )}
        <p className="text-[11px] text-ink-4">
          The trip&apos;s dates are the span of its destinations. Coordinates place each pin on the globe;
          without them a destination is listed and not drawn.
        </p>
      </div>
    </Overlay>
  )
}
