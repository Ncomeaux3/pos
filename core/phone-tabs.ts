import type { NavItem } from './nav'

// The phone tab bar's list. Its own file, with no imports beyond a type,
// because the tab bar is a client component and core/nav.ts reads the database.

/** The last phone tab: the page that lists everything the bar has no room for. */
export const BROWSE: NavItem = { href: '/browse', label: 'Browse', code: '··' }

/**
 * The three the phone gets by name, then Browse. Filtered against the nav
 * rather than hardcoded into it, so a module the owner has disabled drops out
 * and the list tops up in rail order instead of leaving a hole.
 */
const PHONE_TABS = ['/', '/tasks', '/finance']

/** Every tab root, Browse included: the screens that draw no back control. */
export const PHONE_TAB_HREFS = [...PHONE_TABS, BROWSE.href]

export function phoneTabs(nav: NavItem[]): NavItem[] {
  const wanted = PHONE_TABS.map((href) => nav.find((n) => n.href === href)).filter(
    (n): n is NavItem => n !== undefined,
  )
  const spare = nav.filter((n) => !wanted.includes(n) && n.href !== '/review')
  return [...wanted, ...spare]
    .slice(0, PHONE_TABS.length)
    // The rail says Dashboard; the phone's first tab is Home, as decision 3 has it.
    .map((n) => (n.href === '/' ? { ...n, label: 'Home' } : n))
    .concat(BROWSE)
}
