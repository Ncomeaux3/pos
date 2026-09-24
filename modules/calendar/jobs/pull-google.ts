import { db } from '@/core/db'
import {
  calendars,
  events,
  type GoogleCalendar,
  type GoogleEvent,
  googleCredentials,
  pickedIds,
} from '@/integrations/google/client'

// The owner's Google calendars into calendar.event, read only.
//
// A full window each run, not sync tokens (owner's choice, 2026-09-23): the
// window moves forward every night, and anything in it Google no longer
// returns is deleted, so a missed run or a moved event mends itself.

const DAY = 86_400_000
const BACK_DAYS = 30
const AHEAD_DAYS = 365

/** The owner's zone, as calendar/data.ts reads it. */
const TZ = `coalesce((select value #>> '{}' from core.settings where key = 'timezone'), 'UTC')`

export type GoogleRow = {
  external_id: string
  calendar_name: string
  title: string
  /** An ISO timestamp with offset, or YYYY-MM-DD for an all day event. */
  starts_at: string
  ends_at: string | null
  all_day: boolean
  location: string
  url: string
  raw: GoogleEvent
}

function dayBefore(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - DAY).toISOString().slice(0, 10)
}

export function toRow(e: GoogleEvent, cal: Pick<GoogleCalendar, 'id' | 'summary'>): GoogleRow | null {
  if (e.status === 'cancelled') return null
  const allDay = Boolean(e.start.date)
  const start = e.start.date ?? e.start.dateTime
  if (!start) return null

  // Google's end.date is exclusive; calendar.event stores the last day.
  const end = allDay ? (e.end?.date ? dayBefore(e.end.date) : null) : (e.end?.dateTime ?? null)

  return {
    external_id: `${cal.id}/${e.id}`,
    calendar_name: cal.summary,
    title: (e.summary?.trim() || '(No title)').slice(0, 200),
    starts_at: start,
    // A malformed all day end before its start would break the table's check.
    ends_at: allDay && end && end < start ? null : end,
    all_day: allDay,
    location: e.location ?? '',
    url: e.htmlLink ?? '',
    raw: e,
  }
}

/** Upserts one calendar's window and deletes what Google no longer returns in it. */
async function store(calendarId: string, rows: GoogleRow[], from: Date, to: Date): Promise<number> {
  await db().query(
    `insert into calendar.event
       (source, external_id, calendar_name, title, starts_at, ends_at, all_day, location, url, raw, updated_at)
     select 'google', r.external_id, r.calendar_name, r.title,
            case when r.all_day then r.starts_at::date::timestamp at time zone ${TZ} else r.starts_at::timestamptz end,
            case when r.ends_at is null then null
                 when r.all_day then r.ends_at::date::timestamp at time zone ${TZ}
                 else r.ends_at::timestamptz end,
            r.all_day, r.location, r.url, r.raw, now()
       from jsonb_to_recordset($1::jsonb) as r(
              external_id text, calendar_name text, title text, starts_at text, ends_at text,
              all_day boolean, location text, url text, raw jsonb)
     on conflict (source, external_id) do update set
       calendar_name = excluded.calendar_name, title = excluded.title,
       starts_at = excluded.starts_at, ends_at = excluded.ends_at, all_day = excluded.all_day,
       location = excluded.location, url = excluded.url, raw = excluded.raw, updated_at = now()`,
    [JSON.stringify(rows)],
  )

  const { rowCount } = await db().query(
    `delete from calendar.event
      where source = 'google' and starts_with(external_id, $1 || '/')
        and starts_at >= $2 and starts_at < $3
        and not (external_id = any($4::text[]))`,
    [calendarId, from, to, rows.map((r) => r.external_id)],
  )
  return rowCount ?? 0
}

/**
 * Never skips silently: not connected returns a skipped result, and a Google
 * failure throws so the job row says failed and the band shows it.
 */
export async function pullGoogle(now = new Date()) {
  const creds = await googleCredentials()
  if (!creds?.access_token) {
    return { skipped: true, fetched: 0, removed: 0, detail: 'Google is not connected.' }
  }

  const all = await calendars(creds.access_token)
  const ids = pickedIds(creds, all)
  const picked = all.filter((c) => ids.includes(c.id))

  // A calendar unticked since the last pull leaves with all of its rows.
  const { rowCount: dropped } = await db().query(
    `delete from calendar.event e
      where source = 'google'
        and not exists (select 1 from unnest($1::text[]) c where starts_with(e.external_id, c || '/'))`,
    [picked.map((c) => c.id)],
  )

  const from = new Date(now.getTime() - BACK_DAYS * DAY)
  const to = new Date(now.getTime() + AHEAD_DAYS * DAY)
  let fetched = 0
  let removed = dropped ?? 0

  for (const cal of picked) {
    const rows = (await events(cal.id, from, to, creds.access_token))
      .map((e) => toRow(e, cal))
      .filter((r): r is GoogleRow => r !== null)
    fetched += rows.length
    removed += await store(cal.id, rows, from, to)
  }

  return {
    skipped: false,
    fetched,
    removed,
    detail: `${fetched} events from ${picked.length} calendars, ${removed} removed.`,
  }
}
