// What a weekly review holds. No imports: the wizard is a client component and
// anything reaching core/db.ts drags pg into the browser bundle.

/** Carry it to next week, shrink it to a first step, or drop it. */
export type MissAction = 'carry' | 'shrink' | 'drop'

export type ReviewAnswers = {
  /** Win ids that were ticked, plus anything typed in. */
  wins: string[]
  ownWins: string[]
  /** Task id to what happens to it. */
  missActions: Record<string, MissAction>
  /** Why it slipped, optional, shown in the note. */
  reasons: Record<string, string>
  /** Goal id to the number entered, for goals with no metric source. */
  checkins: Record<string, number>
  /** Task ids picked as next week's priorities, in order. */
  picks: string[]
  /** One sentence for the week ahead. */
  intent: string
}

export const EMPTY_ANSWERS: ReviewAnswers = {
  wins: [],
  ownWins: [],
  missActions: {},
  reasons: {},
  checkins: {},
  picks: [],
  intent: '',
}

export type StepKey = 'glance' | 'wins' | 'misses' | 'goals' | 'plan' | 'close'

export const STEPS: { key: StepKey; name: string; kicker: string; question: string; helper: string }[] = [
  {
    key: 'glance',
    name: 'The week',
    kicker: 'Step one · what happened',
    question: 'Here is the week, measured',
    helper:
      'Pulled from the module digests. Nothing here needs your input; read it, then move on.',
  },
  {
    key: 'wins',
    name: 'Wins',
    kicker: 'Step two · what worked',
    question: 'What went well?',
    helper:
      'Tick the ones that count. These become the wins section of the week note.',
  },
  {
    key: 'misses',
    name: 'Misses',
    kicker: 'Step three · what slipped',
    question: 'What slipped, and what happens to it?',
    helper: 'Each one needs a decision: carry it, shrink it, or drop it.',
  },
  {
    key: 'goals',
    name: 'Goals',
    kicker: 'Step four · check in',
    question: 'Where do the goals stand?',
    helper: 'Computed goals updated themselves. The rest need a number from you.',
  },
  {
    key: 'plan',
    name: 'Next week',
    kicker: 'Step five · what matters next',
    question: 'What are the three things for next week?',
    helper: 'Picked items move to the top of Monday. Everything else stays in the backlog.',
  },
  {
    key: 'close',
    name: 'Close',
    kicker: 'Step six · close the week',
    question: 'Ready to close the week?',
    helper:
      'This writes one note, reschedules what you carried, and records the three priorities.',
  },
]

/** How many decisions are still owed at each step, so the wizard can say so. */
export function outstanding(
  step: StepKey,
  answers: ReviewAnswers,
  counts: { misses: number; manualGoals: number },
): number {
  if (step === 'misses') return counts.misses - Object.keys(answers.missActions).length
  if (step === 'goals') return counts.manualGoals - Object.keys(answers.checkins).length
  return 0
}

export type NoteContext = {
  weekLabel: string
  winTitles: Record<string, string>
  missTitles: Record<string, string>
  goalLines: string[]
  pickTitles: Record<string, string>
}

/** A section of the week note, and what stands in when it has no lines. */
export type NoteBlock = { head: string; lines: string[]; empty: string }

/**
 * The note's four sections, before they are markdown.
 *
 * The close step draws these and `renderNote` writes them, so what the screen
 * shows is what gets filed rather than a second rendering of the same answers
 * that can drift from the first.
 */
export function noteBlocks(answers: ReviewAnswers, context: NoteContext): NoteBlock[] {
  const wins = [
    ...answers.wins.map((id) => context.winTitles[id]).filter(Boolean),
    ...answers.ownWins,
  ]

  const slipped = Object.entries(answers.missActions).map(([id, action]) => {
    const what =
      action === 'carry'
        ? 'carried to next week'
        : action === 'shrink'
          ? 'shrunk to a smaller first step'
          : 'dropped'
    const why = answers.reasons[id] ? ` (${answers.reasons[id]})` : ''
    return `${context.missTitles[id] ?? id}, ${what}${why}`
  })

  const picks = answers.picks.map((id, i) => `${i + 1}. ${context.pickTitles[id] ?? id}`)

  return [
    { head: 'Wins', lines: wins, empty: 'Nothing ticked.' },
    { head: 'Slipped', lines: slipped, empty: 'Nothing slipped.' },
    { head: 'Goals', lines: context.goalLines, empty: 'No goals yet.' },
    {
      head: 'Next week',
      lines: answers.intent ? [...picks, `Intent: ${answers.intent}`] : picks,
      empty: 'Nothing picked.',
    },
  ]
}

/**
 * The week note, built from the answers. Plain markdown, because the note goes
 * into a module that stores text and the point is that it reads later.
 */
export function renderNote(answers: ReviewAnswers, context: NoteContext): string {
  const lines: string[] = [`# Week of ${context.weekLabel}`, '']

  for (const block of noteBlocks(answers, context)) {
    const body = block.lines.length > 0 ? block.lines : [block.empty]
    lines.push(`## ${block.head}`, ...body.map((line) => `- ${line}`), '')
  }

  return lines.join('\n').trimEnd()
}
