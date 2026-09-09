// An orthographic projection, hand rolled. No imports.
//
// ponytail: graticule instead of coastlines. The plan budgeted for d3-geo,
// topojson-client and a ~100kB world-atlas file, which buy country outlines.
// The dots are the information here and the sphere is context for them, so this
// draws a lat/lon grid and costs nothing. If coastlines ever matter, that is
// where the dependency goes, and `project` is already the function d3 would be
// replacing.

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
