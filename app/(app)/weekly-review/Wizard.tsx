'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  Chip,
  EmptyState,
  Eyebrow,
  MetricTile,
  PillGroup,
  Row,
  RowList,
  StatusChip,
  WizardShell,
  fieldClass,
  useToast,
} from '@/components/pos'
import {
  EMPTY_ANSWERS,
  outstanding,
  renderNote,
  STEPS,
  type MissAction,
  type ReviewAnswers,
  type StepKey,
} from '@/core/reviews-shape'
import { cn } from '@/lib/utils'
import { close, save } from './actions'

// Six steps over one set of answers. Every step writes into the same object and
// the object is saved as you go, so a review interrupted at step four resumes
// where it was rather than starting again.

type Item = { id: string; title: string; meta: string; estimateMinutes?: number | null; module: string }
type Check = { id: string; title: string; unit: string; computed: boolean; module: string }

export type WeekData = {
  week: string
  weekLabel: string
  glance: { label: string; value: string; module: string }[]
  misses: Item[]
  backlog: Item[]
  checks: Check[]
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
    weekLabel: data.weekLabel,
    winTitles: Object.fromEntries(data.glance.map((g) => [g.label, g.label])),
    missTitles: Object.fromEntries(data.misses.map((m) => [m.id, m.title])),
    goalLines: data.checks.map((c) => {
      if (c.computed) return `${c.title}, computed`
      const value = answers.checkins[c.id]
      // The unit belongs to the number, not to its absence: "no check-in lb"
      // is what the general form produces and it reads as a broken template.
      if (value === undefined) return `${c.title}, no check-in`
      return `${c.title}, ${value}${c.unit ? ` ${c.unit}` : ''}`
    }),
    pickTitles: Object.fromEntries(candidates.map((b) => [b.id, b.title])),
  }

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
        <Eyebrow dot="ok">Week of {data.weekLabel}</Eyebrow>
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

  return (
    <WizardShell
      railTitle="Weekly review"
      railLede={`Week of ${data.weekLabel}. Usually eight minutes.`}
      steps={STEPS.map((s) => ({ key: s.key, name: s.name }))}
      current={step}
      onStep={(key) => setStep(key as StepKey)}
      kicker={stage.kicker}
      title={stage.question}
      helper={stage.helper}
      onBack={index > 0 ? () => setStep(STEPS[index - 1].key) : undefined}
      onSkip={owed > 0 && index < STEPS.length - 1 ? () => setStep(STEPS[index + 1].key) : undefined}
      onNext={
        index === STEPS.length - 1 ? finish : () => setStep(STEPS[index + 1].key)
      }
      nextLabel={index === STEPS.length - 1 ? 'Close the week' : 'Continue'}
      footnote={
        owed > 0
          ? `${owed} still undecided. Skip leaves them as they are.`
          : pending
            ? 'Saving.'
            : undefined
      }
    >
      {step === 'glance' && (
        <div className="space-y-4">
          {data.glance.length === 0 ? (
            <EmptyState headline="No numbers yet">
              The glance reads module digests, and none have been written. Run the nightly job from
              the dashboard and this fills in.
            </EmptyState>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))]">
              {data.glance.map((g) => (
                <MetricTile key={`${g.module}.${g.label}`} label={g.label} value={g.value} />
              ))}
            </div>
          )}
          <p className="t-caption text-ink-3">
            Every number here comes from a module digest, never from a module&apos;s own tables. A module
            that is not installed contributes no line.
          </p>
        </div>
      )}

      {step === 'wins' && (
        <div className="space-y-4">
          <p className="t-caption text-ink-3">
            Nothing is proposed for you. A win is what you say it is, so this is a list you write.
          </p>

          <div className="flex flex-wrap gap-2">
            <input
              value={ownWin}
              onChange={(e) => setOwnWin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && ownWin.trim()) {
                  e.preventDefault()
                  patch({ ownWins: [...answers.ownWins, ownWin.trim()] })
                  setOwnWin('')
                }
              }}
              aria-label="Add a win"
              placeholder="Shipped the drill-ins"
              className={cn(fieldClass, 'min-w-0 flex-1 basis-[260px]')}
            />
            <ActionButton
              variant="brand"
              disabled={!ownWin.trim()}
              onClick={() => {
                patch({ ownWins: [...answers.ownWins, ownWin.trim()] })
                setOwnWin('')
              }}
            >
              Add
            </ActionButton>
          </div>

          {answers.ownWins.length === 0 ? (
            <EmptyState headline="Nothing yet">
              Three or four is plenty. These become the wins section of the week note.
            </EmptyState>
          ) : (
            <RowList>
              {answers.ownWins.map((win, i) => (
                <Row
                  key={`${win}-${i}`}
                  title={win}
                  right={
                    <ActionButton
                      onClick={() =>
                        patch({ ownWins: answers.ownWins.filter((unused, j) => j !== i) })
                      }
                    >
                      Remove
                    </ActionButton>
                  }
                />
              ))}
            </RowList>
          )}
        </div>
      )}

      {step === 'misses' && (
        <div className="space-y-3">
          {data.misses.length === 0 ? (
            <EmptyState headline="Nothing slipped">
              Everything with a date this week either landed or is still ahead of it.
            </EmptyState>
          ) : (
            <RowList>
              {data.misses.map((miss) => {
                const action = answers.missActions[miss.id]
                return (
                  <Row
                    key={miss.id}
                    title={miss.title}
                    meta={miss.meta}
                    muted={action === 'drop'}
                    right={
                      <PillGroup
                        label={`What happens to ${miss.title}`}
                        value={action ?? ''}
                        options={ACTIONS}
                        onChange={(next) =>
                          patch({
                            missActions: { ...answers.missActions, [miss.id]: next as MissAction },
                          })
                        }
                      />
                    }
                  >
                    {action && (
                      <input
                        defaultValue={answers.reasons[miss.id] ?? ''}
                        onBlur={(e) =>
                          patch({ reasons: { ...answers.reasons, [miss.id]: e.target.value } })
                        }
                        aria-label={`Why ${miss.title} slipped`}
                        placeholder="Why, in a few words. Optional, goes in the note."
                        className={cn(fieldClass, 'w-full')}
                      />
                    )}
                  </Row>
                )
              })}
            </RowList>
          )}
        </div>
      )}

      {step === 'goals' && (
        <div className="space-y-3">
          {data.checks.length === 0 ? (
            <EmptyState headline="No goals">
              A goal needs a target and a deadline. Add one on the Goals screen and it appears here
              next week.
            </EmptyState>
          ) : (
            <RowList>
              {data.checks.map((check) => (
                <Row
                  key={check.id}
                  title={check.title}
                  meta={check.computed ? 'Computed nightly, nothing needed' : 'Needs a number'}
                  right={
                    check.computed ? (
                      <StatusChip tone="brand">Computed</StatusChip>
                    ) : (
                      <div className="flex items-center gap-2">
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
                          className={cn(fieldClass, 'w-28')}
                        />
                        {check.unit && <Chip tone="quiet">{check.unit}</Chip>}
                      </div>
                    )
                  }
                />
              ))}
            </RowList>
          )}
        </div>
      )}

      {step === 'plan' && (
        <div className="space-y-3">
          <p className="t-caption text-ink-3">
            Pick up to {MAX_PICKS}. What you carried is already here; everything else stays in the
            backlog.
          </p>

          {candidates.length === 0 ? (
            <EmptyState headline="Nothing to pick">
              No open work and nothing carried. That is either a very good week or an empty backlog.
            </EmptyState>
          ) : (
            <RowList>
              {candidates.map((item) => {
                const picked = answers.picks.includes(item.id)
                const full = answers.picks.length >= MAX_PICKS && !picked
                return (
                  <Row
                    key={item.id}
                    title={item.title}
                    meta={item.meta}
                    selected={picked}
                    muted={full}
                    right={
                      <ActionButton
                        variant={picked ? 'brand' : 'outline'}
                        disabled={full}
                        onClick={() =>
                          patch({
                            picks: picked
                              ? answers.picks.filter((id) => id !== item.id)
                              : [...answers.picks, item.id],
                          })
                        }
                      >
                        {picked ? `#${answers.picks.indexOf(item.id) + 1}` : full ? 'Full' : 'Pick'}
                      </ActionButton>
                    }
                  />
                )
              })}
            </RowList>
          )}

          <label className="block space-y-1.5 pt-2">
            <Eyebrow>One sentence for the week</Eyebrow>
            <input
              defaultValue={answers.intent}
              onBlur={(e) => patch({ intent: e.target.value })}
              aria-label="Intent for next week"
              placeholder="One thing at a time."
              className={cn(fieldClass, 'w-full')}
            />
          </label>
        </div>
      )}

      {step === 'close' && (
        <div className="space-y-4">
          <p className="t-caption text-ink-3">
            This writes the note below, moves what you carried to next Monday, closes what you
            dropped, records the check-ins, and files the week. Anything that will not apply is
            named rather than skipped quietly.
          </p>

          {/* The note as it will be written, before it is written. Nothing is
              generated on the server that is not shown here first. */}
          <pre className="code max-h-[40vh] overflow-auto rounded-md border border-rule-2 bg-bg-deep p-4 text-[12px] leading-relaxed whitespace-pre-wrap text-ink-2">
            {renderNote(answers, context)}
          </pre>
        </div>
      )}
    </WizardShell>
  )
}
