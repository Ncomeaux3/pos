import { requireOwner } from '@/core/auth'
import { getNav, getOffRailNav, NAV_FOOTER } from '@/core/nav'
import { countPending } from '@/core/proposals'
import { getSettings } from '@/core/settings'
import { getSidebarCollapsed, getTheme } from '@/core/theme'
import { CommandPalette } from '@/components/pos/CommandPalette'
import { MobileTabBar, Sidebar } from '@/components/pos/Sidebar'
import { ToastProvider } from '@/components/pos'
import { PullToRefresh } from '@/components/pos/PullToRefresh'
import { EdgeBack } from '@/components/pos/EdgeBack'
import { toggleSidebar, toggleTheme } from './shell-actions'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  await requireOwner()

  const [nav, offRail, collapsed, theme, reviewCount, settings] = await Promise.all([
    getNav(),
    getOffRailNav(),
    getSidebarCollapsed(),
    getTheme(),
    // The same count Browse and Review show: a snoozed proposal is not a badge.
    countPending(),
    getSettings(),
  ])

  return (
    <ToastProvider>
      <Sidebar
        nav={nav}
        footer={NAV_FOOTER}
        collapsed={collapsed}
        theme={theme}
        reviewCount={reviewCount}
        ownerName={settings.owner_name || 'Personal OS'}
        onToggleCollapse={toggleSidebar}
        onToggleTheme={toggleTheme}
      />
      <MobileTabBar nav={nav} reviewCount={reviewCount} />
      <CommandPalette nav={[...nav, ...NAV_FOOTER, ...offRail]} />
      <PullToRefresh />
      <EdgeBack />

      <main
        // The sidebar is fixed so the rail never scrolls with the page; this
        // keeps the column clear of it and clear of the mobile tab bar.
        style={{ ['--rail' as string]: collapsed ? '64px' : '232px' }}
        // 18px of side padding on a phone, not 28: the artboard's body runs
        // `14px 18px 22px`, and 28 on a 402px screen was costing 20px of a
        // column that was already truncating its own rows.
        className="min-w-0 flex-1 p-[18px] pb-[calc(var(--tabbar)+18px)] md:p-7 md:pb-7 md:[margin-left:var(--rail)]"
      >
        {children}
      </main>
    </ToastProvider>
  )
}
