'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { paletteSearch, type PaletteHit } from '@/app/(app)/search/actions'
import type { NavItem } from '@/core/nav'
import { cn } from '@/lib/utils'

// Cmd K anywhere in the app. Entities as you type, plus the Go to list, which
// is the nav the sidebar already builds rather than a second hardcoded copy.

type Row = { key: string; label: string; hint: string; go: string }

export function CommandPalette({ nav }: { nav: NavItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Stored with the query they answer, so a slow reply for an older query can
  // never paint over a newer one.
  const [hits, setHits] = useState<{ q: string; rows: PaletteHit[] }>({ q: '', rows: [] })
  const [cursor, setCursor] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    input.current?.focus()
  }, [open])

  // Debounced so a fast typist does not fire a query per keystroke.
  useEffect(() => {
    const q = query.trim()
    if (!open || q.length < 2) return
    const id = setTimeout(() => {
      paletteSearch(q).then(
        (rows) => setHits({ q, rows }),
        () => setHits({ q, rows: [] }),
      )
    }, 160)
    return () => clearTimeout(id)
  }, [open, query])

  if (!open) return null

  const goto: Row[] = nav
    .filter((n) => !query || n.label.toLowerCase().includes(query.toLowerCase()))
    .map((n) => ({ key: `nav-${n.href}`, label: n.label, hint: `Go ${n.code}`, go: n.href }))

  const fresh = hits.q === query.trim() && query.trim().length >= 2 ? hits.rows : []
  const found: Row[] = fresh.map((h) => ({
    key: h.id,
    label: h.title,
    hint: `${h.moduleLabel} · ${h.entityType}`,
    go: `/${h.module}`,
  }))

  const rows: Row[] = [
    ...found,
    ...goto,
    ...(query.trim()
      ? [
          {
            key: 'all',
            label: `Search everything for "${query.trim()}"`,
            hint: 'Enter',
            go: `/search?q=${encodeURIComponent(query.trim())}`,
          },
        ]
      : []),
  ]

  const active = Math.min(cursor, Math.max(0, rows.length - 1))

  function run(row: Row | undefined) {
    if (!row) return
    setOpen(false)
    setQuery('')
    router.push(row.go)
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="absolute left-1/2 top-[18vh] w-[min(560px,92vw)] -translate-x-1/2 overflow-hidden rounded-lg border border-rule-2 bg-bg-elev"
      >
        <div className="flex items-center gap-3 border-b border-rule px-4">
          <span aria-hidden className="code text-ink-4">
            &gt;
          </span>
          <input
            ref={input}
            value={query}
            aria-label="Command palette search"
            placeholder="Search or jump to"
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setCursor((c) => Math.min(c + 1, rows.length - 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setCursor((c) => Math.max(c - 1, 0))
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                run(rows[active])
              }
            }}
            className="w-full bg-transparent py-3.5 text-[17px] text-ink outline-none placeholder:text-ink-4"
          />
        </div>

        <ul className="max-h-[52vh] overflow-y-auto py-1">
          {rows.map((row, i) => (
            <li key={row.key}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => run(row)}
                className={cn(
                  'flex w-full items-baseline justify-between gap-4 px-4 py-2.5 text-left transition-colors duration-100',
                  i === active ? 'bg-brand-soft text-ink' : 'text-ink-2',
                )}
              >
                <span className="min-w-0 truncate text-[15px]">{row.label}</span>
                <span className="label shrink-0 text-[10px] tracking-[0.1em] text-ink-3">
                  {row.hint}
                </span>
              </button>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="px-4 py-3 text-[13px] text-ink-3">Nothing matches yet.</li>
          )}
        </ul>

        <div className="flex justify-between border-t border-rule px-4 py-2">
          <span className="label text-[9px] tracking-[0.1em] text-ink-4">
            Up down move · enter open · esc close
          </span>
        </div>
      </div>
    </div>
  )
}
