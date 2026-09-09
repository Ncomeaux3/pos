'use client'

import { useState } from 'react'
import { graticule, project, visible, type Rotation } from '../globe'

// A wireframe globe with a dot per place. Drag to spin it.
//
// No d3, no topojson, no world-atlas: see the note in ../globe.ts. The dots are
// the information and the sphere is context for them.

export type Place = { id: string; name: string; country: string; lat: number; lon: number }

const R = 100

export function Globe({ places, onPick }: { places: Place[]; onPick?: (id: string) => void }) {
  // Start looking at the middle of where the owner has actually been, so a
  // globe of European trips does not open on the Pacific.
  const [rotation, setRotation] = useState<Rotation>(() => {
    if (places.length === 0) return { lambda: 0, phi: -20 }
    const meanLon = places.reduce((sum, p) => sum + p.lon, 0) / places.length
    const meanLat = places.reduce((sum, p) => sum + p.lat, 0) / places.length
    return { lambda: -meanLon, phi: -meanLat }
  })

  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null)

  const spin = (e: React.PointerEvent) => {
    if (!dragging) return
    setRotation((r) => ({
      lambda: r.lambda + (e.clientX - dragging.x) * 0.5,
      // Clamped, so the globe cannot be tipped past its pole and turn upside
      // down, which is disorienting and has no useful view on the other side.
      phi: Math.max(-90, Math.min(90, r.phi - (e.clientY - dragging.y) * 0.5)),
    }))
    setDragging({ x: e.clientX, y: e.clientY })
  }

  const near = places.filter((p) => visible(p.lon, p.lat, rotation))

  return (
    <svg
      viewBox={`${-R - 4} ${-R - 4} ${(R + 4) * 2} ${(R + 4) * 2}`}
      role="img"
      aria-label={`Globe showing ${places.length} places visited`}
      onPointerDown={(e) => {
        setDragging({ x: e.clientX, y: e.clientY })
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={spin}
      onPointerUp={() => setDragging(null)}
      onPointerCancel={() => setDragging(null)}
      className="w-full max-w-[420px] cursor-grab touch-none active:cursor-grabbing"
    >
      <circle cx={0} cy={0} r={R} fill="var(--bg-deep)" stroke="var(--rule-2)" strokeWidth={1} />

      {graticule(rotation).map((d, i) => (
        <path
          key={i}
          // The path comes out in the unit circle, so one scale puts it here.
          transform={`scale(${R})`}
          d={d}
          fill="none"
          stroke="var(--rule-2)"
          // vectorEffect makes the width screen pixels, ignoring the scale, so
          // this is 1px and not 1/R of one. With the divide it rendered at a
          // hundredth of a pixel, which is to say not at all.
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {near.map((place) => {
        const { x, y } = project(place.lon, place.lat, rotation)
        return (
          <g key={place.id}>
            <circle
              cx={x * R}
              cy={y * R}
              r={3}
              fill="var(--accent)"
              className={onPick ? 'cursor-pointer' : undefined}
              onClick={() => onPick?.(place.id)}
            >
              {/* One interpolated string, not two children. React renders two
                  JSX children as two text nodes, the server serialises them
                  into one, and the difference is a hydration mismatch. */}
              <title>{place.country ? `${place.name}, ${place.country}` : place.name}</title>
            </circle>
          </g>
        )
      })}
    </svg>
  )
}
