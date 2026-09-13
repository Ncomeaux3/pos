'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { ActionButton, Eyebrow, useToast } from '@/components/pos'
import { useSearchState } from '@/components/pos/searchState'
import { cn } from '@/lib/utils'
import { dueOn, screeningStatus, type ScreeningStatus } from '../screening'
import { completeScreening, markMedication, snoozeScreening, type ActionResult } from './actions'
import { HealthDrawer } from './HealthDrawer'

// The Health page as the artboard draws it: a left pane of vitals tiles,
// appointments, medications and records, a right rail of what is owed, what
// cover costs and who to ring, and one drawer for an appointment, a record or
// the Log a visit form. Every list is the whole list; nothing hides behind a
// tab.

export type Appointment = {
  id: string
  what: string
  startsAt: string
  location: string
  status: string
  prep: string
  notes: string
  costCents: number | null
  providerId: string | null
  provider: string | null
  providerRole: string | null
  providerAddress: string | null
}

export type HealthRecord = {
  id: string
  title: string
  kind: string
  takenOn: string
  summary: string
  fields: Record<string, string>
  file: 'PDF' | 'IMAGE' | null
}

export type HealthData = {
  todayIso: string
  /** From the Fitness module through the registry, or null when it is not installed. */
  bodyWeightLb: number | null
  appointments: Appointment[]
  medications: {
    id: string
    name: string
    dose: string
    schedule: string
    startedOn: string | null
    refillOn: string | null
    ended: boolean
    taken: string[]
  }[]
  vitals: {
    metric: string
    value: number
    valueText: string
    measuredAt: string
    provenance: string
    prevValue: number | null
    prevMeasuredAt: string | null
  }[]
  records: HealthRecord[]
  screenings: {
    id: string
    name: string
    intervalMonths: number
    lastDoneOn: string | null
    snoozeUntil: string | null
  }[]
  providers: { id: string; name: string; role: string; phone: string; address: string; notes: string }[]
  /** From the Insurance module's digest, or empty when it wrote none. */
  coverage: { label: string; value: string }[]
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "12 MAR 2026", the artboard's record date. */
export const recordDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()].toUpperCase()} ${d.getFullYear()}`
}

/** "Fri 18 Sep 2026, 08:30", the drawer's When row. */
export const longWhen = (iso: string) => {
  const d = new Date(iso)
  return `${DOWS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${d.toTimeString().slice(0, 5)}`
}

const monthYear = (iso: string) => {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((new Date(`${toIso}T12:00:00`).getTime() - new Date(`${fromIso}T12:00:00`).getTime()) / 86_400_000)

export const VITAL_LABELS: Record<string, string> = {
  blood_pressure: 'Blood pressure',
  ldl: 'LDL',
  hdl: 'HDL',
  triglycerides: 'Triglycerides',
  a1c: 'HbA1c',
  glucose: 'Fasting glucose',
  vitamin_d: 'Vitamin D',
  tsh: 'TSH',
}

export const KIND_LABEL: Record<string, string> = {
  lab: 'Lab',
  visit: 'Visit',
  imaging: 'Imaging',
  dental: 'Dental',
  vision: 'Vision',
  immunisation: 'Immunisation',
}

// The artboard's three control shapes.
export const pill = (on: boolean) =>
  cn(
    'num h-[30px] shrink-0 border px-[11px] text-[10px] tracking-[0.1em] uppercase transition-colors duration-150',
    on ? 'border-brand bg-brand-soft text-ink' : 'border-rule-2 text-ink-3 hover:text-ink',
  )
export const small =
  'num inline-flex h-8 shrink-0 items-center whitespace-nowrap border border-rule-2 px-3 text-[10px] tracking-[0.08em] text-ink-3 transition-colors duration-150 hover:border-ink hover:text-ink'
export const ctl =
  'inline-flex h-10 shrink-0 items-center whitespace-nowrap border border-rule-2 px-4 text-[11px] tracking-[0.12em] uppercase text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink'
export const accentOutline =
  'inline-flex h-[34px] shrink-0 items-center whitespace-nowrap border border-brand px-[13px] text-[12px] text-brand transition-colors duration-150 hover:bg-brand hover:text-white'

function useParams() {
  const { params, set: setParams } = useSearchState()
  return { params, setParams }
}

/** The title block's "Log a visit": the form drawer, in the URL. */
export function LogVisitButton() {
  const { setParams } = useParams()
  return (
    <ActionButton variant="accent" className="h-10 px-4 text-[13px]" onClick={() => setParams({ new: '1', appt: null, record: null }, { push: true })}>
      Log a visit
    </ActionButton>
  )
}

export function Health({ data }: { data: HealthData }) {
  // Which appointment or record is open, and whether the form is, live in the
  // URL so a screenshot survives the theme reload and a row can be linked to.
  const { params, setParams } = useParams()
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [filter, setFilter] = useState<'all' | 'lab' | 'visit' | 'imaging' | 'other'>('all')
  const [query, setQuery] = useState('')
  const [, start] = useTransition()
  const toast = useToast()

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  const now = new Date()
  const isPast = (a: Appointment) => a.status === 'done' || a.status === 'cancelled' || new Date(a.startsAt) < now
  const upcoming = data.appointments.filter((a) => !isPast(a))
  const shownAppts = tab === 'upcoming' ? upcoming : data.appointments.filter(isPast)

  const active = data.medications.filter((m) => !m.ended)
  const takenToday = active.filter((m) => m.taken.includes(data.todayIso)).length
  const lowest = active
    .filter((m) => m.refillOn)
    .map((m) => ({ name: m.name, days: daysBetween(data.todayIso, m.refillOn!) }))
    .sort((a, b) => a.days - b.days)[0]

  const q = query.trim().toLowerCase()
  const records = data.records.filter((r) => {
    const inFilter =
      filter === 'all' ? true : filter === 'other' ? !['lab', 'visit', 'imaging'].includes(r.kind) : r.kind === filter
    return inFilter && (!q || `${r.title} ${r.summary} ${r.kind}`.toLowerCase().includes(q))
  })

  const openAppt = params.get('appt') ? (data.appointments.find((a) => a.id === params.get('appt')) ?? null) : null
  const openRecord = params.get('record') ? (data.records.find((r) => r.id === params.get('record')) ?? null) : null
  const drawerOpen = openAppt !== null || openRecord !== null || params.get('new') === '1'

  return (
    <div className="-mx-[18px] flex flex-wrap items-start border-t border-rule md:-mx-7">
      <div className="flex min-w-0 flex-[1_1_540px] flex-col gap-7 px-[18px] pb-10 pt-[22px] md:px-7">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,158px),1fr))] gap-2.5">
          {data.bodyWeightLb !== null && (
            <Tile name="Weight" src="FITNESS" value={String(Math.round(data.bodyWeightLb))} delta="lb · from Fitness" />
          )}
          {data.vitals.map((v) => (
            <Tile
              key={v.metric}
              name={VITAL_LABELS[v.metric] ?? v.metric}
              src={v.provenance.toUpperCase()}
              value={v.valueText || String(v.value)}
              delta={
                v.prevValue !== null && v.metric !== 'blood_pressure'
                  ? `${v.value - v.prevValue > 0 ? '+' : ''}${Math.round((v.value - v.prevValue) * 10) / 10} · since ${monthYear(v.prevMeasuredAt!)}`
                  : monthYear(v.measuredAt)
              }
            />
          ))}
          {data.vitals.length === 0 && data.bodyWeightLb === null && (
            <p className="text-[12px] text-ink-4">No readings yet. Blood pressure, lipids and glucose live here; weight comes from Fitness.</p>
          )}
        </div>

        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <Eyebrow>Appointments</Eyebrow>
            <div role="tablist" aria-label="Appointment views" className="flex flex-wrap gap-1.5">
              {(['upcoming', 'past'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={pill(tab === t)}>
                  {t === 'upcoming' ? 'Upcoming' : 'History'}
                </button>
              ))}
            </div>
          </div>
          {shownAppts.map((a) => {
            const d = new Date(a.startsAt)
            const held = a.status === 'held'
            const past = isPast(a)
            const tone = past ? 'text-ink-3' : held ? 'text-warn' : 'text-brand'
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setParams({ appt: a.id, record: null, new: null }, { push: true })}
                className={cn(
                  'mt-2.5 flex w-full flex-wrap items-center gap-3 gap-x-4 border bg-bg-elev p-4 text-left transition-colors duration-150 hover:border-ink',
                  held ? 'border-warn' : 'border-rule-2',
                )}
              >
                <span className="w-[58px] shrink-0">
                  <span className={cn('num block text-[10px] tracking-[0.1em]', tone)}>{MONTHS[d.getMonth()].toUpperCase()}</span>
                  <span className={cn('num block text-[22px] font-light leading-[1.1]', tone)}>{String(d.getDate()).padStart(2, '0')}</span>
                </span>
                <span className="min-w-0 flex-[1_1_200px]">
                  <span className="block text-[15px] text-ink">{a.what}</span>
                  <span className="mt-1 block text-[11px] leading-[1.45] text-ink-3">
                    {[a.provider, a.location].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-2.5">
                  <span className="num text-[10px] text-ink-3">{d.toTimeString().slice(0, 5)}</span>
                  <span
                    className={cn(
                      'num border px-[7px] py-1 text-[9px] tracking-[0.1em] uppercase',
                      held ? 'border-warn text-warn' : past ? 'border-rule-2 text-ink-3' : 'border-brand text-brand',
                    )}
                  >
                    {a.status}
                  </span>
                </span>
              </button>
            )
          })}
          {shownAppts.length === 0 && (
            <div className="mt-3 border border-dashed border-rule-2 px-[18px] py-[30px] text-center">
              <div className="num text-[20px] font-light text-ink-2">{tab === 'upcoming' ? 'NOTHING BOOKED' : 'NO HISTORY'}</div>
              <div className="mt-2 text-[12px] text-ink-3">
                {tab === 'upcoming' ? 'Nothing is on the calendar. Log a visit with a future date to add one.' : 'Nothing has happened yet.'}
              </div>
            </div>
          )}
        </section>

        <section>
          <Eyebrow>Medications &amp; supplements</Eyebrow>
          {active.map((m) => {
            const taken = m.taken.includes(data.todayIso)
            const days = m.refillOn ? daysBetween(data.todayIso, m.refillOn) : null
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3 gap-x-3.5 border-b border-rule py-[15px]">
                <span className="min-w-0 flex-[1_1_200px]">
                  <span className="block text-[15px] text-ink">{[m.name, m.dose].filter(Boolean).join(' · ')}</span>
                  <span className="mt-1 block text-[11px] leading-[1.45] text-ink-3">
                    {[m.schedule, m.startedOn ? `started ${monthYear(m.startedOn)}` : ''].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {days !== null && (
                  <span className={cn('num shrink-0 text-[10px]', days < 0 ? 'text-bad' : days <= 10 ? 'text-warn' : 'text-ink-3')}>
                    {days < 0 ? 'REFILL OVERDUE' : `${days} DAYS LEFT`}
                  </span>
                )}
                <button
                  type="button"
                  aria-pressed={taken}
                  aria-label={`Taken today, ${m.name}`}
                  onClick={() => run(() => markMedication(m.id, !taken))}
                  className={cn(
                    small,
                    taken && 'border-brand bg-brand-soft text-ink',
                  )}
                >
                  {taken ? 'Taken today' : 'Mark taken'}
                </button>
              </div>
            )
          })}
          {active.length === 0 && <p className="mt-3 text-[12px] text-ink-4">Nothing prescribed.</p>}
          {active.length > 0 && (
            <p className="mt-3 text-[12px] leading-[1.5] text-ink-3">
              {takenToday} of {active.length} marked today.
              {lowest && lowest.days <= 10 && lowest.days >= 0 && ` ${lowest.name} is down to ${lowest.days} ${lowest.days === 1 ? 'day' : 'days'}.`}
              {lowest && lowest.days < 0 && ` ${lowest.name} is past its refill date.`}
            </p>
          )}
        </section>

        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <Eyebrow>Records</Eyebrow>
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search records"
                placeholder="Search records"
                className="h-[30px] w-[150px] border border-rule-2 bg-transparent px-2.5 text-[11px] text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand"
              />
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['all', 'All'],
                    ['lab', 'Labs'],
                    ['visit', 'Visits'],
                    ['imaging', 'Imaging'],
                    ['other', 'Other'],
                  ] as const
                ).map(([f, label]) => (
                  <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={pill(filter === f)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 border-b border-rule-2 px-3 pb-2.5 pt-3.5 text-[10px] tracking-[0.12em] text-ink-3">
            <span className="min-w-0 flex-[1_1_200px]">RECORD</span>
            <span className="shrink-0">TYPE · DATE · FILE</span>
          </div>
          {records.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setParams({ record: r.id, appt: null, new: null }, { push: true })}
              className="flex w-full flex-wrap items-center gap-3 gap-x-3.5 border-b border-rule px-3 py-[15px] text-left transition-colors duration-150 hover:bg-brand-soft"
            >
              <span className="min-w-0 flex-[1_1_200px]">
                <span className="block text-[14px] text-ink">{r.title}</span>
                {r.summary && <span className="mt-1 block text-[11px] leading-[1.45] text-ink-3">{r.summary}</span>}
              </span>
              <span className="flex shrink-0 flex-wrap items-center gap-3">
                <span className={cn('num text-[9px] tracking-[0.1em] uppercase', r.kind === 'lab' ? 'text-brand' : r.kind === 'imaging' ? 'text-warn' : 'text-ink-3')}>
                  {r.kind}
                </span>
                <span className="num text-[10px] text-ink-3">{recordDate(r.takenOn)}</span>
                <span className="num text-[9px] tracking-[0.08em] text-ink-3">{r.file ?? 'NO FILE'}</span>
              </span>
            </button>
          ))}
          {records.length === 0 && (
            <div className="mt-3 border border-dashed border-rule-2 px-[18px] py-[30px] text-center">
              <div className="num text-[20px] font-light text-ink-2">{data.records.length === 0 ? 'NO RECORDS' : 'NO MATCHES'}</div>
              <div className="mt-2 text-[12px] text-ink-3">
                {data.records.length === 0 ? 'Log a visit with a past date to file one.' : q ? `Nothing in this filter matches "${query.trim()}".` : 'Nothing in this filter.'}
              </div>
            </div>
          )}
        </section>
      </div>

      <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-[26px] border-t border-rule px-[18px] pb-10 pt-[22px] md:max-w-[400px] md:px-6">
        <section>
          <Eyebrow>Due &amp; overdue</Eyebrow>
          {data.screenings.map((s) => {
            const status = screeningStatus(s, data.todayIso)
            const booked = upcoming.find((a) => a.what.toLowerCase() === s.name.toLowerCase())
            const state: ScreeningStatus | 'scheduled' = booked ? 'scheduled' : status
            if (state === 'ok' || state === 'snoozed') return null
            const due = dueOn(s)
            const label =
              state === 'scheduled'
                ? `Booked for ${new Date(booked!.startsAt).getDate()} ${MONTHS[new Date(booked!.startsAt).getMonth()]}`
                : s.lastDoneOn
                  ? `Last done ${monthYear(s.lastDoneOn)} · ${Math.round(-daysBetween(data.todayIso, s.lastDoneOn) / 30)} months ago`
                  : 'Never done'
            const tone =
              state === 'overdue' ? 'text-bad' : state === 'scheduled' ? 'text-brand' : state === 'never' ? 'text-ink-3' : 'text-warn'
            return (
              <div key={s.id} className={cn('mt-2.5 border bg-bg-elev p-3.5', state === 'overdue' ? 'border-bad' : 'border-rule-2')}>
                <div className="flex items-baseline justify-between gap-2.5">
                  <span className={cn('num text-[9px] tracking-[0.12em]', tone)}>
                    {state === 'scheduled' ? 'SCHEDULED' : state === 'overdue' ? 'OVERDUE' : state === 'never' ? 'NEVER DONE' : 'DUE SOON'}
                  </span>
                  <span className="num text-[10px] text-ink-3">EVERY {s.intervalMonths} MO</span>
                </div>
                <div className="mt-[7px] text-[14px] leading-[1.4] text-ink">{s.name}</div>
                <div className="mt-1 text-[11px] leading-[1.45] text-ink-3">
                  {label}
                  {due && state !== 'scheduled' && state !== 'never' ? ` · due ${new Date(`${due}T12:00:00`).getDate()} ${MONTHS[new Date(`${due}T12:00:00`).getMonth()]}` : ''}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {state === 'scheduled' ? (
                    <button type="button" className={accentOutline} onClick={() => setParams({ appt: booked!.id, record: null, new: null }, { push: true })}>
                      View appointment
                    </button>
                  ) : (
                    <>
                      <button type="button" className={accentOutline} onClick={() => run(() => completeScreening(s.id), `${s.name} recorded`)}>
                        Mark done
                      </button>
                      <button type="button" className={small} onClick={() => run(() => snoozeScreening(s.id, 3), 'Pushed out three months')}>
                        Snooze 3 mo
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {data.screenings.every((s) => ['ok', 'snoozed'].includes(screeningStatus(s, data.todayIso))) && (
            <p className="mt-3 text-[12px] text-ink-4">Nothing is owed.</p>
          )}
        </section>

        <section>
          <Eyebrow>Insurance &amp; cost</Eyebrow>
          {data.coverage.map((c) => (
            <div key={c.label} className="flex flex-wrap items-baseline gap-2 gap-x-3 border-b border-rule py-[11px]">
              <span className="min-w-0 flex-[1_1_130px] text-[13px] text-ink">{c.label}</span>
              <span className="num shrink-0 text-[12px] text-ink-2">{c.value}</span>
            </div>
          ))}
          <p className="mt-3 text-[11px] leading-[1.5] text-ink-3">
            {data.coverage.length === 0 ? 'Nothing from Insurance yet: its nightly digest is where these come from. ' : ''}
            Plan details live in{' '}
            <Link href="/insurance" className="border-b border-rule-2 text-ink-3 hover:text-ink">
              Insurance
            </Link>
            .
          </p>
        </section>

        <section>
          <Eyebrow>Care team</Eyebrow>
          {data.providers.map((p) => (
            <div key={p.id} className="border-b border-rule py-3">
              <div className="flex items-baseline justify-between gap-2.5">
                <span className="text-[13px] text-ink">{p.name}</span>
                <span className="num text-[9px] tracking-[0.1em] uppercase text-ink-3">{p.role}</span>
              </div>
              <div className="mt-1 text-[11px] text-ink-3">{[p.phone, p.address || p.notes].filter(Boolean).join(' · ')}</div>
            </div>
          ))}
          {data.providers.length === 0 && <p className="mt-3 text-[12px] text-ink-4">Nobody yet.</p>}
        </section>
      </aside>

      {drawerOpen && (
        <HealthDrawer
          appointment={openAppt}
          record={openRecord}
          isNew={params.get('new') === '1'}
          providers={data.providers}
          todayIso={data.todayIso}
          onClose={() => setParams({ appt: null, record: null, new: null })}
          onRun={run}
        />
      )}
    </div>
  )
}

function Tile({ name, src, value, delta }: { name: string; src: string; value: string; delta: string }) {
  return (
    <div className="border border-rule-2 bg-bg-elev p-[15px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-ink-3">{name}</span>
        <span className="num text-[9px] tracking-[0.1em] text-ink-3">{src}</span>
      </div>
      <div className="num mt-2 text-[25px] font-light leading-none tracking-[-0.02em] text-ink">{value}</div>
      <div className="num mt-1.5 text-[10px] text-ink-3">{delta}</div>
    </div>
  )
}
