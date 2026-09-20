'use client'

import { useState, useTransition } from 'react'
import { ActionButton, Card, Chip, ConfirmButton, Eyebrow, fieldClass, InlineEdit } from '@/components/pos'
import type { MergedSkill } from '@/modules/skills/tree'
import { cn } from '@/lib/utils'
import { addSkill, deleteSkill, renameSkill, resetTree, restoreSkill, setKeywords } from './actions'

type Group = { attribute: MergedSkill; skills: MergedSkill[] }

/** `New skill` becomes `new_skill`, which is what a skill id has to look like. */
function toId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}

export function SkillsEditor({ groups, overrideCount }: { groups: Group[]; overrideCount: number }) {
  const [showDeleted, setShowDeleted] = useState(false)
  const [pending, startTransition] = useTransition()
  const run = (fn: () => Promise<void>) => startTransition(() => void fn())
  const deletedCount = groups.reduce((n, g) => n + g.skills.filter((s) => s.deleted).length, 0)

  return (
    <div className="flex max-w-[1040px] flex-col gap-3.5" aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-3">
          Every skill a task, note, or workout can link to. Rename inline; delete what you won&apos;t
          use. Changes apply everywhere and never touch XP already earned.
        </p>
        <div className="flex items-center gap-2">
          {deletedCount > 0 && (
            <ActionButton onClick={() => setShowDeleted((s) => !s)}>
              {showDeleted ? 'Hide deleted' : `Show deleted (${deletedCount})`}
            </ActionButton>
          )}
          {overrideCount > 0 && (
            <ConfirmButton
              confirmLabel={`Drop ${overrideCount} ${overrideCount === 1 ? 'edit' : 'edits'}`}
              onConfirm={() => run(resetTree)}
              className="text-ink-3"
            >
              Reset to skills.yaml
            </ConfirmButton>
          )}
        </div>
      </div>

      {groups.map(({ attribute, skills }) => {
        const visible = showDeleted ? skills : skills.filter((s) => !s.deleted)
        return (
          <Card key={attribute.id} className="py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <Eyebrow>{attribute.name}</Eyebrow>
              <span className="num text-[12px] text-ink-3">{skills.filter((s) => !s.deleted).length} skills</span>
            </div>
            <div className="mt-1.5 flex flex-col">
              {visible.map((skill) => (
                <div
                  key={skill.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-b border-rule py-1.5 md:grid-cols-[minmax(0,1fr)_auto_auto]"
                >
                  <input
                    key={skill.name}
                    defaultValue={skill.name}
                    disabled={skill.deleted}
                    aria-label={`Rename ${skill.name}`}
                    onBlur={(e) => {
                      const next = e.target.value.trim()
                      if (next && next !== skill.name) run(() => renameSkill(skill.id, next))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    }}
                    className={cn(
                      'h-11 min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-[16px] outline-none focus-visible:border-action focus-visible:bg-bg focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] sm:h-8 sm:text-[13px]',
                      skill.deleted ? 'text-ink-3 line-through' : 'text-ink',
                    )}
                  />
                  <span className="order-last col-span-2 flex min-w-0 items-center gap-1.5 md:order-none md:col-span-1 md:shrink-0">
                    {skill.origin === 'custom' && (
                      <Chip tone="brand" className="px-2 py-1 text-[11px]">
                        Custom
                      </Chip>
                    )}
                    {skill.renamedFrom && (
                      <span className="num text-[11px] text-ink-3">was {skill.renamedFrom}</span>
                    )}
                    {skill.deleted ? (
                      <span className="num whitespace-nowrap text-[11px] text-ink-4">
                        {(skill.keywords ?? []).slice(0, 3).join(' · ')}
                      </span>
                    ) : (
                      <InlineEdit
                        label={`Keywords for ${skill.name}, comma separated`}
                        value={(skill.keywords ?? []).join(', ')}
                        onSave={(next) =>
                          run(() =>
                            setKeywords(
                              skill.id,
                              next
                                .split(',')
                                .map((k) => k.trim())
                                .filter(Boolean),
                            ),
                          )
                        }
                        className="num min-h-11 w-auto whitespace-normal rounded-none px-1 py-0 text-left text-[12px] text-ink-3 sm:min-h-0"
                      />
                    )}
                  </span>
                  {skill.deleted ? (
                    <ActionButton size="sm" onClick={() => run(() => restoreSkill(skill.id))}>
                      Restore
                    </ActionButton>
                  ) : (
                    <ConfirmButton
                      confirmLabel="Really delete"
                      onConfirm={() => run(() => deleteSkill(skill.id))}
                      className="h-11 px-3 text-[11px] text-ink-3 hover:text-bad sm:h-6 sm:px-2.5"
                    >
                      Delete
                    </ConfirmButton>
                  )}
                </div>
              ))}
            </div>
            <AddSkill
              parent={attribute.name}
              onAdd={(name) => run(() => addSkill(toId(name), name, attribute.id))}
            />
          </Card>
        )
      })}
    </div>
  )
}

function AddSkill({ parent, onAdd }: { parent: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (!toId(trimmed)) return
        onAdd(trimmed)
        setName('')
      }}
      className="mt-2.5 flex items-center gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label={`Add a skill under ${parent}`}
        placeholder={`Add a skill to ${parent}…`}
        maxLength={80}
        className={cn(fieldClass, 'flex-1 border-dashed')}
      />
      <ActionButton type="submit" size="sm" disabled={!toId(name.trim())}>
        Add
      </ActionButton>
    </form>
  )
}
