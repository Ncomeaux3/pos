import { digestsBefore, latestDigests } from '@/core/digests'
import { getModule } from '@/core/modules'
import { glanceTiles, type DigestMap } from '@/core/review-glance'
import { pending, slipped, upcoming, wins } from '@/core/review-registry'
import { getReview, listReviews, noteWriter, weekNumber, weekOf } from '@/core/reviews'
import { EMPTY_ANSWERS } from '@/core/reviews-shape'
import { getTheme } from '@/core/theme'
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
 * reads it, and core never touches a module schema. Which keys are drawn, and
 * in what order, is `glanceTiles()`: the six the artboard names. The labels of
 * the modules that contributed come back too, for the sentence under the
 * heading that says where the numbers came from.
 */
async function glance(): Promise<{ tiles: WeekData['glance']; from: string[] }> {
  const [digests, lastWeek] = await Promise.all([latestDigests(), digestsBefore(7)])
  const byModule = (rows: typeof digests): DigestMap =>
    Object.fromEntries(rows.map((d) => [d.module, d.payload]))

  const tiles = glanceTiles(byModule(digests), byModule(lastWeek))
  const from = [...new Set(tiles.map((t) => t.module))].map(
    (id) => getModule(id)?.nav.label ?? id,
  )
  return { tiles, from }
}

export default async function WeeklyReviewPage() {
  const todayIso = await ownerToday()
  const week = weekOf(todayIso)

  const [review, past, glanced, winsBy, slippedBy, upcomingBy, pendingBy, writer, theme] =
    await Promise.all([
      getReview(week),
      listReviews(),
      glance(),
      wins(),
      slipped(),
      upcoming(),
      pending(),
      noteWriter(),
      getTheme(),
    ])

  const data: WeekData = {
    week,
    weekNumber: weekNumber(week),
    weekLabel: range(week),
    noteLabel: label(week),
    theme,
    glance: glanced.tiles,
    glanceFrom: glanced.from,

    // Flattened with the module kept on each item, so the close can hand each
    // decision back to whichever module owns the row.
    wins: winsBy.flatMap((c) => c.items.map((i) => ({ ...i, module: c.module }))),
    misses: slippedBy.flatMap((c) =>
      c.items.map((i) => ({ ...i, module: c.module, moduleLabel: getModule(c.module)?.nav.label ?? c.module })),
    ),
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
