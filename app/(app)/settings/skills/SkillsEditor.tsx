'use client'

import { useState, useTransition } from 'react'
import { ConfirmButton, Eyebrow, InlineEdit } from '@/components/pos'
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

const mini =
  'shrink-0 whitespace-nowrap border border-rule-2 px-[9px] py-1 text-[11px] text-ink-3 transition-colors duration-150 hover:border-ink hover:text-ink'

export function SkillsEditor({ groups, overrideCount }: { groups: Group[]; overrideCount: number }) {
  const [showDeleted, setShowDeleted] = useState(false)
  const [pending, startTransition] = useTransition()
  const run = (fn: () => Promise<void>) => startTransition(() => void fn())
  const deletedCount = groups.reduce((n, g) => n + g.skills.filter((s) => s.deleted).length, 0)

  return (
    <div className="flex max-w-[860px] flex-col gap-3.5" aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-3">
          Every skill a task, note, or workout can link to. Rename inline; delete what you won&apos;t
          use. Changes apply everywhere and never touch XP already earned.
        </p>
        <div className="flex items-center gap-2">
          {deletedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleted((s) => !s)}
              className="whitespace-nowrap border border-rule-2 px-2.5 py-1.5 text-[12px] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink"
            >
              {showDeleted ? 'Hide deleted' : `Show deleted (${deletedCount})`}
            </button>
          )}
          {overrideCount > 0 && (
            <ConfirmButton
              confirmLabel={`Drop ${overrideCount} ${overrideCount === 1 ? 'edit' : 'edits'}`}
              onConfirm={() => run(resetTree)}
              className="border-0 px-1 text-[12px] text-ink-3 hover:text-ink sm:h-auto"
            >
              Reset to skills.yaml
            </ConfirmButton>
          )}
        </div>
      </div>

      {groups.map(({ attribute, skills }) => {
        const visible = showDeleted ? skills : skills.filter((s) => !s.deleted)
        return (
          <div key={attribute.id} className="border border-rule bg-bg-elev px-5 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <Eyebrow>{attribute.name}</Eyebrow>
              <span className="num text-[11px] text-ink-3">{skills.filter((s) => !s.deleted).length} skills</span>
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
                      'min-w-0 border border-transparent bg-transparent px-2 py-[5px] text-[13px] outline-none focus-visible:border-brand focus-visible:bg-bg',
                      skill.deleted ? 'text-ink-3 line-through' : 'text-ink',
                    )}
                  />
                  <span className="order-last col-span-2 flex min-w-0 items-center gap-1.5 md:order-none md:col-span-1 md:shrink-0">
                    {skill.origin === 'custom' && (
                      <span className="num border border-brand px-[5px] py-px text-[9px] tracking-[0.08em] text-brand">CUSTOM</span>
                    )}
                    {skill.renamedFrom && (
                      <span className="num text-[9px] tracking-[0.08em] text-ink-3">was {skill.renamedFrom}</span>
                    )}
                    {skill.deleted ? (
                      <span className="num whitespace-nowrap text-[10px] text-ink-4">
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
                        className="num w-auto max-w-[220px] truncate rounded-none px-1 py-0 text-[10px] text-ink-4"
                      />
                    )}
                  </span>
                  {skill.deleted ? (
                    <button type="button" onClick={() => run(() => restoreSkill(skill.id))} className={mini}>
                      Restore
                    </button>
                  ) : (
                    <ConfirmButton
                      confirmLabel="Really delete"
                      onConfirm={() => run(() => deleteSkill(skill.id))}
                      className="h-auto border-rule-2 px-[9px] py-1 text-[11px] text-ink-3 hover:border-bad hover:text-bad sm:h-auto"
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
          </div>
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
        className="min-w-0 flex-1 border border-dashed border-rule-2 bg-bg px-2.5 py-[7px] text-[12px] text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand"
      />
      <button type="submit" disabled={!toId(name.trim())} className={cn(mini, 'disabled:text-ink-4')}>
        Add
      </button>
    </form>
  )
}
