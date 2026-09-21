'use client'

import {
  Dumbbell,
  HeartPulse,
  Bell,
  Brain,
  CalendarCheck,
  ChevronsLeft,
  ChevronsRight,
  Compass,
  House,
  Inbox,
  LayoutGrid,
  Lightbulb,
  LineChart,
  ListChecks,
  Network,
  Plane,
  ScrollText,
  Search,
  Settings,
  Shield,
  Sun,
  Target,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { NAV_GROUPS, type NavItem } from '@/core/nav-groups'
import { phoneTabs } from '@/core/phone-tabs'
import { setSidebarCookie } from '@/core/theme-client'
import { cn } from '@/lib/utils'
import { useSwipe } from './gestures'
import { HolonMark, HolonWordmark } from './Logo'

// 232px, collapsing to 72px. Labels fade rather than unmount, so the collapsed
// rail keeps its accessible names and a screen reader still reads the nav.

const EASE = 'cubic-bezier(.2,.8,.2,1)'

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * One row of the rail: a 38px pill with the route's icon and its label. The
 * active row is raised glass with the icon in the action colour.
 */
function NavRow({
  item,
  collapsed,
  active,
  badge,
  rail = true,
}: {
  item: NavItem
  collapsed: boolean
  active: boolean
  badge?: number
  rail?: boolean
}) {
  const Icon = NAV_ICON[item.href] ?? LayoutGrid
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        rowClass,
        collapsed && collapsedRow,
        active
          ? 'bg-glass-strong font-semibold text-ink shadow-[inset_0_1px_0_var(--glass-edge),var(--lift),0_0_0_1px_var(--glass-line)]'
          : 'text-ink-2 hover:bg-glass hover:text-ink',
        !rail && 'text-ink-3',
      )}
    >
      <span className={cn('grid w-5 shrink-0 place-items-center', active && 'text-action')} aria-hidden>
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <span className={cn('min-w-0 truncate text-[14px]', collapsed ? 'w-0' : 'flex-1', fadeClass(collapsed))}>
        {item.label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'num grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-action px-1.5 text-[11px] font-semibold leading-none text-action-fg',
            collapsed && 'hidden',
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

const rowClass =
  'mx-2 flex h-[38px] shrink-0 items-center gap-2.5 rounded-[10px] px-3 text-left transition-[background-color,color,box-shadow] duration-150 ease-[var(--ease)]'

// Collapsed, the pill is a 56px square with the icon on the rail's centre line.
// The label keeps its text (a screen reader still reads it) at no width.
const collapsedRow = 'justify-center gap-0 px-0'

function fadeClass(collapsed: boolean) {
  return cn('transition-opacity duration-200', collapsed && 'pointer-events-none opacity-0')
}

export function Sidebar({
  nav,
  footer,
  collapsed: initialCollapsed,
  reviewCount,
}: {
  nav: NavItem[]
  footer: NavItem[]
  collapsed: boolean
  reviewCount: number
}) {
  const pathname = usePathname()
  // Seeded from the cookie for the first paint; every toggle after that
  // moves this state and the shared --rail variable directly (see below), so
  // the rail's width never waits on a server round trip.
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    document.documentElement.style.setProperty('--rail', next ? '72px' : '232px')
    setSidebarCookie(next)
  }

  // Weekly review files under the Review heading with Review itself; the
  // utilities are behind the avatar in band one, not on the rail.
  const main = [...nav, ...footer.filter((f) => f.group === 'review')]

  return (
    <aside
      style={{ width: collapsed ? 72 : 232, transition: `width .25s ${EASE}` }}
      className="fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-glass-line bg-glass backdrop-blur-[28px] backdrop-saturate-[180%] md:flex"
    >
      <div className="flex h-[76px] items-center px-5">
        {/* The ribbon at 36px with the wordmark; the owner's name is on Today. */}
        <Link href="/" aria-label="Today" className="flex min-w-0 items-center gap-3 text-ink">
          <HolonMark size={36} />
          <HolonWordmark height={22} className={fadeClass(collapsed)} />
        </Link>
      </div>

      <nav aria-label="Modules" className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto py-1">
        {NAV_GROUPS.filter((g) => g.id !== 'utilities').map((g) => {
          const items = main.filter((item) => item.group === g.id)
          if (items.length === 0) return null
          return (
            <div key={g.id} className="flex flex-col gap-px pt-2 first:pt-0">
              {/* The heading gives way to a gap when the rail is collapsed, so
                * fifteen rows and the footer still fit a 900px window. */}
              {g.label && (
                <div
                  className={cn(
                    'label overflow-hidden px-5 text-[11.5px] text-ink-3 transition-[height,opacity] duration-200',
                    collapsed ? 'h-2 opacity-0' : 'h-4',
                  )}
                >
                  {g.label}
                </div>
              )}
              {items.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  active={isActive(pathname, item.href)}
                  badge={item.href === '/review' ? reviewCount : undefined}
                />
              ))}
            </div>
          )
        })}
      </nav>

      {/* The footer is Collapse alone: Settings, Notifications, the Agent log
          and the theme control moved behind the avatar in band one. */}
      <nav aria-label="Sections" className="flex flex-col gap-0.5 py-2.5">
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={toggle}
          className={cn(rowClass, collapsed && collapsedRow, 'text-[13px] text-ink-3 hover:bg-glass hover:text-ink')}
        >
          <span aria-hidden className="grid w-5 shrink-0 place-items-center">
            {collapsed ? <ChevronsRight size={19} strokeWidth={1.8} /> : <ChevronsLeft size={19} strokeWidth={1.8} />}
          </span>
          <span className={cn('min-w-0 truncate', collapsed ? 'w-0' : 'flex-1', fadeClass(collapsed))}>Collapse</span>
        </button>
      </nav>
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
export const NAV_ICON: Record<string, LucideIcon> = {
  '/': Sun,
  '/browse': Compass,
  '/finance': LineChart,
  '/tasks': ListChecks,
  '/fitness': Dumbbell,
  '/brain': Brain,
  '/skills': Network,
  '/goals': Target,
  '/health': HeartPulse,
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
 * Below 768px the sidebar is a floating capsule of tabs: Today, Tasks,
 * Finance, Calendar once it exists, and Browse. Browse is a page listing the
 * rest of the app; there is no More sheet. The utilities are behind the
 * avatar on each tab root.
 *
 * Inset from the edges and sitting just above the home indicator, the way
 * Instagram's bar hugs the bottom. Scrolling down past 32px lowers it to 48px
 * and fades the labels (`data-tabbar="compact"` on <html>, styled in
 * globals.css); any scroll up, the top of the page or a new page restores it.
 * A tap on a compact tab is a tap on that tab, since the width and targets
 * do not change. Direction based, so the status bar's scroll timeline
 * (position based) is not the mechanism. A horizontal swipe on the capsule
 * moves to the neighbouring tab, bounded at both ends like TabBar.
 */
export function MobileTabBar({ nav, reviewCount }: { nav: NavItem[]; reviewCount: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const tabs = phoneTabs(nav)
  const index = tabs.findIndex((t) => isActive(pathname, t.href))

  // A tab change cross-fades rather than pushing (PageTransition.tsx).
  const go = (href: string) => router.push(href, { transitionTypes: ['tab'] })
  const swipe = useSwipe({
    onLeft: () => index >= 0 && index < tabs.length - 1 && go(tabs[index + 1].href),
    onRight: () => index > 0 && go(tabs[index - 1].href),
  })

  useEffect(() => {
    const html = document.documentElement
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (y <= 0 || y < last) delete html.dataset.tabbar
      else if (y > 32 && y > last) html.dataset.tabbar = 'compact'
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      // A new page opens at the top and may be too short to scroll.
      delete html.dataset.tabbar
    }
  }, [pathname])

  return (
    <nav
      aria-label="Sections"
      className="tabbar glass-panel fixed bottom-[var(--inset-b)] left-1/2 z-40 flex w-[calc(100%-32px)] -translate-x-1/2 items-stretch rounded-full px-1.5 shadow-[inset_0_1px_0_var(--glass-edge),var(--pop)] md:hidden"
      {...swipe}
    >
      {tabs.map((item, i) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            transitionTypes={['tab']}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'my-1.5 flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-full px-0.5 transition-[background-color,color] duration-150',
              active ? 'bg-brand-soft text-action' : 'text-ink-3',
            )}
          >
            {/* The count rides the first tab, which is where a proposal lands.
              * It used to be the More tab's top line, where it read as that
              * tab's own label rather than as something waiting. */}
            <TabGlyph item={item} badge={i === 0 ? reviewCount : 0} />
            <span className="tabbar-label max-w-full truncate text-[10.5px] font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/** The tab's glyph: the ribbon for Today, the route's icon otherwise. */
function TabGlyph({ item, badge }: { item: NavItem; badge: number }) {
  const Icon = NAV_ICON[item.href] ?? LayoutGrid

  return (
    <span className="relative grid place-items-center">
      {item.href === '/' ? (
        <HolonMark size={22} />
      ) : (
        <Icon size={21} strokeWidth={1.8} aria-hidden />
      )}
      {badge > 0 && (
        <span className="num absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-action px-1 text-[9px] text-action-fg">
          {badge}
        </span>
      )}
    </span>
  )
}
