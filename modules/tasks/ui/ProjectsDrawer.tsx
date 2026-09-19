'use client'

import { useState } from 'react'
import { ActionButton, Eyebrow, Overlay } from '@/components/pos'
import { ConfirmButton, InlineEdit } from '@/components/pos/edit'
import { fieldClass } from '@/components/pos/field'
import { cn } from '@/lib/utils'
import { writeProject, type ActionResult } from './actions'

// The projects behind the By project view: rename one, point it at a goal so
// its tasks count toward it, archive it, or add a new one. Every write is one
// write_project call; the list re-renders when the page revalidates.

export function ProjectsDrawer({
  projects,
  goals,
  onClose,
  onSave,
}: {
  projects: { id: string; name: string; goalRef: string | null }[]
  goals: { id: string; title: string }[]
  onClose: () => void
  onSave: (action: () => Promise<ActionResult>, ok?: string) => void
}) {
  const [name, setName] = useState('')

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(() => writeProject({ name: trimmed }), `Added. ${trimmed}`)
    setName('')
  }

  return (
    <Overlay
      open
      narrow
      onClose={onClose}
      eyebrow={
        <>
          Tasks <span className="text-ink-4">/</span> Projects
        </>
      }
    >
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project"
          aria-label="New project"
          className={fieldClass}
        />
        <ActionButton
          variant="solid"
          type="submit"
          disabled={!name.trim()}
          className="h-[38px] shrink-0 sm:h-[38px]"
        >
          Add
        </ActionButton>
      </form>

      <div className="glass mt-4 flex flex-col overflow-hidden rounded-[18px]">
        {projects.length === 0 && (
          <p className="t-caption px-4 py-4 text-ink-4">No projects yet.</p>
        )}
        {projects.map((p) => (
          <div
            key={p.id}
            className="relative flex flex-col gap-2 px-4 py-3 before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-rule first:before:hidden"
          >
            <InlineEdit
              value={p.name}
              label={`${p.name} name`}
              onSave={(next) => onSave(() => writeProject({ id: p.id, name: next }), 'Renamed')}
              className="-mx-2.5 font-medium"
            />
            <div className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <Eyebrow className="shrink-0">Goal</Eyebrow>
                <select
                  aria-label={`${p.name} goal`}
                  value={p.goalRef ?? ''}
                  onChange={(e) =>
                    onSave(
                      () => writeProject({ id: p.id, goal_ref: e.target.value || null }),
                      'Saved',
                    )
                  }
                  className={cn(fieldClass, 'py-1.5')}
                >
                  <option value="">None</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </label>
              <ConfirmButton
                confirmLabel="Archive?"
                onConfirm={() => onSave(() => writeProject({ id: p.id, archived: true }), 'Archived')}
                className="h-8 shrink-0 px-2.5 text-[12px]"
              >
                Archive
              </ConfirmButton>
            </div>
          </div>
        ))}
      </div>
      <p className="t-caption mt-3 text-ink-3">
        A task in a project counts toward its goal unless the task names its own.
      </p>
    </Overlay>
  )
}
