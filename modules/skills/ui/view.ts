import { VIEW_H, VIEW_W } from './layout'

// The constellation's view: the group is scale(zoom) translate(pan). Pure, so
// the wheel handler and its tests share one piece of arithmetic.

export const ZOOM_MIN = 0.4
export const ZOOM_MAX = 3

export type View = { zoom: number; pan: { x: number; y: number } }

/**
 * The pointer in viewBox units, and the pixels-per-unit that got it there.
 *
 * The svg is fitted xMidYMid meet, so the viewBox is scaled by the *smaller*
 * side and centred in the larger one. Dividing by the width alone, which is
 * what the pan used to do, makes a drag move the canvas at the wrong rate on
 * any box that is not square, and this one never is.
 */
export function viewPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const box = svg.getBoundingClientRect()
  const scale = Math.min(box.width / VIEW_W, box.height / VIEW_H)

  return {
    scale,
    x: (clientX - box.left - (box.width - VIEW_W * scale) / 2) / scale - VIEW_W / 2,
    y: (clientY - box.top - (box.height - VIEW_H * scale) / 2) / scale - VIEW_H / 2,
  }
}

/**
 * One wheel event applied to the view, anchored on the cursor.
 *
 * Exponential in the delta, so a step is symmetric: in then out returns
 * exactly where you were, which z * 1.1 and z * 0.9 do not (they compound to
 * 0.99 and drift smaller). Proportional too, so a trackpad's many small
 * deltas and a wheel's few large ones cover the same ground.
 */
export function zoomStep(
  view: View,
  deltaY: number,
  deltaMode: number,
  at: { x: number; y: number },
): View {
  const lines = deltaMode === 1 ? 16 : 1
  return zoomBy(view, Math.exp(-deltaY * lines * 0.0015), at)
}

/** The view zoomed by a factor about a point, clamped. Double-click uses 1.5. */
export function zoomBy(view: View, factor: number, at: { x: number; y: number }): View {
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, view.zoom * factor))
  if (next === view.zoom) return view

  // The group is scale(z) translate(p), so the point under the pointer holds
  // still when p moves by c(1/z' - 1/z).
  const shift = 1 / next - 1 / view.zoom
  return { zoom: next, pan: { x: view.pan.x + at.x * shift, y: view.pan.y + at.y * shift } }
}

/**
 * How much bigger a label is drawn as you zoom in.
 *
 * Labels live inside the scaled group, so at zoom 2 they would double with
 * everything else and the tree would read as one word per screen. The
 * artboard scales text by scale^0.7 against a viewBox, which comes out here
 * as zoom^-0.7: on screen a label still grows, but by a third of the zoom
 * rather than all of it.
 */
export function labelScale(zoom: number): number {
  return Math.min(1.6, Math.max(0.6, Math.pow(1 / zoom, 0.7)))
}
