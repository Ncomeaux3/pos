'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { paletteSearch, type PaletteHit } from '@/app/(app)/search/actions'
import type { NavItem } from '@/core/nav'
import { cn } from '@/lib/utils'

// Cmd K anywhere in the app. Entities as you type, plus the Go to list, which
// is the nav the sidebar already builds rather than a second hardcoded copy.

type Row = { key: string; label: string; hint: string; go: string; group: 'results' | 'goto' | 'all' }

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
    // The search box in the page band is a button, not a second input: one
    // palette owns the query so there is never a half typed search in two
    // places. It asks for the palette through this event.
    const onAsk = () => setOpen(true)

    document.addEventListener('keydown', onKey)
    window.addEventListener('pos:search', onAsk)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('pos:search', onAsk)
    }
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
    .map((n) => ({ key: `nav-${n.href}`, label: n.label, hint: n.group === 'today' || n.group === 'review' ? n.label : n.group[0].toUpperCase() + n.group.slice(1), go: n.href, group: 'goto' as const }))

  const fresh = hits.q === query.trim() && query.trim().length >= 2 ? hits.rows : []
  const found: Row[] = fresh.map((h) => ({
    key: h.id,
    label: h.title,
    hint: `${h.moduleLabel} · ${h.entityType}`,
    go: `/${h.module}`,
    group: 'results' as const,
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
            group: 'all' as const,
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

  const rowButton = (row: Row) => {
    const i = rows.indexOf(row)
    return (
      <li key={row.key}>
        <button
          type="button"
          onMouseEnter={() => setCursor(i)}
          onClick={() => run(row)}
          className={cn(
            'flex w-full items-baseline justify-between gap-4 px-3.5 py-[9px] text-left text-[13px] transition-colors duration-100',
            i === active ? 'bg-brand-soft text-ink' : 'text-ink-2 hover:bg-brand-soft hover:text-ink',
          )}
        >
          <span className="min-w-0 truncate">{row.label}</span>
          <span className="num shrink-0 text-[11px] text-ink-4">{row.hint}</span>
        </button>
      </li>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[14vh]">
      <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/55" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-[min(640px,calc(100%-32px))] duration-200 animate-in fade-in zoom-in-95"
      >
        <div className="flex h-[52px] items-center border border-rule-2 bg-bg-elev focus-within:border-brand rounded-[18px]">
          <span aria-hidden className="num pl-4 pr-3 text-[13px] text-ink-4">
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
            className="min-w-0 flex-1 bg-transparent pr-4 text-[16px] text-ink outline-none placeholder:text-ink-4"
          />
        </div>

        <div className="mt-2.5 max-h-[52vh] overflow-y-auto border border-rule-2 bg-bg-elev py-1.5 rounded-[18px]">
          {found.length > 0 && (
            <>
              <div className="px-3.5 py-1.5 text-[11px] text-ink-4">Results</div>
              <ul>{found.map(rowButton)}</ul>
            </>
          )}
          {goto.length > 0 && (
            <>
              <div className="px-3.5 py-1.5 text-[11px] text-ink-4">Go to</div>
              <ul>{goto.map(rowButton)}</ul>
            </>
          )}
          {rows.filter((r) => r.group === 'all').length > 0 && <ul>{rows.filter((r) => r.group === 'all').map(rowButton)}</ul>}
          {rows.length === 0 && <p className="px-3.5 py-3 text-[13px] text-ink-3">Nothing matches yet.</p>}
        </div>
      </div>
    </div>
  )
}
