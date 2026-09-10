import { latestDigests } from '@/core/digests'
import { pending, slipped, upcoming } from '@/core/review-registry'
import { getModule } from '@/core/modules'
import { getReview, listReviews, noteWriter, weekOf } from '@/core/reviews'
import { EMPTY_ANSWERS } from '@/core/reviews-shape'
import { ownerToday } from '@/core/today'
import { Wizard, type WeekData } from './Wizard'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function label(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
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
  const digests = await latestDigests()

  const num = (payload: Record<string, unknown>, key: string): number | null => {
    const value = payload[key]
    return typeof value === 'number' ? value : null
  }

  const lines: WeekData['glance'] = []

  for (const row of digests) {
    // A digest is a module's own shape, so this picks out what it recognises
    // and ignores the rest. Adding a module adds no code here until someone
    // decides one of its numbers belongs on this screen.
    const pairs: [string, string][] = [
      ['completedThisWeek', 'Tasks completed'],
      ['overdue', 'Overdue'],
      ['onTrack', 'Goals on track'],
      ['atRisk', 'Goals at risk'],
      ['totalXp', 'Total XP'],
    ]

    for (const [key, text] of pairs) {
      const value = num(row.payload, key)
      if (value !== null) {
        lines.push({ label: text, value: String(Math.round(value)), module: row.module })
      }
    }
  }

  return lines
}

export default async function WeeklyReviewPage() {
  const todayIso = await ownerToday()
  const week = weekOf(todayIso)

  const [review, past, glanceLines, slippedBy, upcomingBy, pendingBy, writer] = await Promise.all([
    getReview(week),
    listReviews(),
    glance(),
    slipped(),
    upcoming(),
    pending(),
    noteWriter(),
  ])

  const data: WeekData = {
    week,
    weekLabel: label(week),
    glance: glanceLines,

    // Flattened with the module kept on each item, so the close can hand each
    // decision back to whichever module owns the row.
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
