'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import land from '../land.json'
import { flat, graticule, landPath, project, visible, type Rotation } from '../globe'

// The globe, as POS Travel.dc.html draws it: the continents as a dot matrix,
// a pin per place coloured by what it is, the legend bottom left, the four
// controls bottom right and an alert top right when there is one. Drag to
// rotate (or pan, flat), scroll or the buttons to zoom, ⟲ to reset, FLAT to
// unroll it, double-click a pin to fly to it.
//
// No d3, no topojson, no world-atlas: see ../globe.ts.

export type PinKind = 'upcoming' | 'past' | 'wishlist'
export type Pin = { id: string; name: string; country: string; lat: number; lon: number; kind: PinKind }

const R = 100
const DOTS = land as [number, number][]
const ZOOM_MIN = 1
const ZOOM_MAX = 4

export function Globe({
  pins,
  onPick,
  alert,
  className,
}: {
  pins: Pin[]
  onPick?: (id: string) => void
  /** The band top right: an unread travel notification, or nothing. */
  alert?: ReactNode
  className?: string
}) {
  // Start looking at the middle of where the pins are, so a globe of European
  // trips does not open on the Pacific.
  const home = (): Rotation => {
    if (pins.length === 0) return { lambda: 98, phi: -25 }
    const meanLon = pins.reduce((sum, p) => sum + p.lon, 0) / pins.length
    const meanLat = pins.reduce((sum, p) => sum + p.lat, 0) / pins.length
    return { lambda: -meanLon, phi: -meanLat }
  }
  const [rotation, setRotation] = useState<Rotation>(home)
  const [zoom, setZoom] = useState(1)
  const [mode, setMode] = useState<'globe' | 'flat'>('globe')
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null)

  const drag = (e: React.PointerEvent) => {
    if (!dragging) return
    const speed = 0.5 / zoom
    setRotation((r) => ({
      lambda: r.lambda + (e.clientX - dragging.x) * speed,
      // Clamped, so the globe cannot be tipped past its pole. Flat ignores it.
      phi: mode === 'globe' ? Math.max(-90, Math.min(90, r.phi - (e.clientY - dragging.y) * speed)) : r.phi,
    }))
    setDragging({ x: e.clientX, y: e.clientY })
  }

  const zoomBy = (factor: number) => setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * factor)))
  const reset = () => {
    setRotation(home())
    setZoom(1)
  }
  const flyTo = (pin: Pin) => {
    setRotation({ lambda: -pin.lon, phi: mode === 'globe' ? -pin.lat : 0 })
    setZoom(2)
  }

  const place = (p: Pin) => (mode === 'globe' ? project(p.lon, p.lat, rotation) : flat(p.lon, p.lat, rotation))
  const shown = mode === 'globe' ? pins.filter((p) => visible(p.lon, p.lat, rotation)) : pins
  const box = mode === 'globe' ? `${-R - 4} ${-R - 4} ${(R + 4) * 2} ${(R + 4) * 2}` : `${-R * 2} ${-R} ${R * 4} ${R * 2}`

  return (
    <div className={cn('relative h-full w-full', className)}>
      <svg
        viewBox={box}
        role="img"
        aria-label={`Globe showing ${pins.length} places`}
        onPointerDown={(e) => {
          setDragging({ x: e.clientX, y: e.clientY })
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={drag}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2)}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
      >
        <g transform={`scale(${zoom})`}>
          {mode === 'globe' ? (
            <>
              <circle cx={0} cy={0} r={R} fill="var(--bg-deep)" stroke="var(--rule-2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              {graticule(rotation).map((d, i) => (
                <path key={i} transform={`scale(${R})`} d={d} fill="none" stroke="var(--rule)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ))}
            </>
          ) : (
            <rect x={-R * 2} y={-R} width={R * 4} height={R * 2} fill="var(--bg-deep)" stroke="var(--rule-2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}

          {/* The land: one path, a dot per point, in the unit box scaled up. */}
          <path
            data-land
            transform={`scale(${mode === 'globe' ? R : R * 2})`}
            d={landPath(DOTS, rotation, mode)}
            fill="none"
            stroke="var(--ink-4)"
            strokeOpacity={0.9}
            strokeWidth={1.4}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {shown.map((pin) => {
            const { x, y } = place(pin)
            const s = mode === 'globe' ? R : R * 2
            const cx = x * s
            const cy = y * s
            const title = pin.country ? `${pin.name}, ${pin.country}` : pin.name
            return (
              <g
                key={pin.id}
                data-pin={pin.kind}
                className={onPick ? 'cursor-pointer' : undefined}
                onClick={() => onPick?.(pin.id)}
                onDoubleClick={() => flyTo(pin)}
              >
                <title>{title}</title>
                {pin.kind === 'wishlist' ? (
                  <circle cx={cx} cy={cy} r={3.5 / zoom} fill="none" stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
                ) : (
                  <circle cx={cx} cy={cy} r={(pin.kind === 'upcoming' ? 4 : 3.5) / zoom} fill={pin.kind === 'upcoming' ? 'var(--accent)' : 'var(--ink-3)'} />
                )}
                {pin.kind === 'upcoming' && (
                  <text x={cx + 7 / zoom} y={cy - 6 / zoom} fontSize={9 / zoom} letterSpacing={0.08 * (9 / zoom)} fill="var(--ink-2)" className="uppercase">
                    {pin.name}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {alert && <div className="absolute right-3 top-3 max-w-[min(360px,70%)]">{alert}</div>}

      <div className="pointer-events-none absolute bottom-2.5 left-3 flex flex-wrap gap-3.5 text-[10px] uppercase tracking-[0.06em] text-ink-3">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand" />Upcoming</span>
        <span className="flex items-center gap-1.5"><span className="size-[7px] rounded-full bg-ink-3" />Past</span>
        <span className="flex items-center gap-1.5"><span className="size-[7px] rounded-full border border-dashed border-ink-2" />Wishlist</span>
      </div>

      <div className="absolute bottom-2.5 right-3 flex gap-1">
        {(
          [
            ['+', 'Zoom in', () => zoomBy(1.4)],
            ['−', 'Zoom out', () => zoomBy(1 / 1.4)],
            ['⟲', 'Reset view', reset],
          ] as const
        ).map(([glyph, label, act]) => (
          <button key={label} type="button" aria-label={label} title={label} onClick={act} className={control}>
            {glyph}
          </button>
        ))}
        <button
          type="button"
          aria-label={mode === 'globe' ? 'Flat' : 'Globe'}
          title="Globe / flat"
          onClick={() => setMode((m) => (m === 'globe' ? 'flat' : 'globe'))}
          className={cn(control, 'label w-auto px-2 text-[10px] tracking-[0.08em]')}
        >
          {mode === 'globe' ? 'Flat' : 'Globe'}
        </button>
      </div>
    </div>
  )
}

const control =
  'grid size-[26px] place-items-center border border-rule-2 bg-bg text-[13px] text-ink-3 transition-colors duration-150 hover:border-ink hover:text-ink'
