'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ActionButton, Eyebrow, Overlay, SkillPicker } from '@/components/pos'
import { parseNumber } from '@/core/numbers'
import { cn } from '@/lib/utils'
import type { Task } from '../shape'
import { writeTask, type ActionResult, type WriteInput } from './actions'

// The task drawer, as the artboard draws it: a 480px form that holds its edits
// until Save, with Delete in the footer for an existing task. The same form
// with Create at the bottom is New task.

const field =
  'w-full border border-rule-2 bg-bg px-3 py-[9px] text-[13px] text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand'

/** The artboard's due options. `date` reveals a native date input beside the select. */
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

function daysFrom(today: Date, iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000)
}

export function TaskDrawer({
  task,
  projects,
  goals,
  skills,
  today,
  reminderChannels,
  onClose,
  onSave,
  onDelete,
  prefill,
}: {
  /** Null is New task. */
  task: Task | null
  projects: { id: string; name: string; goalRef: string | null }[]
  goals: { id: string; title: string }[]
  skills: [string, string][]
  today: Date
  reminderChannels: string[] | null
  onClose: () => void
  onSave: (action: () => Promise<ActionResult>, ok?: string) => void
  onDelete?: () => void
  /** What the view that opened New task already implies: a due date, goal or project. */
  prefill?: Partial<WriteInput>
}) {
  // The date as a select value: a named option when it is one, else `date`
  // with the day itself in the input beside it. A new task is due today unless
  // the column it was added from says otherwise.
  const dueInDays = task
    ? task.dueInDays
    : prefill?.due_on === undefined
      ? 0
      : prefill.due_on === null
        ? null
        : daysFrom(today, prefill.due_on)
  const dateKey =
    dueInDays === null ? 'none' : dueInDays === 0 ? 'today' : dueInDays === 1 ? 'tomorrow' : 'date'

  const [draft, setDraft] = useState({
    title: task?.title ?? '',
    due: dateKey,
    dueDate: dueInDays === null ? '' : isoFrom(today, dueInDays),
    priority: task?.priority ?? 'P2',
    project: task?.projectName ?? prefill?.project ?? '',
    time: task?.dueAt ?? '',
    remind: task?.remindMinutes === null || !task ? '' : String(task.remindMinutes),
    estimate: task?.estimateMinutes === null || !task ? '' : String(task.estimateMinutes),
    // The task's own goal. What it inherits from the project is a caption, not
    // a value, so saving never copies the project's goal onto the task.
    goal: task?.ownGoalRef ?? prefill?.goal_ref ?? '',
    notes: task?.notes ?? '',
  })
  const inherited = draft.goal
    ? null
    : goals.find((g) => g.id === projects.find((p) => p.name === draft.project)?.goalRef)
  const set = (key: keyof typeof draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }))

  const save = () => {
    const title = draft.title.trim()
    if (!title) return
    const input: WriteInput = {
      ...(task && { id: task.id }),
      title,
      notes: draft.notes,
      due_on:
        draft.due === 'date'
          ? draft.dueDate || null
          : DUE_DAYS[draft.due] === null
            ? null
            : isoFrom(today, DUE_DAYS[draft.due]!),
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
          <div className={cn('flex flex-col gap-1.5', draft.due === 'date' && 'col-span-2')}>
            <Eyebrow>Due</Eyebrow>
            <div className="flex items-center gap-2">
              <select aria-label="Due" value={draft.due} onChange={set('due')} className={field}>
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="week">This week</option>
                <option value="later">Later</option>
                <option value="date">Pick a date</option>
                <option value="none">No date</option>
              </select>
              {draft.due === 'date' && (
                <input
                  type="date"
                  aria-label="Due date"
                  value={draft.dueDate}
                  onChange={set('dueDate')}
                  className={cn(field, 'num')}
                />
              )}
            </div>
          </div>
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
            <div className="flex items-center gap-2">
              <input type="time" value={draft.time} onChange={set('time')} className={cn(field, 'num py-2')} />
              {draft.time && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, time: '' }))}
                  className="text-[12px] text-ink-3 transition-colors duration-150 hover:text-ink"
                >
                  Clear
                </button>
              )}
            </div>
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
            <option value="">{inherited ? 'From the project' : 'None'}</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          {inherited && (
            <span className="text-[11px] text-ink-2">Inherits {inherited.title} from the project</span>
          )}
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
          <Eyebrow>Linked skills</Eyebrow>
          {task?.entityRef ? (
            <SkillPicker entityRef={task.entityRef} links={task.skills} skills={skills} className="mt-2" />
          ) : (
            <p className="mt-2 text-[12px] text-ink-4">Classified when it is created.</p>
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
