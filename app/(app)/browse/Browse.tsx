'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { NAV_ICON } from '@/components/pos/Sidebar'
import { Eyebrow } from '@/components/pos/text'
import type { NavItem } from '@/core/nav'

/** The app's own pages, after the modules. Decision 3 of the phone shell plan. */
const POS: NavItem[] = [
  { href: '/review', label: 'Review', code: 'RV' },
  { href: '/notifications', label: 'Notifications', code: 'ALT' },
  { href: '/agent-log', label: 'Agent log', code: 'LOG' },
  { href: '/settings', label: 'Settings', code: 'SET' },
]

function Row({ item, badge }: { item: NavItem; badge?: number }) {
  const Icon = NAV_ICON[item.href]
  return (
    <li>
      <Link
        href={item.href}
        className="flex min-h-[52px] items-center gap-3.5 px-1 py-2.5 text-[15px] text-ink hover:bg-brand-soft"
      >
        <span className="grid size-6 shrink-0 place-items-center text-ink-3">
          {Icon ? (
            <Icon size={18} strokeWidth={1.3} aria-hidden />
          ) : (
            <span className="label text-[11px] tracking-[0.1em]">{item.code}</span>
          )}
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[10px] text-white">
            {badge}
          </span>
        )}
        <ChevronRight size={16} strokeWidth={1.3} aria-hidden className="shrink-0 text-ink-4" />
      </Link>
    </li>
  )
}

/** Client only for the icon table, which lives in the sidebar's client file. */
export function Browse({ modules, reviewCount }: { modules: NavItem[]; reviewCount: number }) {
  return (
    <div className="space-y-6">
      <section>
        <Eyebrow className="mb-2 block">Modules</Eyebrow>
        <ul className="divide-y divide-rule border-y border-rule">
          {modules.map((item) => (
            <Row key={item.href} item={item} />
          ))}
        </ul>
      </section>
      <section>
        <Eyebrow className="mb-2 block">POS</Eyebrow>
        <ul className="divide-y divide-rule border-y border-rule">
          {POS.map((item) => (
            <Row key={item.href} item={item} badge={item.href === '/review' ? reviewCount : undefined} />
          ))}
        </ul>
      </section>
    </div>
  )
}
