import Link from 'next/link'
import { cn } from '@/lib/utils'

// Two dashboard tiles that read core and nothing else. Both are plain server
// components: what they draw is a fact from a table, and nothing on them is
// clicked except a link.

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** The colour a module's marks take on the strip, from its own nav colour. */
const TONE: Record<string, string> = {
  finance: 'bg-brand',
  insurance: 'bg-warn',
  travel: 'bg-ink-2',
  tasks: 'bg-brand',
  home: 'bg-warn',
  health: 'bg-warn',
}

type Item = { id: string; title: string; meta: string; at: string; module: string }

/**
 * The week ahead as a line with marks on it, then the same items as rows.
 *
 * The line is the artboard's: seven ticks, the dot placed by how far into the
 * week the thing falls. It is a picture of density rather than a chart, which
 * is why nothing on it is measured against a value axis.
 */
export function SevenDays({ items, today }: { items: Item[]; today: string }) {
  // Whole days, from the owner's today. Everything on the strip is a date
  // rather than a moment, so no clock and no timezone comes into it.
  const day = (iso: string) => new Date(`${iso}T12:00:00`)
  const offset = (iso: string) =>
    Math.min(6, Math.max(0, Math.round((day(iso).getTime() - day(today).getTime()) / 86_400_000)))

  const label = (iso: string) => {
    const days = offset(iso)
    if (days === 0) return 'today'
    if (days === 1) return 'tomorrow'
    return DAYS[(day(iso).getDay() + 6) % 7]
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative h-11">
        <div className="absolute inset-x-0 top-2.5 h-px bg-rule-2" />
        {DAYS.map((unused, i) => {
          // Named for the day it actually is, starting today rather than on a
          // Monday: the strip is the next seven days, not this week.
          const at = new Date(day(today).getTime() + i * 86_400_000)
          return (
            <span
              key={i}
              className="absolute top-[18px] -translate-x-1/2 text-[10px] text-ink-4"
              style={{ left: `${(i / 6) * 100}%` }}
            >
              {DAYS[(at.getDay() + 6) % 7]}
            </span>
          )
        })}
        {items.map((item) => (
          <span
            key={item.id}
            title={item.title}
            className={cn(
              'absolute top-2 size-1.5 -translate-x-1/2',
              TONE[item.module] ?? 'bg-ink-3',
            )}
            style={{ left: `${(offset(item.at) / 6) * 100}%` }}
          />
        ))}
      </div>

      {items.length === 0 ? (
        <p className="t-caption mt-1.5 text-ink-3">
          Nothing is scheduled. Modules put their dated things here as they queue them.
        </p>
      ) : (
        <div className="mt-1.5 flex flex-col">
          {items.map((item) => {
            const row = (
              <>
                <span className="num w-16 shrink-0 text-[11px] text-ink-3">{label(item.at)}</span>
                <span
                  className={cn('size-1.5 shrink-0', TONE[item.module] ?? 'bg-ink-3')}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.title}</span>
                <span className="num shrink-0 truncate text-[11px] text-ink-2">{item.meta}</span>
              </>
            )

            return (
              <Link
                key={item.id}
                href={`/${item.module}`}
                className="flex items-center gap-2.5 border-b border-rule py-[7px] hover:bg-brand-soft"
              >
                {row}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * The job list under the heat strip: what ran, when, and how it went.
 *
 * The strip says whether the night was clean at a glance; these rows say which
 * job it was, which is what you need the moment it was not.
 */
export function JobRows({
  jobs,
  timezone,
}: {
  jobs: { name: string; status: string | null; at: string | null }[]
  timezone: string
}) {
  const failed = jobs.filter((j) => j.status === 'failed')
  // Failures first and always shown; otherwise the four most recent runs, so
  // the tile says something on a clean night rather than going blank.
  const shown = (failed.length > 0 ? failed : [...jobs].filter((j) => j.at).slice(0, 4)).slice(0, 4)

  const time = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(new Date(iso))

  return (
    <div className="flex flex-1 flex-col">
      {shown.map((job) => (
        <div
          key={job.name}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-rule py-[7px] text-[12px]"
        >
          <span className="num truncate text-[11px] text-ink-2">{job.name}</span>
          <span className="num text-[11px] text-ink-3">{job.at ? time(job.at) : 'never'}</span>
          <span
            className={cn(
              'label text-[10px] tracking-[0.06em]',
              job.status === 'failed'
                ? 'text-bad'
                : job.status === 'ok'
                  ? 'text-brand'
                  : 'text-ink-3',
            )}
          >
            {job.status ?? 'idle'}
          </span>
        </div>
      ))}

      <p className="t-caption mt-auto pt-2.5 text-ink-3">
        {failed.length > 0
          ? `${failed.length} failed on the last run. The Agent Log has the error.`
          : 'Every job clean.'}
      </p>
    </div>
  )
}
