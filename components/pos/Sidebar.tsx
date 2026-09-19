'use client'

import {
  Dumbbell,
  HeartPulse,
  Bell,
  Brain,
  CalendarCheck,
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
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { NAV_GROUPS, type NavItem } from '@/core/nav-groups'
import { phoneTabs } from '@/core/phone-tabs'
import type { Theme } from '@/core/theme'
import { cn } from '@/lib/utils'
import { HolonMark, HolonWordmark } from './Logo'
import { ThemeSwitch } from './ThemeSwitch'

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
      className={cn(
        rowClass,
        active
          ? 'bg-glass-strong font-semibold text-ink shadow-[inset_0_1px_0_var(--glass-edge),var(--lift),0_0_0_1px_var(--glass-line)]'
          : 'text-ink-2 hover:bg-glass hover:text-ink',
        !rail && 'text-ink-3',
      )}
    >
      <span className={cn('grid w-5 shrink-0 place-items-center', active && 'text-action')} aria-hidden>
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-[14px]', fadeClass(collapsed))}>{item.label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'num grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-action px-1.5 text-[11px] font-semibold leading-none text-action-fg',
            fadeClass(collapsed),
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

function fadeClass(collapsed: boolean) {
  return cn('transition-opacity duration-200', collapsed && 'pointer-events-none opacity-0')
}

export function Sidebar({
  nav,
  footer,
  collapsed,
  theme,
  reviewCount,
  onToggleCollapse,
  onTheme,
}: {
  nav: NavItem[]
  footer: NavItem[]
  collapsed: boolean
  theme: Theme
  reviewCount: number
  onToggleCollapse: (next: boolean) => Promise<void>
  onTheme: (theme: Theme) => Promise<void>
}) {
  const pathname = usePathname()
  const [pending, start] = useTransition()

  // Weekly review files under the Review heading with Review itself; the
  // rest of the footer is Utilities.
  const main = [...nav, ...footer.filter((f) => f.group === 'review')]
  const utilities = footer.filter((f) => f.group !== 'review')

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
                    'label overflow-hidden px-5 text-[11.5px] text-ink-4 transition-[height,opacity] duration-200',
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

      {/* The footer: the four utilities as one row of icon buttons (a grid of
          two when collapsed), the theme control, then Collapse. Rows for all
          of them plus the grouped rail was 130px too tall for a 900px window. */}
      <nav aria-label="Sections" className="flex flex-col gap-0.5 py-2.5">
        <div className={cn('mx-3 grid gap-1', collapsed ? 'grid-cols-2' : 'grid-cols-4')}>
          {utilities.map((item) => {
            const Icon = NAV_ICON[item.href] ?? LayoutGrid
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'grid h-9 place-items-center rounded-[10px] transition-[background-color,color,box-shadow] duration-150 ease-[var(--ease)]',
                  active
                    ? 'bg-glass-strong text-action shadow-[inset_0_1px_0_var(--glass-edge),var(--lift),0_0_0_1px_var(--glass-line)]'
                    : 'text-ink-3 hover:bg-glass hover:text-ink',
                )}
              >
                <Icon size={19} strokeWidth={1.8} aria-hidden />
              </Link>
            )
          })}
        </div>

        <ThemeSwitch theme={theme} onChange={onTheme} compact={collapsed} className="mx-3 my-1.5" />

        <button
          type="button"
          disabled={pending}
          aria-expanded={!collapsed}
          onClick={() => start(() => void onToggleCollapse(!collapsed))}
          className={cn(rowClass, 'text-[13px] text-ink-3 hover:bg-glass hover:text-ink')}
        >
          <span aria-hidden className="grid w-5 shrink-0 place-items-center text-[13px]">
            {collapsed ? '›' : '‹'}
          </span>
          <span className={cn('min-w-0 flex-1 truncate', fadeClass(collapsed))}>Collapse</span>
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
 * Below 768px the sidebar is a bottom tab bar: Home, Tasks, Finance, Browse.
 * Browse is a page listing the rest of the app; there is no More sheet.
 *
 * Measured off PosPhone.dc.html: 56px rows on `8px 6px` padding, an 18px
 * glyph over a 9px label, accent for the current tab. The bottom inset is the
 * home indicator's, and without it the labels sat on the very edge of the
 * screen under it.
 */
export function MobileTabBar({ nav, reviewCount }: { nav: NavItem[]; reviewCount: number }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Sections"
      className="glass-panel fixed inset-x-0 bottom-0 z-40 flex rounded-none border-x-0 border-b-0 px-1.5 pb-[var(--inset-b)] pt-2 shadow-none md:hidden"
    >
      {phoneTabs(nav).map((item, i) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? 'page' : undefined}
          className={cn(
            'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-[5px] px-0.5 py-1.5',
            isActive(pathname, item.href) ? 'text-action' : 'text-ink-3',
          )}
        >
          {/* The count rides the first tab, which is where a proposal lands.
            * It used to be the More tab's top line, where it read as that
            * tab's own label rather than as something waiting. */}
          <TabGlyph item={item} badge={i === 0 ? reviewCount : 0} />
          <span className="max-w-full truncate text-[11px] font-medium">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

/** The tab's glyph: the ribbon for Today, the route's icon otherwise. */
function TabGlyph({ item, badge }: { item: NavItem; badge: number }) {
  const Icon = NAV_ICON[item.href] ?? LayoutGrid

  return (
    <span className="relative grid place-items-center">
      {item.href === '/' ? (
        <HolonMark size={24} />
      ) : (
        <Icon size={23} strokeWidth={1.8} aria-hidden />
      )}
      {badge > 0 && (
        <span className="num absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-action px-1 text-[9px] text-action-fg">
          {badge}
        </span>
      )}
    </span>
  )
}
