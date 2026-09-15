'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ActionButton, Eyebrow, Overlay, fieldClass, useToast } from '@/components/pos'
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
import { dateRange, money, nights, type Trip, type TravelData } from './Travel'

// The trip drawer, as POS Travel.dc.html draws it: the trip's name and line,
// Edit details and a status pill, then Itinerary, Budget, Packing and Inbox.
// The same drawer in form mode is New trip, Add to wishlist and Edit details.
// Every row edits in place; nothing here is a modal on a modal.

type Tab = 'itin' | 'budget' | 'packing' | 'inbox'
type Kind = 'flight' | 'lodging' | 'transit' | 'activity' | 'food'

const KIND_TONE: Record<string, string> = {
  flight: 'text-brand',
  lodging: 'text-ink-2',
  transit: 'text-ink-3',
  activity: 'text-warn',
  food: 'text-warn',
}
const STATUS_TONE: Record<string, string> = {
  idea: 'text-ink-3 border-ink-3',
  planned: 'text-ink-2 border-ink-2',
  booked: 'text-brand border-brand',
  done: 'text-ink-4 border-ink-4',
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const at = (iso: string) => new Date(`${iso}T12:00:00`)
const isoPlus = (iso: string, days: number) => {
  const d = at(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
const shortDate = (iso: string) => `${MONTHS[at(iso).getMonth()]} ${at(iso).getDate()}`

const mini =
  'border border-rule-2 px-[9px] py-1 text-[11px] text-ink-3 transition-colors duration-150 hover:border-ink hover:text-ink'
const miniAccent =
  'border border-brand px-[9px] py-1 text-[11px] text-ink transition-colors duration-150 hover:bg-brand hover:text-bg'
const inlineInput =
  'min-w-0 border border-rule-2 bg-bg px-2 py-1 text-[12px] text-ink outline-none focus-visible:border-brand'

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
  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'itin', label: 'Itinerary' },
    { key: 'budget', label: 'Budget' },
    { key: 'packing', label: 'Packing' },
    { key: 'inbox', label: 'Inbox', badge: pending.length },
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
            <button type="button" onClick={() => setEditing(true)} className={mini}>
              Edit details
            </button>
            <span className={cn('label border px-1.5 py-0.5 text-[9px] tracking-[0.08em]', STATUS_TONE[trip.status] ?? STATUS_TONE.planned)}>
              {trip.status}
            </span>
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
              className="border border-rule-2 bg-transparent px-1.5 py-0.5 text-[12px] text-ink-3"
            >
              <option value="">Merge into…</option>
              {others.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete ${trip.name} and everything under it?`)) run(() => deleteTrip(trip.id), 'Trip deleted', onClose)
            }}
            className="text-[12px] text-ink-3 transition-colors duration-150 hover:text-bad"
          >
            Delete trip
          </button>
        </>
      }
    >
      <div role="tablist" aria-label="Trip" className="-mt-1 flex border-b border-rule">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px border-b-2 px-3 pb-2.5 pt-1 text-[13px] transition-colors duration-150 first:pl-0',
              tab === t.key ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:text-ink',
            )}
          >
            {t.label}
            {t.badge ? <span className="label ml-1.5 text-[9px] text-warn">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-[18px] flex flex-col gap-4">
        {tab === 'itin' && <Itinerary trip={trip} items={confirmed} run={run} />}
        {tab === 'budget' && <Budget trip={trip} items={items} lines={lines} run={run} />}
        {tab === 'packing' && <Packing trip={trip} packing={packing} run={run} />}
        {tab === 'inbox' && <Inbox pending={pending} run={run} />}
      </div>
    </Overlay>
  )
}

type Run = (action: () => Promise<ActionResult>, ok?: string, then?: () => void) => void

function Itinerary({ trip, items, run }: { trip: Trip; items: TravelData['itinerary']; run: Run }) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
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
      <div className="grid grid-cols-[44px_1fr_auto] items-start gap-2.5 border-b border-rule py-2">
        <span className="num pt-0.5 text-[10px] text-ink-3">{it.occursAt ?? ''}</span>
        <button type="button" title="Edit" onClick={() => setEditingId(it.id)} className="min-w-0 text-left hover:text-brand">
          <span className="block text-[13px] text-ink">{it.title}</span>
          {(it.detail || it.confirmation) && (
            <span className="mt-0.5 block text-[11px] text-ink-3">
              {[it.detail, it.confirmation ? `conf. ${it.confirmation}` : ''].filter(Boolean).join(' · ')}
            </span>
          )}
        </button>
        <span className="flex items-center gap-2">
          <span className={cn('label text-[9px] tracking-[0.08em]', KIND_TONE[it.kind] ?? 'text-ink-3')}>{it.kind}</span>
          <button type="button" aria-label={`Remove ${it.title}`} onClick={() => run(() => deleteItem(it.id), 'Removed')} className="text-[11px] text-ink-4 hover:text-bad">
            ✕
          </button>
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
              <span className="num text-[10px] text-ink-3">{shortDate(day)}</span>
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
          className="min-w-[180px] flex-1 border border-rule-2 bg-bg px-2.5 py-[7px] text-[12px] text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand"
        />
        <button type="submit" className={mini}>
          Add
        </button>
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
            {k[0].toUpperCase() + k.slice(1)}
          </option>
        ))}
      </select>
      <input value={day} onChange={(e) => setDay(e.target.value)} placeholder="Day" aria-label="Day" className={cn(inlineInput, 'num')} />
      <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Details · confirmation" aria-label="Details" className={inlineInput} />
      <span className="flex gap-1.5">
        <button type="button" onClick={save} className={miniAccent}>
          Save
        </button>
        <button type="button" onClick={onDone} className={mini}>
          Cancel
        </button>
      </span>
    </div>
  )
}

const DEFAULT_LINES = ['Flights', 'Lodging', 'Food', 'Transit', 'Activities']

function Budget({
  trip,
  items,
  lines,
  run,
}: {
  trip: Trip
  items: TravelData['itinerary']
  lines: TravelData['budgetLines']
  run: Run
}) {
  const [draft, setDraft] = useState('')
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
      <div className="grid grid-cols-3 gap-px border border-rule bg-rule">
        <div className="bg-bg px-3 py-2.5">
          <Eyebrow>Planned · total</Eyebrow>
          <input
            inputMode="decimal"
            defaultValue={dollars(trip.budgetCents)}
            aria-label="Planned total in dollars"
            onBlur={(e) => {
              const typed = parseNumber(e.target.value)
              const next = typed === null ? null : Math.round(typed * 100)
              if (next !== null && next !== trip.budgetCents) run(() => saveTrip({ id: trip.id, budget_cents: next }), 'Budget saved')
            }}
            className="num mt-1 w-full border-0 border-b border-rule-2 bg-transparent py-0.5 text-[18px] font-light text-ink outline-none focus-visible:border-brand"
          />
        </div>
        <div className="bg-bg px-3 py-2.5">
          <Eyebrow>Committed</Eyebrow>
          <div className={cn('num mt-1.5 text-[18px] font-light', totals.committed > totals.planned ? 'text-bad' : 'text-ink')}>{money(totals.committed)}</div>
        </div>
        <div className="bg-bg px-3 py-2.5">
          <Eyebrow>Remaining</Eyebrow>
          <div className={cn('num mt-1.5 text-[18px] font-light', totals.remaining < 0 ? 'text-bad' : 'text-ink')}>{money(totals.remaining)}</div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_90px_90px_20px] gap-2.5 text-[10px] uppercase tracking-[0.06em] text-ink-4">
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
                <button type="button" aria-label={`Remove ${l.category}`} onClick={() => run(() => deleteBudgetLine(trip.id, l.category), 'Removed')} className="text-[11px] text-ink-4 hover:text-bad">
                  ✕
                </button>
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
            className="border border-dashed border-rule py-4 text-[12px] text-ink-4 hover:text-ink"
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
          className="min-w-0 flex-1 border border-rule-2 bg-bg px-2.5 py-[7px] text-[12px] text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand"
        />
        <button type="submit" className={mini}>
          Add
        </button>
      </form>
      <p className="text-[11px] text-ink-4">
        Actuals are the trip&apos;s confirmed itinerary by kind; you can type over any number.
      </p>
    </>
  )
}

function Packing({ trip, packing, run }: { trip: Trip; packing: TravelData['packing']; run: Run }) {
  const [draft, setDraft] = useState('')
  const packed = packing.filter((p) => p.packed).length
  return (
    <>
      <div className="flex items-baseline justify-between">
        <Eyebrow>Packing list</Eyebrow>
        <span className="num text-[10px] text-ink-3">
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
              onClick={() => run(() => savePacking({ id: p.id, packed: !p.packed }))}
              className="flex min-w-0 flex-1 items-center gap-2.5 py-[7px] text-left"
            >
              <span aria-hidden className={cn('grid size-3.5 shrink-0 place-items-center border', p.packed ? 'border-brand bg-brand' : 'border-ink-3')}>
                {p.packed && <span className="size-1.5 bg-bg" />}
              </span>
              <span className={cn('truncate text-[12px]', p.packed ? 'text-ink-4 line-through' : 'text-ink')}>{p.label}</span>
            </button>
            <button type="button" aria-label={`Remove ${p.label}`} onClick={() => run(() => savePacking({ id: p.id, remove: true }), 'Removed')} className="px-0.5 text-[11px] text-ink-4 hover:text-bad">
              ✕
            </button>
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
          className="min-w-0 flex-1 border border-rule-2 bg-bg px-2.5 py-[7px] text-[12px] text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand"
        />
        <button type="submit" className={mini}>
          Add
        </button>
      </form>
    </>
  )
}

function Inbox({ pending, run }: { pending: TravelData['itinerary']; run: Run }) {
  return (
    <>
      <p className="text-[12px] leading-[1.5] text-ink-3">
        Confirmations an agent parsed wait here as itinerary items. Approve to add; nothing is
        added without you.
      </p>
      {pending.map((m) => (
        <div key={m.id} className="flex flex-col gap-2 border border-rule px-3.5 py-3">
          <div className="flex justify-between gap-2.5">
            <span className="min-w-0 truncate text-[11px] text-ink-3">Parsed booking · {m.kind}</span>
            <span className="label shrink-0 text-[9px] tracking-[0.08em] text-warn">pending</span>
          </div>
          <div className="text-[13px] text-ink">{m.title}</div>
          <div className="text-[11px] text-ink-3">
            {[m.occursOn ? shortDate(m.occursOn) : '', m.detail, m.amountCents > 0 ? money(m.amountCents) : '']
              .filter(Boolean)
              .join(' · ')}
            {m.confidence !== null ? ` · confidence ${Math.round(m.confidence * 100)}%` : ''}
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => run(() => decideItem(m.id, true), 'Added to the trip')} className={miniAccent}>
              Add
            </button>
            <button type="button" onClick={() => run(() => decideItem(m.id, false), 'Dismissed')} className={mini}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
      {pending.length === 0 && (
        <div className="border border-dashed border-rule p-5 text-center text-[12px] text-ink-4">Inbox is clear</div>
      )}
    </>
  )
}

function TripForm({
  trip,
  mode,
  onClose,
  run,
}: {
  trip: Trip | null
  mode: 'trip' | 'wish'
  onClose: () => void
  run: Run
}) {
  const [f, setF] = useState({
    name: trip?.name ?? '',
    destination: trip?.destination ?? '',
    lat: trip?.lat === null || trip?.lat === undefined ? '' : String(trip.lat),
    lon: trip?.lon === null || trip?.lon === undefined ? '' : String(trip.lon),
    start: trip?.startsOn ?? '',
    end: trip?.endsOn ?? '',
    budget: trip ? String(Math.round(trip.budgetCents / 100)) : '',
    travellers: trip ? String(trip.travellers) : '2',
    notes: trip?.notes ?? '',
  })
  const set = (key: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [key]: e.target.value }))
  const title = trip ? 'Edit details' : mode === 'wish' ? 'Add to wishlist' : 'New trip'

  // Destination suggestions: debounced so typing does not fire a request per
  // keystroke; picking a suggestion exactly fills lat/lon too, but a typed
  // number still wins because Lat and Lon stay plain inputs.
  const [hits, setHits] = useState<Hit[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestQuery = useRef('')
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])
  const onDestination = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const picked = hits.find((h) => h.label === value)
    setF((v) => ({
      ...v,
      destination: picked ? picked.label.split(',')[0] : value,
      ...(picked ? { lat: String(picked.lat), lon: String(picked.lon) } : {}),
    }))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      // A slow answer to an earlier query must not replace a newer list.
      suggestPlaces(value).then((found) => {
        if (value === latestQuery.current) setHits(found)
      })
    }, 300)
    latestQuery.current = value
  }
  const save = () => {
    if (!f.name.trim()) return
    const num = (v: string) => (v.trim() === '' ? null : Number(v))
    run(
      () =>
        saveTrip({
          id: trip?.id,
          name: f.name.trim(),
          destination: f.destination.trim(),
          lat: num(f.lat),
          lon: num(f.lon),
          notes: f.notes,
          ...(mode === 'trip'
            ? {
                starts_on: f.start || null,
                ends_on: f.end || null,
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
            <button type="button" onClick={onClose} className="text-[13px] text-ink-2 hover:text-ink">
              Cancel
            </button>
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
        <div className="grid grid-cols-[1fr_96px_96px] gap-3">
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Destination</Eyebrow>
            <input value={f.destination} onChange={onDestination} placeholder="City, country" list="destination-hits" className={field} />
            <datalist id="destination-hits">
              {hits.map((h) => (
                <option key={`${h.label} ${h.lat} ${h.lon}`} value={h.label} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Lat</Eyebrow>
            <input value={f.lat} onChange={set('lat')} placeholder="35.69" className={cn(field, 'num')} />
          </label>
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Lon</Eyebrow>
            <input value={f.lon} onChange={set('lon')} placeholder="139.69" className={cn(field, 'num')} />
          </label>
        </div>
        {mode === 'trip' ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <Eyebrow>Depart</Eyebrow>
              <input type="date" value={f.start} onChange={set('start')} className={cn(field, 'num')} />
            </label>
            <label className="flex flex-col gap-1.5">
              <Eyebrow>Return</Eyebrow>
              <input type="date" value={f.end} onChange={set('end')} className={cn(field, 'num')} />
            </label>
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
        <p className="text-[11px] text-ink-4">Coordinates place the pin on the globe; without them the trip is listed and not drawn.</p>
      </div>
    </Overlay>
  )
}
