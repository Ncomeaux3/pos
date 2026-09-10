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

  // Leaves only in the summary columns: an attribute's number is the sum of
  // its children, so listing both says the same thing twice.
  const leaves = useMemo(
    () => data.stats.filter((s) => s.parent && !data.stats.some((c) => c.parent === s.id)),
    [data.stats],
  )

  const gainingFastest = useMemo(
    () => [...leaves].filter((s) => s.gained30d > 0).sort((a, b) => b.gained30d - a.gained30d).slice(0, 4),
    [leaves],
  )

  const stagnant = useMemo(
    () =>
      leaves
        .filter((s) => s.xp > 0 && toneFor(s, now) === 'stagnant')
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 4),
    [leaves, now],
  )

  /**
   * A skill that crossed a level in the last 30 days.
   *
   * Worked out rather than stored: level is a function of XP, and gained30d is
   * how much of that XP arrived this month, so the level a month ago is the
   * level of the difference. No history table needed for a question this shape.
   */
  const levelUps = useMemo(
    () =>
      leaves
        .filter((s) => s.gained30d > 0 && levelOf(s.xp) > levelOf(s.xp - s.gained30d))
        .sort((a, b) => b.level - a.level)
        .slice(0, 4),
    [leaves],
  )

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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <Card>
          {/* Character sits on the canvas, top left, the way the design has
            * it: the constellation is the page and this is a legend for it,
            * not a separate card underneath. */}
          <div className="mb-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div>
              <span className="eyebrow text-ink-3">Character</span>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="num text-[34px] font-light leading-none tracking-[-0.02em] text-ink">
                  Lv {data.characterLevel}
                </span>
                <span className="text-[15px] text-ink-2">{characterTitle(data.characterLevel)}</span>
              </div>
              <div className="num mt-1.5 text-[11px] text-ink-3">
                {round(data.totalXp)} XP · {round(toNext(data.totalXp).needed)} TO LV{' '}
                {toNext(data.totalXp).next}
              </div>
            </div>

            {/* One tile per attribute, which is the character sheet. */}
            <div className="flex flex-wrap gap-px bg-rule-2">
              {attributes.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a.id)}
                  className="min-w-[72px] bg-surface px-3 py-2 text-left hover:bg-brand-soft"
                >
                  <span className="eyebrow block truncate text-[9px] text-ink-3">{a.name}</span>
                  <span className="num text-[17px] text-ink">{a.level}</span>
                </button>
              ))}
            </div>
          </div>

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
                    background:
                      tone === 'gaining'
                        ? 'var(--accent)'
                        : tone === 'active'
                          ? '#9fd1ff'
                          : '#5b6b7d',
                  }}
                />
                {tone === 'stagnant' ? 'stagnant 60d+' : tone}
              </span>
            ))}
          </div>
        </Card>

        {/* The four column read of the whole tree, under the canvas. */}
        <div className="grid gap-px bg-rule-2 sm:grid-cols-2 lg:grid-cols-4">
          <Column label="Gaining fastest">
            {gainingFastest.length === 0 ? (
              <Quiet>Nothing gained XP in 30 days.</Quiet>
            ) : (
              gainingFastest.map((sk) => (
                <Line key={sk.id} onClick={() => setSelected(sk.id)} name={sk.name}>
                  <span className="text-brand">+{round(sk.gained30d)}</span>
                </Line>
              ))
            )}
          </Column>

          <Column label="Stagnant 60d+">
            {stagnant.length === 0 ? (
              <Quiet>Nothing has been idle that long.</Quiet>
            ) : (
              stagnant.map((sk) => (
                <Line key={sk.id} onClick={() => setSelected(sk.id)} name={sk.name}>
                  Lv {sk.level}
                </Line>
              ))
            )}
          </Column>

          <Column label="Goal weight high, low activity">
            {/* Nothing stores a goal weight, so this says so rather than
              * showing a number nobody computed. */}
            <Quiet>No goal weights are stored yet, so this cannot be worked out.</Quiet>
          </Column>

          <Column label="Level-ups this month">
            {levelUps.length === 0 ? (
              <Quiet>No skill crossed a level in 30 days.</Quiet>
            ) : (
              levelUps.map((sk) => (
                <Line key={sk.id} onClick={() => setSelected(sk.id)} name={sk.name}>
                  <span className="text-brand">&rarr; Lv {sk.level}</span>
                </Line>
              ))
            )}
          </Column>
        </div>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHead label="Attributes" />
          <div className="mt-3 flex justify-center">
            <Radar axes={attributes.map((a) => ({ label: a.name, value: a.level }))} />
          </div>
        </Card>

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

/** A title for the character level. Flavour, and the design shows one. */
function characterTitle(level: number): string {
  if (level >= 30) return 'Master'
  if (level >= 20) return 'Practitioner'
  if (level >= 12) return 'Builder'
  if (level >= 6) return 'Apprentice'
  return 'Novice'
}

/** One of the four summary columns under the canvas. */
function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface p-3.5">
      <span className="eyebrow block text-ink-3">{label}</span>
      <div className="mt-2.5 space-y-1.5">{children}</div>
    </div>
  )
}

function Line({
  name,
  onClick,
  children,
}: {
  name: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-baseline justify-between gap-3 text-left hover:text-ink"
    >
      <span className="truncate text-[13px] text-ink-2">{name}</span>
      <span className="num shrink-0 text-[11px] text-ink-3">{children}</span>
    </button>
  )
}

/**
 * An empty column says why it is empty.
 *
 * The design fills these with data; with none, a blank column reads as broken
 * rather than as quiet, and the owner cannot tell which it is.
 */
function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] leading-snug text-ink-3">{children}</p>
}
