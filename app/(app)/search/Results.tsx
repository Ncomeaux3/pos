'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { ActionButton, Chip, Eyebrow, Overlay } from '@/components/pos'

export type Hit = {
  id: string
  module: string
  moduleLabel: string
  entityType: string
  title: string
  snippet: string | null
  score: number
  daysAgo: number
  skills: string[]
  /** Other entities the classifier put under the same skills. */
  related: { id: string; title: string; module: string; moduleLabel: string }[]
}

const SHOWN = 3

const ago = (days: number) => (days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`)

/**
 * Results grouped by module, best scoring group first, three rows a group until
 * you ask for more. The bar beside each row is the score relative to the best
 * hit on the page, which is the only honest way to show a fused rank: the
 * absolute number means nothing on its own.
 */
export function Results({
  hits,
  query,
  top,
  openId,
}: {
  hits: Hit[]
  query: string
  top: number
  openId: string | null
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [expanded, setExpanded] = useState<string[]>([])
  const open = hits.find((h) => h.id === openId) ?? null

  // The open row lives in the URL, so a screenshot survives the theme reload.
  const setOpen = (id: string | null) => {
    const search = new URLSearchParams(params.toString())
    if (id) search.set('open', id)
    else search.delete('open')
    router.replace(`/search?${search.toString()}`, { scroll: false })
  }

  const groups = new Map<string, Hit[]>()
  for (const hit of hits) {
    const list = groups.get(hit.module) ?? []
    list.push(hit)
    groups.set(hit.module, list)
  }

  return (
    <>
      {[...groups.entries()].map(([module, list]) => {
        const isOpen = expanded.includes(module)
        const visible = isOpen ? list : list.slice(0, SHOWN)

        return (
          <section key={module} className="mb-[26px]">
            <div className="flex items-baseline justify-between gap-3 border-b border-rule-2 pb-2">
              <span className="text-[14px] text-ink">{list[0].moduleLabel}</span>
              <span className="text-[11px] text-ink-3">
                {list.length} {list.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {visible.map((hit) => (
              <button
                key={hit.id}
                type="button"
                onClick={() => setOpen(hit.id)}
                className="flex w-full items-start gap-3.5 border-b border-rule px-2 py-3 text-left transition-colors duration-150 hover:bg-brand-soft"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[15px] text-ink">{hit.title}</span>
                    <Chip tone="quiet">{hit.entityType.charAt(0).toUpperCase() + hit.entityType.slice(1)}</Chip>
                  </span>
                  {hit.snippet && (
                    <span className="mt-1 block text-[13px] leading-[1.5] text-ink-3">{hit.snippet}</span>
                  )}
                  <span className="mt-1.5 flex gap-3.5 text-[11px] text-ink-4">
                    <span className="text-ink-3">{ago(hit.daysAgo)}</span>
                    {hit.skills.length > 0 && <span>Skills: {hit.skills.join(', ')}</span>}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5 pt-1.5">
                  <span className="block h-0.5 w-16 bg-rule-2">
                    <span
                      className="block h-full bg-brand"
                      style={{ width: `${Math.max(12, Math.round((hit.score / top) * 100))}%` }}
                    />
                  </span>
                  <span className="text-[11px] text-ink-3">match</span>
                </span>
              </button>
            ))}

            {list.length > SHOWN && (
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => (isOpen ? prev.filter((m) => m !== module) : [...prev, module]))
                }
                className="mt-2 px-2 py-1 text-[12px] text-brand hover:underline"
              >
                {isOpen ? 'Show less' : `Show ${list.length - SHOWN} more`}
              </button>
            )}
          </section>
        )
      })}

      {hits.length === 0 && query && (
        <p className="text-[13px] text-ink-3">
          Nothing matched <span className="text-ink">&ldquo;{query}&rdquo;</span>, and nothing came
          close. Search covers titles and indexed text across every module.
        </p>
      )}

      {open && (
        <Overlay
          open
          narrow
          onClose={() => setOpen(null)}
          eyebrow={
            <>
              {open.moduleLabel} <span className="text-ink-4">/</span> {open.entityType}
            </>
          }
          footer={
            <>
              <span />
              <ActionButton variant="solid" onClick={() => router.push(`/${open.module}`)}>
                Open in {open.moduleLabel} <span aria-hidden="true">&rarr;</span>
              </ActionButton>
            </>
          }
        >
          <div className="flex flex-col gap-[18px]">
            <div>
              <h2 className="text-[24px] font-normal leading-[1.15] tracking-[-0.03em] text-ink">{open.title}</h2>
              {open.snippet && <p className="mt-2.5 text-[14px] leading-[1.55] text-ink-2">{open.snippet}</p>}
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] border border-rule rounded-[18px]">
              {[
                ['Module', open.moduleLabel],
                ['Type', open.entityType],
                ['When', ago(open.daysAgo)],
              ].map(([k, v]) => (
                <div key={k} className="border-r border-rule px-3 py-2.5 last:border-r-0">
                  <Eyebrow>{k}</Eyebrow>
                  <div className="mt-1.5 text-[13px] text-ink">{v}</div>
                </div>
              ))}
            </div>

            {open.skills.length > 0 && (
              <div>
                <Eyebrow>Linked skills</Eyebrow>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {open.skills.map((s) => (
                    <Chip key={s}>{s}</Chip>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Eyebrow>Related</Eyebrow>
              <div className="mt-1.5">
                {open.related.length === 0 && (
                  <p className="py-2 text-[12px] text-ink-4">Nothing else shares a skill with this yet.</p>
                )}
                {open.related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/${r.module}`}
                    className="flex w-full justify-between gap-3 border-b border-rule py-[9px] text-[13px] text-ink transition-colors duration-150 hover:text-brand"
                  >
                    <span className="min-w-0 truncate">{r.title}</span>
                    <span className="shrink-0 text-[11px] text-ink-3">{r.moduleLabel}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Overlay>
      )}
    </>
  )
}
