// Which way a drag went, and whether a hold was a long press. No imports and
// no React: the gesture logic is decided
// here so it can be tested, and the hook that listens for pointer events lives
// in components/pos/gestures.ts.

export type Swipe = 'left' | 'right' | 'down' | null

/** Below this a swipe is a tap with a shaky thumb. */
export const MIN_DISTANCE = 56

/**
 * Which way a drag went, if it went anywhere.
 *
 * The dominant axis decides, so a diagonal drag reads as whichever it mostly
 * was. This is what keeps a horizontal swipe from firing while the page is
 * being scrolled: a scroll is mostly vertical, and vertical is only a gesture
 * when it starts at the top of the page.
 */
export function swipeOf(
  dx: number,
  dy: number,
  options: { allowDown?: boolean; minDistance?: number } = {},
): Swipe {
  const min = options.minDistance ?? MIN_DISTANCE

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (Math.abs(dx) < min) return null
    return dx < 0 ? 'left' : 'right'
  }

  if (!options.allowDown) return null
  return dy >= min ? 'down' : null
}

/**
 * Whether a pull down should count as a pull to sync.
 *
 * Only from the very top of the page. Anywhere else a downward drag is a scroll
 * back up, and hijacking that would make the page feel broken.
 */
export function atTop(scrollY: number): boolean {
  return scrollY <= 4
}

/** PosPhone's timer: a tile held this long enters arrange mode. */
export const LONG_PRESS_MS = 480

/** A finger that moved further than this on either axis is scrolling. */
export const LONG_PRESS_SLOP = 10

/**
 * Whether a hold counts as a long press.
 *
 * Long enough, and still. The stillness is what keeps a slow scroll that
 * started on a tile from flipping the dashboard into arrange mode.
 */
export function isLongPress(heldMs: number, dx: number, dy: number): boolean {
  return heldMs >= LONG_PRESS_MS && Math.abs(dx) < LONG_PRESS_SLOP && Math.abs(dy) < LONG_PRESS_SLOP
}

/**
 * The strip along the left edge that belongs to swipe-back.
 *
 * A swipe that starts here is never a segment change or a task completion. An
 * installed PWA on iOS has no browser edge gesture of its own, so the app draws
 * the back control and, from Phase 2, owns the drag that mirrors it.
 */
export const EDGE_PX = 20

export function fromEdge(x: number): boolean {
  return x <= EDGE_PX
}

/** How far a drag from the edge travels before it is a request to go back. */
export const EDGE_BACK_PX = 90

/**
 * Whether a drag that started at `startX` and travelled (dx, dy) is swipe-back.
 *
 * From the edge strip, mostly horizontal, and past 90px: a shorter drag is a
 * finger that brushed the edge on its way to something else.
 */
export function edgeBack(startX: number, dx: number, dy: number): boolean {
  return fromEdge(startX) && swipeOf(dx, dy, { minDistance: EDGE_BACK_PX }) === 'right'
}
