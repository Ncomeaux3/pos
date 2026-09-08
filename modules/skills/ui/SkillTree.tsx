'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState, useTransition } from 'react'
import { Card, CardHead, Chip, EmptyState, Radar } from '@/components/pos'
import type { SkillEvent, SkillTreeData } from '../data'
import { reassignEvent } from './actions'
import { Constellation, toneFor } from './Constellation'
import { WeeklyBars } from './WeeklyBars'

const DAY = 24 * 60 * 60 * 1000
const WEEKS = 13

const round = (n: number) => Math.round(n).toLocaleString()

/** Mirrors modules/skills/xp.ts. Kept here so the panel does not import pg. */
const levelOf = (xp: number) => Math.min(99, Math.floor(Math.sqrt(Math.max(xp, 0) / 100)))
const toNext = (xp: number) => {
  const next = levelOf(xp) + 1
  return { next, needed: Math.max(0, next * next * 100 - Math.floor(xp)) }
}

function since(iso: string | null, now: number): string {
  if (!iso) return 'never'
  const days = Math.floor((now - Date.parse(iso)) / DAY)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

/**
 * `now` comes from the server rather than Date.now() in render. The React
 * compiler treats a clock read during render as impure, and it is: two renders
 * would disagree about what counts as the last 30 days. It also keeps the
 * server and the client markup identical.
 */
export function SkillTree({ data, now }: { data: SkillTreeData; now: number }) {
  // The selected skill lives in the URL so it survives a reload and a skill is
  // linkable. Written with replaceState rather than the router: the whole tree
  // is already on the client, so a navigation would be a round trip for a
  // selection the browser can make on its own.
  const params = useSearchParams()
  const [selected, setSelectedState] = useState<string | null>(params.get('skill'))
  const [pending, startTransition] = useTransition()

  const setSelected = useCallback((id: string | null) => {
    setSelectedState(id)
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('skill', id)
    else url.searchParams.delete('skill')
    window.history.replaceState(null, '', url)
  }, [])

  const statById = useMemo(() => new Map(data.stats.map((s) => [s.id, s])), [data.stats])
  const attributes = data.stats.filter((s) => !s.parent)

  const stat = selected ? statById.get(selected) : undefined
  const children = data.stats.filter((s) => s.parent === selected)

  // Every event under the selected skill, its descendants included, so clicking
  // an attribute shows the work that rolled up into it.
  const descendantIds = useMemo(() => {
    if (!selected) return new Set<string>()
    const ids = new Set([selected])
    let grew = true
    while (grew) {
      grew = false
      for (const s of data.stats) {
        if (s.parent && ids.has(s.parent) && !ids.has(s.id)) {
          ids.add(s.id)
          grew = true
        }
      }
    }
    return ids
  }, [selected, data.stats])

  const events = useMemo(
    () => (selected ? data.events.filter((e) => descendantIds.has(e.skillId)) : []),
    [selected, data.events, descendantIds],
  )
  const recent = useMemo(
    () => events.filter((e) => Date.parse(e.occurredAt) > now - 30 * DAY),
    [events, now],
  )

  const weeks = useMemo(() => {
    const buckets = Array<number>(WEEKS).fill(0)
    for (const e of events) {
      const weeksAgo = Math.floor((now - Date.parse(e.occurredAt)) / (7 * DAY))
      if (weeksAgo >= 0 && weeksAgo < WEEKS) buckets[WEEKS - 1 - weeksAgo] += e.xp
    }
    return buckets
  }, [events, now])

  const path = stat?.parent ? (statById.get(stat.parent)?.name ?? null) : null

  const onReassign = (entityRef: string, from: string, to: string) => {
    startTransition(async () => {
      await reassignEvent(entityRef, from, to)
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card>
          <CardHead label="Constellation" />
          <Constellation
            nodes={data.nodes}
            stats={data.stats}
            selected={selected}
            onSelect={setSelected}
            characterLevel={data.characterLevel}
            now={now}
            onReassign={onReassign}
          />
          <div className="mt-3 flex flex-wrap gap-3 border-t border-rule pt-3">
            {(['gaining', 'active', 'stagnant'] as const).map((tone) => (
              <span key={tone} className="eyebrow flex items-center gap-1.5 text-ink-3">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    background: tone === 'gaining' ? 'var(--accent)' : tone === 'active' ? 'var(--ink-2)' : 'var(--ink-3)',
                    opacity: tone === 'stagnant' ? 0.45 : 1,
                  }}
                />
                {tone === 'stagnant' ? 'stagnant 60d+' : tone}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead label="Character" meta={<Chip tone="quiet">Lv {data.characterLevel}</Chip>} />
          <div className="mt-4 grid gap-5 sm:grid-cols-[132px_minmax(0,1fr)]">
            <Radar axes={attributes.map((a) => ({ label: a.name, value: a.level }))} />
            <div className="space-y-2">
              <div className="num text-[11px] text-ink-3">
                {round(data.totalXp)} XP · {round(toNext(data.totalXp).needed)} TO LV{' '}
                {toNext(data.totalXp).next}
              </div>
              {attributes.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 text-left hover:bg-rule-2"
                >
                  <span className="text-[13px] text-ink-2">{a.name}</span>
                  <span className="num text-[11px] text-ink-3">Lv {a.level}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        {!stat ? (
          <Card>
            <CardHead label="Skill" />
            <div className="mt-4">
              <EmptyState headline="Nothing selected">
                Click a skill in the constellation to see its XP, the events behind it, and the
                keywords that classify to it.
              </EmptyState>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <CardHead
                label={stat.name}
                meta={<Chip tone={toneFor(stat, now) === 'gaining' ? 'brand' : 'quiet'}>Lv {stat.level}</Chip>}
              />
              <div className="mt-4 space-y-3">
                {path && <div className="eyebrow text-ink-3">{path}</div>}
                <div className="num text-[11px] text-ink-3">
                  {round(stat.xp)} XP · {round(toNext(stat.xp).needed)} to Lv {toNext(stat.xp).next}
                </div>
                <dl className="grid grid-cols-3 gap-3 border-t border-rule pt-3">
                  <Stat label="30 days" value={stat.gained30d > 0 ? `+${round(stat.gained30d)}` : '0'} />
                  {/* No source for a goal weight until the Goals module ships. */}
                  <Stat label="Goal weight" value="--" />
                  <Stat label="Last event" value={since(stat.lastEventAt, now)} />
                </dl>
              </div>
            </Card>

            <Card>
              <CardHead label="XP · 90 days" meta={<span className="eyebrow text-ink-3">weekly</span>} />
              <div className="mt-4">
                <WeeklyBars weeks={weeks} />
              </div>
            </Card>

            <Card>
              <CardHead
                label="Events · 30 days"
                meta={
                  <span className="eyebrow text-ink-3">
                    {recent.length} · drag to reassign
                  </span>
                }
              />
              <div className="mt-4" aria-busy={pending}>
                {recent.length === 0 ? (
                  <EmptyState headline="Nothing in 30 days">
                    Finish a task, note, or workout that matches a keyword below.
                  </EmptyState>
                ) : (
                  <ul className="space-y-1">
                    {recent.slice(0, 20).map((e) => (
                      <EventRow key={`${e.entityRef}-${e.skillId}-${e.occurredAt}`} event={e} />
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <Card>
              <CardHead label="Keywords" meta={<span className="eyebrow text-ink-3">skills.yaml</span>} />
              <div className="mt-4 flex flex-wrap gap-1.5">
                {stat.keywords.length === 0 ? (
                  <span className="text-[13px] text-ink-3">
                    None. This skill is only reachable by the model or by hand.
                  </span>
                ) : (
                  stat.keywords.map((k) => (
                    <Chip key={k} tone="quiet">
                      {k}
                    </Chip>
                  ))
                )}
              </div>
            </Card>

            {children.length > 0 && (
              <Card>
                <CardHead label="Children" />
                <ul className="-mx-2 mt-3">
                  {children.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(c.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-[8px] px-2 py-2 text-left hover:bg-rule-2"
                      >
                        <span className="text-[13px] text-ink-2">{c.name}</span>
                        <span className="num text-[11px] text-ink-3">
                          {c.gained30d > 0 ? `+${round(c.gained30d)} · ` : ''}Lv {c.level}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}

        <p className="text-[12px] text-ink-3">
          Level = &radic;(XP &divide; 100). Parent XP is the sum of its children.
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow text-ink-3">{label}</dt>
      <dd className="num text-[13px] text-ink">{value}</dd>
    </div>
  )
}

function EventRow({ event }: { event: SkillEvent }) {
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', `${event.entityRef}|${event.skillId}`)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className="flex cursor-grab items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 hover:bg-rule-2 active:cursor-grabbing"
    >
      <div className="min-w-0">
        <div className="truncate text-[13px] text-ink-2">{event.title}</div>
        <div className="eyebrow text-ink-3">
          {event.eventType} · {event.isManual ? 'manual' : event.classifiedBy}
        </div>
      </div>
      <span className="num shrink-0 text-[11px] text-ink-3">+{Math.round(event.xp)}</span>
    </li>
  )
}
