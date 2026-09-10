'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import type { NavItem } from '@/core/nav'
import type { Theme } from '@/core/theme'
import { cn } from '@/lib/utils'
import { ComeauxverseLockup, ComeauxverseMark } from './Logo'

// 232px, collapsing to 64px. Labels fade rather than unmount, so the collapsed
// rail keeps its accessible names and a screen reader still reads the nav.

const EASE = 'cubic-bezier(.2,.8,.2,1)'

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

function NavRow({
  item,
  collapsed,
  active,
  badge,
}: {
  item: NavItem
  collapsed: boolean
  active: boolean
  badge?: number
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 border-l-2 py-2.5 pl-3 pr-2.5 transition-colors duration-150',
        active
          ? 'border-brand bg-brand-soft text-ink'
          : 'border-transparent text-ink-3 hover:bg-bg-elev hover:text-ink-2',
      )}
    >
      <span className={cn('label w-5 shrink-0 text-[10px] tracking-[0.1em]', active ? 'text-ok' : 'text-ink-4')}>
        {item.code}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[13px] transition-opacity duration-200',
          collapsed && 'pointer-events-none opacity-0',
        )}
      >
        {item.label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'num shrink-0 rounded-md border border-brand px-1.5 py-0.5 text-[10px] leading-none text-ok transition-opacity duration-200',
            collapsed && 'opacity-0',
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

export function Sidebar({
  nav,
  footer,
  collapsed,
  theme,
  reviewCount,
  onToggleCollapse,
  onToggleTheme,
}: {
  nav: NavItem[]
  footer: NavItem[]
  collapsed: boolean
  theme: Theme
  reviewCount: number
  onToggleCollapse: (next: boolean) => Promise<void>
  onToggleTheme: (current: Theme) => Promise<void>
}) {
  const pathname = usePathname()
  const [pending, start] = useTransition()

  return (
    <aside
      style={{ width: collapsed ? 64 : 232, transition: `width .25s ${EASE}` }}
      className="fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-rule bg-bg-elev md:flex"
    >
      <div className="flex h-14 items-center border-b border-rule px-3">
        {/* Clear space around the lockup equals the mark radius, so the rail
            gives it its own band rather than crowding it against the nav. */}
        <Link href="/" aria-label="ComeauxVerse, dashboard" className="min-w-0">
          {collapsed ? <ComeauxverseMark size={26} /> : <ComeauxverseLockup />}
        </Link>
      </div>

      <nav aria-label="Modules" className="min-h-0 flex-1 overflow-y-auto py-2">
        {nav.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={isActive(pathname, item.href)}
            badge={item.code === 'RV' ? reviewCount : undefined}
          />
        ))}
      </nav>

      <div className="border-t border-rule py-2">
        {footer.map((item) => (
          <NavRow key={item.href} item={item} collapsed={collapsed} active={isActive(pathname, item.href)} />
        ))}

        <div className="mt-1 flex items-center gap-1 border-t border-rule px-3 pt-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => void onToggleTheme(theme))}
            className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left text-ink-3 transition-colors duration-150 hover:text-ink"
          >
            <span
              aria-hidden
              className={cn(
                'size-3 shrink-0 rounded-full border',
                theme === 'dark' ? 'border-ink-3' : 'border-ink-3 bg-ink-3',
              )}
            />
            <span
              className={cn(
                'label truncate text-[10px] tracking-[0.1em] transition-opacity duration-200',
                collapsed && 'opacity-0',
              )}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </span>
          </button>

          <button
            type="button"
            disabled={pending}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => start(() => void onToggleCollapse(!collapsed))}
            className="label shrink-0 px-1.5 py-2 text-[11px] text-ink-3 transition-colors duration-150 hover:text-ink"
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>
      </div>
    </aside>
  )
}

/**
 * Below 720px the sidebar is a bottom tab bar: the first four nav entries plus
 * More, which opens the rest. Same list, same order, same badge.
 */
export function MobileTabBar({
  nav,
  footer,
  reviewCount,
}: {
  nav: NavItem[]
  footer: NavItem[]
  reviewCount: number
}) {
  const pathname = usePathname()
  const primary = nav.slice(0, 4)
  const rest = [...nav.slice(4), ...footer]

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-rule bg-bg-elev md:hidden"
    >
      {primary.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? 'page' : undefined}
          className={cn(
            'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2',
            isActive(pathname, item.href) ? 'text-ink' : 'text-ink-3',
          )}
        >
          <span className="label text-[9px] tracking-[0.1em]">{item.code}</span>
          <span className="max-w-full truncate text-[10px]">{item.label}</span>
        </Link>
      ))}

      <details className="group relative flex-1">
        <summary className="flex min-h-[52px] cursor-pointer list-none flex-col items-center justify-center gap-1 px-1 py-2 text-ink-3">
          <span className="label text-[9px] tracking-[0.1em]">
            {reviewCount > 0 ? reviewCount : '···'}
          </span>
          <span className="text-[10px]">More</span>
        </summary>
        <div className="absolute bottom-full right-0 mb-px grid w-[62vw] grid-cols-2 border border-rule-2 bg-bg-elev">
          {rest.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="min-h-[44px] border-b border-rule px-3 py-2.5 text-[12px] text-ink-2"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </details>
    </nav>
  )
}
