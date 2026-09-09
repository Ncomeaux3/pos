import { db } from '@/core/db'

// Reads for the screen and the digest. The screening arithmetic lives in
// ./screening.ts, which has no imports and can be pulled into a client.

export type AppointmentRow = {
  id: string
  what: string
  starts_at: Date
  location: string
  status: string
  cost_estimate_cents: number | null
  prep: string
  provider_name: string | null
  provider_role: string | null
}

export async function listAppointments(): Promise<AppointmentRow[]> {
  const { rows } = await db().query<AppointmentRow>(
    `select a.id, a.what, a.starts_at, a.location, a.status, a.cost_estimate_cents, a.prep,
            p.name as provider_name, p.role as provider_role
       from health.appointment a
       left join health.provider p on p.id = a.provider_id
      order by
        -- What is coming first, then what already happened, newest of those
        -- first. A past appointment is a record; an upcoming one is a plan.
        case when a.starts_at >= now() then 0 else 1 end,
        case when a.starts_at >= now() then a.starts_at end,
        a.starts_at desc
      limit 60`,
  )
  return rows
}

export async function listMedications(): Promise<
  {
    id: string
    name: string
    dose: string
    schedule: string
    refill_on: string | null
    ended_on: string | null
    taken: string[]
  }[]
> {
  const { rows } = await db().query<{
    id: string
    name: string
    dose: string
    schedule: string
    refill_on: string | null
    ended_on: string | null
    taken: string[] | null
  }>(
    `select m.id, m.name, m.dose, m.schedule, m.refill_on::text, m.ended_on::text,
            array_agg(l.taken_on::text order by l.taken_on desc)
              filter (where l.taken_on is not null) as taken
       from health.medication m
       left join health.medication_log l
         on l.medication_id = m.id and l.taken_on >= core.today() - 60
      group by m.id
      order by m.ended_on nulls first, m.name`,
  )
  return rows.map((r) => ({ ...r, taken: r.taken ?? [] }))
}

export type VitalRow = {
  metric: string
  value: string
  value_text: string
  measured_at: Date
  provenance: string
}

/** The latest reading of each clinical metric. */
export async function latestVitals(): Promise<VitalRow[]> {
  const { rows } = await db().query<VitalRow>(
    `select distinct on (metric) metric, value::text, value_text, measured_at, provenance
       from health.vital
      order by metric, measured_at desc`,
  )
  return rows
}

export async function listRecords(): Promise<
  { id: string; title: string; kind: string; taken_on: string; summary: string; file_path: string | null }[]
> {
  const { rows } = await db().query<{
    id: string
    title: string
    kind: string
    taken_on: string
    summary: string
    file_path: string | null
  }>(
    `select id, title, kind, taken_on::text, summary, file_path
       from health.record order by taken_on desc limit 60`,
  )
  return rows
}

export async function listScreenings(): Promise<
  { id: string; name: string; interval_months: number; last_done_on: string | null; snooze_until: string | null }[]
> {
  const { rows } = await db().query<{
    id: string
    name: string
    interval_months: number
    last_done_on: string | null
    snooze_until: string | null
  }>(
    `select id, name, interval_months, last_done_on::text, snooze_until::text
       from health.screening order by name`,
  )
  return rows
}

export async function listProviders(): Promise<
  { id: string; name: string; role: string; phone: string; notes: string }[]
> {
  const { rows } = await db().query<{
    id: string
    name: string
    role: string
    phone: string
    notes: string
  }>(`select id, name, role, phone, notes from health.provider order by role, name`)
  return rows
}
