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
  const floor = levelOf(xp) * levelOf(xp) * 100
  const ceiling = next * next * 100
  return {
    next,
    needed: Math.max(0, ceiling - Math.floor(xp)),
    /** How far through the current level, for the bar under the name. */
    percent: Math.max(0, Math.min(100, ((xp - floor) / Math.max(1, ceiling - floor)) * 100)),
  }
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

  /** Goals point here, and nothing has happened. Weight first, then quiet. */
  const aimed = useMemo(
    () =>
      leaves
        .filter((s) => s.goalWeight > 0 && s.gained30d <= 0)
        .sort((a, b) => b.goalWeight - a.goalWeight)
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
    // Two panes, as the design has them: the left one holds the whole tree
    // read, canvas and columns together, and the right one scrolls on its own.
    // Stacked in page flow, the four columns under the canvas ended up below
    // the fold behind a rail that is twice the height of the canvas.
    <div className="grid gap-5 lg:h-[calc(100dvh-var(--app-header,120px))] lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-h-0 flex-col gap-5 lg:overflow-hidden">
        <Card className="flex min-h-0 flex-1 flex-col">
          {/* The constellation is a night sky in both themes, which is how the
            * artboard draws it: its section carries a hardcoded #05080c and
            * the stars, edges and labels are lit for that ground. Left on the
            * theme's own surface, the whole tree vanished in light. Everything
            * inside this panel therefore states its colour rather than
            * inheriting an ink. */}
          <div className="-mx-5 -mt-4 flex min-h-0 flex-1 flex-col bg-[#05080c] px-5 pt-4">
          {/* Character sits on the canvas, top left, the way the design has
            * it: the constellation is the page and this is a legend for it,
            * not a separate card underneath. */}
          <div className="mb-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div>
              <span className="eyebrow text-[#8fa3b8]">Character</span>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="num text-[34px] font-light leading-none tracking-[-0.02em] text-white">
                  Lv {data.characterLevel}
                </span>
                <span className="text-[15px] text-white">{characterTitle(data.characterLevel)}</span>
              </div>
              <div className="num mt-1.5 text-[11px] text-[#8fa3b8]">
                {round(data.totalXp)} XP · {round(toNext(data.totalXp).needed)} TO LV{' '}
                {toNext(data.totalXp).next}
              </div>
            </div>

            {/* One tile per attribute, which is the character sheet.
              * Cells on a hairline grid, the way the artboard has them: the
              * fill used to be `bg-surface`, which is not a token here, so
              * every cell was transparent and the strip read as one slab. The
              * grid colour is `rule`, not `rule-2`: when the pips wrap, the
              * remainder of the row is this background, and at rule-2 in light
              * that leftover reads as a solid grey block. */}
            <div className="flex flex-wrap justify-end gap-px border border-white/12 bg-white/12">
              {attributes.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a.id)}
                  className="min-w-[72px] bg-[#0a1018] px-3 py-2 text-left hover:bg-brand-soft"
                >
                  <span className="eyebrow block truncate text-[9px] text-[#8fa3b8]">{a.name}</span>
                  <span className="num text-[17px] text-white">{a.level}</span>
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
          <div className="mt-3 flex flex-wrap gap-3 border-t border-white/10 pb-4 pt-3">
            {(['gaining', 'active', 'stagnant'] as const).map((tone) => (
              <span key={tone} className="eyebrow flex items-center gap-1.5 text-[#6f8399]">
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
          </div>

          {/* The four column read of the whole tree, bled to the card's own
            * edges under the canvas: in the artboard this strip is part of the
            * constellation panel, divided from it and from itself by hairlines,
            * not a separate block floating under it. */}
          <div className="-mx-5 -mb-4 grid shrink-0 gap-px border-t border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
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
            {/* Weight from the goals that link here, against what actually
              * happened in thirty days. A skill you are aiming at and have not
              * touched is the one thing this screen can tell you that the
              * constellation cannot. */}
            {aimed.length === 0 ? (
              <Quiet>No goal links to a skill that has been quiet this month.</Quiet>
            ) : (
              aimed.map((sk) => (
                <Line key={sk.id} onClick={() => setSelected(sk.id)} name={sk.name}>
                  weight {sk.goalWeight.toFixed(1)}
                </Line>
              ))
            )}
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
        </Card>
      </div>

      {/* One column, the way the artboard has it: the attributes, a rule, then
        * everything about the selected skill, then the formula pinned to the
        * bottom. Five bordered cards with gaps between them is what made the
        * rail read as a stack of unrelated boxes with a chart lost inside one
        * of them. */}
      <div className="min-h-0 lg:overflow-y-auto lg:pr-1">
        <Card className="flex min-h-full flex-col">
          <CardHead label="Attributes" />
          <div className="mt-2 flex justify-center">
            <Radar axes={attributes.map((a) => ({ label: a.name, value: a.level }))} size={200} />
          </div>

          <div className="mt-4 border-t border-rule pt-4">
            {!stat ? (
              <EmptyState headline="Nothing selected">
                Click a skill in the constellation to see its XP, the events behind it, and the
                keywords that classify to it.
              </EmptyState>
            ) : (
              <div className="space-y-5" aria-busy={pending}>
                <div>
                  <span className="eyebrow text-ink-3">{path ?? 'Attribute'}</span>
                  {/* Name and level on one baseline, then the bar: how close
                    * the next level is should be a length, not a subtraction. */}
                  <div className="mt-2 flex items-baseline justify-between gap-3">
                    <h2 className="t-title truncate text-[22px] tracking-[-0.03em]">{stat.name}</h2>
                    <span className="num shrink-0 text-[22px] font-light">Lv {stat.level}</span>
                  </div>
                  <div className="mt-3 h-0.5 bg-rule-2">
                    <div
                      className="h-0.5 bg-brand"
                      style={{ width: `${Math.round(toNext(stat.xp).percent)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-3">
                    <span className="num text-[11px] text-ink-3">{round(stat.xp)} XP</span>
                    <span className="num text-[11px] text-ink-3">
                      {round(toNext(stat.xp).needed)} to Lv {toNext(stat.xp).next}
                    </span>
                  </div>
                </div>

                {/* Three cells on a hairline grid rather than three loose
                  * columns, which is what the artboard draws and what makes
                  * them read as one instrument. */}
                <dl className="grid grid-cols-3 gap-px border border-rule bg-rule">
                  <Stat
                    label="30 days"
                    value={stat.gained30d > 0 ? `+${round(stat.gained30d)} XP` : 'idle'}
                    tone={stat.gained30d > 0 ? 'ok' : 'warn'}
                  />
                  <Stat
                    label="Goal weight"
                    value={stat.goalWeight > 0 ? stat.goalWeight.toFixed(1) : '\u2014'}
                  />
                  <Stat label="Last event" value={since(stat.lastEventAt, now)} />
                </dl>

                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="eyebrow text-ink-3">XP &middot; 90 days</span>
                    <span className="num text-[11px] text-ink-3">weekly</span>
                  </div>
                  <div className="mt-2">
                    <WeeklyBars weeks={weeks} />
                  </div>
                </div>

                {children.length > 0 ? (
                  <div>
                    <span className="eyebrow text-ink-3">Children</span>
                    <ul className="mt-1.5">
                      {children.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setSelected(c.id)}
                            className="flex w-full items-center justify-between gap-3 border-b border-rule px-1 py-2.5 text-left hover:bg-brand-soft"
                          >
                            <span className="text-[13px] text-ink-2">{c.name}</span>
                            {/* The artboard's two figures: what it gained this
                              * month, then where it stands. */}
                            <span className="flex shrink-0 items-baseline gap-3">
                              <span
                                className={`num text-[11px] ${c.gained30d > 0 ? 'text-ok' : 'text-warn'}`}
                              >
                                {c.gained30d > 0 ? `+${round(c.gained30d)} / 30d` : 'idle'}
                              </span>
                              <span className="num text-[12px] text-ink-3">Lv {c.level}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="t-caption mt-2 text-ink-4">
                      Drop an event here to reassign it to that skill.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="eyebrow text-ink-3">Events &middot; 30 days</span>
                        <span className="num text-[11px] text-ink-3">
                          {recent.length} &middot; drag to reassign
                        </span>
                      </div>
                      {recent.length === 0 ? (
                        <p className="t-caption mt-2 text-ink-3">
                          No events linked in 30 days. Finish a task, note, or workout that matches
                          a keyword below.
                        </p>
                      ) : (
                        // Capped and scrolled rather than run down the page: a
                        // month under a busy skill is a hundred rows.
                        <ul className="mt-1 max-h-[420px] overflow-y-auto pr-1">
                          {recent.map((e) => (
                            <EventRow key={`${e.entityRef}-${e.skillId}-${e.occurredAt}`} event={e} />
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="eyebrow text-ink-3">Keywords</span>
                        <span className="num text-[11px] text-ink-3">skills.yaml</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {stat.keywords.length === 0 ? (
                          <span className="t-caption text-ink-3">
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
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <p className="mt-auto pt-6 text-[12px] text-ink-4">
            Level = &radic;(XP &divide; 100). Parent XP is the sum of its children.
          </p>
        </Card>
      </div>
    </div>
  )
}

/** One cell of the three up grid under the name. Its own fill, so the 1px
 * grid gaps behind it read as hairlines. */
function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'ok' | 'warn'
}) {
  return (
    <div className="bg-bg-elev px-3 py-2.5">
      <dt className="eyebrow text-ink-3">{label}</dt>
      <dd
        className={`num mt-1.5 text-[15px] ${tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-ink'}`}
      >
        {value}
      </dd>
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
      className="flex cursor-grab items-center justify-between gap-3 border-b border-rule px-1 py-1.5 hover:bg-brand-soft active:cursor-grabbing"
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
    <div className="bg-bg-elev px-4 py-3">
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
