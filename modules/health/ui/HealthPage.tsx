import { Eyebrow, PageHeader } from '@/components/pos'
import { getDigest } from '@/core/digests'
import { readMetric } from '@/core/metrics'
import { ownerToday } from '@/core/today'
import {
  latestVitals,
  listAppointments,
  listMedications,
  listProviders,
  listRecords,
  listScreenings,
} from '../data'
import { screeningStatus } from '../screening'
import { Health, LogVisitButton, type HealthData } from './Health'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default async function HealthPage() {
  const [
    appointments,
    medications,
    vitals,
    records,
    screenings,
    providers,
    todayIso,
    bodyWeight,
    insurance,
  ] =
    await Promise.all([
      listAppointments(),
      listMedications(),
      latestVitals(),
      listRecords(),
      listScreenings(),
      listProviders(),
      ownerToday(),
      // Body weight belongs to Fitness. Read through the registry rather than
      // duplicated into a health.vital row, so there is one source of truth and
      // it is simply absent when that module is not installed.
      readMetric('fitness.body_weight'),
      // What health cover costs, from the Insurance module's digest. Through
      // core.digests rather than the insurance schema: this module reads no
      // other module's tables, and an Insurance that has not run tonight
      // contributes no line rather than an error.
      getDigest('insurance'),
    ])

  const money = (cents: number) =>
    `$${Math.round(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  const annual = typeof insurance?.annualCents === 'number' ? insurance.annualCents : null
  const active = typeof insurance?.active === 'number' ? insurance.active : null
  const expiring = Array.isArray(insurance?.expiring) ? insurance.expiring.length : null

  const data: HealthData = {
    todayIso,
    bodyWeightLb: bodyWeight,
    coverage: [
      ...(annual === null ? [] : [{ label: 'Premiums a year', value: money(annual) }]),
      ...(annual === null ? [] : [{ label: 'A month', value: money(Math.round(annual / 12)) }]),
      ...(active === null ? [] : [{ label: 'Active policies', value: String(active) }]),
      ...(expiring ? [{ label: 'Expiring inside 60 days', value: String(expiring) }] : []),
    ],
    appointments: appointments.map((a) => ({
      id: a.id,
      what: a.what,
      startsAt: new Date(a.starts_at).toISOString(),
      location: a.location,
      status: a.status,
      prep: a.prep,
      notes: a.notes,
      costCents: a.cost_estimate_cents,
      providerId: a.provider_id,
      provider: a.provider_name,
      providerRole: a.provider_role,
      providerAddress: a.provider_address,
    })),
    medications: medications.map((m) => ({
      id: m.id,
      name: m.name,
      dose: m.dose,
      schedule: m.schedule,
      startedOn: m.started_on,
      refillOn: m.refill_on,
      ended: m.ended_on !== null,
      taken: m.taken,
    })),
    vitals: vitals.map((v) => ({
      metric: v.metric,
      value: Number(v.value),
      valueText: v.value_text,
      measuredAt: new Date(v.measured_at).toISOString(),
      provenance: v.provenance,
      prevValue: v.prev_value === null ? null : Number(v.prev_value),
      prevMeasuredAt: v.prev_measured_at === null ? null : new Date(v.prev_measured_at).toISOString(),
    })),
    records: records.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      takenOn: r.taken_on,
      summary: r.summary,
      fields: r.fields,
      file: r.file_path === null ? null : /\.(png|jpe?g|webp|heic|gif)$/i.test(r.file_path) ? 'IMAGE' : 'PDF',
    })),
    screenings: screenings.map((s) => ({
      id: s.id,
      name: s.name,
      intervalMonths: s.interval_months,
      lastDoneOn: s.last_done_on,
      snoozeUntil: s.snooze_until,
    })),
    providers: providers.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      phone: p.phone,
      address: p.address,
      notes: p.notes,
    })),
  }

  const now = new Date()
  const next = data.appointments.find((a) => new Date(a.startsAt) >= now && a.status !== 'cancelled')
  const overdue = data.screenings.filter((s) => screeningStatus(s, todayIso) === 'overdue').length
  const nextLabel = next
    ? `next visit ${new Date(next.startsAt).getDate()} ${MONTHS[new Date(next.startsAt).getMonth()]}`
    : 'nothing booked'

  return (
    <div className="space-y-[22px]">
      <PageHeader
        eyebrow="Health / Overview"
        status={
          <Eyebrow dot={overdue > 0 ? 'bad' : 'brand'} className="whitespace-nowrap">
            {overdue > 0 ? `${overdue} screening${overdue === 1 ? '' : 's'} overdue` : 'Nothing overdue'} · {nextLabel}
          </Eyebrow>
        }
        title="Health"
        lede="Appointments, medications, vitals and documents in one place. Vitals that Fitness already reads are pulled in rather than typed twice."
        actions={<LogVisitButton />}
      />
      <Health data={data} />
    </div>
  )
}
