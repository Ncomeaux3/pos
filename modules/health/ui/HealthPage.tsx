import { PageHeader } from '@/components/pos'
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
import { Health, type HealthData } from './Health'

export default async function HealthPage() {
  const [appointments, medications, vitals, records, screenings, providers, todayIso, bodyWeight] =
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
    ])

  const data: HealthData = {
    todayIso,
    bodyWeightLb: bodyWeight,
    appointments: appointments.map((a) => ({
      id: a.id,
      what: a.what,
      startsAt: new Date(a.starts_at).toISOString(),
      location: a.location,
      status: a.status,
      prep: a.prep,
      costCents: a.cost_estimate_cents,
      provider: a.provider_name,
      providerRole: a.provider_role,
    })),
    medications: medications.map((m) => ({
      id: m.id,
      name: m.name,
      dose: m.dose,
      schedule: m.schedule,
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
    })),
    records: records.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      takenOn: r.taken_on,
      summary: r.summary,
      hasFile: r.file_path !== null,
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
      notes: p.notes,
    })),
  }

  const next = data.appointments.find((a) => new Date(a.startsAt) >= new Date())

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`Health / ${data.medications.filter((m) => !m.ended).length} medications / ${data.screenings.length} screenings`}
        dot={next ? 'brand' : 'idle'}
        title="Health"
        lede="Appointments, prescriptions, screenings and records. Every reading shows where it came from, and nothing here offers an opinion about what a number means."
        actions={
          <span className="num text-[11px] text-ink-3">
            {data.records.length} record{data.records.length === 1 ? '' : 's'}
          </span>
        }
      />
      <Health data={data} />
    </div>
  )
}
