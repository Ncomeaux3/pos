import { cookies } from 'next/headers'

// Theme and sidebar width are the two things that must be right on the very
// first paint, so they live in cookies and are read on the server rather than
// hydrated from localStorage. core.settings holds the durable copy; the cookie
// is the fast path.

export type Theme = 'dark' | 'light'

export const THEME_COOKIE = 'pos_theme'
export const SIDEBAR_COOKIE = 'pos_sidebar'

/** Dark is the design's default, so anything unset or unrecognised is dark. */
export async function getTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value
  return value === 'light' ? 'light' : 'dark'
}

export async function getSidebarCollapsed(): Promise<boolean> {
  return (await cookies()).get(SIDEBAR_COOKIE)?.value === 'collapsed'
}

const YEAR_SECONDS = 60 * 60 * 24 * 365

export async function setTheme(theme: Theme): Promise<void> {
  const store = await cookies()
  store.set(THEME_COOKIE, theme, { path: '/', maxAge: YEAR_SECONDS, sameSite: 'lax' })
}

export async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
  const store = await cookies()
  store.set(SIDEBAR_COOKIE, collapsed ? 'collapsed' : 'expanded', {
    path: '/',
    maxAge: YEAR_SECONDS,
    sameSite: 'lax',
  })
}
