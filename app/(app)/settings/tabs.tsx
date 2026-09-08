import type { TabLink } from '@/components/pos'

// One list, imported by every settings route, so the tab row cannot drift
// between them. Tabs whose step has not landed render greyed rather than
// linking somewhere that 404s.
export function settingsTabs(providerCount: number, skillCount: number): TabLink[] {
  return [
    { href: '/settings', label: 'General' },
    { href: '/settings/connections', label: 'Connections', count: providerCount },
    { href: '/settings/agents', label: 'Agents and MCP', soon: true },
    { href: '/settings/notifications', label: 'Notifications', soon: true },
    { href: '/settings/skills', label: 'Skills', count: skillCount, soon: true },
  ]
}
