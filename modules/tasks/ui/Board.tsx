'use client'

import { useMemo, useOptimistic, useState, useTransition } from 'react'
import { ActionButton, EmptyState, TabBar, useToast } from '@/components/pos'
import { cn } from '@/lib/utils'
import { parseQuickAdd } from '../quickadd'
import {
  bucket,
  columnsFor,
  dueLabel,
  remindLabel,
  VIEWS,
  type Task,
  type View,
} from '../shape'
import { useSwipe } from '@/components/pos/gestures'
import { useSearchState } from '@/components/pos/searchState'
import { approveTask, completeTask, deleteTask, writeTask, type ActionResult } from './actions'
import { Calendar } from './Calendar'
import { TaskDrawer } from './TaskDrawer'

// The whole board: the quick add line, the view tabs, the columns, and the
// drawer. One client component because the drag source, the drop target, the
// expanded row and the drawer all read the same selection, and splitting them
// would mean syncing it.

const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The artboard's small buttons: 11px, 4px 9px, a rule-2 border. */
export const mini =
  'border border-rule-2 px-[9px] py-1 text-[11px] text-ink-3 transition-colors duration-150 hover:border-ink hover:text-ink'
export const miniAccent =
  'border border-brand px-[9px] py-1 text-[11px] text-ink transition-colors duration-150 hover:bg-brand hover:text-bg'

export const priorityColor = (p: Task['priority']) =>
  p === 'P1' ? 'text-bad' : p === 'P2' ? 'text-ink-2' : 'text-ink-4'

const TABS: { value: View | 'calendar'; label: string }[] = [
  ...VIEWS.slice(0, 4),
  { value: 'calendar', label: 'Calendar' },
  ...VIEWS.slice(4),
]

function useView(): { view: View; calendar: boolean; label: string } {
  const { params } = useSearchState()
  const view = (VIEWS.find((v) => v.value === params.get('view'))?.value ?? 'today') as View
  const calendar = params.get('month') === '1'
  return {
    view,
    calendar,
    label: calendar ? 'Calendar' : VIEWS.find((v) => v.value === view)!.label,
  }
}

/** "Tasks / Today", the band's crumb. Reads the view the board is on. */
export function BoardCrumb() {
  const { label } = useView()
  return (
    <>
      Tasks <span className="text-ink-4">/</span> {label}
    </>
  )
}

export function Board({
  tasks: serverTasks,
  projects,
  goals,
  reminderChannels,
  todayIso,
}: {
  tasks: Task[]
  projects: { id: string; name: string }[]
  goals: { id: string; title: string }[]
  reminderChannels: string[] | null
  todayIso: string
}) {
  // The view and the open drawer live in the URL, not in state. They survive
  // a refresh, they can be linked to, and it is what lets a screenshot of
  // "By project" actually be one: the theme switch reloads the page, and
  // client state does not come back.
  const { params, set: setParams } = useSearchState()
  const { view, calendar: showCalendar } = useView()
  const drawer = params.get('task')

  // A completed task reads as done the moment the box is ticked or the row is
  // swiped, and the server's answer replaces the guess when it lands.
  const [tasks, flip] = useOptimistic(serverTasks, (state, patch: { id: string; done: boolean }) =>
    state.map((t) => (t.id === patch.id ? { ...t, status: patch.done ? 'done' : 'open' } : t)),
  )

  // The expanded row rides in the URL with the view and the drawer, for the
  // same reason: a screenshot of an open row has to survive a reload.
  const expanded = params.get('open')
  const setExpanded = (id: string | null) => setParams({ open: id })
  const [dragging, setDragging] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const toast = useToast()

  const today = useMemo(() => {
    const [y, m, d] = todayIso.split('-').map(Number)
    return new Date(y, m - 1, d)
  }, [todayIso])

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  const columns = columnsFor(view, tasks, { projects, goals })
  const open = tasks.filter((t) => t.status === 'open')
  const counts: Partial<Record<View, number>> = {
    today: open.filter((t) => ['overdue', 'today'].includes(bucket(t.dueInDays))).length,
    week: open.filter((t) => ['overdue', 'today', 'week'].includes(bucket(t.dueInDays))).length,
    review: tasks.filter((t) => t.status === 'review').length,
    done: tasks.filter((t) => t.status === 'done').length,
  }

  /** Turn a column's drop spec into the tool input that makes it true. */
  const dropPatch = (drop: Record<string, unknown>): Record<string, unknown> => {
    const patch: Record<string, unknown> = {}
    if ('dueInDays' in drop) {
      const days = drop.dueInDays as number
      const target = new Date(today)
      target.setDate(target.getDate() + days)
      patch.due_on = target.toISOString().slice(0, 10)
    }
    if ('goalRef' in drop) patch.goal_ref = drop.goalRef
    if ('projectId' in drop) {
      patch.project = drop.projectId
        ? (projects.find((p) => p.id === drop.projectId)?.name ?? null)
        : null
    }
    return patch
  }

  const openDrawer = (id: string) => setParams({ task: id }, { push: true })
  const remove = (task: Task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return
    setParams({ open: null, task: null })
    run(() => deleteTask(task.id), 'Deleted')
  }

  const selected = drawer && drawer !== 'new' ? (tasks.find((t) => t.id === drawer) ?? null) : null

  return (
    <div>
      {/* The artboard's order: the line you type a task on comes first, the
        * views under it. Adding is the thing this screen is for. */}
      <QuickAdd
        projects={projects.map((p) => p.name)}
        today={today}
        onSave={run}
        onNew={() => setParams({ task: 'new' }, { push: true })}
      />

      <TabBar
        label="Task views"
        className="mt-3.5"
        value={showCalendar ? 'calendar' : view}
        // One write to the query, not two: each setParams builds from the
        // current params, so a pair of them would drop the first.
        onChange={(next) =>
          setParams(
            next === 'calendar'
              ? { month: '1', open: null }
              : { month: null, open: null, view: next === 'today' ? null : next },
          )
        }
        tabs={TABS.map((t) => ({
          value: t.value,
          label: t.label,
          count: t.value === 'calendar' ? undefined : counts[t.value] || undefined,
          countTone: t.value === 'review' ? 'warn' : undefined,
        }))}
      />

      <div className="pt-4">
        {showCalendar ? (
          <Calendar
            tasks={tasks.filter((t) => t.status === 'open' || t.status === 'review')}
            today={today}
            onOpen={(t) => openDrawer(t.id)}
          />
        ) : (
          <div
            className={cn(
              'grid gap-3.5',
              columns.length === 1
                ? 'grid-cols-1'
                : 'grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]',
              pending && 'opacity-100',
            )}
          >
            {columns.map((column) => {
              const label =
                view === 'today' && column.id === 'today'
                  ? `Today · ${DOWS[today.getDay()]} ${MONTHS[today.getMonth()]} ${today.getDate()}`
                  : column.label
              return (
                <section
                  key={column.id}
                  aria-label={column.label}
                  onDragOver={(e) => {
                    if (dragging && column.drop) e.preventDefault()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = e.dataTransfer.getData('text/plain')
                    setDragging(null)
                    if (!id || !column.drop) return
                    run(() => writeTask({ id, ...dropPatch(column.drop!) }), `Moved to ${column.label}`)
                  }}
                  className={cn(
                    'min-w-0 border bg-bg-elev px-2.5 py-3 transition-colors duration-150',
                    // A dashed accent border says this column will take the card.
                    // A read-only column stays solid, so it says it will not.
                    dragging && column.drop ? 'border-dashed border-brand' : 'border-rule',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3 border-b border-rule-2 px-1 pb-2.5">
                    <span
                      className={cn(
                        'eyebrow',
                        column.tone === 'ink' && 'text-ink',
                        column.tone === 'ink-2' && 'text-ink-2',
                        column.tone === 'ink-3' && 'text-ink-3',
                        column.tone === 'warn' && 'text-warn',
                        column.tone === 'ok' && 'text-ok',
                      )}
                    >
                      {label}
                    </span>
                    <span className="num shrink-0 text-[11px] text-ink-3">{column.meta}</span>
                  </div>

                  <div className="flex min-h-[60px] flex-col gap-1.5 pt-2.5">
                    {column.tasks.length === 0 ? (
                      <p className="border border-dashed border-rule px-2 py-[18px] text-center text-[12px] text-ink-4">
                        {column.empty}
                      </p>
                    ) : (
                      column.tasks.map((task) => (
                        <Row
                          key={task.id}
                          task={task}
                          today={today}
                          expanded={expanded === task.id}
                          moves={columns
                            .filter((c) => c.drop && c.id !== column.id)
                            .map((c) => ({
                              label: c.label.length > 18 ? `${c.label.slice(0, 18)}…` : c.label,
                              go: () =>
                                run(
                                  () => writeTask({ id: task.id, ...dropPatch(c.drop!) }),
                                  `Moved to ${c.label}`,
                                ),
                            }))}
                          draggable={column.drop !== null}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', task.id)
                            setDragging(task.id)
                          }}
                          onDragEnd={() => setDragging(null)}
                          onExpand={() => setExpanded(expanded === task.id ? null : task.id)}
                          onEdit={() => openDrawer(task.id)}
                          onDelete={() => remove(task)}
                          onComplete={() => {
                            // An agent's task is approved before it is done; the
                            // box opens the row so Approve is in reach.
                            if (task.status === 'review') return setExpanded(task.id)
                            const done = task.status !== 'done'
                            run(
                              () => {
                                flip({ id: task.id, done })
                                return completeTask(task.id, done)
                              },
                              done ? `Done. ${task.title}` : 'Reopened',
                            )
                          }}
                          onApprove={() => run(() => approveTask(task.id), 'Approved')}
                        />
                      ))
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {columns.every((c) => c.tasks.length === 0) && !showCalendar && (
          <EmptyState
            className="mt-5"
            headline={view === 'review' ? 'Nothing to approve' : 'Nothing here'}
          >
            {view === 'review'
              ? 'An agent-created task lands here first and does not count as work until you accept it.'
              : 'Type a task on the line above. Tokens like !p1, #project, @thursday and 30m are read as you type.'}
          </EmptyState>
        )}
      </div>

      {drawer !== null && (
        <TaskDrawer
          task={selected}
          projects={projects}
          goals={goals}
          today={today}
          reminderChannels={reminderChannels}
          onClose={() => setParams({ task: null })}
          onSave={run}
          onDelete={selected ? () => remove(selected) : undefined}
        />
      )}
    </div>
  )
}

/** The outlined 9px marks: OVERDUE in red, AGENT · REVIEW in amber. */
function Mark({ tone, children }: { tone: 'bad' | 'warn'; children: string }) {
  return (
    <span
      className={cn(
        'num border px-[5px] py-px text-[9px] tracking-[0.08em]',
        tone === 'bad' ? 'border-bad text-bad' : 'border-warn text-warn',
      )}
    >
      {children}
    </span>
  )
}

/** One task in a column: the row, and the band under it when it is expanded. */
function Row({
  task,
  today,
  expanded,
  moves,
  draggable,
  onDragStart,
  onDragEnd,
  onExpand,
  onEdit,
  onDelete,
  onComplete,
  onApprove,
}: {
  task: Task
  today: Date
  expanded: boolean
  moves: { label: string; go: () => void }[]
  draggable: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onExpand: () => void
  onEdit: () => void
  onDelete: () => void
  onComplete: () => void
  onApprove: () => void
}) {
  const done = task.status === 'done'
  const agent = task.status === 'review'
  const overdue = !done && task.dueInDays !== null && task.dueInDays < 0
  const remind = remindLabel(task.remindMinutes, task.dueAt)
  const by = task.skills[0]?.by ?? 'rule'

  // Swipe right to complete, swipe left to reopen: the gesture every task app
  // has, and the reason the checkbox does not have to be hit exactly with a
  // thumb. Touch only, so a mouse drag over the text still selects it.
  // The card follows the finger up to 80px in the direction that means
  // something, with the word it is about to earn showing behind it.
  const [dx, setDx] = useState(0)
  const swipe = useSwipe({
    onRight: () => !done && onComplete(),
    onLeft: () => done && onComplete(),
    onMove: (d) => setDx(done ? Math.max(-80, Math.min(0, d)) : Math.max(0, Math.min(80, d))),
  })

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className={cn(
          'label absolute inset-y-0 flex w-20 items-center justify-center text-[10px] tracking-[0.12em] text-brand',
          done ? 'right-0' : 'left-0',
        )}
      >
        {done ? 'Reopen' : 'Done'}
      </span>
      <article
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        {...swipe}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        className={cn(
          'relative border bg-bg p-2.5 transition-colors duration-150 [touch-action:pan-y]',
          !dx && 'transition-transform',
          expanded ? 'border-rule-2' : 'border-rule',
          draggable && 'cursor-grab active:cursor-grabbing',
        )}
      >
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={onComplete}
            title={agent ? 'Approve first' : done ? 'Reopen' : 'Complete'}
            aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
            className={cn(
              'mt-px flex size-4 shrink-0 items-center justify-center border transition-colors duration-150',
              done
                ? 'border-brand bg-brand'
                : agent
                  ? 'border-dashed border-warn'
                  : 'border-ink-3 hover:border-brand',
            )}
          >
            {done && <span className="block size-1.5 bg-bg" />}
          </button>

          <button
            type="button"
            onClick={onExpand}
            onDoubleClick={onEdit}
            title="Click: details · Double-click: edit"
            aria-expanded={expanded}
            className="min-w-0 flex-1 text-left"
          >
            <span
              className={cn(
                'block text-[13px] leading-[1.35]',
                done ? 'text-ink-3 line-through' : 'text-ink',
              )}
            >
              {task.title}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {overdue && <Mark tone="bad">OVERDUE</Mark>}
              {agent && <Mark tone="warn">AGENT · REVIEW</Mark>}
              <span className={cn('num text-[10px]', priorityColor(task.priority))}>
                {task.priority}
              </span>
              <span className="num text-[10px] text-ink-3">
                {dueLabel(task.dueInDays, today)}
                {task.dueAt ? ` · ${task.dueAt}` : ''}
              </span>
              {remind && (
                <span
                  title="Reminder"
                  className="num inline-flex items-center gap-[3px] whitespace-nowrap border border-rule-2 px-[5px] py-px text-[9px] tracking-[0.06em] text-ink-4"
                >
                  ⏰ {remind}
                </span>
              )}
              {task.projectName && (
                <span className="text-[10px] text-ink-3">#{task.projectName}</span>
              )}
              {task.estimateMinutes !== null && task.estimateMinutes > 0 && (
                <span className="num text-[10px] text-ink-4">{task.estimateMinutes}m</span>
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={onEdit}
            title="Edit task"
            aria-label={`Edit ${task.title}`}
            className="num shrink-0 border border-rule px-1.5 py-0.5 text-[9px] tracking-[0.08em] text-ink-3 transition-colors duration-150 hover:border-ink hover:text-ink"
          >
            EDIT
          </button>
        </div>

        {expanded && (
          <div className="mt-2.5 flex flex-col gap-2 border-t border-rule pt-2.5 duration-150 animate-in fade-in">
            {task.notes && <p className="text-[12px] leading-[1.5] text-ink-2">{task.notes}</p>}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
              <span>
                Goal: <span className="text-ink-2">{task.goalTitle ?? 'none'}</span>
              </span>
              <span>
                Skills:{' '}
                <span className="text-ink-2">
                  {task.skills.length === 0
                    ? 'none'
                    : task.skills
                        .map((s) =>
                          s.by === 'manual' ? s.name : `${s.name} ${Math.round(s.confidence * 100)}%`,
                        )
                        .join(', ')}
                </span>{' '}
                {task.skills.length > 0 && (
                  <span
                    className={cn(
                      'num',
                      by === 'manual' ? 'text-warn' : by === 'model' ? 'text-ink-4' : 'text-ok',
                    )}
                  >
                    {by.toUpperCase()}
                  </span>
                )}
              </span>
              <span>
                Source: <span className="text-ink-2">{task.source}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={onEdit} className={miniAccent}>
                Edit
              </button>
              {agent && (
                <button type="button" onClick={onApprove} className={miniAccent}>
                  Approve
                </button>
              )}
              {moves.map((m) => (
                <button key={m.label} type="button" onClick={m.go} className={mini}>
                  → {m.label}
                </button>
              ))}
              <button
                type="button"
                onClick={onDelete}
                className={cn(mini, 'ml-auto hover:border-bad hover:text-bad')}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </article>
    </div>
  )
}

/**
 * The line you type a task on, and the button beside it.
 *
 * The artboard's shape: one 44px field with a + in front of it, what the
 * parser understood shown as chips inside the field rather than under it, and
 * the token hint sitting where the chips will be until you type. Nothing is
 * saved until Add, so a misread token is caught by the reader first.
 */
function QuickAdd({
  projects,
  today,
  onSave,
  onNew,
}: {
  projects: string[]
  today: Date
  onSave: (action: () => Promise<ActionResult>, ok?: string) => void
  onNew: () => void
}) {
  const [text, setText] = useState('')
  const parsed = useMemo(
    () => parseQuickAdd(text, { projects, now: today }),
    [text, projects, today],
  )

  const save = () => {
    if (!parsed.title) return
    const dueOn =
      parsed.dueInDays === null
        ? null
        : (() => {
            const d = new Date(today)
            d.setDate(d.getDate() + parsed.dueInDays)
            return d.toISOString().slice(0, 10)
          })()

    onSave(
      () =>
        writeTask({
          title: parsed.title,
          priority: parsed.priority,
          due_on: dueOn,
          project: parsed.project,
          estimated_minutes: parsed.estimateMinutes,
        }),
      `Added. ${parsed.title}`,
    )
    setText('')
  }

  const chipColor = (field: string, value: string) =>
    field === 'Priority'
      ? priorityColor(value as Task['priority'])
      : field === 'Estimate'
        ? 'text-ink-4'
        : 'text-ink-3'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2.5">
        <ActionButton
          variant="solid"
          className="h-11 gap-2 px-4 text-[13px]"
          onClick={onNew}
        >
          New task <span aria-hidden="true">&rarr;</span>
        </ActionButton>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          className={cn(
            'flex h-11 min-w-0 flex-1 basis-[280px] items-center border bg-bg-elev transition-colors duration-150',
            text ? 'border-brand' : 'border-rule-2',
          )}
        >
          <span className="num pl-4 pr-3 text-[13px] text-ink-4" aria-hidden>
            +
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Add a task"
            placeholder="Add a task… e.g. Renew renters policy !p1 #Home @fri 30m"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4"
          />

          {text.trim() === '' ? (
            <span className="num hidden whitespace-nowrap px-4 text-[10px] tracking-[0.08em] text-ink-4 sm:inline">
              !P1 · #PROJECT · @DAY · 30M
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1.5 px-3">
              {parsed.parsed.map((p) => (
                <span
                  key={p.field}
                  className={cn(
                    'border border-current px-[7px] py-0.5 text-[10px]',
                    chipColor(p.field, p.value),
                  )}
                >
                  {p.value}
                </span>
              ))}
              <button
                type="submit"
                disabled={!parsed.title}
                className="num shrink-0 bg-ink px-2.5 py-1.5 text-[10px] tracking-[0.08em] text-bg disabled:bg-rule-2 disabled:text-ink-4"
              >
                ADD ↵
              </button>
            </span>
          )}
        </form>
      </div>

      {text.trim() !== '' && !parsed.title && (
        <p className="t-caption text-ink-3">Needs a title. Tokens alone are not a task.</p>
      )}
    </div>
  )
}
