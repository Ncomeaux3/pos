'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState, useTransition } from 'react'
import {
  ActionButton,
  BandSearch,
  Chip,
  EmptyState,
  MetricStrip,
  Radar,
  RowList,
  SearchButton,
  useToast,
} from '@/components/pos'
import { cn } from '@/lib/utils'
import { BackControl } from '@/components/pos/BackControl'
import type { SkillEvent, SkillStat, SkillTreeData } from '../data'
import { underGoalPressure } from '../pressure'
import { reassignEvent } from './actions'
import { Constellation, toneFor } from './Constellation'
import { ROOT_ID } from './layout'
import { WeeklyBars } from './WeeklyBars'

const DAY = 24 * 60 * 60 * 1000
const WEEKS = 13

const round = (n: number) => Math.round(n).toLocaleString()
/** The most rows the events list draws. */
const EVENT_ROWS = 100

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
  // The artboard opens on a skill, the top gainer among the leaves, so the
  // right pane is never the empty explanation. Nothing is written to the URL
  // until a click chooses.
  const [selected, setSelectedState] = useState<string | null>(
    () => params.get('skill') ?? topLeaf(data) ?? null,
  )
  const [pending, startTransition] = useTransition()
  const [resetToken, setResetToken] = useState(0)
  const toast = useToast()

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
  const aimed = useMemo(() => underGoalPressure(leaves, 4), [leaves])

  // The centre star is not a skill row, so the pane gets one made from the
  // character figures: the sum of the attributes, which is what "You" is.
  const isRoot = selected === ROOT_ID
  const you = useMemo<SkillStat>(
    () => ({
      id: ROOT_ID,
      name: 'You',
      keywords: [],
      ownXp: 0,
      xp: data.totalXp,
      level: data.characterLevel,
      gained30d: attributes.reduce((sum, a) => sum + a.gained30d, 0),
      lastEventAt: attributes.reduce<string | null>(
        (latest, a) => (a.lastEventAt && (!latest || a.lastEventAt > latest) ? a.lastEventAt : latest),
        null,
      ),
      goalWeight: 0,
    }),
    [data.totalXp, data.characterLevel, attributes],
  )
  const stat = isRoot ? you : selected ? statById.get(selected) : undefined
  const children = data.stats.filter((s) => (isRoot ? !s.parent : s.parent === selected))

  // Every event under the selected skill, its descendants included, so clicking
  // an attribute shows the work that rolled up into it. Under You, all of them.
  const descendantIds = useMemo(() => {
    if (!selected) return new Set<string>()
    if (selected === ROOT_ID) return new Set(data.stats.map((s) => s.id))
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

  // The crumb is the whole path down to the parent: "Engineering / Coding".
  const path = (() => {
    const names: string[] = []
    let cursor = stat?.parent ? statById.get(stat.parent) : undefined
    while (cursor) {
      names.unshift(cursor.name)
      cursor = cursor.parent ? statById.get(cursor.parent) : undefined
    }
    return names.length > 0 ? names.join(' / ') : null
  })()

  const onReassign = (entityRef: string, from: string, to: string) => {
    startTransition(async () => {
      const result = await reassignEvent(entityRef, from, to)
      if (!result.ok) toast(result.error)
    })
  }

  return (
    // One element, not a fragment: the module route wraps every page in
    // space-y-5, and as two children the band and the grid picked up 20px
    // between them, which is exactly how far the page overran the window.
    <div>
      {/* The band, as POS Skill Tree.dc.html draws it: 56px, full bleed, the
        * crumb, the scoped search and Reset view. No title block: the panes
        * start under the band. The heading is drawn nowhere and present all
        * the same, because a page with no heading is one a screen reader
        * cannot announce. */}
      <header className="-mx-[18px] -mt-[max(18px,calc(var(--inset-t)+8px))] flex min-h-14 flex-wrap items-center justify-between gap-4 border-b border-rule px-[18px] py-2 md:-mx-7 md:-mt-7 md:px-7 lg:h-14 lg:flex-nowrap lg:py-0">
        <BackControl />
        <h1 className="sr-only">Skills</h1>
        {/* The view name is desktop only: there is one view, and with the
          * back control in the band the full crumb ran under the search. */}
        <span className="eyebrow shrink-0 whitespace-nowrap text-ink-3">
          Skills
          <span className="hidden md:contents">
            <span className="text-ink-4">/</span> Constellation
          </span>
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
          <SearchButton className="md:hidden" />
          <BandSearch className="hidden min-w-[220px] flex-1 md:flex" placeholder="Search skill tree" />
          <ActionButton onClick={() => setResetToken((t) => t + 1)}>Reset view</ActionButton>
        </div>
      </header>

      {/* Two flush halves split by one rule, filling the viewport under the
        * band: the tree on the left with its columns under it, the detail on
        * the right scrolling on its own. */}
      <div className="-mx-[18px] -mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,560px),1fr))] md:-mx-7 md:-mb-7 md:h-[calc(100dvh-56px)] md:overflow-auto">
        <section
          data-testid="skill-tree-canvas-pane"
          className="relative flex min-w-0 flex-col border-b border-rule bg-[#05080c] md:min-h-full md:border-b-0 md:border-r"
        >
          {/* The constellation is a night sky in both themes, which is how the
            * artboard draws it: the section carries a hardcoded #05080c and
            * everything on it states its colour rather than inheriting an ink.
            * The character, the pips, the hints and the legend sit in its four
            * corners, over the sky. */}
          <div className="relative flex flex-1 flex-col overflow-hidden md:min-h-[420px]">
            {/* On a phone the character and the pips sit above the sky in
              * flow; from md they float in its top corners as drawn. */}
            <div className="z-10 px-5 pt-[18px] md:pointer-events-none md:absolute md:left-5 md:top-[18px] md:p-0">
              <span className="eyebrow text-[#8fa3b8]">Character</span>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="num text-[34px] font-light leading-none tracking-[-0.02em] text-white">
                  Lv {data.characterLevel}
                </span>
                <span className="text-[20px] tracking-[-0.02em] text-white">{characterTitle(data.characterLevel)}</span>
              </div>
              <div className="num mt-2 text-[11px] text-[#8fa3b8]">
                {round(data.totalXp)} XP · {round(toNext(data.totalXp).needed)} to Lv{' '}
                {toNext(data.totalXp).next}
              </div>
            </div>

            {/* One pip per attribute, the character sheet, six letters each as
              * the artboard cuts them. Cells on a hairline grid. */}
            <div className="z-10 mx-5 mt-3 flex flex-wrap justify-end gap-px border border-white/12 bg-white/12 md:absolute md:right-5 md:top-[18px] md:mx-0 md:mt-0 md:max-w-[calc(100%-320px)] rounded-[18px]">
              {attributes.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a.id)}
                  aria-label={a.name}
                  aria-pressed={selected === a.id}
                  className={cn(
                    'min-w-[56px] px-2.5 py-1.5 text-center hover:bg-brand-soft',
                    selected === a.id ? 'bg-brand-soft' : 'bg-[#0a1018]',
                  )}
                >
                  <span data-testid="skill-pip-label" className="label block text-[9px] tracking-[0.1em] text-[#8fa3b8]">
                    {a.name.slice(0, 6)}
                  </span>
                  <span className="num mt-[3px] block text-[16px] font-light leading-none text-white">{a.level}</span>
                </button>
              ))}
            </div>

            <Constellation
              nodes={data.nodes}
              stats={data.stats}
              selected={selected}
              onSelect={setSelected}
              characterLevel={data.characterLevel}
              now={now}
              onReassign={onReassign}
              resetToken={resetToken}
            />

            {/* Pointer hints, so not on a phone, where they were sitting on
              * the bottom leaves and describing a mouse nobody has. */}
            <div className="pointer-events-none absolute bottom-3.5 left-5 z-10 hidden max-w-[55%] flex-wrap gap-3.5 text-[11px] text-[#6f8399] md:flex">
              <span>Hover: details</span>
              <span>Click: inspect</span>
              <span>Double-click: zoom</span>
              <span>Scroll: zoom · Drag: pan</span>
            </div>
            {/* The legend floats in the sky's corner from md; on a phone the
              * sky is only as tall as the tree, so it goes under it in flow. */}
            <div className="pointer-events-none z-10 mx-5 my-2.5 flex flex-wrap items-center justify-end gap-3 text-[11px] text-[#6f8399] md:absolute md:bottom-3.5 md:right-5 md:mx-0 md:my-0 md:max-w-[40%]">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-brand shadow-[0_0_8px_var(--accent)]" />
                gaining
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#cfe6ff]" />
                active
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full border border-dashed border-warn" />
                stagnant 60d+
              </span>
            </div>
          </div>

          {/* The four column read of the whole tree under the canvas: one
            * strip of four cells, flush on the phone so it still ends above
            * the tab bar, inset from md up. */}
          <div className="shrink-0 border-t border-rule bg-bg md:p-4">
          <MetricStrip className="grid-cols-2 rounded-none sm:grid-cols-2 md:rounded-[18px]">
          <Column label="Gaining fastest">
            {gainingFastest.length === 0 ? (
              <Quiet>Nothing gained XP in 30 days.</Quiet>
            ) : (
              gainingFastest.map((sk) => (
                <Line key={sk.id} onClick={() => setSelected(sk.id)} name={sk.name}>
                  +{round(sk.gained30d)}
                </Line>
              ))
            )}
          </Column>

          <Column label="Stagnant 60d+" tone="warn">
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

          <Column label="Goal weight high, low activity" tone="warn">
            {/* Weight from the goals that link here, against what actually
              * happened in thirty days. A skill you are aiming at and have not
              * touched is the one thing this screen can tell you that the
              * constellation cannot. */}
            {aimed.length === 0 ? (
              <Quiet>No goal links to a skill that has been quiet this month.</Quiet>
            ) : (
              aimed.map((sk) => (
                <Line key={sk.id} onClick={() => setSelected(sk.id)} name={sk.name}>
                  w {sk.goalWeight.toFixed(1)}
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
                  &rarr; Lv {sk.level}
                </Line>
              ))
            )}
          </Column>
          </MetricStrip>
          </div>
        </section>

        {/* One column, the way the artboard has it: the attributes, a rule,
          * then everything about the selected skill, then the formula pinned
          * to the bottom. */}
        <aside
          data-testid="skill-tree-detail-pane"
          className="flex min-w-0 flex-col bg-bg-deep md:min-h-0 md:overflow-y-auto"
        >
          <div className="px-[22px] pt-[18px]">
            <span className="eyebrow text-ink-3">Attributes</span>
            <div className="mx-auto mt-1.5 flex max-w-[240px] justify-center">
              <Radar axes={attributes.map((a) => ({ label: a.name, value: a.level }))} size={200} />
            </div>
          </div>

          <div className="mx-[22px] mt-3.5 border-t border-rule pt-4">
            {!stat ? (
              <EmptyState headline="Nothing selected">
                Click a skill in the constellation to see its XP, the events behind it, and the
                keywords that classify to it.
              </EmptyState>
            ) : (
              <div className="space-y-4" aria-busy={pending}>
                <div>
                  <span className="eyebrow text-ink-3">{path ?? (isRoot ? 'Character' : 'Attribute')}</span>
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
                <MetricStrip className="grid-cols-3 sm:grid-cols-3">
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
                </MetricStrip>

                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="eyebrow text-ink-3">XP &middot; 90 days</span>
                    <span className="num text-[11px] text-ink-3">weekly</span>
                  </div>
                  <div className="mt-2">
                    <WeeklyBars weeks={weeks} />
                  </div>
                </div>

                {children.length > 0 && (
                  <div>
                    <span className="eyebrow text-ink-3">{isRoot ? 'Attributes' : 'Children'}</span>
                    <RowList className="mt-1.5">
                      {children.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelected(c.id)}
                          className={cn(ROW, 'flex w-full items-center justify-between gap-3 text-left')}
                        >
                            <span className="text-[13px] text-ink">{c.name}</span>
                            {/* The artboard's two figures: what it gained this
                              * month, then where it stands. */}
                            <span className="flex shrink-0 items-baseline gap-3">
                              <span
                                className={`num text-[11px] ${c.gained30d > 0 ? 'text-ok' : 'text-warn'}`}
                              >
                                {c.gained30d > 0 ? `+${round(c.gained30d)} / 30d` : 'idle'}
                              </span>
                              <span className="num text-[12px] text-ink">Lv {c.level}</span>
                            </span>
                        </button>
                      ))}
                    </RowList>
                    <p className="mt-2 text-[11px] text-ink-4">
                      Drop an event here to reassign it to that skill.
                    </p>
                  </div>
                )}

                {/* A leaf lists its events; so does You, across every skill,
                  * which is the month in one column. An attribute lists its
                  * children instead. */}
                {(children.length === 0 || isRoot) && (
                  <>
                    <div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="eyebrow text-ink-3">Events &middot; 30 days</span>
                        <span className="num text-[11px] text-ink-3">
                          {recent.length > EVENT_ROWS
                            ? `latest ${EVENT_ROWS} of ${recent.length}`
                            : recent.length}{' '}
                          &middot; drag to reassign
                        </span>
                      </div>
                      {recent.length === 0 ? (
                        <p className="mt-2 text-[12px] text-ink-3">
                          No events linked in 30 days. Finish a task, note, or workout that matches
                          a keyword below.
                        </p>
                      ) : (
                        // Capped in rows as well as height. A busy month is a
                        // hundred rows; the seed's is five thousand, and every
                        // hover on the constellation paid to lay them out
                        // (105ms to first paint against 35ms with a hundred).
                        <RowList className="mt-1.5">
                          <ul className="max-h-[420px] overflow-y-auto">
                            {recent.slice(0, EVENT_ROWS).map((e) => (
                              <EventRow key={`${e.entityRef}-${e.skillId}-${e.occurredAt}`} event={e} now={now} />
                            ))}
                          </ul>
                        </RowList>
                      )}
                    </div>

                    {!isRoot && (
                      <div>
                        <span className="eyebrow text-ink-3">Keywords &middot; skills.yaml</span>
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
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <p className="mt-auto px-[22px] pb-[22px] pt-3.5 text-[11px] text-ink-4">
            Level = &radic;(XP &divide; 100). Parent XP is the sum of its children.
          </p>
        </aside>
      </div>
    </div>
  )
}

/** The leaf that gained most in 30 days, for the first open. */
function topLeaf(data: SkillTreeData): string | undefined {
  const parents = new Set(data.stats.map((s) => s.parent).filter(Boolean))
  const leaves = data.stats.filter((s) => !parents.has(s.id))
  const best = [...leaves].sort((a, b) => b.gained30d - a.gained30d)[0]
  return best && best.gained30d > 0 ? best.id : (data.stats.find((s) => !s.parent)?.id ?? leaves[0]?.id)
}

/** One cell of the metric strip under the name. */
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
    <div className="px-3 py-2.5">
      <dt className="eyebrow text-ink-3">{label}</dt>
      <dd
        className={`num mt-1.5 text-[15px] ${tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-ink'}`}
      >
        {value}
      </dd>
    </div>
  )
}

/** "1d", "13d": the artboard's when column. */
function ago(iso: string, now: number): string {
  const days = Math.max(0, Math.floor((now - Date.parse(iso)) / DAY))
  return `${days}d`
}

function EventRow({ event, now }: { event: SkillEvent; now: number }) {
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', `${event.entityRef}|${event.skillId}`)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(ROW, 'flex cursor-grab items-center gap-2.5 active:cursor-grabbing')}
    >
      <span className="num w-[34px] shrink-0 text-[11px] text-ink-3">{ago(event.occurredAt, now)}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] text-ink">{event.title}</div>
        <div className="mt-px text-[11px] text-ink-3">
          {event.eventType.replace(/_/g, ' ')} · {event.isManual ? 'manual' : event.classifiedBy}
        </div>
      </div>
      <span className="num shrink-0 text-[11px] text-ok">+{Math.round(event.xp)}</span>
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

/** The row shape from Row.tsx, for a list item that is its own button. */
const ROW =
  'relative px-4 py-2.5 transition-colors duration-150 ease-[var(--ease)] hover:bg-glass-strong ' +
  'before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-rule first:before:hidden'

/** One of the four summary columns under the canvas. */
function Column({
  label,
  tone = 'ok',
  children,
}: {
  label: string
  /** The artboard colours each column's head: gains in the accent, idleness in amber. */
  tone?: 'ok' | 'warn'
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <h2 className={cn('text-[13px] font-semibold leading-tight', tone === 'warn' ? 'text-warn' : 'text-ink')}>
        {label}
      </h2>
      <div className="mt-2 flex flex-col gap-1">{children}</div>
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
      className="flex w-full min-w-0 items-baseline justify-between gap-2 text-left text-ink transition-colors duration-150 hover:text-brand"
    >
      <span className="truncate text-[12px]">{name}</span>
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
