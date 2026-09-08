'use client'

import { useMemo, useRef, useState } from 'react'
import type { SkillStat } from '../data'
import type { SkillNode } from '../tree'
import { layout, nodeRadius, ROOT_ID, type Placed } from './layout'

// Obsidian style, but placed rather than simulated: see ./layout.ts.

const VIEW = 900
const ZOOM_MIN = 0.4
const ZOOM_MAX = 3

export type Tone = 'gaining' | 'active' | 'stagnant'

/** Gaining beats stagnant: a skill worked on this month is not stagnant. */
export function toneFor(stat: SkillStat | undefined, now: number): Tone {
  if (!stat) return 'stagnant'
  if (stat.gained30d > 0) return 'gaining'
  if (!stat.lastEventAt) return 'stagnant'
  return Date.parse(stat.lastEventAt) > now - 60 * 24 * 60 * 60 * 1000 ? 'active' : 'stagnant'
}

const TONE_FILL: Record<Tone, string> = {
  gaining: 'var(--accent)',
  active: 'var(--ink-2)',
  stagnant: 'var(--ink-3)',
}

export function Constellation({
  nodes,
  stats,
  selected,
  onSelect,
  characterLevel,
  now,
  onReassign,
}: {
  nodes: SkillNode[]
  stats: SkillStat[]
  selected: string | null
  onSelect: (id: string | null) => void
  characterLevel: number
  /** From the server. A clock read during render is impure and unstable. */
  now: number
  onReassign?: (entityRef: string, fromSkillId: string, toSkillId: string) => void
}) {
  const placed = useMemo(() => layout(nodes), [nodes])
  const statById = useMemo(() => new Map(stats.map((s) => [s.id, s])), [stats])

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hover, setHover] = useState<Placed | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const edges = placed.filter((p) => p.id !== ROOT_ID)
  const positionOf = (id: string) => placed.find((p) => p.id === id)

  const reset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const hovered = hover ? statById.get(hover.id) : undefined

  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button type="button" onClick={reset} className="eyebrow rounded-[8px] border border-rule px-2 py-1 text-ink-2 hover:text-ink">
          Reset view
        </button>
      </div>

      <svg
        role="img"
        aria-label="Skill constellation"
        viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
        className="h-[min(70vh,620px)] w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onWheel={(e) => {
          setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * (e.deltaY < 0 ? 1.1 : 0.9))))
        }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const scale = VIEW / e.currentTarget.getBoundingClientRect().width / zoom
          setPan({
            x: drag.current.panX + (e.clientX - drag.current.x) * scale,
            y: drag.current.panY + (e.clientY - drag.current.y) * scale,
          })
        }}
        onPointerUp={() => {
          drag.current = null
        }}
        onDoubleClick={() => setZoom((z) => Math.min(ZOOM_MAX, z * 1.5))}
      >
        <g transform={`scale(${zoom}) translate(${pan.x} ${pan.y})`}>
          {edges.map((node) => {
            const from = positionOf(node.parent ?? ROOT_ID)
            if (!from) return null
            return (
              <line
                key={`edge-${node.id}`}
                x1={from.x}
                y1={from.y}
                x2={node.x}
                y2={node.y}
                stroke="var(--rule)"
                strokeWidth={node.ring === 'leaf' ? 0.6 : 1.1}
              />
            )
          })}

          {placed.map((node) => {
            const stat = statById.get(node.id)
            const isRoot = node.id === ROOT_ID
            const level = isRoot ? characterLevel : (stat?.level ?? 0)
            const r = nodeRadius(node.ring, level)
            const tone = isRoot ? 'gaining' : toneFor(stat, now)
            const isSelected = selected === node.id
            const isDrop = dropTarget === node.id

            return (
              <g
                key={node.id}
                transform={`translate(${node.x} ${node.y})`}
                onPointerEnter={() => setHover(node)}
                onPointerLeave={() => setHover((h) => (h?.id === node.id ? null : h))}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!isRoot) onSelect(isSelected ? null : node.id)
                }}
                onDragOver={(e) => {
                  if (isRoot || !onReassign) return
                  e.preventDefault()
                  setDropTarget(node.id)
                }}
                onDragLeave={() => setDropTarget((t) => (t === node.id ? null : t))}
                onDrop={(e) => {
                  e.preventDefault()
                  setDropTarget(null)
                  if (isRoot || !onReassign) return
                  const payload = e.dataTransfer.getData('text/plain')
                  const [entityRef, fromSkillId] = payload.split('|')
                  if (entityRef && fromSkillId && fromSkillId !== node.id) {
                    onReassign(entityRef, fromSkillId, node.id)
                  }
                }}
                className="cursor-pointer"
              >
                {(isSelected || isDrop) && (
                  <circle r={r + 7} fill="none" stroke="var(--accent)" strokeWidth={isDrop ? 2 : 1.2} />
                )}
                <circle
                  r={r}
                  fill={isRoot ? 'var(--accent)' : TONE_FILL[tone]}
                  fillOpacity={tone === 'stagnant' ? 0.45 : 1}
                  stroke="var(--bg)"
                  strokeWidth={1.5}
                />
                {node.ring !== 'leaf' || zoom > 0.85 ? (
                  <text
                    y={r + 13}
                    textAnchor="middle"
                    className="pointer-events-none fill-ink-2"
                    style={{ fontSize: node.ring === 'leaf' ? 11 : 13, fontWeight: 500 }}
                  >
                    {isRoot ? `Lv ${characterLevel}` : (stat?.name ?? node.id)}
                  </text>
                ) : null}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 h-16">
        {hovered ? (
          <div className="rounded-[8px] border border-rule bg-surface px-3 py-2">
            <div className="text-[13px] font-medium text-ink">{hovered.name}</div>
            <div className="num text-[11px] text-ink-3">
              Lv {hovered.level} · {Math.round(hovered.xp)} XP
              {hovered.gained30d > 0 ? ` · +${Math.round(hovered.gained30d)} in 30d` : ''}
            </div>
          </div>
        ) : (
          <div className="eyebrow text-ink-3">
            Hover: details · Click: inspect · Scroll: zoom · Drag: pan
          </div>
        )}
      </div>
    </div>
  )
}
