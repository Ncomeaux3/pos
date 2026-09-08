import { requireOwner } from '@/core/auth'
import { db } from '@/core/db'
import { getNav, NAV_FOOTER } from '@/core/nav'
import { getSidebarCollapsed, getTheme } from '@/core/theme'
import { MobileTabBar, Sidebar } from '@/components/pos/Sidebar'
import { ToastProvider } from '@/components/pos'
import { toggleSidebar, toggleTheme } from './shell-actions'

async function pendingProposals(): Promise<number> {
  const { rows } = await db().query<{ count: string }>(
    `select count(*)::text as count from core.proposals where status = 'pending'`,
  )
  return Number(rows[0].count)
}

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  await requireOwner()

  const [nav, collapsed, theme, reviewCount] = await Promise.all([
    getNav(),
    getSidebarCollapsed(),
    getTheme(),
    pendingProposals(),
  ])

  return (
    <ToastProvider>
      <Sidebar
        nav={nav}
        footer={NAV_FOOTER}
        collapsed={collapsed}
        theme={theme}
        reviewCount={reviewCount}
        onToggleCollapse={toggleSidebar}
        onToggleTheme={toggleTheme}
      />
      <MobileTabBar nav={nav} footer={NAV_FOOTER} reviewCount={reviewCount} />

      <main
        // The sidebar is fixed so the rail never scrolls with the page; this
        // keeps the column clear of it and clear of the mobile tab bar.
        style={{ ['--rail' as string]: collapsed ? '64px' : '232px' }}
        className="min-w-0 flex-1 p-7 pb-24 md:pb-7 md:[margin-left:var(--rail)]"
      >
        {children}
      </main>
    </ToastProvider>
  )
}
