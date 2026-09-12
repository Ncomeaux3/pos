// An orthographic projection, hand rolled. No imports.
//
// The land is modules/travel/land.json, a few thousand points sampled once
// from Natural Earth by scripts/land-dots.mts and drawn here as a dot matrix,
// which is how POS Travel.dc.html draws the continents. d3-geo, topojson and
// world-atlas stay out of the bundle (2026-09-07); `project` is the function
// d3 would be replacing.

export type Rotation = {
  /** Degrees the globe is turned about its axis. Negative moves east into view. */
  lambda: number
  /** Degrees it is tilted. Positive brings the south into view. */
  phi: number
}

const RAD = Math.PI / 180

/**
 * Longitude and latitude to a point in the unit circle.
 *
 * Screen coordinates, so y grows downward and the north pole is negative. The
 * caller scales and centres; everything here stays in units of one radius so
 * the maths never has to know how big the drawing is.
 */
export function project(lon: number, lat: number, rotation: Rotation): { x: number; y: number } {
  const l = (lon + rotation.lambda) * RAD
  const p = lat * RAD
  const phi = rotation.phi * RAD

  const cosP = Math.cos(p)
  const x = cosP * Math.sin(l)
  const y = Math.cos(phi) * Math.sin(p) - Math.sin(phi) * cosP * Math.cos(l)

  return { x, y: -y }
}

/**
 * Whether a point is on the near side of the sphere.
 *
 * The z component of the same rotation. Zero is the exact silhouette, counted
 * as visible so a point sitting on the edge stays put rather than flickering as
 * a rounding error crosses the boundary.
 */
export function visible(lon: number, lat: number, rotation: Rotation): boolean {
  const l = (lon + rotation.lambda) * RAD
  const p = lat * RAD
  const phi = rotation.phi * RAD

  const z =
    Math.sin(phi) * Math.sin(p) + Math.cos(phi) * Math.cos(p) * Math.cos(l)
  return z >= 0
}

/**
 * The flat map: equirectangular into a 2 by 1 box, x in [-1, 1] and y in
 * [-0.5, 0.5], screen y down. `lambda` pans it the way it turns the globe.
 */
export function flat(lon: number, lat: number, rotation: Rotation): { x: number; y: number } {
  let l = lon + rotation.lambda
  while (l > 180) l -= 360
  while (l < -180) l += 360
  return { x: l / 180, y: -lat / 180 }
}

/**
 * The land as one SVG path: a zero-length dash per visible point, drawn with
 * round caps so each reads as a dot. One node however many points, which is
 * what keeps a drag smooth; a circle per point was thousands of elements a
 * frame.
 */
export function landPath(
  dots: [number, number][],
  rotation: Rotation,
  mode: 'globe' | 'flat',
): string {
  let d = ''
  for (const [lat, lon] of dots) {
    if (mode === 'globe' && !visible(lon, lat, rotation)) continue
    const { x, y } = mode === 'globe' ? project(lon, lat, rotation) : flat(lon, lat, rotation)
    d += `M${x.toFixed(4)},${y.toFixed(4)}h0`
  }
  return d
}

/** Degrees between grid lines. Ten would be a mesh, thirty is a globe. */
const STEP = 30

/** How finely a line is sampled. Small enough that a curve reads as a curve. */
const SAMPLE = 5

/**
 * The lat/lon grid, as SVG paths in the unit circle.
 *
 * A line that passes behind the sphere is broken rather than joined: connecting
 * the point where it disappears to the point where it returns would draw a
 * chord straight through the middle of the globe, which is the one artefact
 * that makes a wireframe look wrong rather than sparse.
 */
export function graticule(rotation: Rotation): string[] {
  const paths: string[] = []

  const trace = (points: [number, number][]) => {
    let d = ''
    let drawing = false

    for (const [lon, lat] of points) {
      if (!visible(lon, lat, rotation)) {
        drawing = false
        continue
      }
      const { x, y } = project(lon, lat, rotation)
      d += `${drawing ? 'L' : 'M'}${x.toFixed(4)},${y.toFixed(4)}`
      drawing = true
    }

    if (d.length > 0) paths.push(d)
  }

  // Meridians, pole to pole.
  for (let lon = -180; lon < 180; lon += STEP) {
    const points: [number, number][] = []
    for (let lat = -90; lat <= 90; lat += SAMPLE) points.push([lon, lat])
    trace(points)
  }

  // Parallels, all the way round.
  for (let lat = -60; lat <= 60; lat += STEP) {
    const points: [number, number][] = []
    for (let lon = -180; lon <= 180; lon += SAMPLE) points.push([lon, lat])
    trace(points)
  }

  return paths
}

/**
 * Cents per point, the one calculation SPEC asks this module for.
 *
 * Both prices come from the owner. SPEC is explicit that loyalty sites are not
 * scraped, so nothing here guesses what a point is worth: it divides what you
 * would have paid by what it would cost you, and the answer is only as good as
 * the two numbers put in.
 */
export function centsPerPoint(cashCents: number, points: number, feesCents = 0): number | null {
  if (points <= 0) return null
  return (cashCents - feesCents) / points
}

/** The globe's radius in viewBox units. The flat map is 2R wide by R tall. */
export const R = 100
export const ZOOM_MIN = 1
export const ZOOM_MAX = 8

/** How far in the drawing is and where it has been pushed: screen = t + zoom * world. */
export type View = { zoom: number; tx: number; ty: number }

/** Half the width and height of what the svg shows, in viewBox units. */
export type Half = { x: number; y: number }

/**
 * Zoom about a point given in viewBox units, so whatever is under the cursor
 * (or between two fingers) stays there rather than sliding toward the centre.
 */
export function zoomAt(view: View, factor: number, px: number, py: number, mode: 'globe' | 'flat', half: Half): View {
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, view.zoom * factor))
  const k = zoom / view.zoom
  return clampView({ zoom, tx: px - k * (px - view.tx), ty: py - k * (py - view.ty) }, mode, half)
}

/**
 * Keeps the drawing over the box: an edge of it may be pushed no further than
 * the box's own edge, so nothing blank is dragged into view. `half` is what
 * the svg shows, which on a tall phone is more than the flat map's own
 * height, since the viewBox is letterboxed rather than stretched.
 */
export function clampView(view: View, mode: 'globe' | 'flat', half: Half): View {
  const limitX = Math.max(0, (mode === 'globe' ? R : 2 * R) * view.zoom - half.x)
  const limitY = Math.max(0, R * view.zoom - half.y)
  return {
    zoom: view.zoom,
    tx: Math.max(-limitX, Math.min(limitX, view.tx)),
    ty: Math.max(-limitY, Math.min(limitY, view.ty)),
  }
}
