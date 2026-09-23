import { db } from '@/core/db'

// Synthetic events for `pnpm setup --demo`, dated from today so the grid is
// never empty in a fresh demo. Upserts on external_id, so a rerun moves them
// rather than duplicating them. Invented, like every seed in the template.

const TZ = `coalesce((select value #>> '{}' from core.settings where key = 'timezone'), 'UTC')`

const EVENTS: { external_id: string; title: string; days: number; time: string | null; location: string }[] = [
  { external_id: 'e-coffee', title: 'Coffee with Sam', days: 1, time: '08:30', location: 'Corner cafe' },
  { external_id: 'e-birthday', title: "Jo's birthday", days: 4, time: null, location: '' },
  { external_id: 'e-plumber', title: 'Plumber window', days: 9, time: '13:00', location: 'Home' },
]

export async function seed(): Promise<number> {
  for (const e of EVENTS) {
    await db().query(
      `insert into calendar.event (source, external_id, title, starts_at, ends_at, all_day, location)
       values ('demo', $1, $2,
               ((core.today() + $3::int) + coalesce($4::time, '00:00')) at time zone ${TZ},
               case when $4::time is null then null
                    else ((core.today() + $3::int) + $4::time + interval '1 hour') at time zone ${TZ} end,
               $4::time is null, $5)
       on conflict (source, external_id) do update
         set title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
             all_day = excluded.all_day, location = excluded.location`,
      [e.external_id, e.title, e.days, e.time, e.location],
    )
  }
  return EVENTS.length
}
