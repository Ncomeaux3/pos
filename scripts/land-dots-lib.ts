// The arithmetic behind scripts/land-dots.mts, kept apart so it can be tested
// without fetching anything.

type Topology = {
  transform: { scale: [number, number]; translate: [number, number] }
  arcs: number[][][]
  objects: { land: { type: string; geometries?: unknown[]; arcs?: unknown } }
}

/** A ring is a closed list of [lon, lat]. */
export type Ring = [number, number][]

/** Decodes the topology's delta-encoded, quantised arcs into absolute rings. */
export function decodeTopology(topo: Topology): Ring[] {
  const { scale, translate } = topo.transform
  const arcs = topo.arcs.map((arc) => {
    let x = 0
    let y = 0
    return arc.map(([dx, dy]) => {
      x += dx
      y += dy
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as [number, number]
    })
  })
  const geometries: { type: string; arcs: unknown }[] = (
    topo.objects.land.geometries ?? [topo.objects.land]
  ) as { type: string; arcs: unknown }[]

  const ring = (indexes: number[]): Ring => {
    const out: Ring = []
    for (const i of indexes) {
      const arc = i < 0 ? [...arcs[~i]].reverse() : arcs[i]
      // Consecutive arcs share their end point.
      out.push(...(out.length > 0 ? arc.slice(1) : arc))
    }
    return out
  }

  const rings: Ring[] = []
  for (const g of geometries) {
    if (g.type === 'Polygon') for (const r of g.arcs as number[][]) rings.push(ring(r))
    if (g.type === 'MultiPolygon')
      for (const poly of g.arcs as number[][][]) for (const r of poly) rings.push(ring(r))
  }
  return rings
}

/**
 * Even-odd point in polygon over every ring: land polygons and their lake
 * holes both count, and a point inside an odd number of rings is on land.
 */
export function pointInRings(lat: number, lon: number, rings: Ring[]): boolean {
  let inside = false
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i]
      const [xj, yj] = r[j]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
    }
  }
  return inside
}

/**
 * A grid a degree and a half apart in latitude, spaced by cos(lat) in longitude so the
 * dots stay evenly spread on the sphere rather than bunching at the poles.
 * Antarctica is skipped below 60S: the artboard's globe does not draw it and
 * it would be a solid band on a flat map.
 */
export function sampleLand(rings: Ring[], step = 1.5): [number, number][] {
  const dots: [number, number][] = []
  for (let lat = -60; lat <= 84; lat += step) {
    const stride = step / Math.max(0.2, Math.cos((lat * Math.PI) / 180))
    for (let lon = -180; lon < 180; lon += stride) {
      if (pointInRings(lat, lon, rings)) dots.push([Math.round(lat * 10) / 10, Math.round(lon * 10) / 10])
    }
  }
  return dots
}
