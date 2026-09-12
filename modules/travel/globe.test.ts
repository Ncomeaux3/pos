import { describe, expect, it } from 'vitest'
import { R, ZOOM_MAX, clampView, flat, graticule, landPath, project, visible, zoomAt, type Rotation } from './globe'

// An orthographic projection, hand rolled.
//
// The alternative was d3-geo plus topojson plus a 100kB world-atlas data file,
// which the plan budgeted for. It buys coastlines. The dots are the
// information and the globe is context for them, so this draws a graticule
// instead and costs no dependency and no download.

const NONE: Rotation = { lambda: 0, phi: 0 }

describe('project', () => {
  it('puts the point facing the viewer at the centre', () => {
    const p = project(0, 0, NONE)
    // Close to, not equal to: negating a zero gives -0, and Object.is
    // distinguishes the two even though nothing that draws a pixel does.
    expect(p.x).toBeCloseTo(0, 6)
    expect(p.y).toBeCloseTo(0, 6)
  })

  it('puts the north pole at the top', () => {
    // Screen y grows downward, so the pole is negative.
    const p = project(0, 90, NONE)
    expect(p.x).toBeCloseTo(0, 6)
    expect(p.y).toBeCloseTo(-1, 6)
  })

  it('puts a quarter turn east on the right edge', () => {
    const p = project(90, 0, NONE)
    expect(p.x).toBeCloseTo(1, 6)
    expect(p.y).toBeCloseTo(0, 6)
  })

  it('keeps every visible point inside the unit circle', () => {
    for (let lon = -180; lon <= 180; lon += 17) {
      for (let lat = -90; lat <= 90; lat += 13) {
        const p = project(lon, lat, NONE)
        expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(1.0000001)
      }
    }
  })

  it('rotates, so spinning the globe moves what faces you', () => {
    // Rotate the globe 90 degrees and the point that was on the right edge is
    // now facing the viewer.
    const centred = project(90, 0, { lambda: -90, phi: 0 })
    expect(centred.x).toBeCloseTo(0, 6)
    expect(centred.y).toBeCloseTo(0, 6)
  })
})

describe('visible', () => {
  it('hides the far side of the globe', () => {
    // The antipode of the point facing you is behind the sphere.
    expect(visible(0, 0, NONE)).toBe(true)
    expect(visible(180, 0, NONE)).toBe(false)
    expect(visible(91, 0, NONE)).toBe(false)
  })

  it('counts the exact edge as visible rather than flickering there', () => {
    expect(visible(90, 0, NONE)).toBe(true)
  })

  it('follows the rotation', () => {
    expect(visible(180, 0, { lambda: -180, phi: 0 })).toBe(true)
    expect(visible(0, 0, { lambda: -180, phi: 0 })).toBe(false)
  })
})

describe('graticule', () => {
  it('draws meridians and parallels', () => {
    const lines = graticule(NONE)
    expect(lines.length).toBeGreaterThan(8)
    // Every path is a real polyline, not an empty string.
    expect(lines.every((d) => d.startsWith('M') && d.length > 10)).toBe(true)
  })

  it('breaks a line rather than drawing it across the sphere', () => {
    // The case that matters is a rotation putting the antimeridian in view: a
    // parallel is then visible at both ends of the sampled range and hidden in
    // the middle. Joining those two runs would draw a chord straight through
    // the globe, which is the one artefact that makes a wireframe look broken.
    //
    // Unrotated there is nothing to break: the visible hemisphere is a single
    // contiguous run of longitudes, so every line is one stroke.
    const seam = graticule({ lambda: -180, phi: 0 })
    expect(seam.some((d) => d.lastIndexOf('M') > 0)).toBe(true)
    expect(graticule(NONE).every((d) => d.lastIndexOf('M') === 0)).toBe(true)
  })
})

describe('flat and landPath', () => {
  it('flat puts the equator on the middle line and wraps the antimeridian', () => {
    expect(flat(0, 0, { lambda: 0, phi: 0 })).toEqual({ x: 0, y: -0 })
    expect(flat(90, 0, { lambda: 0, phi: 0 }).x).toBeCloseTo(0.5)
    expect(flat(170, 0, { lambda: 20, phi: 0 }).x).toBeCloseTo(-170 / 180)
    expect(flat(0, 45, { lambda: 0, phi: 0 }).y).toBeCloseTo(-0.25)
  })

  it('landPath draws a dash per visible point and all of them flat', () => {
    const dots: [number, number][] = [
      [0, 0],
      [0, 180],
    ]
    const front = { lambda: 0, phi: 0 }
    expect(landPath(dots, front, 'globe').match(/M/g)?.length).toBe(1)
    expect(landPath(dots, front, 'flat').match(/M/g)?.length).toBe(2)
  })
})

describe('zoomAt', () => {
  const home = { zoom: 1, tx: 0, ty: 0 }
  // The globe's box, R plus a 4 unit margin each way.
  const box = { x: R + 4, y: R + 4 }

  it('keeps the point under the cursor where it was', () => {
    const v = zoomAt(home, 2, 50, -20, 'globe', box)
    expect(v.zoom).toBe(2)
    // screen = t + zoom * world, and the cursor's world point was (50, -20).
    expect(v.tx + v.zoom * 50).toBeCloseTo(50)
    expect(v.ty + v.zoom * -20).toBeCloseTo(-20)
  })

  it('stays between 1x and 8x and sits home at 1x', () => {
    expect(zoomAt(home, 100, 30, 30, 'globe', box).zoom).toBe(ZOOM_MAX)
    expect(zoomAt({ zoom: 3, tx: -40, ty: 10 }, 0.01, 30, 30, 'globe', box)).toEqual(home)
  })

  it('never pans an edge of the drawing past the edge of the box', () => {
    // Zooming toward the corner would push the globe out of view: at 2x it
    // is 200 across and the box shows 104 each way, so 96 is as far as it goes.
    const v = zoomAt(home, 2, R + 4, R + 4, 'globe', box)
    expect(v.tx).toBe(-96)
    expect(v.ty).toBe(-96)
    // A phone shows the flat map letterboxed: the box is taller than the map,
    // so at 2x only the extra height may be dragged, and at 1x nothing.
    const phone = { x: 2 * R, y: 1.8 * R }
    expect(clampView({ zoom: 2, tx: -999, ty: -999 }, 'flat', phone)).toEqual({ zoom: 2, tx: -2 * R, ty: -20 })
    expect(clampView({ zoom: 1, tx: 0, ty: -50 }, 'flat', phone).ty).toBeCloseTo(0)
  })
})
