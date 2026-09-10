'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import {
  ActionButton,
  Chip,
  EmptyState,
  MetricStrip,
  MetricTile,
  Row,
  RowList,
  Eyebrow,
  StatusChip,
  Switch,
  TabBar,
  useToast,
} from '@/components/pos'
import { dueOn, screeningLabel, screeningStatus, streak } from '../screening'
import {
  completeScreening,
  markMedication,
  setAppointmentStatus,
  snoozeScreening,
  type ActionResult,
} from './actions'

export type HealthData = {
  todayIso: string
  /** From the Fitness module through the registry, or null when it is not installed. */
  bodyWeightLb: number | null
  appointments: {
    id: string
    what: string
    startsAt: string
    location: string
    status: string
    prep: string
    costCents: number | null
    provider: string | null
    providerRole: string | null
  }[]
  medications: {
    id: string
    name: string
    dose: string
    schedule: string
    refillOn: string | null
    ended: boolean
    taken: string[]
  }[]
  vitals: { metric: string; value: number; valueText: string; measuredAt: string; provenance: string }[]
  records: { id: string; title: string; kind: string; takenOn: string; summary: string; hasFile: boolean }[]
  screenings: {
    id: string
    name: string
    intervalMonths: number
    lastDoneOn: string | null
    snoozeUntil: string | null
  }[]
  providers: { id: string; name: string; role: string; phone: string; notes: string }[]
  /** From the Insurance module's digest, or empty when it wrote none. */
  coverage: { label: string; value: string }[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "21 Sep", for a due date with no time on it. */
const shortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

const when = (iso: string) => {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.toTimeString().slice(0, 5)}`
}

const VITAL_LABELS: Record<string, string> = {
  blood_pressure: 'Blood pressure',
  ldl: 'LDL cholesterol',
  hdl: 'HDL cholesterol',
  triglycerides: 'Triglycerides',
  a1c: 'HbA1c',
  glucose: 'Fasting glucose',
  vitamin_d: 'Vitamin D',
  tsh: 'TSH',
}

const STATUS_TONE = {
  overdue: 'bad',
  due: 'warn',
  never: 'warn',
  soon: 'warn',
  snoozed: 'quiet',
  ok: 'brand',
} as const

export function Health({ data }: { data: HealthData }) {
  const router = useRouter()
  const params = useSearchParams()
  const tab = params.get('tab') ?? 'appointments'

  const setTab = (next: string) => {
    const search = new URLSearchParams(params.toString())
    if (next === 'appointments') search.delete('tab')
    else search.set('tab', next)
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

  const now = new Date()
  const active = data.medications.filter((m) => !m.ended)

  const dueSoon = data.screenings
    .map((sc) => ({ ...sc, status: screeningStatus(sc, data.todayIso), due: dueOn(sc) }))
    .filter((sc) => sc.status === 'due' || sc.status === 'overdue' || sc.status === 'never')

  return (
    <div className="flex flex-wrap items-start gap-x-7 gap-y-5">
      <div className="min-w-0 flex-[1_1_540px] space-y-5">
      <TabBar
        label="Health views"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'appointments', label: 'Appointments', count: data.appointments.length },
          { value: 'medications', label: 'Medications', count: active.length },
          { value: 'screenings', label: 'Screenings', count: data.screenings.length },
          { value: 'vitals', label: 'Vitals', count: data.vitals.length },
          { value: 'records', label: 'Records', count: data.records.length },
          { value: 'team', label: 'Care team', count: data.providers.length },
        ]}
      />

      {tab === 'appointments' &&
        (data.appointments.length === 0 ? (
          <EmptyState headline="Nothing booked">
            An appointment carries what to do beforehand, which is the part that is useless the day
            after and vital the day before.
          </EmptyState>
        ) : (
          <RowList>
            {data.appointments.map((a) => {
              const past = new Date(a.startsAt) < now
              return (
                <Row
                  key={a.id}
                  title={a.what}
                  muted={past || a.status === 'cancelled'}
                  meta={[
                    when(a.startsAt),
                    a.provider ? `${a.provider}${a.providerRole ? `, ${a.providerRole}` : ''}` : '',
                    a.location,
                  ]
                    .filter(Boolean)
                    .join(' / ')}
                  right={
                    <>
                      <StatusChip tone={a.status === 'done' ? 'brand' : past ? 'warn' : 'quiet'}>
                        {a.status}
                      </StatusChip>
                      {!past && a.status !== 'cancelled' && (
                        <ActionButton
                          onClick={() => run(() => setAppointmentStatus(a.id, 'done'), 'Marked done')}
                        >
                          Mark done
                        </ActionButton>
                      )}
                    </>
                  }
                >
                  {a.prep && !past && (
                    <p className="t-caption rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-ink-2">
                      Before you go: {a.prep}
                    </p>
                  )}
                </Row>
              )
            })}
          </RowList>
        ))}

      {tab === 'medications' &&
        (active.length === 0 ? (
          <EmptyState headline="Nothing prescribed">
            A medication tracks its schedule and when to reorder. One mark a day; pressing it twice
            is a correction, not a second dose.
          </EmptyState>
        ) : (
          <RowList>
            {active.map((m) => {
              const takenToday = m.taken.includes(data.todayIso)
              const run_ = streak(m.taken, data.todayIso)
              return (
                <Row
                  key={m.id}
                  title={m.name}
                  meta={[
                    m.dose,
                    m.schedule,
                    m.refillOn ? `reorder by ${m.refillOn}` : '',
                    // Today unmarked does not break a streak; it is not the end
                    // of the day yet.
                    run_ > 0 ? `${run_} day run` : '',
                  ]
                    .filter(Boolean)
                    .join(' / ')}
                  right={
                    <Switch
                      label={`Taken today, ${m.name}`}
                      checked={takenToday}
                      onChange={(next) => run(() => markMedication(m.id, next))}
                    />
                  }
                />
              )
            })}
          </RowList>
        ))}

      {tab === 'screenings' &&
        (data.screenings.length === 0 ? (
          <EmptyState headline="None tracked">
            A screening is a name and an interval. Completing one resets the clock; snoozing pushes
            it out without making it go away.
          </EmptyState>
        ) : (
          <RowList>
            {data.screenings.map((s) => {
              const shape = {
                intervalMonths: s.intervalMonths,
                lastDoneOn: s.lastDoneOn,
                snoozeUntil: s.snoozeUntil,
              }
              const status = screeningStatus(shape, data.todayIso)
              return (
                <Row
                  key={s.id}
                  title={s.name}
                  meta={`every ${s.intervalMonths} months / ${screeningLabel(shape, data.todayIso)}`}
                  right={
                    <>
                      <StatusChip tone={STATUS_TONE[status]}>{status}</StatusChip>
                      <ActionButton
                        onClick={() => run(() => completeScreening(s.id), `${s.name} recorded`)}
                      >
                        Done
                      </ActionButton>
                      <ActionButton onClick={() => run(() => snoozeScreening(s.id, 3), 'Pushed out three months')}>
                        3mo
                      </ActionButton>
                    </>
                  }
                />
              )
            })}
          </RowList>
        ))}

      {tab === 'vitals' && (
        <div className="space-y-4">
          <MetricStrip>
            {data.bodyWeightLb !== null && (
              <MetricTile
                label="Body weight"
                value={`${Math.round(data.bodyWeightLb)} lb`}
                // Named rather than implied: it is not stored here, and saying
                // so is what keeps one source of truth honest.
                delta="from Fitness"
                deltaTone="quiet"
              />
            )}
            {data.vitals.map((v) => (
              <MetricTile
                key={v.metric}
                label={VITAL_LABELS[v.metric] ?? v.metric}
                value={v.valueText || String(v.value)}
                delta={`${v.provenance}, ${v.measuredAt.slice(0, 10)}`}
                deltaTone="quiet"
              />
            ))}
          </MetricStrip>

          {data.vitals.length === 0 && data.bodyWeightLb === null && (
            <EmptyState headline="No readings">
              Clinical readings live here: blood pressure, lipids, glucose. Body weight and resting
              heart rate belong to Fitness, so they are read from there rather than kept twice.
            </EmptyState>
          )}

          <p className="t-caption text-ink-3">
            Every reading shows where it came from, because that is what decides whether it is worth
            acting on. Nothing here offers an opinion about what a number means.
          </p>
        </div>
      )}

      {tab === 'records' &&
        (data.records.length === 0 ? (
          <EmptyState headline="No records">
            A record keeps whatever the document carried, as written. A lab panel has forty
            analytes and every provider names them differently, so nothing tries to parse them into
            columns.
          </EmptyState>
        ) : (
          <RowList>
            {data.records.map((r) => (
              <Row
                key={r.id}
                title={r.title}
                meta={`${r.kind} / ${r.takenOn}${r.summary ? ` / ${r.summary}` : ''}`}
                right={r.hasFile ? <Chip tone="quiet">file</Chip> : undefined}
              />
            ))}
          </RowList>
        ))}

      {tab === 'team' &&
        (data.providers.length === 0 ? (
          <EmptyState headline="Nobody yet">
            The people you actually call. A name, what they do, and a number.
          </EmptyState>
        ) : (
          <RowList>
            {data.providers.map((p) => (
              <Row
                key={p.id}
                title={p.name}
                meta={[p.role, p.phone, p.notes].filter(Boolean).join(' / ')}
              />
            ))}
          </RowList>
        ))}
      </div>

      {/* The artboard's rail: what is owed, what it costs, and who to ring.
        * Three things that are true whichever tab is open. */}
      <aside className="min-w-0 flex-[1_1_320px] space-y-6 lg:max-w-[400px]">
        <section className="space-y-2.5">
          <Eyebrow dot={dueSoon.length > 0 ? 'warn' : 'ok'}>Due and overdue</Eyebrow>
          {dueSoon.length === 0 ? (
            <p className="t-caption text-ink-3">
              Nothing is owed. A screening you have never had would say so here rather than
              claiming to be late.
            </p>
          ) : (
            <RowList>
              {dueSoon.map((sc) => (
                <Row
                  key={sc.id}
                  title={sc.name}
                  meta={
                    sc.status === 'never'
                      ? 'never done'
                      : `due ${sc.due ? shortDate(sc.due) : 'unknown'}`
                  }
                  right={
                    <StatusChip tone={sc.status === 'overdue' ? 'bad' : 'warn'}>
                      {sc.status}
                    </StatusChip>
                  }
                />
              ))}
            </RowList>
          )}
        </section>

        <section className="space-y-2.5">
          <Eyebrow>Insurance and cost</Eyebrow>
          {data.coverage.length === 0 ? (
            <p className="t-caption text-ink-3">
              Nothing from Insurance. Its nightly digest is where these come from, so a module that
              has not run tonight contributes no line.
            </p>
          ) : (
            <RowList>
              {data.coverage.map((c) => (
                <Row key={c.label} title={c.label} right={<span className="num text-[13px] text-ink">{c.value}</span>} />
              ))}
            </RowList>
          )}
          <p className="t-caption text-ink-4">
            Read from Insurance rather than copied here, so there is one number and it is the
            current one.
          </p>
        </section>

        <section className="space-y-2.5">
          <Eyebrow>Care team</Eyebrow>
          {data.providers.length === 0 ? (
            <p className="t-caption text-ink-3">Nobody yet.</p>
          ) : (
            <RowList>
              {data.providers.slice(0, 5).map((p) => (
                <Row key={p.id} title={p.name} meta={[p.role, p.phone].filter(Boolean).join(' / ')} />
              ))}
            </RowList>
          )}
        </section>
      </aside>
    </div>
  )
}
