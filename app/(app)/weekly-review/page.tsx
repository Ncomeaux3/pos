import { digestsBefore, latestDigests } from '@/core/digests'
import { getModule } from '@/core/modules'
import { pending, slipped, upcoming, wins } from '@/core/review-registry'
import { getReview, listReviews, noteWriter, weekNumber, weekOf } from '@/core/reviews'
import { EMPTY_ANSWERS } from '@/core/reviews-shape'
import { ownerToday } from '@/core/today'
import { Wizard, type WeekData } from './Wizard'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function label(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** "1 - 7 Sep 2026", and "29 Sep - 5 Oct 2026" when the week crosses a month. */
function range(mondayIso: string): string {
  const monday = new Date(`${mondayIso}T12:00:00`)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)

  const sameMonth = monday.getMonth() === sunday.getMonth()
  const from = sameMonth ? String(monday.getDate()) : `${monday.getDate()} ${MONTHS[monday.getMonth()]}`
  return `${from} - ${label(sunday.toISOString().slice(0, 10))}`
}

/**
 * The week's numbers, from core.digests only.
 *
 * This is the whole cross-module read rule: a module writes a digest, core
 * reads it, and core never touches a module schema. The keys are read
 * defensively because the shape belongs to the module, not to this page, and a
 * module that renames one contributes no line rather than a crash.
 */
async function glance(): Promise<WeekData['glance']> {
  const [digests, lastWeek] = await Promise.all([latestDigests(), digestsBefore(7)])

  const num = (payload: Record<string, unknown>, key: string): number | null => {
    const value = payload[key]
    return typeof value === 'number' ? value : null
  }

  const lines: WeekData['glance'] = []

  for (const row of digests) {
    // A digest is a module's own shape, so this picks out what it recognises
    // and ignores the rest. Adding a module adds no code here until someone
    // decides one of its numbers belongs on this screen.
    //
    // The third element is which direction is the good one. Core picked these
    // keys, so core can say that overdue going up is not good news, and the
    // delta is coloured on that rather than on its sign.
    const pairs: [string, string, 'up' | 'down'][] = [
      ['completedThisWeek', 'Tasks completed', 'up'],
      ['overdue', 'Overdue', 'down'],
      ['onTrack', 'Goals on track', 'up'],
      ['atRisk', 'Goals at risk', 'down'],
      ['totalXp', 'Total XP', 'up'],
    ]

    const before = lastWeek.find((d) => d.module === row.module)?.payload

    for (const [key, text, good] of pairs) {
      const value = num(row.payload, key)
      if (value === null) continue

      const was = before ? num(before, key) : null
      const change = was === null ? null : Math.round(value - was)

      lines.push({
        label: text,
        value: String(Math.round(value)),
        module: row.module,
        delta:
          change === null
            ? null
            : change === 0
              ? 'No change on last week'
              : `${change > 0 ? '+' : ''}${change} on last week`,
        tone:
          change === null || change === 0
            ? 'quiet'
            : (change > 0) === (good === 'up')
              ? 'brand'
              : 'warn',
      })
    }
  }

  return lines
}

export default async function WeeklyReviewPage() {
  const todayIso = await ownerToday()
  const week = weekOf(todayIso)

  const [review, past, glanceLines, winsBy, slippedBy, upcomingBy, pendingBy, writer] =
    await Promise.all([
      getReview(week),
      listReviews(),
      glance(),
      wins(),
      slipped(),
      upcoming(),
      pending(),
      noteWriter(),
    ])

  const data: WeekData = {
    week,
    weekNumber: weekNumber(week),
    weekLabel: range(week),
    noteLabel: label(week),
    glance: glanceLines,

    // Flattened with the module kept on each item, so the close can hand each
    // decision back to whichever module owns the row.
    wins: winsBy.flatMap((c) => c.items.map((i) => ({ ...i, module: c.module }))),
    misses: slippedBy.flatMap((c) => c.items.map((i) => ({ ...i, module: c.module }))),
    backlog: upcomingBy.flatMap((c) => c.items.map((i) => ({ ...i, module: c.module }))),
    checks: pendingBy.flatMap((c) => c.items.map((i) => ({ ...i, module: c.module }))),

    // Named on the close step, so it says where the note goes rather than
    // promising a filing that no installed module performs.
    noteTarget: writer ? (getModule(writer)?.nav.label ?? writer) : null,

    answers: review?.answers ?? EMPTY_ANSWERS,
    closedAt: review?.closed_at ? new Date(review.closed_at).toISOString() : null,
    past: past
      .filter((r) => r.closed_at)
      .map((r) => ({ week: r.week_of, label: label(r.week_of), priorities: r.priorities })),
  }

  return <Wizard data={data} />
}
