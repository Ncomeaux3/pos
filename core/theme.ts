import { cookies } from 'next/headers'

// Theme and sidebar width are the two things that must be right on the very
// first paint, so they live in cookies and are read on the server.

/** `system` follows the device: <html> carries no data-theme and the CSS
 * color-scheme resolves light-dark() from prefers-color-scheme. */
export type Theme = 'dark' | 'light' | 'system'

export const THEME_COOKIE = 'pos_theme'
export const SIDEBAR_COOKIE = 'pos_sidebar'

/** An absent or unrecognised cookie follows the device. */
export async function getTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value
  return value === 'light' || value === 'dark' ? value : 'system'
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
