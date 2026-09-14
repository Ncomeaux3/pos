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
 * The rail's order, from PosSidebar.dc.html. Module ids, not labels: the label
 * and the route still come from the manifest, this only says where a module
 * sits. An enabled module that is not named here is not on the rail at all,
 * because the artboard draws exactly these thirteen and the numbering is what
 * the eye reads. It keeps its route and its place in the command palette.
 */
const RAIL = [
  'finance',
  'skills',
  'tasks',
  'goals',
  'brain',
  'insurance',
  'ideas',
  'fitness',
  'health',
  'home',
  'meals',
  'travel',
]

async function enabledModules() {
  const enabled = await getSetting('modules_enabled')
  return getModules().filter((m) => enabled === null || enabled.includes(m.id))
}

/**
 * Dashboard, then every enabled module in the artboard's order, then Review.
 * The index is positional rather than stored, so disabling a module renumbers
 * the list instead of leaving a hole.
 */
export async function getNav(): Promise<NavItem[]> {
  const modules = await enabledModules()
  const onRail = RAIL.flatMap((id) => modules.filter((m) => m.id === id))

  const main: Omit<NavItem, 'code'>[] = [
    { href: '/', label: 'Dashboard' },
    ...onRail.map((m) => ({ href: `/${m.id}`, label: m.nav.label })),
  ]

  return [
    ...main.map((item, i) => ({ ...item, code: String(i + 1).padStart(2, '0') })),
    { href: '/review', label: 'Review', code: 'RV' },
  ]
}

/**
 * Enabled modules with no row on the rail. The command palette lists these
 * after the rail and the footer, so nothing enabled is more than a keystroke
 * away even when the artboard has no place for it.
 */
export async function getOffRailNav(): Promise<NavItem[]> {
  const modules = await enabledModules()
  return modules
    .filter((m) => !RAIL.includes(m.id))
    .map((m) => ({ href: `/${m.id}`, label: m.nav.label, code: '··' }))
}

/** The sidebar footer. The phone reaches these through Browse and the palette. */
export const NAV_FOOTER: NavItem[] = [
  { href: '/search', label: 'Search', code: '⌘K' },
  { href: '/weekly-review', label: 'Weekly review', code: 'WK' },
  { href: '/notifications', label: 'Notifications', code: 'ALT' },
  { href: '/agent-log', label: 'Agent log', code: 'LOG' },
  { href: '/settings', label: 'Settings', code: 'SET' },
]
