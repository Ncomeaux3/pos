import type { TabLink } from '@/components/pos'
import { getModule } from '@/core/modules'

// One list, imported by every settings route, so the tab row cannot drift
// between them. Tabs whose step has not landed render greyed rather than
// linking somewhere that 404s.
//
// The Skills tab appears only while a module owns a skill tree, so deleting
// modules/skills leaves no link to a page that explains its own absence.
// skillCount is the number of skills; every page but Skills itself omits it and
// the tab renders without a count.
export function settingsTabs(providerCount: number, skillCount?: number): TabLink[] {
  return [
    { href: '/settings', label: 'General' },
    { href: '/settings/connections', label: 'Connections', count: providerCount },
    { href: '/settings/agents', label: 'Agents and MCP' },
    { href: '/settings/notifications', label: 'Notifications', soon: true },
    ...(getModule('skills')
      ? [{ href: '/settings/skills', label: 'Skills', count: skillCount } as TabLink]
      : []),
  ]
}
