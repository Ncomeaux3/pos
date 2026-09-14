'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ActionButton, Eyebrow, Overlay } from '@/components/pos'
import { parseNumber } from '@/core/numbers'
import { cn } from '@/lib/utils'
import type { Task } from '../shape'
import { writeTask, type ActionResult, type WriteInput } from './actions'

// The task drawer, as the artboard draws it: a 480px form that holds its edits
// until Save, with Delete in the footer for an existing task. The same form
// with Create at the bottom is New task.

const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const field =
  'w-full border border-rule-2 bg-bg px-3 py-[9px] text-[13px] text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand'

/** The artboard's due options, with the task's own date first when it has one. */
const DUE_DAYS: Record<string, number | null> = {
  today: 0,
  tomorrow: 1,
  week: 4,
  later: 14,
  none: null,
}

const REMIND = [
  { value: '', label: 'No reminder' },
  { value: '0', label: 'At the time' },
  { value: '30', label: '30 min before' },
  { value: '1440', label: 'Day before' },
]

function isoFrom(today: Date, days: number): string {
  const d = new Date(today)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function TaskDrawer({
  task,
  projects,
  goals,
  today,
  reminderChannels,
  onClose,
  onSave,
  onDelete,
}: {
  /** Null is New task. */
  task: Task | null
  projects: { id: string; name: string }[]
  goals: { id: string; title: string }[]
  today: Date
  reminderChannels: string[] | null
  onClose: () => void
  onSave: (action: () => Promise<ActionResult>, ok?: string) => void
  onDelete?: () => void
}) {
  // The task's date as a select value: one of the named options when it is
  // one, the date itself otherwise, which the select lists first.
  const dateKey =
    task?.dueInDays === null || task === null
      ? 'none'
      : task.dueInDays === 0
        ? 'today'
        : task.dueInDays === 1
          ? 'tomorrow'
          : isoFrom(today, task.dueInDays)
  const dateLabel =
    task && task.dueInDays !== null && dateKey.includes('-')
      ? (() => {
          const d = new Date(today)
          d.setDate(d.getDate() + task.dueInDays)
          return `${DOWS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`
        })()
      : null

  const [draft, setDraft] = useState({
    title: task?.title ?? '',
    due: task ? dateKey : 'today',
    priority: task?.priority ?? 'P2',
    project: task?.projectName ?? '',
    time: task?.dueAt ?? '',
    remind: task?.remindMinutes === null || !task ? '' : String(task.remindMinutes),
    estimate: task?.estimateMinutes === null || !task ? '' : String(task.estimateMinutes),
    goal: task?.goalRef ?? '',
    notes: task?.notes ?? '',
  })
  const set = (key: keyof typeof draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }))

  const save = () => {
    const title = draft.title.trim()
    if (!title) return
    const input: WriteInput = {
      ...(task && { id: task.id }),
      title,
      notes: draft.notes,
      due_on: draft.due in DUE_DAYS
        ? (DUE_DAYS[draft.due] === null ? null : isoFrom(today, DUE_DAYS[draft.due]!))
        : draft.due,
      due_at: draft.time || null,
      priority: draft.priority,
      project: draft.project || null,
      goal_ref: draft.goal || null,
      estimated_minutes: parseNumber(draft.estimate),
      remind_minutes: draft.remind === '' ? null : Number(draft.remind),
    }
    onSave(() => writeTask(input), task ? 'Saved' : `Added. ${title}`)
    onClose()
  }

  const by = task?.skills[0]?.by
  const byLabel = by === 'manual' ? 'MANUAL · is_manual = true' : by === 'model' ? 'MODEL FALLBACK' : 'RULES'

  return (
    <Overlay
      open
      narrow
      onClose={onClose}
      eyebrow={
        <>
          Tasks <span className="text-ink-4">/</span> {task ? 'Edit' : 'New task'}
        </>
      }
      footer={
        <>
          {task ? (
            <button
              type="button"
              onClick={onDelete}
              className="text-[13px] text-ink-3 transition-colors duration-150 hover:text-bad"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <ActionButton
            variant="solid"
            className="h-[38px] gap-2 px-3.5 text-[13px]"
            disabled={!draft.title.trim()}
            onClick={save}
          >
            {task ? 'Save' : 'Create'} <span aria-hidden="true">&rarr;</span>
          </ActionButton>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <label className="flex flex-col gap-1.5">
          <Eyebrow>Title</Eyebrow>
          <input
            value={draft.title}
            onChange={set('title')}
            placeholder="What needs doing?"
            className={cn(field, 'px-3 py-2.5 text-[15px]')}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Due</Eyebrow>
            <select value={draft.due} onChange={set('due')} className={field}>
              {dateLabel && <option value={dateKey}>{dateLabel}</option>}
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="week">This week</option>
              <option value="later">Later</option>
              <option value="none">No date</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Priority</Eyebrow>
            <select value={draft.priority} onChange={set('priority')} className={cn(field, 'num')}>
              <option>P1</option>
              <option>P2</option>
              <option>P3</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Project</Eyebrow>
            <select value={draft.project} onChange={set('project')} className={field}>
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Time · optional</Eyebrow>
            <input type="time" value={draft.time} onChange={set('time')} className={cn(field, 'num py-2')} />
          </label>
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Remind me</Eyebrow>
            <select value={draft.remind} onChange={set('remind')} className={field}>
              {REMIND.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <Eyebrow>Estimate · min</Eyebrow>
            <input
              inputMode="decimal"
              value={draft.estimate}
              onChange={set('estimate')}
              className={cn(field, 'num')}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <Eyebrow>Goal</Eyebrow>
          <select value={draft.goal} onChange={set('goal')} className={field}>
            <option value="">None</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <Eyebrow>Notes</Eyebrow>
          <textarea
            value={draft.notes}
            onChange={set('notes')}
            rows={4}
            placeholder="Context, links, acceptance…"
            className={cn(field, 'resize-y px-3 py-2.5 leading-[1.5]')}
          />
        </label>

        <div>
          <div className="flex items-baseline justify-between">
            <Eyebrow>Linked skills</Eyebrow>
            {task && task.skills.length > 0 && (
              <span
                className={cn(
                  'num text-[10px] tracking-[0.08em]',
                  by === 'manual' ? 'text-warn' : by === 'model' ? 'text-ink-3' : 'text-ok',
                )}
              >
                {byLabel}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {!task || task.skills.length === 0 ? (
              <span className="text-[12px] text-ink-4">
                {task ? 'Nothing matched yet.' : 'Classified when it is created.'}
              </span>
            ) : (
              task.skills.map((s) => (
                <span
                  key={s.name}
                  className="inline-flex items-center gap-1.5 border border-rule-2 px-2 py-[3px] text-[11px] text-ink"
                >
                  {s.name}
                  <span className="num text-ink-3">
                    {s.by === 'manual' ? 'manual' : `${Math.round(s.confidence * 100)}%`}
                  </span>
                </span>
              ))
            )}
          </div>
          {task && (
            <p className="mt-2 text-[11px] leading-[1.5] text-ink-4">
              {by === 'manual'
                ? 'You set these. Jobs will never overwrite them.'
                : by === 'model'
                  ? 'No keyword matched, so the model decided. Correct it on the Skill Tree.'
                  : 'Matched keywords from skills.yaml. Correct it on the Skill Tree.'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-px border border-rule bg-rule">
          <div className="bg-bg px-3 py-2.5">
            <Eyebrow>Source · who created it</Eyebrow>
            <div
              className={cn(
                'num mt-1.5 text-[12px]',
                task?.source.startsWith('agent') ? 'text-warn' : 'text-ink',
              )}
            >
              {task?.source ?? 'manual'}
            </div>
          </div>
          <div className="bg-bg px-3 py-2.5">
            <Eyebrow>Reminder channel</Eyebrow>
            <div className="num mt-1.5 text-[12px] text-ink">
              {reminderChannels ? reminderChannels.join(' · ') : 'Off'} ·{' '}
              <Link href="/settings/notifications" className="text-ink-3 hover:text-ink">
                change
              </Link>
            </div>
          </div>
        </div>
      </form>
    </Overlay>
  )
}
