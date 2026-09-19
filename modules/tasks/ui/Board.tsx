'use client'

import { AlarmClock, Check, Filter, Plus } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useMemo, useOptimistic, useState, useTransition } from 'react'
import { ActionButton, EmptyState, PillGroup, RowList, StatusChip, useToast } from '@/components/pos'
import { actionButtonBase, actionButtonSizes, actionButtonVariants } from '@/components/pos/Button'
import { cn } from '@/lib/utils'
import { parseQuickAdd } from '../quickadd'
import {
  bucket,
  columnsFor,
  dueLabel,
  hoursLabel,
  remindLabel,
  VIEWS,
  type Task,
  type View,
} from '../shape'
import { Segments } from '@/components/pos/Segments'
import { useSwipe } from '@/components/pos/gestures'
import { useIsPhone } from '@/components/pos/useIsPhone'
import { useSearchState } from '@/components/pos/searchState'
import {
  approveTask,
  completeTask,
  deleteTask,
  writeTask,
  type ActionResult,
  type WriteInput,
} from './actions'

// Both mount only when asked for (month=1, an open drawer), so their
// code loads then rather than with the board. `loading` gives each its own
// Suspense boundary; without one the first load suspends up to the route's
// loading.tsx and swaps the whole page for the skeleton while the chunk lands.
const Calendar = dynamic(() => import('./Calendar').then((m) => m.Calendar), { loading: () => null })
const TaskDrawer = dynamic(() => import('./TaskDrawer').then((m) => m.TaskDrawer), { loading: () => null })
const ProjectsDrawer = dynamic(() => import('./ProjectsDrawer').then((m) => m.ProjectsDrawer), {
  loading: () => null,
})

// The whole board: the quick add line, the view tabs, the columns, and the
// drawer. One client component because the drag source, the drop target, the
// expanded row and the drawer all read the same selection, and splitting them
// would mean syncing it.

const LONG_DOWS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The small buttons, as ActionButton draws them: a glass pill, and the soft action fill. */
export const mini = cn(actionButtonBase, actionButtonSizes.sm, actionButtonVariants.outline)
export const miniAccent = cn(actionButtonBase, actionButtonSizes.sm, actionButtonVariants.brand)

/** P1 in the risk colour, P2 in attention, P3 quiet, as the mockup marks them. */
export const priorityColor = (p: Task['priority']) =>
  p === 'P1' ? 'text-bad' : p === 'P2' ? 'text-warn' : 'text-ink-4'

const TABS: { value: View | 'calendar'; label: string }[] = [
  ...VIEWS.slice(0, 4),
  { value: 'calendar', label: 'Calendar' },
  ...VIEWS.slice(4),
]

// The phone segment row: Today, This week, Calendar. The other four views
// move into the PillGroup filter behind the row's own filter toggle.
const PHONE_TABS: { value: View | 'calendar'; label: string }[] = [
  VIEWS[0],
  VIEWS[1],
  { value: 'calendar', label: 'Calendar' },
]
const FILTER_VIEWS = [VIEWS[2], VIEWS[3], VIEWS[4], VIEWS[5]]

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
  skills,
  reminderChannels,
  todayIso,
}: {
  tasks: Task[]
  projects: { id: string; name: string; goalRef: string | null }[]
  goals: { id: string; title: string }[]
  skills: [string, string][]
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
  const isPhone = useIsPhone()
  const [showFilter, setShowFilter] = useState(false)
  const filtered = FILTER_VIEWS.some((v) => v.value === view)

  // A completed task reads as done the moment the box is ticked or the row is
  // swiped, and the server's answer replaces the guess when it lands.
  const [tasks, flip] = useOptimistic(serverTasks, (state, patch: { id: string; done: boolean }) =>
    state.map((t) => (t.id === patch.id ? { ...t, status: patch.done ? 'done' : 'open' } : t)),
  )

  // The expanded row rides in the URL with the view and the drawer, for the
  // same reason: a screenshot of an open row has to survive a reload.
  const expanded = params.get('open')
  const setExpanded = (id: string | null) => setParams({ open: id }, { local: true })
  const [dragging, setDragging] = useState<string | null>(null)
  // What a column's plus hands the new-task drawer. State, not the URL: a
  // reload of ?task=new opens the plain form, as it always has.
  const [columnPrefill, setColumnPrefill] = useState<Partial<WriteInput> | null>(null)
  const [showProjects, setShowProjects] = useState(false)
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
  const openNew = (prefill: Partial<WriteInput> | null = null) => {
    setColumnPrefill(prefill)
    setParams({ task: 'new' }, { push: true })
  }
  // The band's New task and the phone plus take the current view's first
  // column: By goal starts on its first goal, This week on today.
  const first = columns.find((c) => c.drop)
  const prefill = columnPrefill ?? (first ? dropPatch(first.drop!) : {})
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
      <QuickAdd projects={projects.map((p) => p.name)} today={today} onSave={run} />

      <Segments
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
            { local: true },
          )
        }
        tabs={(isPhone ? PHONE_TABS : TABS).map((t) => ({
          value: t.value,
          label: t.label,
          count: t.value === 'calendar' ? undefined : counts[t.value] || undefined,
          countTone: t.value === 'review' ? 'warn' : undefined,
        }))}
        end={
          <button
            type="button"
            onClick={() => setShowFilter((s) => !s)}
            aria-label="Filter task views"
            aria-pressed={showFilter}
            // Lit while open, and while a filtered view is showing, since no
            // segment is selected then and the crumb is the only other cue.
            className={cn(mini, 'mb-2 md:hidden', (showFilter || filtered) && 'border-action text-ink')}
          >
            <Filter size={13} aria-hidden />
          </button>
        }
      >
        {showFilter && (
          <PillGroup
            label="Task view filter"
            className="pt-3.5 md:hidden"
            value={view}
            onChange={(next) => {
              setParams({ month: null, open: null, view: next === 'today' ? null : next }, { local: true })
              setShowFilter(false)
            }}
            options={FILTER_VIEWS.map((v) => ({
              value: v.value,
              label: v.label,
              count: counts[v.value] || undefined,
            }))}
          />
        )}

      <div className="pt-4">
        {view === 'project' && !showCalendar && (
          <div className="flex justify-end pb-3">
            <button type="button" onClick={() => setShowProjects(true)} className={mini}>
              Projects
            </button>
          </div>
        )}
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
              // "Today, Friday 18" on the Today view, as the mockup writes it;
              // every other column keeps the label the shape gives it.
              const label =
                view === 'today' && column.id === 'today' ? (
                  <>
                    Today<span className="font-normal text-ink-3">, {LONG_DOWS[today.getDay()]} {today.getDate()}</span>
                  </>
                ) : (
                  column.label
                )
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
                  className="min-w-0"
                >
                  {/* The heading over the column, then one grouped surface
                    * holding its rows: whitespace between groups, hairlines
                    * between records. */}
                  <div className="flex items-baseline justify-between gap-3 px-1 pb-2.5">
                    <h2
                      className={cn(
                        'text-[15px] font-semibold leading-tight text-ink',
                        column.tone === 'ink-2' && 'text-ink-2',
                        column.tone === 'ink-3' && 'text-ink-3',
                        column.tone === 'warn' && 'text-warn',
                        column.tone === 'ok' && 'text-ok',
                      )}
                    >
                      {label}
                    </h2>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="num text-[13px] text-ink-3">{column.meta}</span>
                      {column.drop && (
                        <button
                          type="button"
                          aria-label={`New task in ${column.label}`}
                          onClick={() => openNew(dropPatch(column.drop!))}
                          // 24px target around a 13px glyph, per WCAG 2.5.8.
                          className="-my-1.5 flex h-6 w-6 items-center justify-center text-ink-3 transition-colors duration-150 hover:text-ink"
                        >
                          <Plus size={13} aria-hidden />
                        </button>
                      )}
                    </span>
                  </div>

                  <RowList
                    className={cn(
                      'min-h-[60px] transition-colors duration-150',
                      // A dashed accent edge says this column will take the card.
                      // A read-only column stays as it is, so it says it will not.
                      dragging && column.drop && 'border-dashed border-action',
                    )}
                  >
                    {column.tasks.length === 0 ? (
                      <p className="px-4 py-[18px] text-center text-[13px] text-ink-4">{column.empty}</p>
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
                          inToday={column.id === 'today'}
                          isPhone={isPhone}
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
                  </RowList>
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
      </Segments>

      {drawer !== null && (
        <TaskDrawer
          task={selected}
          projects={projects}
          goals={goals}
          skills={skills}
          today={today}
          reminderChannels={reminderChannels}
          onClose={() => {
            // Cleared with the drawer, or the next plain New task would
            // carry the last column's goal or project.
            setColumnPrefill(null)
            setParams({ task: null })
          }}
          onSave={run}
          onDelete={selected ? () => remove(selected) : undefined}
          prefill={selected ? undefined : prefill}
        />
      )}

      {showProjects && (
        <ProjectsDrawer
          projects={projects}
          goals={goals}
          onClose={() => setShowProjects(false)}
          onSave={run}
        />
      )}
    </div>
  )
}

/**
 * The title block's "New task" and the phone header's plus: the same drawer
 * opener, so `?task=new` is the one way a blank form opens.
 */
export function NewTaskButton({ phone = false }: { phone?: boolean }) {
  const { set: setParams } = useSearchState()
  const open = () => setParams({ task: 'new' }, { push: true })
  if (phone) {
    return (
      <ActionButton variant="solid" aria-label="New task" className="h-11 w-11 gap-0 rounded-full p-0" onClick={open}>
        <Plus size={18} aria-hidden />
      </ActionButton>
    )
  }
  return (
    <ActionButton variant="accent" size="lg" onClick={open}>
      New task
    </ActionButton>
  )
}

/** One task in a column: the row, and the band under it when it is expanded. */
function Row({
  task,
  today,
  expanded,
  moves,
  draggable,
  inToday,
  isPhone,
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
  /** In the Today column, where a due date of today says nothing the heading does not. */
  inToday: boolean
  /** No inline expand and no EDIT button at this width: tapping the row opens the drawer. */
  isPhone: boolean
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
    <div
      className={cn(
        // The inset hairline between rows, drawn by every row but the first;
        // the selected row's soft fill takes its own and the next one's.
        'relative overflow-hidden before:absolute before:inset-x-4 before:top-0 before:z-10 before:h-px before:bg-rule first:before:hidden',
        expanded && 'bg-brand-soft before:hidden [&+*]:before:hidden',
      )}
    >
      {/* The word the swipe is about to earn, behind the row while it moves. */}
      {dx !== 0 && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-y-0 flex w-20 items-center justify-center text-[12px] font-medium text-action',
            done ? 'right-0' : 'left-0',
          )}
        >
          {done ? 'Reopen' : 'Done'}
        </span>
      )}
      <article
        data-swipes
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        {...swipe}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        className={cn(
          'relative px-4 py-2.5 transition-colors duration-150 [touch-action:pan-y]',
          !dx && 'transition-transform',
          dx && 'bg-bg-elev',
          draggable && 'cursor-grab active:cursor-grabbing',
        )}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onComplete}
            title={agent ? 'Approve first' : done ? 'Reopen' : 'Complete'}
            aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
            className={cn(
              'mt-px grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150',
              done
                ? 'border-action bg-action text-action-fg'
                : agent
                  ? 'border-dashed border-warn'
                  : 'border-rule-2 hover:border-action',
            )}
          >
            {done && <Check size={12} strokeWidth={3} aria-hidden />}
          </button>

          <button
            type="button"
            onClick={isPhone ? onEdit : onExpand}
            onDoubleClick={isPhone ? undefined : onEdit}
            title={isPhone ? 'Edit' : 'Click: details · Double-click: edit'}
            aria-expanded={expanded}
            className="min-w-0 flex-1 text-left"
          >
            <span
              className={cn(
                'block text-[14.5px] font-medium leading-[1.35]',
                done ? 'text-ink-3 line-through' : 'text-ink',
              )}
            >
              {task.title}
            </span>
            {/* One grey line: the priority when it matters, the project, when
              * it is due, and the reminder. The estimate sits on the right. */}
            <span className="t-caption mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-ink-3 [&>*+*]:before:mr-1.5 [&>*+*]:before:content-['·']">
              {agent && <StatusChip tone="warn">Agent, review</StatusChip>}
              {task.priority !== 'P3' && (
                <span className={cn('num font-medium', priorityColor(task.priority))}>{task.priority}</span>
              )}
              <span>{task.projectName ?? 'No project'}</span>
              {/* Overdue is the due label itself in the risk colour, not a second
                * mark. In the Today column a task due today with no time says
                * nothing here: the heading already says today. */}
              {(!inToday || task.dueInDays !== 0 || task.dueAt) && (
                <span className={cn('num', overdue && 'font-medium text-bad')}>
                  {inToday && task.dueInDays === 0 ? task.dueAt : dueLabel(task.dueInDays, today)}
                  {!(inToday && task.dueInDays === 0) && task.dueAt ? ` · ${task.dueAt}` : ''}
                </span>
              )}
              {remind && (
                <span title="Reminder" className="num inline-flex items-center gap-1 text-ink-3">
                  <AlarmClock size={12} aria-hidden />
                  {remind.toLowerCase()}
                </span>
              )}
            </span>
          </button>

          {task.estimateMinutes !== null && task.estimateMinutes > 0 && (
            <span className="num shrink-0 pt-0.5 text-[12.5px] text-ink-3">{hoursLabel(task.estimateMinutes)}</span>
          )}
          <button
            type="button"
            onClick={onEdit}
            title="Edit task"
            aria-label={`Edit ${task.title}`}
            className="hidden shrink-0 pt-0.5 text-[12.5px] font-medium text-ink-4 transition-colors duration-150 hover:text-action md:inline-flex"
          >
            Edit
          </button>
        </div>

        {expanded && (
          <div className="mt-3 flex flex-col gap-2.5 pl-8 duration-150 animate-in fade-in">
            {task.notes && <p className="text-[13px] leading-[1.5] text-ink-2">{task.notes}</p>}
            <div className="t-caption flex flex-wrap gap-x-3 gap-y-1 text-ink-3">
              <span>
                Goal: <span className="text-ink-2">{task.goalTitle ?? 'none'}</span>
                {task.goalRef && !task.ownGoalRef && ' · via project'}
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
                      by === 'manual' ? 'text-warn' : by === 'model' ? 'text-ink-4' : 'text-ok',
                    )}
                  >
                    {by === 'manual' ? 'by hand' : by === 'model' ? 'by model' : 'by rules'}
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
                className={cn(mini, 'ml-auto hover:text-bad')}
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
 * The line you type a task on.
 *
 * One 44px field with a + in front of it, what the
 * parser understood shown as chips inside the field rather than under it, and
 * the token hint sitting where the chips will be until you type. Nothing is
 * saved until Add, so a misread token is caught by the reader first.
 */
function QuickAdd({
  projects,
  today,
  onSave,
}: {
  projects: string[]
  today: Date
  onSave: (action: () => Promise<ActionResult>, ok?: string) => void
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
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          className={cn(
            'flex h-11 min-w-0 flex-1 basis-[280px] items-center rounded-full border bg-field transition-colors duration-150',
            text ? 'border-action bg-bg-elev shadow-[0_0_0_3px_var(--accent-soft)]' : 'border-glass-line',
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
            <span className="num hidden whitespace-nowrap px-4 text-[12px] text-ink-4 sm:inline">
              !p1 · #project · @day · 30m
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1.5 px-3">
              {parsed.parsed.map((p) => (
                <span
                  key={p.field}
                  className={cn(
                    'rounded-full bg-glass-strong px-2 py-0.5 text-[11.5px] font-medium shadow-[inset_0_0_0_1px_var(--glass-line)]',
                    chipColor(p.field, p.value),
                  )}
                >
                  {p.value}
                </span>
              ))}
              <button
                type="submit"
                disabled={!parsed.title}
                className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[12px] font-medium text-bg disabled:bg-rule-2 disabled:text-ink-4"
              >
                Add ↵
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
