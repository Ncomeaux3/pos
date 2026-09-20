'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { NAV_ICON } from '@/components/pos/Sidebar'
import { Eyebrow } from '@/components/pos/text'
import { NAV_GROUPS, type NavItem } from '@/core/nav-groups'

function Row({ item, badge }: { item: NavItem; badge?: number }) {
  const Icon = NAV_ICON[item.href]
  return (
    <li>
      <Link
        href={item.href}
        className="flex min-h-[52px] items-center gap-3.5 px-4 py-2.5 text-[15px] text-ink hover:bg-glass-strong"
      >
        <span className="grid size-6 shrink-0 place-items-center text-ink-3">
          {Icon && <Icon size={19} strokeWidth={1.8} aria-hidden />}
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-action px-1.5 text-[10px] text-action-fg">
            {badge}
          </span>
        )}
        <ChevronRight size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-ink-4" />
      </Link>
    </li>
  )
}

/**
 * The same groups as the rail, one glass list per heading. Client only for
 * the icon table, which lives in the sidebar's client file.
 */
export function Browse({ items, reviewCount }: { items: NavItem[]; reviewCount: number }) {
  return (
    <div className="space-y-6">
      {NAV_GROUPS.map((g) => {
        const rows = items.filter((item) => item.group === g.id)
        if (rows.length === 0) return null
        return (
          <section key={g.id}>
            {g.label && <Eyebrow className="mb-2 block">{g.label}</Eyebrow>}
            <ul className="glass overflow-hidden rounded-[18px]">
              {rows.map((item) => (
                <Row key={item.href} item={item} badge={item.href === '/review' ? reviewCount : undefined} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
