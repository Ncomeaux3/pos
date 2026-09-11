'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  EmptyState,
  Eyebrow,
  GlanceCard,
  ReviewNote,
  ReviewRow,
  ReviewShell,
  reviewField,
  useToast,
} from '@/components/pos'
import type { GlanceTile } from '@/core/review-glance'
import type { Theme } from '@/core/theme'
import {
  closeHelper,
  EMPTY_ANSWERS,
  glanceHelper,
  glanceSentence,
  missesHelper,
  noteBlocks,
  outstanding,
  STEPS,
  type MissAction,
  type ReviewAnswers,
  type StepKey,
} from '@/core/reviews-shape'
import { cn } from '@/lib/utils'
import { toggleTheme } from '../shell-actions'
import { close, save } from './actions'

// Six steps over one set of answers. Every step writes into the same object and
// the object is saved as you go, so a review interrupted at step four resumes
// where it was rather than starting again.

type Item = { id: string; title: string; meta: string; estimateMinutes?: number | null; module: string }
type Win = { id: string; title: string; meta: string; tag?: string; module: string }
type Check = {
  id: string
  title: string
  unit: string
  computed: boolean
  module: string
  source?: string
  percent?: number
  movement?: number | null
  status?: 'done' | 'on_track' | 'at_risk' | 'stalled'
  note?: string
}

export type WeekData = {
  week: string
  weekNumber: number
  /** "1 - 7 Sep 2026", for the band. */
  weekLabel: string
  /** "7 Sep 2026", for the note's title. */
  noteLabel: string
  /** For the band's theme button, which names the theme you are on. */
  theme: Theme
  glance: GlanceTile[]
  /** Labels of the modules whose digests the glance drew from, in tile order. */
  glanceFrom: string[]
  wins: Win[]
  misses: Item[]
  backlog: Item[]
  checks: Check[]
  /** The module the week note goes to, or null when none takes notes. */
  noteTarget: string | null
  answers: ReviewAnswers
  closedAt: string | null
  past: { week: string; label: string; priorities: string[] }[]
}

const ACTIONS: { value: MissAction; label: string }[] = [
  { value: 'carry', label: 'Carry' },
  { value: 'shrink', label: 'Shrink' },
  { value: 'drop', label: 'Drop' },
]

/** How many of next week's three are picked. Three is the design's number. */
const MAX_PICKS = 3

const STATUS_LABELS = {
  done: 'Done',
  on_track: 'On track',
  at_risk: 'At risk',
  stalled: 'Stalled',
} as const

/** "45m", "2h", "1h 30m". Nothing at all when the module gave no estimate. */
function estimate(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return ''
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours === 0 ? `${rest}m` : rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

export function Wizard({ data }: { data: WeekData }) {
  // The step lives in the URL. It survives a refresh, which matters more here
  // than anywhere else because the answers are saved as you go and losing your
  // place in a resumed review defeats the point of resuming.
  const router = useRouter()
  const params = useSearchParams()
  const step = (STEPS.find((s) => s.key === params.get('step'))?.key ?? 'glance') as StepKey

  const setStep = (next: StepKey) => {
    const search = new URLSearchParams(params.toString())
    if (next === 'glance') search.delete('step')
    else search.set('step', next)
    const query = search.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }

  const [answers, setAnswers] = useState<ReviewAnswers>(data.answers ?? EMPTY_ANSWERS)
  const [ownWin, setOwnWin] = useState('')
  const [closed, setClosed] = useState(data.closedAt !== null)
  const [pending, start] = useTransition()
  const toast = useToast()

  const manualChecks = data.checks.filter((c) => !c.computed)
  const owed = outstanding(step, answers, {
    misses: data.misses.length,
    manualGoals: manualChecks.length,
  })

  const index = STEPS.findIndex((s) => s.key === step)
  const stage = STEPS[index]
  // The artboard's sentences carry the week's own numbers, so three of them
  // are built here rather than read off the step.
  const question = step === 'close' ? `Ready to close week ${data.weekNumber}?` : stage.question
  const helper =
    step === 'glance'
      ? glanceHelper(data.glanceFrom)
      : step === 'misses'
        ? missesHelper(data.misses.length)
        : step === 'close'
          ? closeHelper(answers.picks.length)
          : stage.helper

  // Every change is saved, so the answers survive a closed tab. Fire and
  // forget: a failed save shows a toast and the state is still in the browser.
  const patch = (next: Partial<ReviewAnswers>) => {
    const merged = { ...answers, ...next }
    setAnswers(merged)
    start(async () => {
      const result = await save(merged)
      if (!result.ok) toast(result.error)
    })
  }

  const carried = Object.entries(answers.missActions)
    .filter(([, a]) => a !== 'drop')
    .map(([id]) => data.misses.find((m) => m.id === id))
    .filter((m): m is Item => Boolean(m))

  const candidates = [...carried, ...data.backlog]

  const context = {
    weekLabel: data.noteLabel,
    winTitles: Object.fromEntries(data.wins.map((w) => [w.id, w.title])),
    missTitles: Object.fromEntries(data.misses.map((m) => [m.id, m.title])),
    goalLines: data.checks.map((c) => {
      if (c.computed) {
        const percent = c.percent === undefined ? 'computed' : `${c.percent} percent`
        return `${c.title}, ${percent}${c.status ? `, ${STATUS_LABELS[c.status].toLowerCase()}` : ''}`
      }
      const value = answers.checkins[c.id]
      // The unit belongs to the number, not to its absence: "no check-in lb"
      // is what the general form produces and it reads as a broken template.
      if (value === undefined) return `${c.title}, no check-in`
      return `${c.title}, ${value}${c.unit ? ` ${c.unit}` : ''}`
    }),
    pickTitles: Object.fromEntries(candidates.map((b) => [b.id, b.title])),
  }

  // The close reads as a promise, so it says only what the close action does:
  // the modules move their own carried rows, the picks land on the review row,
  // and the note goes wherever a module takes notes.
  const outcomes = [
    {
      tag: 'Reschedules',
      text:
        carried.length === 0
          ? 'Nothing carried, so nothing moves.'
          : `${carried.length} item${carried.length === 1 ? '' : 's'} move${carried.length === 1 ? 's' : ''} to next week with ${carried.length === 1 ? 'its' : 'their'} original context.`,
    },
    {
      tag: 'Priorities',
      text:
        answers.picks.length === 0
          ? 'No priorities picked. The week still closes.'
          : `${answers.picks.length} priorit${answers.picks.length === 1 ? 'y is' : 'ies are'} recorded on the week, in the order you picked them.`,
    },
    {
      tag: 'Note',
      text: data.noteTarget
        ? `One note, titled Week of ${data.noteLabel}, is written to ${data.noteTarget}.`
        : 'No module takes notes, so the write-up stays on the review itself.',
    },
  ]

  const finish = () =>
    start(async () => {
      const result = await close(answers, context)
      if (!result.ok) {
        toast(result.error)
        return
      }
      setClosed(true)
      toast(
        result.skipped.length > 0
          ? `Week closed, with ${result.skipped.length} thing${result.skipped.length > 1 ? 's' : ''} that did not apply.`
          : 'Week closed.',
      )
    })

  if (closed) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-7">
        <Eyebrow dot="ok">Week of {data.noteLabel}</Eyebrow>
        <EmptyState headline="Week closed">
          The note is written, what you carried has moved, and the three priorities are recorded.
          Come back next week.
        </EmptyState>
        {answers.picks.length > 0 && (
          <Card className="space-y-2">
            <Eyebrow>Next week</Eyebrow>
            {answers.picks.map((id, i) => (
              <p key={id} className="t-caption text-ink-2">
                {i + 1}. {context.pickTitles[id] ?? id}
              </p>
            ))}
          </Card>
        )}
      </div>
    )
  }

  const picked = [
    ...answers.wins.map((id) => context.winTitles[id]).filter(Boolean),
    ...answers.ownWins,
  ]

  const decided = Object.keys(answers.missActions).length

  const addWin = () => {
    if (!ownWin.trim()) return
    patch({ ownWins: [...answers.ownWins, ownWin.trim()] })
    setOwnWin('')
  }

  return (
    <ReviewShell
      week={data.weekNumber}
      weekLabel={data.weekLabel}
      steps={STEPS.map((s) => ({ key: s.key, name: s.name }))}
      current={step}
      onStep={(key) => setStep(key as StepKey)}
      kicker={stage.kicker}
      title={question}
      helper={helper}
      // The artboard's band has the theme button beside the duration, and
      // the sidebar has its own row; both go through the same setting.
      // 38px, the artboard's control height on desktop; 44 on a phone.
      themeToggle={
        <button
          type="button"
          onClick={() => start(() => toggleTheme(data.theme))}
          className="label min-h-11 border border-rule-2 px-3.5 text-[11px] uppercase tracking-[0.12em] text-ink-2 transition-colors duration-150 hover:text-ink md:min-h-[38px]"
        >
          {data.theme === 'dark' ? 'Dark' : 'Light'}
        </button>
      }
      onBack={index > 0 ? () => setStep(STEPS[index - 1].key) : undefined}
      onNext={index === STEPS.length - 1 ? finish : () => setStep(STEPS[index + 1].key)}
      nextLabel={
        index === STEPS.length - 1
          ? 'Close the week'
          : step === 'glance'
            ? 'Start the review'
            : 'Continue'
      }
      footnote={
        step === 'close'
          ? 'Nothing is written until you press it'
          : owed > 0
            ? `${owed} still undecided, you can move on and come back`
            : pending
              ? 'Saving.'
              : undefined
      }
    >
      {step === 'glance' && (
        <div>
          {data.glance.length === 0 ? (
            <EmptyState headline="No numbers yet">
              The glance reads module digests, and none have been written. Run the nightly job from
              the dashboard and this fills in.
            </EmptyState>
          ) : (
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))]">
              {data.glance.map((g) => (
                <GlanceCard
                  key={`${g.module}.${g.label}`}
                  label={g.label}
                  value={g.value}
                  delta={g.delta}
                  tone={g.tone}
                />
              ))}
            </div>
          )}
          <ReviewNote>
            {glanceSentence(
              data.glance,
              data.checks.filter((c) => c.status === 'stalled').length,
            )}
          </ReviewNote>
        </div>
      )}

      {step === 'wins' && (
        <div className="flex flex-col gap-2">
          {data.wins.map((win) => {
            const on = answers.wins.includes(win.id)
            return (
              <ReviewRow
                key={win.id}
                selected={on}
                label={`${on ? 'Drop' : 'Keep'} ${win.title}`}
                onClick={() =>
                  patch({
                    wins: on
                      ? answers.wins.filter((id) => id !== win.id)
                      : [...answers.wins, win.id],
                  })
                }
                mark={
                  <span
                    aria-hidden
                    className={cn(
                      'size-4 shrink-0 border',
                      on ? 'border-brand bg-brand' : 'border-ink-3',
                    )}
                  />
                }
                title={win.title}
                meta={win.meta}
                right={
                  win.tag && (
                    <span
                      className={cn(
                        'label shrink-0 text-[10px]',
                        on ? 'text-brand' : 'text-ink-3',
                      )}
                    >
                      {win.tag}
                    </span>
                  )
                }
              />
            )
          })}

          {/* What the modules could not measure. These are always kept: you
              typed them, which is the whole of the decision. */}
          {answers.ownWins.map((win, i) => (
            <ReviewRow
              key={`${win}-${i}`}
              selected
              label={`Remove ${win}`}
              onClick={() => patch({ ownWins: answers.ownWins.filter((unused, j) => j !== i) })}
              mark={<span aria-hidden className="size-4 shrink-0 border border-brand bg-brand" />}
              title={win}
              meta="Yours"
              right={<span className="label shrink-0 text-[10px] text-ink-3">Remove</span>}
            />
          ))}

          <div className="mt-2 flex flex-wrap gap-2.5">
            <input
              value={ownWin}
              onChange={(e) => setOwnWin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addWin()
                }
              }}
              aria-label="Add a win"
              placeholder="Something the data missed"
              className={cn(reviewField, 'flex-[1_1_240px]')}
            />
            <ActionButton size="lg" variant="accent" disabled={!ownWin.trim()} onClick={addWin}>
              Add
            </ActionButton>
          </div>

          <p className="mt-1.5 text-[12px] leading-[1.5] text-ink-3">
            {picked.length === 0
              ? 'Nothing picked yet. A week with no wins is worth writing down too.'
              : `${picked.length} picked${answers.ownWins.length > 0 ? `, ${answers.ownWins.length} of them yours` : ''}. These go in the note and nowhere else.`}
          </p>
        </div>
      )}

      {step === 'misses' && (
        <div className="flex flex-col gap-2">
          {data.misses.length === 0 ? (
            <EmptyState headline="Nothing slipped">
              Everything with a date this week either landed or is still ahead of it.
            </EmptyState>
          ) : (
            <>
              {data.misses.map((miss) => {
                const action = answers.missActions[miss.id]
                const est = estimate(miss.estimateMinutes)
                return (
                  <div
                    key={miss.id}
                    className={cn(
                      'border bg-bg-elev px-4 py-[15px]',
                      action ? 'border-brand' : 'border-rule-2',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
                      <span className="min-w-0 flex-[1_1_220px]">
                        <span
                          className={cn(
                            'block text-[15px]',
                            action === 'drop' ? 'text-ink-3 line-through' : 'text-ink',
                          )}
                        >
                          {miss.title}
                        </span>
                        <span className="mt-1 block text-[11px] leading-[1.45] text-ink-3">
                          {miss.meta}
                          {est && ` · ${est}`}
                        </span>
                      </span>

                      <span
                        role="radiogroup"
                        aria-label={`What happens to ${miss.title}`}
                        className="flex shrink-0 flex-wrap gap-1.5"
                      >
                        {ACTIONS.map((a) => (
                          <button
                            key={a.value}
                            type="button"
                            role="radio"
                            aria-checked={action === a.value}
                            onClick={() => {
                              // Clicking the chosen one again unsets it, which
                              // is how the artboard behaves. Deleted rather
                              // than set to undefined: the count of decisions
                              // still owed is the count of keys.
                              const next = { ...answers.missActions }
                              if (action === a.value) delete next[miss.id]
                              else next[miss.id] = a.value
                              patch({ missActions: next })
                            }}
                            className={cn(
                              'h-11 border px-3 text-[12px] transition-colors duration-150 active:scale-[.985] sm:h-8',
                              action === a.value
                                ? 'border-brand bg-brand-soft text-ink'
                                : 'border-rule-2 text-ink-3 hover:text-ink',
                            )}
                          >
                            {a.label}
                          </button>
                        ))}
                      </span>
                    </div>

                    {/* Carrying something needs no explanation. Dropping it or
                        cutting it down does, and the reason goes in the note. */}
                    {(action === 'drop' || action === 'shrink') && (
                      <input
                        defaultValue={answers.reasons[miss.id] ?? ''}
                        onBlur={(e) =>
                          patch({ reasons: { ...answers.reasons, [miss.id]: e.target.value } })
                        }
                        aria-label={`Why ${miss.title} slipped`}
                        placeholder="Why did it slip? One line is enough."
                        className={cn(reviewField, 'mt-2.5 w-full')}
                      />
                    )}
                  </div>
                )
              })}

              <p className="mt-1.5 text-[12px] leading-[1.5] text-ink-3">
                {decided} of {data.misses.length} decided. Carried items land on Monday, shrunk ones
                get a smaller first step, dropped ones leave the board with the reason attached.
              </p>
            </>
          )}
        </div>
      )}

      {step === 'goals' && (
        <div className="flex flex-col gap-2.5">
          {data.checks.length === 0 ? (
            <EmptyState headline="No goals">
              A goal needs a target and a deadline. Add one on the Goals screen and it appears here
              next week.
            </EmptyState>
          ) : (
            data.checks.map((check) => {
              const tone =
                check.status === 'at_risk'
                  ? 'text-warn'
                  : check.status === 'stalled'
                    ? 'text-bad'
                    : 'text-brand'
              const bar =
                check.status === 'at_risk'
                  ? 'bg-warn'
                  : check.status === 'stalled'
                    ? 'bg-bad'
                    : 'bg-brand'

              return (
                <div key={check.id} className="border border-rule-2 bg-bg-elev p-4">
                  <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-2.5">
                    <span className="min-w-0 flex-[1_1_220px]">
                      <span className="block text-[15px] text-ink">{check.title}</span>
                      <span className="mt-1 block text-[11px] text-ink-3">
                        {check.source ?? (check.computed ? 'Computed nightly' : 'Manual check-in')}
                      </span>
                    </span>
                    {check.status && (
                      <span className={cn('label shrink-0 text-[10px] tracking-[0.1em]', tone)}>
                        {STATUS_LABELS[check.status]}
                      </span>
                    )}
                  </div>

                  {/* The module measured this, not the review. A module that
                      tracks no target hands over no percent and gets no bar. */}
                  {check.percent !== undefined && (
                    <div className="mt-3.5 flex flex-wrap items-center gap-3">
                      <div
                        className="h-[3px] min-w-0 flex-[1_1_200px] bg-rule-2"
                        role="meter"
                        aria-valuenow={check.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${check.title} progress`}
                      >
                        <div className={cn('h-[3px]', bar)} style={{ width: `${check.percent}%` }} />
                      </div>
                      <span className="num shrink-0 text-[12px] text-ink-2">{check.percent}%</span>
                      {check.movement !== null && check.movement !== undefined && (
                        <span
                          className={cn(
                            'shrink-0 text-[10px]',
                            check.movement > 0
                              ? 'text-brand'
                              : check.movement === 0
                                ? 'text-ink-3'
                                : 'text-bad',
                          )}
                        >
                          {check.movement === 0
                            ? 'no change'
                            : `${check.movement > 0 ? '+' : ''}${check.movement} pts`}
                        </span>
                      )}
                    </div>
                  )}

                  {!check.computed && (
                    <div className="mt-3.5 flex flex-wrap gap-2.5 border-t border-rule pt-3.5">
                      <input
                        type="number"
                        step="any"
                        defaultValue={answers.checkins[check.id] ?? ''}
                        onBlur={(e) =>
                          e.target.value !== '' &&
                          patch({
                            checkins: { ...answers.checkins, [check.id]: Number(e.target.value) },
                          })
                        }
                        aria-label={`Check in on ${check.title}`}
                        placeholder="Where it stands today"
                        className={cn(reviewField, 'flex-[1_1_240px]')}
                      />
                      {check.unit && (
                        <span className="label self-center text-[10px] text-ink-3">
                          {check.unit}
                        </span>
                      )}
                    </div>
                  )}

                  {check.computed && check.note && (
                    <p className="mt-3 text-[12px] leading-[1.5] text-ink-3">{check.note}</p>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {step === 'plan' && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Eyebrow>Backlog · pick up to three</Eyebrow>
            <span
              className={cn(
                'num text-[11px]',
                answers.picks.length >= MAX_PICKS ? 'text-brand' : 'text-ink-3',
              )}
            >
              {answers.picks.length} of {MAX_PICKS} picked
              {answers.picks.length >= MAX_PICKS && ' · picking a fourth replaces the first'}
            </span>
          </div>

          {candidates.length === 0 ? (
            <div className="mt-3.5">
              <EmptyState headline="Nothing to pick">
                No open work and nothing carried. That is either a very good week or an empty
                backlog.
              </EmptyState>
            </div>
          ) : (
            <div className="mt-3.5 flex flex-col gap-2">
              {candidates.map((item) => {
                const at = answers.picks.indexOf(item.id)
                const on = at >= 0
                return (
                  <ReviewRow
                    key={item.id}
                    selected={on}
                    label={`${on ? 'Unpick' : 'Pick'} ${item.title}`}
                    onClick={() =>
                      patch({
                        picks: on
                          ? answers.picks.filter((id) => id !== item.id)
                          : // A fourth replaces the first rather than being
                            // refused: three is the shape of the week, not a
                            // quota to argue with.
                            answers.picks.length >= MAX_PICKS
                            ? [...answers.picks.slice(1), item.id]
                            : [...answers.picks, item.id],
                      })
                    }
                    mark={
                      <span
                        aria-hidden
                        className={cn(
                          'grid size-6 shrink-0 place-items-center border text-[10px]',
                          on ? 'border-brand bg-brand text-white' : 'border-rule-2 text-ink-3',
                        )}
                      >
                        {on ? at + 1 : ''}
                      </span>
                    }
                    title={item.title}
                    meta={item.meta}
                    right={
                      estimate(item.estimateMinutes) && (
                        <span className="num shrink-0 text-[10px] text-ink-3">
                          {estimate(item.estimateMinutes)}
                        </span>
                      )
                    }
                  />
                )
              })}
            </div>
          )}

          <label className="mt-[22px] block">
            <span className="label text-[10px] tracking-[0.12em] text-ink-3">
              One sentence on next week
            </span>
            <input
              defaultValue={answers.intent}
              onBlur={(e) => patch({ intent: e.target.value })}
              aria-label="Intent for next week"
              placeholder="One thing at a time."
              className={cn(reviewField, 'mt-2.5 w-full')}
            />
          </label>
        </div>
      )}

      {step === 'close' && (
        <div className="flex flex-col gap-5">
          {/* The note as it will be written, before it is written. The server
              renders these same blocks, so nothing is filed that was not read
              here first. */}
          <div className="border border-rule-2 bg-bg-elev p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <Eyebrow>Week {data.weekNumber} note</Eyebrow>
              <span className="label text-[10px] tracking-[0.12em] text-ink-3">
                {data.noteTarget ? `Saves to ${data.noteTarget}` : 'Kept on the review'}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3.5">
              {noteBlocks(answers, context).map((block) => (
                <div key={block.head}>
                  <p className="label text-[9px] tracking-[0.12em] text-brand">{block.head}</p>
                  {block.lines.length === 0 ? (
                    <p className="py-[7px] text-[12px] text-ink-3">{block.empty}</p>
                  ) : (
                    block.lines.map((line) => (
                      <div
                        key={line}
                        className="flex items-baseline gap-2.5 border-b border-rule py-[7px] text-[13px] leading-[1.5] text-ink"
                      >
                        <span className="size-[5px] shrink-0 rounded-full bg-ink-3" aria-hidden />
                        <span>{line}</span>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* What pressing the button does, in the three places it does it. */}
          <div className="flex flex-wrap gap-2.5">
            {outcomes.map((outcome) => (
              <div
                key={outcome.tag}
                className="min-w-0 flex-[1_1_200px] border border-rule-2 bg-bg p-3.5"
              >
                <p className="label text-[9px] tracking-[0.12em] text-brand">{outcome.tag}</p>
                <p className="mt-2 text-[13px] leading-[1.5] text-ink-2">{outcome.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </ReviewShell>
  )
}
