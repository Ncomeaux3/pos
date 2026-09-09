'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  Chip,
  EmptyState,
  Eyebrow,
  Overlay,
  PaceBar,
  PillGroup,
  Sparkline,
  StatusChip,
  TabBar,
  fieldClass,
  useToast,
} from '@/components/pos'
import type { Metric } from '@/core/metrics'
import { cn } from '@/lib/utils'
import {
  formatValue,
  STATUS_LABELS,
  type GoalKind,
  type Point,
  type Progress,
  type Status,
} from '../progress'
import { recordCheckin, writeGoal, type ActionResult } from './actions'

export type GoalCard = {
  id: string
  title: string
  notes: string
  area: string
  kind: GoalKind
  unit: string
  startValue: number
  targetValue: number
  deadline: string
  metricSource: string | null
  archived: boolean
  history: Point[]
  progress: Progress
  rule: string
}

const TONE: Record<Status, 'ok' | 'warn' | 'bad' | 'brand'> = {
  done: 'brand',
  on_track: 'ok',
  at_risk: 'warn',
  stalled: 'bad',
}

const BAR: Record<Status, 'brand' | 'warn' | 'bad'> = {
  done: 'brand',
  on_track: 'brand',
  at_risk: 'warn',
  stalled: 'bad',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "12 Nov 2027", and the year only when it is not this one. */
function formatDate(iso: string, todayIso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  const sameYear = iso.slice(0, 4) === todayIso.slice(0, 4)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`
}

/** Where a projection lands, or the honest answer when it never does. */
function projectionLabel(days: number | null, todayIso: string): string {
  if (days === null) return 'never at this pace'
  const d = new Date(`${todayIso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function GoalList({
  goals,
  metrics,
  todayIso,
}: {
  goals: GoalCard[]
  metrics: Metric[]
  todayIso: string
}) {
  // Tab and open goal live in the URL, so a goal can be linked to and both
  // survive a refresh. It is also what makes a screenshot of the drawer
  // actually be one: the theme switch reloads, and client state does not come
  // back.
  const router = useRouter()
  const params = useSearchParams()
  const tab = params.get('tab') === 'archive' ? 'archive' : 'active'
  const selected = goals.find((g) => g.id === params.get('goal')) ?? null

  const setParams = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
    const query = search.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }

  const setTab = (next: string) => setParams({ tab: next === 'active' ? null : next, goal: null })
  const setSelected = (goal: GoalCard | null) => setParams({ goal: goal?.id ?? null })

  const [, start] = useTransition()
  const toast = useToast()

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  const shown = goals.filter((g) => (tab === 'archive' ? g.archived : !g.archived))
  const areas = [...new Set(shown.map((g) => g.area))]

  return (
    <div className="space-y-5">
      <TabBar
        label="Goal status"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'active', label: 'Active', count: goals.filter((g) => !g.archived).length },
          { value: 'archive', label: 'Archive', count: goals.filter((g) => g.archived).length },
        ]}
      />

      {shown.length === 0 ? (
        <EmptyState headline={tab === 'archive' ? 'Nothing archived' : 'No goals yet'}>
          {tab === 'archive'
            ? 'A goal you archive keeps its history and stops being counted.'
            : 'A goal is a target, a deadline, and a way of knowing where you stand. Point it at a module metric and it checks itself in nightly.'}
        </EmptyState>
      ) : (
        areas.map((area) => (
          <section key={area} className="space-y-2.5">
            <Eyebrow>{area}</Eyebrow>
            <div className="grid gap-2.5 lg:grid-cols-2">
              {shown
                .filter((g) => g.area === area)
                .map((goal) => (
                  <Row
                    key={goal.id}
                    goal={goal}
                    todayIso={todayIso}
                    onOpen={() => setSelected(goal)}
                  />
                ))}
            </div>
          </section>
        ))
      )}

      <Detail
        goal={selected}
        metrics={metrics}
        todayIso={todayIso}
        onClose={() => setSelected(null)}
        onRun={run}
      />
    </div>
  )
}

function Row({
  goal,
  todayIso,
  onOpen,
}: {
  goal: GoalCard
  todayIso: string
  onOpen: () => void
}) {
  const p = goal.progress

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 basis-[180px] text-left">
          <p className={cn('t-body', goal.archived ? 'text-ink-3' : 'text-ink')}>{goal.title}</p>
          <p className="t-caption mt-1 text-ink-3">
            {/* A milestone has no "x of y": it happened or it did not, and
                "Not yet of Done" is what reads out of the general form. */}
            {goal.kind === 'milestone'
              ? `${formatValue(p.current, goal.kind, goal.unit)}, due ${formatDate(goal.deadline, todayIso)}`
              : `${formatValue(p.current, goal.kind, goal.unit)} of ${formatValue(
                  goal.targetValue,
                  goal.kind,
                  goal.unit,
                )} by ${formatDate(goal.deadline, todayIso)}`}
          </p>
        </button>
        <StatusChip tone={TONE[p.status]}>{STATUS_LABELS[p.status]}</StatusChip>
      </div>

      {/* The tick is where a straight line from the start would have you today,
          so the bar shows pace rather than only distance. */}
      <PaceBar
        value={p.percent}
        max={100}
        pace={p.expectedPercent / 100}
        tone={BAR[p.status]}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {/* The rule, not just the colour. This is the sentence the whole screen
            exists to be able to write. */}
        <p className="t-caption min-w-0 flex-1 basis-[200px] text-ink-3">{goal.rule}</p>
        <div className="flex items-center gap-2">
          {goal.metricSource && <Chip tone="quiet">computed</Chip>}
          <span className="num text-[11px] text-ink-3">{Math.round(p.percent)}%</span>
        </div>
      </div>

      {goal.history.length > 1 && (
        <Sparkline
          points={[...goal.history].sort((a, b) => b.daysAgo - a.daysAgo).map((h) => h.value)}
          height={28}
        />
      )}
    </Card>
  )
}

/** The drawer: history, both projections, the metric source, and a check-in. */
function Detail({
  goal,
  metrics,
  todayIso,
  onClose,
  onRun,
}: {
  goal: GoalCard | null
  metrics: Metric[]
  todayIso: string
  onClose: () => void
  onRun: (action: () => Promise<ActionResult>, ok?: string) => void
}) {
  const [value, setValue] = useState('')

  if (!goal) return null
  const p = goal.progress

  const save = (patch: Record<string, unknown>) =>
    onRun(() => writeGoal({ id: goal.id, ...patch }))

  return (
    <Overlay
      open
      onClose={onClose}
      eyebrow={`${goal.area} / ${goal.kind}`}
      title={goal.title}
      footer={
        <>
          <ActionButton
            onClick={() => {
              save({ archived: !goal.archived })
              onClose()
            }}
          >
            {goal.archived ? 'Restore' : 'Archive'}
          </ActionButton>
          <StatusChip tone={TONE[p.status]}>{STATUS_LABELS[p.status]}</StatusChip>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="t-caption text-ink-3">{goal.rule}</p>
          <PaceBar
            className="mt-3"
            value={p.percent}
            max={100}
            pace={p.expectedPercent / 100}
            tone={BAR[p.status]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Figure label="Now" value={formatValue(p.current, goal.kind, goal.unit)} />
          <Figure label="Target" value={formatValue(goal.targetValue, goal.kind, goal.unit)} />
          <Figure
            label="Deadline"
            value={formatDate(goal.deadline, todayIso)}
            note={p.daysLeft >= 0 ? `${p.daysLeft} days left` : `${-p.daysLeft} days over`}
          />
          <Figure
            label="Needed pace"
            value={
              p.neededRate > 0
                ? `${formatValue(p.neededRate * 30, goal.kind, goal.unit)}/mo`
                : 'nothing left'
            }
          />
        </div>

        {/* Two models, shown together and labelled, because they disagree
            exactly when the answer matters. A single projection would have to
            pick one and would be wrong quietly. */}
        <div className="space-y-2">
          <Eyebrow>Projected finish</Eyebrow>
          <div className="space-y-1.5">
            <Line
              label="At the last 30 days"
              value={projectionLabel(p.projected30, todayIso)}
            />
            <Line label="At the lifetime pace" value={projectionLabel(p.projectedAll, todayIso)} />
          </div>
        </div>

        <div className="space-y-2">
          <Eyebrow>Source</Eyebrow>
          {/* The picker lists what modules actually register. There is no query
              string to type and no schema to know. */}
          <PillGroup
            label="Metric source"
            value={goal.metricSource ?? '__manual'}
            options={[
              { value: '__manual', label: 'Check in by hand' },
              ...metrics.map((m) => ({ value: m.id, label: m.label })),
            ]}
            onChange={(id) => save({ metric_source: id === '__manual' ? null : id })}
          />
          {goal.metricSource && !metrics.some((m) => m.id === goal.metricSource) && (
            <p className="t-caption text-warn">
              {goal.metricSource} is not registered by any installed module, so this goal is on its
              own check-ins until it comes back.
            </p>
          )}
        </div>

        {goal.kind !== 'milestone' && (
          <div className="space-y-2">
            <Eyebrow>Check in</Eyebrow>
            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label={`Check in on ${goal.title}`}
                placeholder={String(p.current)}
                className={cn(fieldClass, 'min-w-0 flex-1 basis-[140px]')}
              />
              <ActionButton
                variant="brand"
                disabled={value === ''}
                onClick={() => {
                  onRun(() => recordCheckin(goal.id, Number(value)), 'Checked in')
                  setValue('')
                }}
              >
                Record
              </ActionButton>
            </div>
            <p className="t-caption text-ink-3">
              One reading a day. A second on the same day corrects the first rather than adding a
              point, because the pace maths would count it twice.
            </p>
          </div>
        )}

        {goal.kind === 'milestone' && (
          <ActionButton
            variant={p.status === 'done' ? 'outline' : 'brand'}
            onClick={() =>
              onRun(
                () => recordCheckin(goal.id, p.status === 'done' ? 0 : 1),
                p.status === 'done' ? 'Reopened' : 'Marked done',
              )
            }
          >
            {p.status === 'done' ? 'Reopen' : 'Mark done'}
          </ActionButton>
        )}

        <label className="block space-y-1.5">
          <Eyebrow>Notes</Eyebrow>
          <textarea
            defaultValue={goal.notes}
            rows={3}
            onBlur={(e) => e.target.value !== goal.notes && save({ notes: e.target.value })}
            className={cn(fieldClass, 'w-full resize-y')}
          />
        </label>
      </div>
    </Overlay>
  )
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="space-y-1 rounded-md border border-rule-2 p-3">
      <Eyebrow className="text-[10px]">{label}</Eyebrow>
      <p className="num text-[15px] text-ink">{value}</p>
      {note && <p className="t-caption text-ink-3">{note}</p>}
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-1.5 last:border-b-0">
      <span className="t-caption text-ink-3">{label}</span>
      <span className="num text-[12px] text-ink-2">{value}</span>
    </div>
  )
}
