import { getModules } from './modules'
import { getSetting } from './settings'

// One nav list, used by the sidebar and by the mobile tab bar, so the two can
// never disagree about what exists or what order it is in.

export type NavItem = {
  href: string
  label: string
  /** The two character mono index the design prints before each label. */
  code: string
}

/**
 * Dashboard, then every enabled module in manifest order, then Review. The
 * index is positional rather than stored, so removing a module renumbers the
 * list instead of leaving a hole.
 */
export async function getNav(): Promise<NavItem[]> {
  const enabled = await getSetting('modules_enabled')
  const modules = getModules().filter((m) => enabled === null || enabled.includes(m.id))

  const main: Omit<NavItem, 'code'>[] = [
    { href: '/', label: 'Dashboard' },
    ...modules.map((m) => ({ href: `/${m.id}`, label: m.nav.label })),
  ]

  return [
    ...main.map((item, i) => ({ ...item, code: String(i + 1).padStart(2, '0') })),
    { href: '/review', label: 'Review', code: 'RV' },
  ]
}

/** The sidebar footer, and the source of the mobile More sheet's second half. */
export const NAV_FOOTER: NavItem[] = [
  { href: '/search', label: 'Search', code: '⌘K' },
  { href: '/weekly-review', label: 'Weekly review', code: 'WK' },
  { href: '/notifications', label: 'Notifications', code: 'ALT' },
  { href: '/agent-log', label: 'Agent log', code: 'LOG' },
  { href: '/settings', label: 'Settings', code: 'SET' },
]
