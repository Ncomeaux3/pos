'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ActionButton, Eyebrow, Overlay } from '@/components/pos'
import { cn } from '@/lib/utils'
import { quadrant, type Level } from '../quadrant'
import { deleteIdea, draftTask, researchIdea, saveIdea, type ActionResult, type IdeaInput } from './actions'
import {
  LEVEL_TEXT,
  LevelBar,
  QuadrantPill,
  STAGES,
  field,
  ghost,
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
  return <View idea={idea} research={research} onClose={onClose} onEdit={() => onEdit(true)} onRun={onRun} />
}

function View({
  idea,
  research,
  onClose,
  onEdit,
  onRun,
}: {
  idea: Idea
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
          <button type="button" onClick={onEdit} className={ghost}>
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`Delete "${idea.title}"? Killing keeps it; this does not.`)) return
              onRun(() => deleteIdea(idea.id), 'Deleted')
              onClose()
            }}
            className="text-[13px] text-ink-3 transition-colors duration-150 hover:text-bad"
          >
            Delete
          </button>
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
                <span key={t} className="num border border-rule px-1.5 py-0.5 text-[10px] text-ink-3">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-px border border-rule bg-rule">
          <div className="bg-bg px-3 py-2.5">
            <Eyebrow>Stage</Eyebrow>
            <div className={cn('mt-1.5 text-[14px]', stage.className)}>{stage.label}</div>
            <div className={cn('num mt-0.5 text-[10px]', idea.stale ? 'text-warn' : 'text-ink-4')}>
              {idea.stale ? 'STALE · ' : ''}
              {idea.daysInStage}d in stage
            </div>
          </div>
          <div className="bg-bg px-3 py-2.5">
            <Eyebrow>Impact</Eyebrow>
            <div className="mt-1.5 flex items-center gap-2 text-[14px] text-ink">
              {LEVEL_TEXT[idea.impact]} <LevelBar level={idea.impact} tone="brand" />
            </div>
          </div>
          <div className="bg-bg px-3 py-2.5">
            <Eyebrow>Effort</Eyebrow>
            <div className="mt-1.5 flex items-center gap-2 text-[14px] text-ink">
              {LEVEL_TEXT[idea.effort]} <LevelBar level={idea.effort} tone="ink" />
            </div>
          </div>
        </div>

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

        <div className="flex flex-col gap-2.5 border border-rule px-3.5 py-3">
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
            <div className="border-t border-rule pt-2.5 text-[12px] leading-[1.5] text-ink-2">
              <span className="num text-[9px] tracking-[0.08em] text-warn">PENDING · </span>
              {idea.draftTitle}{' '}
              <Link href="/tasks?view=review" className="text-ink-3 hover:text-ink">
                Review →
              </Link>
            </div>
          )}
        </div>

        <ResearchCard idea={idea} run={research} onRun={(depth) => onRun(() => researchIdea(idea.id, depth), 'Researched. The card says what it found and what it cost.')} />

        <div>
          <div className="flex items-baseline justify-between">
            <Eyebrow>Linked skills</Eyebrow>
            <Link href="/skills" className="text-[11px] text-ink-3 hover:text-ink">
              Skill tree →
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {idea.skills.length === 0 && <span className="text-[12px] text-ink-4">Nothing matched yet.</span>}
            {idea.skills.map((s) => (
              <Link key={s.id} href={`/skills?skill=${s.id}`} className="num border border-rule-2 px-2 py-[3px] text-[11px] tracking-[0.06em] text-ink-2 uppercase hover:border-ink hover:text-ink">
                {s.name}
              </Link>
            ))}
          </div>
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
                <span className="num shrink-0 text-[10px] text-ink-4">note · {Math.round(n.similarity * 100)}%</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Overlay>
  )
}

const VERDICT_CLASS: Record<string, string> = {
  build: 'text-brand border-brand',
  park: 'text-warn border-warn',
  drop: 'text-bad border-bad',
  unclear: 'text-ink-3 border-ink-3',
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
    <div className="flex flex-col gap-2.5 border border-rule px-3.5 py-3">
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
            <span className={cn('num border px-1.5 py-0.5 text-[9px] tracking-[0.08em] uppercase', VERDICT_CLASS[run.verdict] ?? VERDICT_CLASS.unclear)}>
              {run.verdict}
            </span>
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
    </div>
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
      <div role="radiogroup" aria-label={label} className="flex border border-rule-2">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={value === l}
            onClick={() => onChange(l)}
            className={cn(
              'flex-1 border-r border-rule-2 py-2 text-[12px] transition-colors duration-150 last:border-r-0',
              value === l ? 'bg-ink text-bg' : 'text-ink-3 hover:text-ink',
            )}
          >
            {LEVEL_TEXT[l]}
          </button>
        ))}
      </div>
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
        <div className="border border-rule px-3.5 py-3">
          <div className="flex items-baseline justify-between">
            <Eyebrow>Skills · linked</Eyebrow>
            <span className="text-[11px] text-ink-3">from title, pitch and tags · corrected on the Skill tree</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {!idea || idea.skills.length === 0 ? (
              <span className="text-[12px] text-ink-4">{idea ? 'Nothing matched yet.' : 'Classified when it is saved.'}</span>
            ) : (
              idea.skills.map((s) => (
                <span key={s.id} className="num border border-rule-2 px-2 py-[3px] text-[11px] tracking-[0.06em] text-ink-2 uppercase">
                  {s.name}
                </span>
              ))
            )}
          </div>
        </div>
      </form>
    </Overlay>
  )
}
