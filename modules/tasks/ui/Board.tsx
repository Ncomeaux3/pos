'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  ActionButton,
  Chip,
  EmptyState,
  Eyebrow,
  Overlay,
  PillGroup,
  StatusChip,
  TabBar,
  fieldClass,
  useToast,
} from '@/components/pos'
import { cn } from '@/lib/utils'
import { parseQuickAdd } from '../quickadd'
import { columnsFor, dueLabel, estimateLabel, VIEWS, bucket, type Task, type View } from '../shape'
import { useSwipe } from '@/components/pos/gestures'
import { approveTask, completeTask, writeTask, type ActionResult } from './actions'
import { Calendar } from './Calendar'

// The whole board: view tabs, the quick add line, the columns, and the drawer.
// One client component because the drag source, the drop target and the drawer
// all read the same selection, and splitting them would mean syncing it.

export function Board({
  tasks,
  projects,
  goals,
  todayIso,
}: {
  tasks: Task[]
  projects: { id: string; name: string }[]
  goals: { id: string; title: string }[]
  todayIso: string
}) {
  // The view lives in the URL, not in state. It survives a refresh, it can be
  // linked to, and it is what lets a screenshot of "By project" actually be one:
  // the theme switch reloads the page, and client state does not come back.
  const router = useRouter()
  const params = useSearchParams()
  const view = (VIEWS.find((v) => v.value === params.get('view'))?.value ?? 'today') as View
  const showCalendar = params.get('month') === '1'

  const setParams = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
    const query = search.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }

  const setView = (next: View) => setParams({ view: next === 'today' ? null : next })
  const setShowCalendar = (on: boolean) => setParams({ month: on ? '1' : null })

  const [selected, setSelected] = useState<Task | null>(null)
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

  const counts: Partial<Record<View, number>> = {
    today: tasks.filter((t) => t.status === 'open' && (t.dueInDays ?? 99) <= 0).length,
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

  return (
    <div className="space-y-5">
      <TabBar
        label="Task views"
        value={view}
        onChange={(next) => setView(next as View)}
        tabs={VIEWS.map((v) => ({ value: v.value, label: v.label, count: counts[v.value] }))}
      />

      <QuickAdd projects={projects.map((p) => p.name)} today={today} onSave={run} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Eyebrow>{showCalendar ? 'Month' : VIEWS.find((v) => v.value === view)?.label}</Eyebrow>
        <ActionButton
          variant={showCalendar ? 'brand' : 'outline'}
          onClick={() => setShowCalendar(!showCalendar)}
        >
          {showCalendar ? 'Back to the board' : 'Month view'}
        </ActionButton>
      </div>

      {showCalendar ? (
        <Calendar
          tasks={tasks.filter((t) => t.status === 'open')}
          today={today}
          onOpen={setSelected}
        />
      ) : (
        <div
          className={cn(
            'grid gap-3',
            columns.length === 1
              ? 'grid-cols-1'
              : 'grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]',
            pending && 'opacity-100',
          )}
        >
          {columns.map((column) => (
            <section
              key={column.id}
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
                'min-w-0 rounded-lg border bg-bg-elev p-2.5',
                // A dashed accent border says this column will take the card.
                // A read-only column stays solid, so it says it will not.
                dragging && column.drop ? 'border-dashed border-brand' : 'border-rule',
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1 pb-2.5">
                <span
                  className={cn(
                    'label text-[10px] tracking-[0.12em]',
                    column.tone === 'ink' && 'text-ink',
                    column.tone === 'ink-2' && 'text-ink-2',
                    column.tone === 'ink-3' && 'text-ink-3',
                    column.tone === 'warn' && 'text-warn',
                    column.tone === 'ok' && 'text-ok',
                  )}
                >
                  {column.label}
                </span>
                <span className="label text-[10px] text-ink-3">{column.meta}</span>
              </div>

              {column.tasks.length === 0 ? (
                <p className="t-caption px-1 py-6 text-center text-ink-3">{column.empty}</p>
              ) : (
                <div className="space-y-2">
                  {column.tasks.map((task) => (
                    <Card
                      key={task.id}
                      task={task}
                      today={today}
                      draggable={column.drop !== null}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', task.id)
                        setDragging(task.id)
                      }}
                      onDragEnd={() => setDragging(null)}
                      onOpen={() => setSelected(task)}
                      onComplete={() =>
                        run(
                          () => completeTask(task.id, task.status !== 'done'),
                          task.status === 'done' ? 'Reopened' : `Done. ${task.title}`,
                        )
                      }
                      onApprove={() => run(() => approveTask(task.id), 'Approved')}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {columns.every((c) => c.tasks.length === 0) && !showCalendar && (
        <EmptyState headline={view === 'review' ? 'Nothing to approve' : 'Nothing here'}>
          {view === 'review'
            ? 'An agent-created task lands here first and does not count as work until you accept it.'
            : 'Type a task on the line above. Tokens like !p1, #project, @thursday and 30m are read as you type.'}
        </EmptyState>
      )}

      <Detail
        task={selected}
        projects={projects}
        goals={goals}
        today={today}
        onClose={() => setSelected(null)}
        onSave={run}
      />
    </div>
  )
}

/** One task. The card on the board and the row in the drawer's list. */
function Card({
  task,
  today,
  draggable,
  onDragStart,
  onDragEnd,
  onOpen,
  onComplete,
  onApprove,
}: {
  task: Task
  today: Date
  draggable: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onOpen: () => void
  onComplete: () => void
  onApprove: () => void
}) {
  const state = bucket(task.dueInDays)
  const done = task.status === 'done'

  // Swipe right to complete, swipe left to reopen: the gesture every task app
  // has, and the reason the checkbox does not have to be hit exactly with a
  // thumb. Touch only, so a mouse drag over the text still selects it.
  const swipe = useSwipe({
    onRight: () => !done && onComplete(),
    onLeft: () => done && onComplete(),
  })

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      {...swipe}
      className={cn(
        'space-y-2 rounded-md border bg-bg p-2.5 transition-colors duration-150',
        task.priority === 'P1' && !done ? 'border-bad/50' : 'border-rule-2',
        task.status === 'review' && 'border-warn/60',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={onComplete}
          aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          className={cn(
            'mt-0.5 size-4 shrink-0 rounded-[3px] border transition-colors duration-150',
            done ? 'border-ok bg-ok/25' : 'border-rule-2 hover:border-brand',
          )}
        />
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            't-caption min-w-0 flex-1 text-left',
            done ? 'text-ink-3 line-through' : 'text-ink',
          )}
        >
          {task.title}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-6.5">
        {task.dueInDays !== null && (
          <span
            className={cn(
              'label text-[10px] tracking-[0.08em]',
              state === 'overdue' ? 'text-bad' : state === 'today' ? 'text-teal' : 'text-ink-3',
            )}
          >
            {dueLabel(task.dueInDays, today)}
            {task.dueAt ? ` ${task.dueAt}` : ''}
          </span>
        )}
        {task.priority === 'P1' && !done && <Chip tone="bad">P1</Chip>}
        {task.projectName && <Chip tone="quiet">{task.projectName}</Chip>}
        {task.estimateMinutes !== null && (
          <span className="label text-[10px] text-ink-3">
            {estimateLabel(task.estimateMinutes)}
          </span>
        )}
        {task.status === 'review' && (
          <ActionButton className="h-6 px-2 sm:h-6" onClick={onApprove}>
            Approve
          </ActionButton>
        )}
      </div>
    </article>
  )
}

/** The one line that takes a whole task, and says what it understood first. */
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
          aria-label="Add a task"
          placeholder="Pay the Amex !p1 #Finance @tomorrow 5m"
          className={cn(fieldClass, 'min-w-0 flex-1 basis-[280px]')}
        />
        <ActionButton variant="brand" disabled={!parsed.title} onClick={save}>
          Add
        </ActionButton>
      </div>

      {/* Shown before anything is saved, so a misread token is caught by the
          reader rather than discovered later in the wrong column. */}
      {text.trim() !== '' && (
        <div className="flex flex-wrap items-center gap-1.5">
          {parsed.title ? (
            <span className="t-caption text-ink-2">{parsed.title}</span>
          ) : (
            <span className="t-caption text-ink-3">Needs a title</span>
          )}
          {parsed.parsed.map((p) => (
            <Chip key={p.field} tone="brand">
              {p.field} {p.value}
            </Chip>
          ))}
          {parsed.parsed.length === 0 && parsed.title && (
            <span className="t-caption text-ink-3">
              No tokens read. Try !p1, #project, @thursday, 30m.
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** The right drawer: everything about one task, editable in place. */
function Detail({
  task,
  projects,
  goals,
  today,
  onClose,
  onSave,
}: {
  task: Task | null
  projects: { id: string; name: string }[]
  goals: { id: string; title: string }[]
  today: Date
  onClose: () => void
  onSave: (action: () => Promise<ActionResult>, ok?: string) => void
}) {
  if (!task) return null

  const dueIso =
    task.dueInDays === null
      ? ''
      : (() => {
          const d = new Date(today)
          d.setDate(d.getDate() + task.dueInDays)
          return d.toISOString().slice(0, 10)
        })()

  const save = (patch: Record<string, unknown>, note?: string) =>
    onSave(() => writeTask({ id: task.id, ...patch }), note)

  return (
    <Overlay
      open
      onClose={onClose}
      eyebrow={`${task.projectName ?? 'No project'} / ${task.source}`}
      title={task.title}
      footer={
        <>
          <ActionButton
            variant={task.status === 'done' ? 'outline' : 'brand'}
            onClick={() => {
              onSave(
                () => completeTask(task.id, task.status !== 'done'),
                task.status === 'done' ? 'Reopened' : 'Done',
              )
              onClose()
            }}
          >
            {task.status === 'done' ? 'Reopen' : 'Mark done'}
          </ActionButton>
          <span className="label text-[10px] text-ink-3">
            {task.goalTitle ? `Toward ${task.goalTitle}` : 'No goal linked'}
          </span>
        </>
      }
    >
      <div className="space-y-5">
        <label className="block space-y-1.5">
          <Eyebrow>Title</Eyebrow>
          <input
            defaultValue={task.title}
            onBlur={(e) => e.target.value !== task.title && save({ title: e.target.value })}
            className={cn(fieldClass, 'w-full')}
          />
        </label>

        <label className="block space-y-1.5">
          <Eyebrow>Notes</Eyebrow>
          <textarea
            defaultValue={task.notes}
            rows={4}
            onBlur={(e) => e.target.value !== task.notes && save({ notes: e.target.value })}
            className={cn(fieldClass, 'w-full resize-y')}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <Eyebrow>Due</Eyebrow>
            <input
              type="date"
              defaultValue={dueIso}
              onBlur={(e) => save({ due_on: e.target.value || null })}
              className={cn(fieldClass, 'w-full')}
            />
          </label>
          <label className="block space-y-1.5">
            <Eyebrow>Time</Eyebrow>
            <input
              type="time"
              defaultValue={task.dueAt ?? ''}
              onBlur={(e) => save({ due_at: e.target.value || null })}
              className={cn(fieldClass, 'w-full')}
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <Eyebrow>Priority</Eyebrow>
          <PillGroup
            label="Priority"
            value={task.priority}
            options={[
              { value: 'P1', label: 'P1' },
              { value: 'P2', label: 'P2' },
              { value: 'P3', label: 'P3' },
            ]}
            onChange={(priority) => save({ priority })}
          />
        </div>

        <div className="space-y-1.5">
          <Eyebrow>Project</Eyebrow>
          <PillGroup
            label="Project"
            value={task.projectName ?? '__none'}
            options={[
              { value: '__none', label: 'None' },
              ...projects.map((p) => ({ value: p.name, label: p.name })),
            ]}
            onChange={(name) => save({ project: name === '__none' ? null : name })}
          />
        </div>

        <div className="space-y-1.5">
          <Eyebrow>Goal</Eyebrow>
          {goals.length === 0 ? (
            <p className="t-caption text-ink-3">
              No goals yet. A task links to a goal through the core registry, so this fills in on
              its own once the Goals module ships.
            </p>
          ) : (
            <PillGroup
              label="Goal"
              value={task.goalRef ?? '__none'}
              options={[
                { value: '__none', label: 'None' },
                ...goals.map((g) => ({ value: g.id, label: g.title })),
              ]}
              onChange={(id) => save({ goal_ref: id === '__none' ? null : id })}
            />
          )}
        </div>

        <label className="block space-y-1.5">
          <Eyebrow>Estimate, minutes</Eyebrow>
          <input
            type="number"
            min={0}
            defaultValue={task.estimateMinutes ?? ''}
            onBlur={(e) =>
              save({ estimated_minutes: e.target.value === '' ? null : Number(e.target.value) })
            }
            className={cn(fieldClass, 'w-full')}
          />
        </label>

        {task.status === 'review' && (
          <div className="space-y-2 rounded-md border border-warn/60 bg-warn/5 p-3">
            <StatusChip tone="warn">Waiting on you</StatusChip>
            <p className="t-caption text-ink-3">
              An agent proposed this. It is a real row, it just does not count as work until you
              accept it.
            </p>
            <ActionButton
              onClick={() => {
                onSave(() => approveTask(task.id), 'Approved')
                onClose()
              }}
            >
              Approve
            </ActionButton>
          </div>
        )}
      </div>
    </Overlay>
  )
}
