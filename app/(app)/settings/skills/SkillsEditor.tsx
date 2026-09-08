'use client'

import { useState, useTransition } from 'react'
import { Card, CardHead, Chip, ConfirmButton, InlineEdit, Switch } from '@/components/pos'
import type { MergedSkill } from '@/modules/skills/tree'
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

  return (
    <div className="space-y-5" aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch checked={showDeleted} onChange={setShowDeleted} label="Show deleted skills" />
          <span className="eyebrow text-ink-3">
            {showDeleted ? 'Showing deleted' : 'Hiding deleted'}
          </span>
        </div>
        {overrideCount > 0 && (
          <ConfirmButton
            confirmLabel={`Drop ${overrideCount} ${overrideCount === 1 ? 'edit' : 'edits'}`}
            onConfirm={() => run(resetTree)}
          >
            Reset to skills.yaml
          </ConfirmButton>
        )}
      </div>

      {groups.map(({ attribute, skills }) => {
        const visible = showDeleted ? skills : skills.filter((s) => !s.deleted)

        return (
          <Card key={attribute.id} className="space-y-3">
            <CardHead
              label={attribute.name}
              dot={attribute.deleted ? 'idle' : 'brand'}
              meta={`${skills.filter((s) => !s.deleted).length} skills`}
            />

            <ul className="divide-y divide-rule">
              {visible.map((skill) => (
                <li
                  key={skill.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {skill.deleted ? (
                        <span className="text-[13px] text-ink-3 line-through">{skill.name}</span>
                      ) : (
                        <InlineEdit
                          label={`Rename ${skill.name}`}
                          value={skill.name}
                          onSave={(next) => next !== skill.name && run(() => renameSkill(skill.id, next))}
                        />
                      )}
                      {skill.origin === 'custom' && <Chip tone="brand">custom</Chip>}
                      {skill.renamedFrom && (
                        <span className="eyebrow text-ink-3">was {skill.renamedFrom}</span>
                      )}
                    </div>

                    {/*
                      One editable line rather than chips plus a duplicate of
                      them. Keywords are the half that decides cost: a skill
                      with none never matches a rule, so everything that belongs
                      to it is a model call.
                    */}
                    <div className="mt-1">
                      {skill.deleted ? (
                        <span className="eyebrow text-ink-3">
                          {skill.keywords?.join(', ') || 'no keywords'}
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
                          className="eyebrow text-ink-3"
                        />
                      )}
                    </div>
                  </div>

                  {skill.deleted ? (
                    <button
                      type="button"
                      onClick={() => run(() => restoreSkill(skill.id))}
                      className="eyebrow rounded-[8px] border border-rule px-2 py-1 text-ink-2 hover:text-ink"
                    >
                      Restore
                    </button>
                  ) : (
                    <ConfirmButton
                      confirmLabel="Really delete"
                      onConfirm={() => run(() => deleteSkill(skill.id))}
                    >
                      Delete
                    </ConfirmButton>
                  )}
                </li>
              ))}
            </ul>

            <AddSkill
              parent={attribute.id}
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
      className="flex gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label={`Add a skill under ${parent}`}
        placeholder="Add a skill"
        maxLength={80}
        className="min-w-0 flex-1 rounded-[8px] border border-rule bg-transparent px-2 py-1 text-[13px] text-ink placeholder:text-ink-3"
      />
      <button
        type="submit"
        disabled={!toId(name.trim())}
        className="eyebrow rounded-[8px] border border-rule px-3 py-1 text-ink-2 hover:text-ink disabled:opacity-40"
      >
        Add
      </button>
    </form>
  )
}
