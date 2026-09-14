'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ActionButton, Eyebrow, Overlay } from '@/components/pos'
import type { Metric } from '@/core/metrics'
import { parseNumber } from '@/core/numbers'
import { cn } from '@/lib/utils'
import { formatValue, historyPaths, ruleLong, type GoalKind } from '../progress'
import { deleteGoal, recordCheckin, writeGoal, type ActionResult, type GoalInput } from './actions'
import {
  AREAS,
  KIND_LABEL,
  STATUS_CLASS,
  STATUS_TEXT,
  checkinPlaceholder,
  field,
  formatDate,
  mini,
  miniAccent,
  projectionLabel,
  type GoalCard,
} from './GoalList'

// The goal drawer, as the artboard draws it: a view with the numbers, the rule
// written out, the history, what is linked, and a footer with Edit, Archive
// and Delete; and an edit mode that is a form holding its edits until Save.
// New goal is the form with Create.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function GoalDrawer({
  goal,
  isNew,
  editing,
  draft,
  metrics,
  todayIso,
  onClose,
  onEdit,
  onRun,
}: {
  goal: GoalCard | null
  isNew: boolean
  editing: boolean
  /** What the inline form had typed when More options was pressed. */
  draft: { title: string; target: string; deadline: string }
  metrics: Metric[]
  todayIso: string
  onClose: () => void
  onEdit: (on: boolean) => void
  onRun: (action: () => Promise<ActionResult>, ok?: string) => void
}) {
  if (isNew || (goal && editing)) {
    return (
      <Form
        goal={isNew ? null : goal}
        draft={draft}
        metrics={metrics}
        onCancel={() => (isNew ? onClose() : onEdit(false))}
        onRun={onRun}
        onSaved={() => (isNew ? onClose() : onEdit(false))}
      />
    )
  }
  if (!goal) return null
  return <View goal={goal} todayIso={todayIso} onClose={onClose} onEdit={() => onEdit(true)} onRun={onRun} />
}

function View({
  goal,
  todayIso,
  onClose,
  onEdit,
  onRun,
}: {
  goal: GoalCard
  todayIso: string
  onClose: () => void
  onEdit: () => void
  onRun: (action: () => Promise<ActionResult>, ok?: string) => void
}) {
  const p = goal.progress
  const [value, setValue] = useState('')
  const manual = !goal.metricSource
  const shape = {
    kind: goal.kind,
    startValue: goal.startValue,
    targetValue: goal.targetValue,
    deadlineInDays: p.daysLeft,
    ageInDays: goal.ageInDays,
    history: goal.history,
  }
  const chart = historyPaths(shape, p)
  const startDate = new Date(`${todayIso}T12:00:00`)
  startDate.setDate(startDate.getDate() - chart.spanDays)
  const proj = (days: number | null) =>
    p.status === 'done'
      ? { text: 'done', ok: true }
      : goal.kind === 'milestone'
        ? null
        : { text: projectionLabel(days, todayIso), ok: days !== null && days <= p.daysLeft }
  const proj30 = proj(p.projected30)
  const projAll = proj(p.projectedAll)
  const doneTasks = goal.tasks.filter((t) => t.done).length

  return (
    <Overlay
      open
      onClose={onClose}
      eyebrow={
        <>
          Goals <span className="text-ink-4">/</span> {goal.title}
        </>
      }
      footer={
        <>
          <div className="flex gap-2">
            <button type="button" onClick={onEdit} className={mini}>
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                onRun(() => writeGoal({ id: goal.id, archived: !goal.archived }), goal.archived ? 'Unarchived' : 'Archived')
                onClose()
              }}
              className={mini}
            >
              {goal.archived ? 'Unarchive' : 'Archive'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`Delete "${goal.title}"?`)) return
              onRun(() => deleteGoal(goal.id), 'Deleted')
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
            <h2 className="text-[22px] font-normal leading-[1.2] tracking-[-0.03em] text-ink">{goal.title}</h2>
            <span className={cn('num mt-1 shrink-0 whitespace-nowrap border px-1.5 py-0.5 text-[9px] tracking-[0.08em]', STATUS_CLASS[p.status])}>
              {STATUS_TEXT[p.status]}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-3">
            {goal.area} · {KIND_LABEL[goal.kind]} · {manual ? 'check-ins' : 'computed'}
          </p>
          {goal.notes && <p className="mt-2.5 text-[13px] leading-[1.55] text-ink-2">{goal.notes}</p>}
        </div>

        <div className="grid grid-cols-3 gap-px border border-rule bg-rule">
          <Cell label="Now" value={formatValue(p.current, goal.kind, goal.unit)} />
          <Cell label="Target" value={formatValue(goal.targetValue, goal.kind, goal.unit)} />
          <Cell label="Days left" value={p.daysLeft >= 0 ? `${p.daysLeft} days left` : `${-p.daysLeft} days over`} />
        </div>

        <div className="flex flex-col gap-2 border border-rule px-3.5 py-3">
          <Eyebrow>Status rule</Eyebrow>
          <p className="text-[13px] leading-[1.55] text-ink">
            {ruleLong(shape, p, goal.unit, formatDate(goal.deadline, todayIso))}
          </p>
          {proj30 && projAll && (
            <div className="grid grid-cols-2 gap-3 text-[12px] text-ink-3">
              <span>
                Projected · last 30d pace
                <span className={cn('mt-0.5 block', proj30.ok ? 'text-ok' : 'text-warn')}>{proj30.text}</span>
              </span>
              <span>
                Projected · all history
                <span className={cn('mt-0.5 block', projAll.ok ? 'text-ok' : 'text-warn')}>{projAll.text}</span>
              </span>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <Eyebrow>History</Eyebrow>
            <span className="num text-[11px] text-ink-3">
              {goal.history.length} points · {manual ? 'check-ins' : 'nightly snapshots'}
            </span>
          </div>
          <svg viewBox="0 0 400 110" preserveAspectRatio="none" className="mt-2 block h-[110px] w-full overflow-visible" aria-hidden>
            <line x1="0" y1={chart.targetY} x2="400" y2={chart.targetY} stroke="var(--ink-4)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
            <line x1="0" y1={chart.paceY1} x2="400" y2={chart.paceY2} stroke="var(--rule-2)" vectorEffect="non-scaling-stroke" />
            <path d={chart.area} fill="var(--accent-soft)" />
            <path d={chart.path} fill="none" stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            {chart.dots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={2.5} fill={d.manual ? 'var(--ink)' : 'var(--accent)'} stroke="var(--bg-elev)" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div className="mt-1 flex justify-between text-[10px] text-ink-4">
            <span>{`${MONTHS[startDate.getMonth()]} ${startDate.getDate()}`.toUpperCase()}</span>
            <span>dashed = target · grey = needed pace</span>
            <span>TODAY</span>
          </div>
          {manual && goal.kind !== 'milestone' && (
            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const n = parseNumber(value)
                if (n === null) return
                onRun(() => recordCheckin(goal.id, n), 'Checked in')
                setValue('')
              }}
            >
              <input
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label={`Check in on ${goal.title}`}
                placeholder={checkinPlaceholder(goal.unit)}
                className={cn(field, 'num min-w-0 flex-1 px-2.5 py-2')}
              />
              <button type="submit" className={miniAccent}>
                Check in
              </button>
            </form>
          )}
          {manual && goal.kind === 'milestone' && (
            <button
              type="button"
              className={cn(miniAccent, 'mt-3')}
              onClick={() =>
                onRun(() => recordCheckin(goal.id, p.status === 'done' ? 0 : 1), p.status === 'done' ? 'Reopened' : 'Marked done')
              }
            >
              {p.status === 'done' ? 'Reopen' : 'Mark done'}
            </button>
          )}
          {!manual && (
            <p className="mt-2.5 text-[11px] text-ink-4">
              Computed nightly from <span className="num">{goal.metricSource}</span>. Manual check-ins are disabled while a source is set.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <Eyebrow>Linked tasks</Eyebrow>
            <Link href="/tasks?view=goal" className="text-[11px] text-ink-3 hover:text-ink">
              {doneTasks} / {goal.tasks.length} done →
            </Link>
          </div>
          <div className="mt-1.5 flex flex-col">
            {goal.tasks.length === 0 && <p className="py-2 text-[12px] text-ink-4">No task points at this goal yet.</p>}
            {goal.tasks.map((t, i) => (
              <div key={i} className="flex justify-between gap-2.5 border-b border-rule py-2 text-[13px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn('size-3 shrink-0 border', t.done ? 'border-brand bg-brand' : 'border-ink-3')} />
                  <span className={cn('truncate', t.done ? 'text-ink-3 line-through' : 'text-ink')}>{t.title}</span>
                </span>
                <span className="num shrink-0 text-[11px] text-ink-3">{t.meta}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Eyebrow>Linked skills</Eyebrow>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {goal.skills.length === 0 && <span className="text-[12px] text-ink-4">Nothing matched yet.</span>}
            {goal.skills.map((s) => (
              <Link key={s.id} href={`/skills?skill=${s.id}`} className="num border border-rule-2 px-2 py-[3px] text-[11px] tracking-[0.06em] text-ink-2 uppercase hover:border-ink hover:text-ink">
                {s.name}
              </Link>
            ))}
          </div>
        </div>

        {goal.proposals.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between">
              <Eyebrow>Agent proposals</Eyebrow>
              <Link href="/review" className="text-[11px] text-ink-3 hover:text-ink">
                Review →
              </Link>
            </div>
            <div className="mt-1.5 flex flex-col">
              {goal.proposals.map((pr) => (
                <div key={pr.id} className="border-b border-rule py-2">
                  <div className="flex justify-between gap-2.5">
                    <span className="text-[11px] text-ink-3">{pr.from}</span>
                    <span className="num text-[9px] tracking-[0.08em] text-warn">PENDING</span>
                  </div>
                  <div className="mt-[3px] text-[13px] text-ink">{pr.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Overlay>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg px-3 py-2.5">
      <Eyebrow>{label}</Eyebrow>
      <div className="num mt-1.5 text-[18px] font-light text-ink">{value}</div>
    </div>
  )
}

function Form({
  goal,
  draft,
  metrics,
  onCancel,
  onRun,
  onSaved,
}: {
  goal: GoalCard | null
  draft: { title: string; target: string; deadline: string }
  metrics: Metric[]
  onCancel: () => void
  onRun: (action: () => Promise<ActionResult>, ok?: string) => void
  onSaved: () => void
}) {
  const [d, setD] = useState({
    title: goal?.title ?? draft.title,
    kind: (goal?.kind ?? 'number') as GoalKind,
    area: goal?.area ?? 'Life ops',
    target: goal ? String(goal.targetValue) : draft.target,
    unit: goal?.unit ?? '',
    deadline: goal?.deadline ?? draft.deadline,
    start: goal ? String(goal.startValue) : '0',
    metric: goal?.metricSource ?? '',
    notes: goal?.notes ?? '',
  })
  const set = (key: keyof typeof d) => (e: { target: { value: string } }) =>
    setD((prev) => ({ ...prev, [key]: e.target.value }))
  const milestone = d.kind === 'milestone'
  const target = parseNumber(d.target) ?? 0
  const ready = d.title.trim() !== '' && d.deadline !== '' && (milestone || target > 0)

  const save = () => {
    if (!ready) return
    const input: GoalInput = {
      ...(goal && { id: goal.id }),
      title: d.title.trim(),
      kind: d.kind,
      area: d.area,
      unit: milestone ? '' : d.unit,
      target_value: milestone ? 1 : target,
      start_value: milestone ? 0 : (parseNumber(d.start) ?? 0),
      deadline: d.deadline,
      metric_source: d.metric || null,
      notes: d.notes,
    }
    onRun(() => writeGoal(input), goal ? 'Saved' : `Added. ${d.title.trim()}`)
    onSaved()
  }

  const areas = AREAS.includes(d.area) ? AREAS : [...AREAS, d.area]

  return (
    <Overlay
      open
      onClose={onCancel}
      eyebrow={
        <>
          Goals <span className="text-ink-4">/</span> {goal ? 'Edit' : 'New goal'}
        </>
      }
      footer={
        <>
          <button type="button" onClick={onCancel} className="text-[13px] text-ink-3 transition-colors duration-150 hover:text-ink">
            Cancel
          </button>
          <ActionButton variant="solid" className="h-[38px] gap-2 px-3.5 text-[13px]" disabled={!ready} onClick={save}>
            {goal ? 'Save' : 'Create'} <span aria-hidden="true">&rarr;</span>
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
          <Eyebrow>Title</Eyebrow>
          <input value={d.title} onChange={set('title')} className={cn(field, 'px-3 py-2.5 text-[15px]')} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Type</Eyebrow>
            <select value={d.kind} onChange={set('kind')} className={field}>
              <option value="number">Numeric target</option>
              <option value="count">Count</option>
              <option value="streak">Habit · per week</option>
              <option value="milestone">Milestone</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Life area</Eyebrow>
            <select value={d.area} onChange={set('area')} className={field}>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          {!milestone && (
            <>
              <label className="flex flex-col gap-1.5">
                <Eyebrow>{d.kind === 'streak' ? 'Times per week' : 'Target'}</Eyebrow>
                <input inputMode="decimal" value={d.target} onChange={set('target')} className={cn(field, 'num')} />
              </label>
              <label className="flex flex-col gap-1.5">
                <Eyebrow>Unit</Eyebrow>
                <input value={d.unit} onChange={set('unit')} placeholder="$, lb, books, /wk" className={cn(field, 'num')} />
              </label>
            </>
          )}
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Deadline</Eyebrow>
            <input type="date" value={d.deadline} onChange={set('deadline')} className={cn(field, 'num py-2')} />
          </label>
          {!milestone && (
            <label className="flex flex-col gap-1.5">
              <Eyebrow>Starting value</Eyebrow>
              <input inputMode="decimal" value={d.start} onChange={set('start')} className={cn(field, 'num')} />
            </label>
          )}
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <Eyebrow>Metric source · optional</Eyebrow>
            <span className="text-[11px] text-ink-3">progress is computed when set</span>
          </div>
          <select
            value={d.metric}
            onChange={set('metric')}
            aria-label="Metric source"
            className={cn(field, 'mt-2 text-[12px]')}
          >
            <option value="">Manual check-ins</option>
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · {m.id}
              </option>
            ))}
            {d.metric && !metrics.some((m) => m.id === d.metric) && (
              <option value={d.metric}>{d.metric} (not registered)</option>
            )}
          </select>
        </div>
        <label className="flex flex-col gap-1.5">
          <Eyebrow>Notes</Eyebrow>
          <textarea value={d.notes} onChange={set('notes')} rows={3} className={cn(field, 'resize-y px-3 py-2.5 leading-[1.5]')} />
        </label>
      </form>
    </Overlay>
  )
}
