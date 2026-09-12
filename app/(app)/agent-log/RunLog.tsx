'use client'

import { useState, useTransition } from 'react'
import {
  ActionButton,
  Chip,
  DiffList,
  EmptyState,
  Eyebrow,
  PillGroup,
  StatusChip,
  useToast,
} from '@/components/pos'
import type { Entry, Run } from '@/core/writelog-shape'
import { jobLabel } from './format'
import { cn } from '@/lib/utils'
import { redo, retryModule, undo } from './actions'
import type { ActionResult } from './actions'

// The run accordion. One run open at a time, filtered by module, with every
// entry carrying the change it made and the button that puts it back.

export function RunLog({
  runs,
  moduleLabels,
  registeredModules,
}: {
  runs: Run[]
  /** Module id to display name, for the filter chips. */
  moduleLabels: Record<string, string>
  /** Nav order, and the only ids `runNightly({ module })` can rerun: a
   * failed job outside this list (a core stage, say) gets no Retry now,
   * since the button would otherwise rerun nothing and call it done. */
  registeredModules: string[]
}) {
  const [filter, setFilter] = useState('all')
  const [retrying, setRetrying] = useState<string | null>(null)
  // Open the newest run that actually wrote something. Defaulting to the newest
  // run means a page that greets you with "this run wrote nothing", which is
  // true and useless: the reason to come here is to see what changed.
  const [open, setOpen] = useState(
    (runs.find((r) => r.entries.length > 0) ?? runs[0])?.id ?? '',
  )
  const [, start] = useTransition()
  const toast = useToast()

  const run = (action: () => Promise<ActionResult>, ok: string) =>
    start(async () => {
      const result = await action()
      toast(result.ok ? ok : result.error)
    })

  // Retry's own toast names the real outcome rather than a fixed word, the
  // same way Run now does, since a rerun can fail again.
  const retry = (module: string) =>
    start(async () => {
      setRetrying(module)
      const result = await retryModule(module)
      setRetrying(null)
      toast(
        result.ok
          ? result.failedJobs
            ? `Run partial, ${result.failedJobs} job${result.failedJobs === 1 ? '' : 's'} failed`
            : 'Run clean'
          : result.error,
      )
    })

  const matches = (e: Entry) => filter === 'all' || e.module === filter

  const shown = runs
    .map((r) => ({ ...r, entries: r.entries.filter(matches) }))
    // A run with nothing left after filtering drops out, except when nothing is
    // filtered: an empty run is itself worth seeing.
    .filter((r) => filter === 'all' || r.entries.length > 0)

  const total = shown.reduce((n, r) => n + r.entries.length, 0)
  const modules = [...new Set(runs.flatMap((r) => r.entries.map((e) => e.module)))].sort((a, b) => {
    const ai = registeredModules.indexOf(a)
    const bi = registeredModules.indexOf(b)
    // A module outside the registry (a core stage, say) sorts after every
    // real one rather than at an arbitrary spot indexOf's -1 would put it.
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi)
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <PillGroup
          label="Filter the log by module"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            ...modules.map((m) => ({ value: m, label: moduleLabels[m] ?? m })),
          ]}
        />
        <span className="t-caption text-ink-3">
          {total} {total === 1 ? 'entry' : 'entries'} / last {runs.length}{' '}
          {runs.length === 1 ? 'run' : 'runs'}
        </span>
      </div>

      {shown.length === 0 ? (
        <EmptyState headline="Nothing logged">
          No writes match this filter in the last {runs.length} runs. The agent only logs what it
          changed, so a quiet week is a short list.
        </EmptyState>
      ) : (
        <div className="space-y-2.5">
          {shown.map((r) => {
            const isOpen = open === r.id
            const reversible = r.entries.filter((e) => e.canUndo).map((e) => e.id)

            return (
              <div
                key={r.id}
                className={cn(
                  'rounded-lg border bg-bg',
                  isOpen ? 'border-brand' : 'border-rule-2',
                )}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpen(isOpen ? '' : r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setOpen(isOpen ? '' : r.id)
                    }
                  }}
                  className="flex cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1 basis-[240px] space-y-1.5">
                    <div className="flex flex-wrap items-baseline gap-x-2.5">
                      <span
                        className={cn(
                          'label text-[11px] tracking-[0.12em]',
                          r.status === 'clean' ? 'text-ok' : 'text-warn',
                        )}
                      >
                        {r.date}
                      </span>
                      <span className="label text-[10px] text-ink-3">
                        {r.clock} / {r.duration}
                      </span>
                    </div>
                    <p className="t-body text-ink">{r.summary}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="quiet">
                      {r.writes} {r.writes === 1 ? 'write' : 'writes'}
                    </Chip>
                    <StatusChip tone={r.status === 'clean' ? 'brand' : 'warn'}>
                      {r.status}
                    </StatusChip>
                    <span aria-hidden className="text-ink-3">
                      {isOpen ? '▴' : '▾'}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-rule">
                    {reversible.length > 1 && (
                      <div className="flex justify-end px-4 pt-3">
                        <UndoRun ids={reversible} />
                      </div>
                    )}

                    {r.entries.length === 0 && (
                      <p className="t-caption px-4 py-4 text-ink-3">
                        This run wrote nothing. The jobs it ran are in the rail.
                      </p>
                    )}

                    {r.entries.map((e) => (
                      <div
                        key={e.id}
                        className={cn(
                          'space-y-3 border-b border-rule px-4 py-3.5 last:border-b-0',
                          e.undone ? 'bg-transparent' : 'bg-bg-elev',
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                          <div className="min-w-0 flex-1 basis-[220px] space-y-1">
                            <div className="flex flex-wrap items-baseline gap-x-2.5">
                              <span
                                className={cn(
                                  'label text-[10px] tracking-[0.12em]',
                                  e.undone ? 'text-ink-3' : 'text-ok',
                                )}
                              >
                                {e.moduleLabel.toUpperCase()}
                              </span>
                              <span className="label text-[10px] tracking-[0.1em] text-ink-3">
                                {e.kind}
                              </span>
                              <span className="label text-[10px] text-ink-3">{e.time}</span>
                            </div>
                            {/* Struck through when reverted, so the log reads as
                                a history rather than as current state. */}
                            <p
                              className={cn(
                                't-body',
                                e.undone ? 'text-ink-3 line-through' : 'text-ink',
                              )}
                            >
                              {e.title}
                            </p>
                            <p className="t-caption text-ink-3">{e.reason}</p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {e.canUndo && (
                              <ActionButton
                                className="border-warn/60 text-warn hover:border-warn"
                                onClick={() =>
                                  run(
                                    () => undo(e.id),
                                    'Put back. The rule that made it is paused for seven days.',
                                  )
                                }
                              >
                                Undo
                              </ActionButton>
                            )}
                            {e.canRedo && (
                              <ActionButton onClick={() => run(() => redo(e.id), 'Re-applied.')}>
                                Redo
                              </ActionButton>
                            )}
                          </div>
                        </div>

                        <DiffList
                          undone={e.undone}
                          diffs={e.diff.map((d) => ({
                            field: d.field,
                            before: d.before === null ? null : String(d.before),
                            after: d.after === null ? null : String(d.after),
                          }))}
                        />
                      </div>
                    ))}

                    {r.jobs
                      .filter((j) => j.status === 'failed')
                      .map((j) => (
                        <div
                          key={`${j.module}.${j.name}`}
                          className="space-y-2 border-t border-rule bg-bad/5 px-4 py-3.5"
                        >
                          <Eyebrow className="text-[10px] tracking-[0.1em] text-bad">Error</Eyebrow>
                          <p className="t-body text-ink">{jobLabel(j.name)}</p>
                          {/* The raw provider message, not a paraphrase of it.
                              A rewritten error is one you cannot search for. */}
                          <p className="code t-caption break-all text-ink-2">
                            {j.detail ?? 'No detail recorded.'}
                          </p>
                          <p className="t-caption text-ink-3">
                            Retried twice inside the run, then left for the next one.
                          </p>
                          {/* Only when the module is a real one runNightly can
                              rerun: a job stamped with anything else would
                              have this button do nothing and call it done. */}
                          {registeredModules.includes(j.module) && (
                            <ActionButton disabled={retrying === j.module} onClick={() => retry(j.module)}>
                              {retrying === j.module ? 'Retrying' : 'Retry now'}
                            </ActionButton>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Every reversible write in one run, put back in one press. */
function UndoRun({ ids }: { ids: string[] }) {
  const [armed, setArmed] = useState(false)
  const [pending, start] = useTransition()
  const toast = useToast()

  // Two press rather than a modal: there is no modal anywhere in the design,
  // and undoing a whole run is worth asking about twice.
  return (
    <ActionButton
      variant={armed ? 'brand' : 'outline'}
      disabled={pending}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) {
          setArmed(true)
          return
        }
        setArmed(false)
        start(async () => {
          const { undoRun } = await import('./actions')
          const result = await undoRun(ids)
          toast(result.ok ? `Put back ${result.undone} writes.` : result.error)
        })
      }}
    >
      {armed ? `Undo all ${ids.length}, press again` : 'Undo this run'}
    </ActionButton>
  )
}
