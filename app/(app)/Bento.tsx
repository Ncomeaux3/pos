'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useLongPress } from '@/components/pos/gestures'

// The dashboard grid, in the order this device likes it.
//
// The tiles themselves are server rendered and handed over as nodes: this
// component only decides what order they go in, which is the whole of what
// arranging is. Nothing about a tile's contents reaches the client because of
// it.

const KEY = 'pos.dashboard.order'

export type Tile = { id: string; node: ReactNode }

// The stored order is external state, so it is read through the hook meant for
// external state: the server snapshot is null, the browser's is whatever the
// string in localStorage is, and the first client render therefore matches the
// server's before swapping to the saved order.
const listeners = new Set<() => void>()

function subscribe(notify: () => void) {
  listeners.add(notify)
  window.addEventListener('storage', notify)
  return () => {
    listeners.delete(notify)
    window.removeEventListener('storage', notify)
  }
}

function raw(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    // A private window, or a browser with site data off. The default order is
    // a working dashboard, so this is not worth telling anyone about.
    return null
  }
}

function write(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, value)
  } catch {
    // Same as reading: the order is a convenience, not the dashboard.
  }
  for (const notify of listeners) notify()
}

function parse(value: string | null): string[] | null {
  try {
    const parsed = value ? JSON.parse(value) : null
    return Array.isArray(parsed) && parsed.every((x) => typeof x === 'string') ? parsed : null
  } catch {
    return null
  }
}

/**
 * The bento.
 *
 * `grid-auto-rows: minmax(200px, auto)` and auto-fit at 300px are the
 * artboard's: three columns at 1440, two at 1024, one on a phone, with every
 * tile in a row the height of the tallest.
 *
 * Arrange mode is `?arrange=1` rather than component state, so the button that
 * turns it on can live up in the header where the design puts it without a
 * context to carry the flag across the page.
 */
export function Bento({ tiles }: { tiles: Tile[] }) {
  const arranging = useSearchParams().get('arrange') === '1'
  const router = useRouter()
  // PosPhone's way in: hold a tile and the page enters the same arrange mode
  // the header link opens. Touch and pen only; see components/pos/gestures.
  const press = useLongPress(() => router.push('/?arrange=1'))

  const order = parse(useSyncExternalStore(subscribe, raw, () => null))
  const [dragging, setDragging] = useState<string | null>(null)

  const save = (next: string[]) => write(JSON.stringify(next))

  // The stored order names tiles that may no longer exist, and cannot know
  // about a module installed since. Known ids first in their saved order, then
  // everything new in the order the server sent it.
  const ids = tiles.map((t) => t.id)
  const sorted = order
    ? [...order.filter((id) => ids.includes(id)), ...ids.filter((id) => !order.includes(id))]
    : ids

  const move = (id: string, by: number) => {
    const from = sorted.indexOf(id)
    const to = Math.max(0, Math.min(sorted.length - 1, from + by))
    if (from === to) return
    const next = [...sorted]
    next.splice(to, 0, ...next.splice(from, 1))
    save(next)
  }

  const drop = (onto: string) => {
    if (!dragging || dragging === onto) return
    const next = sorted.filter((id) => id !== dragging)
    next.splice(sorted.indexOf(onto), 0, dragging)
    save(next)
    setDragging(null)
  }

  return (
    // The artboard: the grid sits 22px under the headline block, and in
    // arrange mode the banner takes 18px of that and the grid 22px more.
    <div className="mt-[22px]">
      {arranging && (
        <div className="-mt-1 mb-[22px] flex flex-wrap items-center justify-between gap-3 border border-dashed border-brand px-3.5 py-2.5 text-[12px] text-ink-2">
          <span>
            Arrange mode: <span className="max-md:hidden">drag tiles, or </span>use ‹ › on each. Order
            is saved on this device.
          </span>
          <button
            type="button"
            onClick={() => write(null)}
            className="text-[12px] text-ink-3 hover:text-ink"
          >
            Reset to default
          </button>
        </div>
      )}

      <div
        data-testid="dashboard-bento"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] content-start gap-3.5 [grid-auto-rows:minmax(200px,auto)]"
      >
        {sorted.map((id) => {
          const tile = tiles.find((t) => t.id === id)
          if (!tile) return null

          return (
            <div
              key={id}
              {...(arranging ? {} : press)}
              draggable={arranging}
              onDragStart={() => setDragging(id)}
              onDragOver={(e) => arranging && e.preventDefault()}
              onDrop={() => drop(id)}
              className={cn(
                'flex min-w-0 flex-col',
                arranging && 'cursor-grab',
                dragging === id && 'opacity-60',
              )}
            >
              {arranging && (
                <div className="flex items-center justify-between border border-b-0 border-brand bg-brand-soft px-2 py-1">
                  <button
                    type="button"
                    aria-label={`Move ${id} earlier`}
                    onClick={() => move(id, -1)}
                    className="px-1 text-ink-2 hover:text-ink"
                  >
                    ‹
                  </button>
                  <span className="label text-[10px] tracking-[0.08em] text-ink-3">Drag</span>
                  <button
                    type="button"
                    aria-label={`Move ${id} later`}
                    onClick={() => move(id, 1)}
                    className="px-1 text-ink-2 hover:text-ink"
                  >
                    ›
                  </button>
                </div>
              )}
              {tile.node}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The header's Arrange toggle. A link, because the mode lives in the URL. */
export function ArrangeToggle() {
  const arranging = useSearchParams().get('arrange') === '1'

  return (
    <Link
      href={arranging ? '/' : '/?arrange=1'}
      className={cn(
        // 12px in 8px 12px, and filled accent while arranging, as drawn.
        'inline-flex h-11 shrink-0 items-center border px-3 text-[12px] transition-colors duration-150 sm:h-[33px]',
        arranging
          ? 'border-brand bg-brand text-bg'
          : 'border-rule-2 text-ink-2 hover:border-ink hover:text-ink',
      )}
    >
      {arranging ? 'Done' : 'Arrange'}
    </Link>
  )
}
