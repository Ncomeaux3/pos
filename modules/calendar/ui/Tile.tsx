import type { CalendarDigest } from '../jobs/nightly-digest'

// The Calendar tile: what is on today and tomorrow, and the next few things.

export function CalendarTile({ payload }: { payload: Record<string, unknown> }) {
  const d = payload as Partial<CalendarDigest>
  const next = d.next ?? []

  if (!d.today && !d.tomorrow) {
    return <p className="t-caption text-ink-3">Nothing is on today or tomorrow.</p>
  }

  return (
    <div className="space-y-2.5">
      {/* By position: at most three, never reordered, and two tasks can share
        * a title and a day, which a key built from those collides on. */}
      {next.map((i, n) => (
        <div key={n} className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[14px] text-ink">{i.title}</span>
          <span className="num shrink-0 text-[11px] text-ink-3">
            {i.allDay ? i.startsAt.slice(5) : i.startsAt.slice(11)}
          </span>
        </div>
      ))}
      <p className="num text-[11px] text-ink-3">
        {d.today ?? 0} today · {d.tomorrow ?? 0} tomorrow
      </p>
    </div>
  )
}
