'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Chip, EmptyState, Eyebrow, Overlay, Row, RowList } from '@/components/pos'

export type Hit = {
  id: string
  module: string
  moduleLabel: string
  entityType: string
  title: string
  snippet: string | null
  score: number
  skills: string[]
  /** Other entities the classifier put under the same skills. */
  related: { id: string; title: string; module: string; moduleLabel: string }[]
}

const SHOWN = 3

/**
 * Results grouped by module, best scoring group first, three rows a group until
 * you ask for more. The bar under each row is the score relative to the best
 * hit on the page, which is the only honest way to show a fused rank: the
 * absolute number means nothing on its own.
 */
export function Results({ hits, query, top }: { hits: Hit[]; query: string; top: number }) {
  const [expanded, setExpanded] = useState<string[]>([])
  const [open, setOpen] = useState<Hit | null>(null)

  const groups = new Map<string, Hit[]>()
  for (const hit of hits) {
    const list = groups.get(hit.module) ?? []
    list.push(hit)
    groups.set(hit.module, list)
  }

  return (
    <>
      <div className="space-y-8">
        {[...groups.entries()].map(([module, list]) => {
          const isOpen = expanded.includes(module)
          const visible = isOpen ? list : list.slice(0, SHOWN)

          return (
            <section key={module} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
                <Eyebrow>{list[0].moduleLabel}</Eyebrow>
                <span className="num text-[11px] tracking-[0.1em] text-ink-3">
                  {list.length} {list.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <RowList>
                {visible.map((hit) => (
                  <Row
                    key={hit.id}
                    onClick={() => setOpen(hit)}
                    title={hit.title}
                    meta={hit.snippet ?? undefined}
                    right={<Chip tone="quiet">{hit.entityType}</Chip>}
                  >
                    <div className="space-y-1.5">
                      {hit.skills.length > 0 && (
                        <p className="t-caption text-ink-3">Skills: {hit.skills.join(', ')}</p>
                      )}
                      <div className="h-0.5 w-full rounded-full bg-rule">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${Math.max(4, Math.round((hit.score / top) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </Row>
                ))}
              </RowList>

              {list.length > SHOWN && (
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) =>
                      isOpen ? prev.filter((m) => m !== module) : [...prev, module],
                    )
                  }
                  className="label text-[10px] tracking-[0.1em] text-ink-3 hover:text-ink"
                >
                  {isOpen ? 'Show less' : `Show ${list.length - SHOWN} more`}
                </button>
              )}
            </section>
          )
        })}
      </div>

      <Overlay
        open={open !== null}
        onClose={() => setOpen(null)}
        eyebrow={open ? `${open.moduleLabel} / ${open.entityType}` : ''}
        title={open?.title ?? ''}
        footer={
          open && (
            <Link
              href={`/${open.module}`}
              className="label text-[10px] tracking-[0.1em] text-ink-2 hover:text-ink"
            >
              Open in {open.moduleLabel}
            </Link>
          )
        }
      >
        {open && (
          <div className="space-y-5">
            {open.snippet && <p className="t-body text-ink-2">{open.snippet}</p>}

            <div className="space-y-2">
              <Eyebrow>Fields</Eyebrow>
              <RowList>
                <Row title="Module" right={<Chip tone="quiet">{open.moduleLabel}</Chip>} />
                <Row title="Type" right={<Chip tone="quiet">{open.entityType}</Chip>} />
              </RowList>
            </div>

            <div className="space-y-2">
              <Eyebrow>Related</Eyebrow>
              {open.related.length > 0 ? (
                <RowList>
                  {open.related.map((r) => (
                    <Row
                      key={r.id}
                      title={r.title}
                      right={<Chip tone="quiet">{r.moduleLabel}</Chip>}
                    />
                  ))}
                </RowList>
              ) : (
                <p className="t-caption text-ink-3">
                  Nothing else shares a skill with this yet.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Eyebrow>Linked skills</Eyebrow>
              {open.skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {open.skills.map((s) => (
                    <Chip key={s}>{s}</Chip>
                  ))}
                </div>
              ) : (
                <p className="t-caption text-ink-3">
                  Nothing linked yet. Classification runs on create and again nightly.
                </p>
              )}
            </div>
          </div>
        )}
      </Overlay>

      {hits.length === 0 && query && (
        <EmptyState headline="No matches">
          Nothing matched {`"${query}"`}. Search covers titles and indexed text across every
          module, and semantic matching needs Voyage connected.
        </EmptyState>
      )}
    </>
  )
}
