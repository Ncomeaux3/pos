'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ActionButton, Card, Chip, Eyebrow, MetricStrip, Overlay, PillGroup, SkillPicker, StatusChip, type ChipTone } from '@/components/pos'
import { cn } from '@/lib/utils'
import { quadrant, type Level } from '../quadrant'
import { deleteIdea, draftTask, researchIdea, saveIdea, type ActionResult, type IdeaInput } from './actions'
import {
  LEVEL_TEXT,
  LevelBar,
  QuadrantPill,
  STAGES,
  field,
  mini,
  miniAccent,
  type Idea,
  type Research,
  type Stage,
} from './Ideas'

// The idea drawer, as the artboard draws it: a view with the scores, the
// stage moves, the problem, the Agent card, what is linked, and Edit and
// Delete in the footer; an edit mode that is a form holding until Save. New
// idea is the form with Create. The research rubric, which the artboard
// predates, sits under the Agent card in the same box.

export function IdeaDrawer({
  idea,
  isNew,
  editing,
  draftTitle,
  goals,
  skills,
  research,
  onClose,
  onEdit,
  onRun,
}: {
  idea: Idea | null
  isNew: boolean
  editing: boolean
  /** What the capture line had when Full form was pressed. */
  draftTitle: string
  goals: { id: string; title: string }[]
  skills: [string, string][]
  research: Research | null
  onClose: () => void
  onEdit: (on: boolean) => void
  onRun: (action: () => Promise<ActionResult>, ok?: string) => void
}) {
  if (isNew || (idea && editing)) {
    return (
      <Form
        idea={isNew ? null : idea}
        draftTitle={draftTitle}
        goals={goals}
        onCancel={() => (isNew ? onClose() : onEdit(false))}
        onRun={onRun}
        onSaved={() => (isNew ? onClose() : onEdit(false))}
      />
    )
  }
  if (!idea) return null
  return <View idea={idea} skills={skills} research={research} onClose={onClose} onEdit={() => onEdit(true)} onRun={onRun} />
}

function View({
  idea,
  skills,
  research,
  onClose,
  onEdit,
  onRun,
}: {
  idea: Idea
  skills: [string, string][]
  research: Research | null
  onClose: () => void
  onEdit: () => void
  onRun: (action: () => Promise<ActionResult>, ok?: string) => void
}) {
  const q = quadrant(idea.effort, idea.impact)
  const stage = STAGES.find((s) => s.key === idea.stage) ?? STAGES[0]

  return (
    <Overlay
      open
      onClose={onClose}
      eyebrow={
        <>
          Ideas <span className="text-ink-4">/</span> {idea.title}
        </>
      }
      footer={
        <>
          <ActionButton onClick={onEdit}>Edit</ActionButton>
          <ActionButton
            variant="danger"
            onClick={() => {
              if (!window.confirm(`Delete "${idea.title}"? Killing keeps it; this does not.`)) return
              onRun(() => deleteIdea(idea.id), 'Deleted')
              onClose()
            }}
          >
            Delete
          </ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-[18px]">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[22px] font-normal leading-[1.2] tracking-[-0.03em] text-ink">{idea.title}</h2>
            <QuadrantPill q={q} className="mt-1" />
          </div>
          {idea.pitch && <p className="mt-2 text-[14px] leading-[1.5] text-ink-2">{idea.pitch}</p>}
          {idea.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {idea.tags.map((t) => (
                <Chip key={t} tone="quiet" className="num">
                  #{t}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <MetricStrip className="grid-cols-3 sm:grid-cols-3">
          <div className="px-3 py-2.5">
            <Eyebrow>Stage</Eyebrow>
            <div className={cn('mt-1.5 text-[14px]', stage.className)}>{stage.label}</div>
            <div className={cn('num t-caption mt-0.5', idea.stale ? 'text-warn' : 'text-ink-4')}>
              {idea.stale ? 'Stale · ' : ''}
              {idea.daysInStage}d in stage
            </div>
          </div>
          <div className="px-3 py-2.5">
            <Eyebrow>Impact</Eyebrow>
            <div className="mt-1.5 flex items-center gap-2 text-[14px] text-ink">
              {LEVEL_TEXT[idea.impact]} <LevelBar level={idea.impact} tone="brand" />
            </div>
          </div>
          <div className="px-3 py-2.5">
            <Eyebrow>Effort</Eyebrow>
            <div className="mt-1.5 flex items-center gap-2 text-[14px] text-ink">
              {LEVEL_TEXT[idea.effort]} <LevelBar level={idea.effort} tone="ink" />
            </div>
          </div>
        </MetricStrip>

        <div className="flex flex-wrap items-center gap-1.5">
          <Eyebrow className="mr-1">Move to</Eyebrow>
          {STAGES.filter((s) => s.key !== idea.stage).map((s) => (
            <button
              key={s.key}
              type="button"
              className={mini}
              onClick={() => onRun(() => saveIdea({ id: idea.id, stage: s.key }), `Moved to ${s.label}`)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {(idea.notes || idea.killedReason) && (
          <div>
            <Eyebrow>{idea.stage === 'killed' && idea.killedReason ? 'Why it was killed' : "Problem · who it's for"}</Eyebrow>
            <p className="mt-2 text-[13px] leading-[1.55] text-ink-2">
              {idea.stage === 'killed' && idea.killedReason ? idea.killedReason : idea.notes}
            </p>
          </div>
        )}

        <Card className="flex flex-col gap-2.5 px-3.5 py-3">
          <div className="flex items-baseline justify-between">
            <Eyebrow className="text-brand">Agent</Eyebrow>
            <span className="text-[11px] text-ink-3">drafts land in Review</span>
          </div>
          <div className="flex items-center justify-between gap-2.5">
            <div className="min-w-0 text-[13px] text-ink">
              Validation task
              <div className="mt-0.5 text-[11px] text-ink-3">
                {idea.stage === 'exploring'
                  ? 'Drafts a 30-minute task to test the riskiest assumption'
                  : 'Drafts the next concrete step for this stage'}
              </div>
            </div>
            <button
              type="button"
              className={miniAccent}
              onClick={() => onRun(() => draftTask(idea.id), 'Drafted. It is waiting in Tasks / Review.')}
            >
              {idea.draftTitle ? 'Redraft' : 'Draft task'}
            </button>
          </div>
          {idea.draftTitle && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-rule pt-2.5 text-[12px] leading-[1.5] text-ink-2">
              <StatusChip tone="warn">Pending</StatusChip>
              {idea.draftTitle}{' '}
              <Link href="/tasks?view=review" className="text-ink-3 hover:text-ink">
                Review →
              </Link>
            </div>
          )}
        </Card>

        <ResearchCard idea={idea} run={research} onRun={(depth) => onRun(() => researchIdea(idea.id, depth), 'Researched. The card says what it found and what it cost.')} />

        <div>
          <div className="flex items-baseline justify-between">
            <Eyebrow>Linked skills</Eyebrow>
            <Link href="/skills" className="text-[11px] text-ink-3 hover:text-ink">
              Skill tree →
            </Link>
          </div>
          {idea.entityRef ? (
            <SkillPicker entityRef={idea.entityRef} links={idea.skills} skills={skills} className="mt-2" />
          ) : (
            <p className="mt-2 text-[12px] text-ink-4">Nothing matched yet.</p>
          )}
        </div>

        {idea.goalTitle && idea.goalRef && (
          <div>
            <Eyebrow>Linked goal</Eyebrow>
            <Link href="/goals" className="mt-1.5 block text-[13px] text-ink hover:text-brand">
              {idea.goalTitle} →
            </Link>
          </div>
        )}

        <div>
          <div className="flex items-baseline justify-between">
            <Eyebrow>Related notes</Eyebrow>
            <Link href="/brain" className="text-[11px] text-ink-3 hover:text-ink">
              Second Brain →
            </Link>
          </div>
          <div className="mt-1.5 flex flex-col">
            {idea.related.length === 0 && (
              <span className="py-1.5 text-[12px] text-ink-4">Nothing similar in the vault yet</span>
            )}
            {idea.related.map((n) => (
              <Link key={n.title} href="/brain" className="flex justify-between gap-2.5 border-b border-rule py-2 text-[12px] text-ink hover:text-brand">
                <span className="min-w-0 truncate">{n.title}</span>
                <span className="num shrink-0 text-[11px] text-ink-3">note · {Math.round(n.similarity * 100)}%</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Overlay>
  )
}

const VERDICT_TONE: Record<string, ChipTone> = {
  build: 'brand',
  park: 'warn',
  drop: 'bad',
  unclear: 'quiet',
}

/**
 * The rubric's answer, its sources, and what it cost.
 *
 * The cost is on the screen because the run spends real money: a cent a search
 * plus tokens, and an idea board is exactly the place where it is tempting to
 * press the button forty times.
 */
function ResearchCard({
  idea,
  run,
  onRun,
}: {
  idea: Idea
  run: Research | null
  onRun: (depth: 'quick' | 'deep') => void
}) {
  return (
    <Card className="flex flex-col gap-2.5 px-3.5 py-3">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Research</Eyebrow>
        <span className="num text-[11px] text-ink-3">{run === null ? 'never run' : `${run.depth} · ${run.ranOn}`}</span>
      </div>

      {run === null && (
        <p className="text-[12px] leading-[1.5] text-ink-3">
          A fixed rubric with web search: problem, market, competitors, differentiation, and what one
          person nights and weekends would have to build. Every number comes with the page it came
          from, and a number without one is deleted before you see it.
        </p>
      )}

      {run?.status === 'failed' && <p className="text-[12px] text-bad">{run.detail}</p>}

      {run?.status === 'ok' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={VERDICT_TONE[run.verdict] ?? 'quiet'}>
              {run.verdict.charAt(0).toUpperCase() + run.verdict.slice(1)}
            </StatusChip>
            <span className="num text-[11px] text-ink-3">
              {run.confidence === null ? 'no confidence given' : `${Math.round(run.confidence * 100)}% confident`}
            </span>
            <span className="num text-[11px] text-ink-3">
              {run.searches} searches, {(run.costCents / 100).toFixed(2)} dollars
            </span>
          </div>

          {run.sections.map((section) => (
            <div key={section.key} className="space-y-1">
              <Eyebrow>{section.label}</Eyebrow>
              {section.summary && <p className="text-[12px] leading-[1.5] text-ink-2">{section.summary}</p>}
              {section.claims.length === 0 && !section.summary ? (
                <p className="text-[12px] text-ink-4">Nothing it could source.</p>
              ) : (
                section.claims.map((claim) => (
                  <p key={claim.text} className="text-[12px] leading-[1.5] text-ink-2">
                    {claim.text}{' '}
                    {claim.source && (
                      <a className="text-brand" href={claim.source} target="_blank" rel="noreferrer">
                        source
                      </a>
                    )}
                  </p>
                ))
              )}
            </div>
          ))}

          {run.sources.length > 0 && (
            <div className="space-y-1 border-t border-rule pt-2">
              <Eyebrow>Pages it read</Eyebrow>
              {run.sources.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block truncate text-[12px] text-ink-3 hover:text-brand">
                  {source.title}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={miniAccent} onClick={() => onRun('quick')}>
          {run === null ? 'Research it' : 'Run again'}
        </button>
        <button type="button" className={mini} onClick={() => onRun('deep')}>
          Deep run
        </button>
      </div>
      <p className="text-[11px] leading-[1.5] text-ink-4">
        Quick is up to four searches, deep is twelve. Searches are a cent each and the pages they
        return are read as tokens, which is the larger half of the bill. Counted against the monthly
        cap in Settings, which stops research first when it runs out.
        {idea.stage === 'killed' && ' Researching something you killed is allowed; sometimes that is how it comes back.'}
      </p>
    </Card>
  )
}

const LEVELS: Level[] = [1, 2, 3]

function Segment({
  label,
  value,
  onChange,
}: {
  label: string
  value: Level
  onChange: (l: Level) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow>{label}</Eyebrow>
      <PillGroup
        label={label}
        value={String(value)}
        onChange={(v) => onChange(Number(v) as Level)}
        options={LEVELS.map((l) => ({ value: String(l), label: LEVEL_TEXT[l] }))}
      />
    </div>
  )
}

function Form({
  idea,
  draftTitle,
  goals,
  onCancel,
  onRun,
  onSaved,
}: {
  idea: Idea | null
  draftTitle: string
  goals: { id: string; title: string }[]
  onCancel: () => void
  onRun: (action: () => Promise<ActionResult>, ok?: string) => void
  onSaved: () => void
}) {
  const [d, setD] = useState({
    title: idea?.title ?? draftTitle,
    pitch: idea?.pitch ?? '',
    notes: idea?.notes ?? '',
    effort: (idea?.effort ?? 2) as Level,
    impact: (idea?.impact ?? 2) as Level,
    stage: (idea?.stage ?? 'exploring') as Stage,
    goal: idea?.goalRef ?? '',
    tags: idea?.tags.join(', ') ?? '',
  })
  const set = (key: keyof typeof d) => (e: { target: { value: string } }) =>
    setD((prev) => ({ ...prev, [key]: e.target.value }))
  const ready = d.title.trim() !== ''

  const save = () => {
    if (!ready) return
    const input: IdeaInput = {
      ...(idea && { id: idea.id }),
      title: d.title.trim(),
      pitch: d.pitch,
      notes: d.notes,
      effort: d.effort,
      impact: d.impact,
      stage: d.stage,
      goal_ref: d.goal || null,
      tags: d.tags
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, '').toLowerCase())
        .filter(Boolean),
    }
    onRun(() => saveIdea(input), idea ? 'Saved' : `Captured. ${d.title.trim()}`)
    onSaved()
  }

  return (
    <Overlay
      open
      onClose={onCancel}
      eyebrow={
        <>
          Ideas <span className="text-ink-4">/</span> {idea ? 'Edit' : 'New idea'}
        </>
      }
      footer={
        <>
          <button type="button" onClick={onCancel} className="text-[13px] text-ink-3 transition-colors duration-150 hover:text-ink">
            Cancel
          </button>
          <ActionButton variant="solid" className="h-[38px] gap-2 px-3.5 text-[13px]" disabled={!ready} onClick={save}>
            {idea ? 'Save' : 'Create'} <span aria-hidden="true">&rarr;</span>
          </ActionButton>
        </>
      }
    >
      <form
        className="flex flex-col gap-[18px]"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <label className="flex flex-col gap-1.5">
          <Eyebrow>Idea</Eyebrow>
          <input value={d.title} onChange={set('title')} placeholder="Short name" className={cn(field, 'px-3 py-2.5 text-[15px]')} />
        </label>
        <label className="flex flex-col gap-1.5">
          <Eyebrow>One-line pitch</Eyebrow>
          <input value={d.pitch} onChange={set('pitch')} placeholder="What it does, in a sentence" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <Eyebrow>Problem · who it&apos;s for</Eyebrow>
          <textarea value={d.notes} onChange={set('notes')} rows={3} className={cn(field, 'resize-y leading-[1.5]')} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Segment label="Effort" value={d.effort} onChange={(effort) => setD((p) => ({ ...p, effort }))} />
          <Segment label="Impact" value={d.impact} onChange={(impact) => setD((p) => ({ ...p, impact }))} />
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Stage</Eyebrow>
            <select value={d.stage} onChange={set('stage')} className={field}>
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Linked goal</Eyebrow>
            <select value={d.goal} onChange={set('goal')} className={field}>
              <option value="">None</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <Eyebrow>Tags</Eyebrow>
          <input value={d.tags} onChange={set('tags')} placeholder="saas, b2b, hardware" className={cn(field, 'num')} />
        </label>
        <Card className="px-3.5 py-3">
          <div className="flex items-baseline justify-between">
            <Eyebrow>Skills · linked</Eyebrow>
            <span className="text-[11px] text-ink-3">from title, pitch and tags · corrected on the Skill tree</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {!idea || idea.skills.length === 0 ? (
              <span className="text-[12px] text-ink-4">{idea ? 'Nothing matched yet.' : 'Classified when it is saved.'}</span>
            ) : (
              idea.skills.map((s) => (
                <Chip key={s.id} tone="brand">
                  {s.name}
                </Chip>
              ))
            )}
          </div>
        </Card>
      </form>
    </Overlay>
  )
}
