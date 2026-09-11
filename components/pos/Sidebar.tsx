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
import { useRef, useTransition } from 'react'
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

/**
 * One row of the rail, measured off PosSidebar.dc.html: 36px at least,
 * `padding 9px 18px 9px 0`, a 2px bar down the left that is the accent on the
 * active row and nothing otherwise, 12px to an 11px index in a 20px slot, then
 * the 13px label. The index takes the row's own colour; the artboard gives it
 * no colour of its own. Footer rows have no bar and start 20px in instead.
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
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        rowClass,
        rail ? 'pl-0' : 'pl-5',
        active ? 'bg-brand-soft text-ink' : 'text-ink-3 hover:text-ink',
      )}
    >
      {rail && (
        <span
          aria-hidden
          className={cn('w-[2px] shrink-0 self-stretch', active ? 'bg-brand' : 'bg-transparent')}
        />
      )}
      <span className="label w-5 shrink-0 text-[11px] tracking-[0.12em]">{item.code}</span>
      <span className={cn('min-w-0 flex-1 truncate text-[13px]', fadeClass(collapsed))}>{item.label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'label num shrink-0 rounded-md border border-brand px-[7px] py-0.5 text-[10px] leading-none text-brand',
            fadeClass(collapsed),
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

const rowClass = 'flex min-h-9 w-full items-center gap-3 py-[9px] pr-[18px] text-left transition-colors duration-150'

function fadeClass(collapsed: boolean) {
  return cn('transition-opacity duration-200', collapsed && 'pointer-events-none opacity-0')
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
      <div className="flex h-14 items-center border-b border-rule px-[18px]">
        {/* Mark only at 28px with the owner's name beside it, which is what the
            design bundle asks for by name: "The sidebar renders it at 28px
            square, mark only, with the owner name beside it in Manrope 600
            13px. Do not use a wordmark lockup." The name is a setting, never a
            literal, because this repo holds nothing personal. */}
        <Link href="/" aria-label="Dashboard" className="flex min-w-0 items-center gap-3">
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

      <nav aria-label="Modules" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-3">
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

      {/* The footer is a second list, not a bar: five links, then the theme and
          the collapse control as rows of the same height and type, which is how
          the artboard draws them. The theme row names the theme you are on. */}
      <nav aria-label="Sections" className="flex flex-col gap-0.5 border-t border-rule py-2.5">
        {footer.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={isActive(pathname, item.href)}
            rail={false}
          />
        ))}

        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => void onToggleTheme(theme))}
          className={cn(rowClass, 'pl-5 text-[13px] text-ink-3 hover:text-ink')}
        >
          <span className="flex w-5 shrink-0">
            <span
              aria-hidden
              className={cn(
                'size-2.5 rounded-full border border-current',
                theme === 'light' && 'bg-current',
              )}
            />
          </span>
          <span className={cn('min-w-0 flex-1 truncate', fadeClass(collapsed))}>
            {theme === 'dark' ? 'Dark' : 'Light'}
          </span>
        </button>

        <button
          type="button"
          disabled={pending}
          aria-expanded={!collapsed}
          onClick={() => start(() => void onToggleCollapse(!collapsed))}
          className={cn(rowClass, 'pl-5 text-[13px] text-ink-3 hover:text-ink')}
        >
          <span aria-hidden className="label w-5 shrink-0 text-[11px]">
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
  const primary = phoneTabs(nav)
  const rest = [...nav.filter((n) => !primary.includes(n)), ...footer]
  const sheet = useRef<HTMLDetailsElement>(null)

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

      {/* A sheet, as the artboard has it: full width above the bar, a grab
        * handle, and the rest of the app as numbered cards two across. It was
        * a 78vw box in the corner with a list of plain links in it.
        *
        * Still a `details`, so More opens with no javascript, and the artboard's
        * scrim is what that costs: nothing can close a sheet it has no way to
        * toggle. Tapping More again closes it either way. */}
      <details ref={sheet} className="group flex-1 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex min-h-[56px] cursor-pointer list-none flex-col items-center justify-center gap-[5px] px-0.5 py-1.5 text-ink-3 group-open:text-brand">
          <MoreHorizontal size={18} strokeWidth={1.3} aria-hidden />
          <span className="label text-[9px] tracking-[0.08em]">More</span>
        </summary>

        <div className="fixed inset-x-0 bottom-[90px] z-50 max-h-[70dvh] overflow-y-auto border-t border-rule-2 bg-bg-elev px-[18px] pb-5 pt-3.5">
          <span className="mx-auto mb-3.5 block h-1 w-[38px] rounded-full bg-rule-2" aria-hidden />
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span className="eyebrow text-ink-3">All modules</span>
            <button
              type="button"
              onClick={() => sheet.current?.removeAttribute('open')}
              className="label text-[10px] tracking-[0.12em] text-ink-3 hover:text-ink"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {rest.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[76px] flex-col justify-end gap-1.5 border border-rule-2 bg-bg px-3.5 py-4 hover:border-ink-4"
              >
                <span className="label text-[9px] tracking-[0.12em] text-brand">{item.code}</span>
                <span className="text-[14px] text-ink">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </details>
    </nav>
  )
}

/**
 * The four the phone gets, by name rather than by nav order.
 *
 * The design plan names them: Home, Finance, Tasks, Fitness. `nav.slice(0, 4)`
 * gave whatever manifest order produced, which is Dashboard, Finance, Notes and
 * Skill Tree here, so two of the four thumb-reachable tabs were screens nobody
 * opens on a phone. Filtered against the nav rather than hardcoded into it, so
 * a module the owner has disabled drops out and the list tops up in nav order
 * instead of leaving a hole.
 */
const PHONE_TABS = ['/', '/finance', '/tasks', '/fitness']

function phoneTabs(nav: NavItem[]): NavItem[] {
  const wanted = PHONE_TABS.map((href) => nav.find((n) => n.href === href)).filter(
    (n): n is NavItem => n !== undefined,
  )
  const spare = nav.filter((n) => !wanted.includes(n))
  return [...wanted, ...spare].slice(0, 4)
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
