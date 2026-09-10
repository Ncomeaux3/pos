'use client'

import {
  Activity,
  Bell,
  Brain,
  CalendarCheck,
  FileText,
  House,
  Inbox,
  LayoutGrid,
  Lightbulb,
  LineChart,
  ListChecks,
  MoreHorizontal,
  Network,
  Plane,
  ScrollText,
  Search,
  Settings,
  Shield,
  Target,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import type { NavItem } from '@/core/nav'
import type { Theme } from '@/core/theme'
import { cn } from '@/lib/utils'
import { ComeauxverseMark } from './Logo'

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
  ownerName,
  onToggleCollapse,
  onToggleTheme,
}: {
  nav: NavItem[]
  footer: NavItem[]
  collapsed: boolean
  theme: Theme
  reviewCount: number
  /** From core.settings. Empty on a fresh install, which is why it falls back. */
  ownerName: string
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
        {/* Mark only at 28px with the owner's name beside it, which is what the
            design bundle asks for by name: "The sidebar renders it at 28px
            square, mark only, with the owner name beside it in Manrope 600
            13px. Do not use a wordmark lockup." The name is a setting, never a
            literal, because this repo holds nothing personal. */}
        <Link href="/" aria-label="Dashboard" className="flex min-w-0 items-center gap-2.5">
          <ComeauxverseMark size={28} />
          <span
            className={cn(
              'min-w-0 truncate text-[13px] font-semibold leading-none text-ink transition-opacity duration-200',
              collapsed && 'pointer-events-none opacity-0',
            )}
          >
            {ownerName}
          </span>
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
 * One icon per route, for the bottom tab bar.
 *
 * The phone artboard draws a glyph per tab, not the two digit code the rail
 * uses: at 78px of width a code and a label are two lines of small type and
 * the bar reads as a table. Keyed by href so a module without an entry falls
 * back to its code rather than to a wrong picture.
 */
const NAV_ICON: Record<string, LucideIcon> = {
  '/': LayoutGrid,
  '/finance': LineChart,
  '/tasks': ListChecks,
  '/fitness': Activity,
  '/brain': Brain,
  '/notes': FileText,
  '/skills': Network,
  '/goals': Target,
  '/health': Activity,
  '/home': House,
  '/ideas': Lightbulb,
  '/insurance': Shield,
  '/meals': Utensils,
  '/travel': Plane,
  '/review': Inbox,
  '/search': Search,
  '/weekly-review': CalendarCheck,
  '/notifications': Bell,
  '/agent-log': ScrollText,
  '/settings': Settings,
}

/**
 * Below 720px the sidebar is a bottom tab bar: the first four nav entries plus
 * More, which opens the rest. Same list, same order, same badge.
 *
 * Measured off PosPhone.dc.html: 56px rows on `8px 6px 26px` padding, an 18px
 * glyph over a 9px label, accent for the current tab. The 26px at the bottom
 * is the home indicator's, and without it the labels sat on the very edge of
 * the screen under it.
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
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-rule-2 bg-bg-elev px-1.5 pb-[26px] pt-2 md:hidden"
    >
      {primary.map((item, i) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? 'page' : undefined}
          className={cn(
            'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-[5px] px-0.5 py-1.5',
            isActive(pathname, item.href) ? 'text-brand' : 'text-ink-3',
          )}
        >
          {/* The count rides the first tab, which is where a proposal lands.
            * It used to be the More tab's top line, where it read as that
            * tab's own label rather than as something waiting. */}
          <TabGlyph item={item} badge={i === 0 ? reviewCount : 0} />
          <span className="label max-w-full truncate text-[9px] tracking-[0.08em]">
            {item.label}
          </span>
        </Link>
      ))}

      <details className="group relative flex-1">
        <summary className="flex min-h-[56px] cursor-pointer list-none flex-col items-center justify-center gap-[5px] px-0.5 py-1.5 text-ink-3">
          <MoreHorizontal size={18} strokeWidth={1.3} aria-hidden />
          <span className="label text-[9px] tracking-[0.08em]">More</span>
        </summary>
        <div className="absolute bottom-full right-0 mb-px grid w-[78vw] grid-cols-2 border border-rule-2 bg-bg-elev">
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

/** The tab's glyph, or its code when this repo has no icon for that route. */
function TabGlyph({ item, badge }: { item: NavItem; badge: number }) {
  const Icon = NAV_ICON[item.href]

  return (
    <span className="relative grid place-items-center">
      {Icon ? (
        <Icon size={18} strokeWidth={1.3} aria-hidden />
      ) : (
        <span className="label text-[11px] tracking-[0.1em]">{item.code}</span>
      )}
      {badge > 0 && (
        <span className="num absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] text-white">
          {badge}
        </span>
      )}
    </span>
  )
}
