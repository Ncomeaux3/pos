import { describe, expect, it } from 'vitest'
import { flat, graticule, landPath, project, visible, type Rotation } from './globe'

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
