import type { TasksDigest } from '../jobs/nightly-digest'

// The Tasks dashboard tile. What is due, not how many are due: a count tells
// you there is work and nothing about what it is.

export function TasksTile({ payload }: { payload: Record<string, unknown> }) {
  const d = payload as Partial<TasksDigest>
  const upcoming = d.upcoming ?? []
  const done = d.completedToday ?? 0
  const due = d.dueToday ?? 0
  const overdue = d.overdue ?? 0

  if (upcoming.length === 0 && due === 0 && overdue === 0) {
    return <p className="t-caption text-ink-3">Nothing due today.</p>
  }

  return (
    <div className="space-y-2.5">
      <p className="num text-[11px] text-ink-3">
        {done} of {due + done} done
        {overdue > 0 ? ` · ${overdue} overdue` : ''}
        {d.awaitingReview ? ` · ${d.awaitingReview} awaiting review` : ''}
      </p>

      {upcoming.slice(0, 4).map((t) => (
        <div key={t.id} className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[14px] text-ink">{t.title}</span>
          <span className="num shrink-0 text-[11px] text-ink-3">{t.priority}</span>
        </div>
      ))}
    </div>
  )
}
