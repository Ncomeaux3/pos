import { expect, test, type Page } from '@playwright/test'

// One smoke test per screen: load it, assert the elements that carry meaning
// are there, and capture the shot at this project's width in both themes. The
// shots are the evidence that a screen matches its prototype; they are
// gitignored, because the prototypes are the baseline, not a committed png.

const SHOTS = 'e2e/__screens__'

async function withTheme(page: Page, theme: 'dark' | 'light') {
  await page.context().addCookies([
    { name: 'pos_theme', value: theme, url: 'http://localhost:3000' },
  ])
}

async function shoot(page: Page, name: string) {
  const width = page.viewportSize()?.width ?? 0
  for (const theme of ['dark', 'light'] as const) {
    await withTheme(page, theme)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${SHOTS}/${name}-${width}-${theme}.png`, fullPage: true })
  }
  await withTheme(page, 'dark')
}

test('dashboard shell', async ({ page }) => {
  await page.goto('/')

  // The nav is built from manifests, so Dashboard and the stub module both
  // have to be there for the module contract to still be working.
  const nav = page.getByRole('navigation', { name: /modules|sections/i }).first()
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Notes' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Review' })).toBeVisible()

  await shoot(page, 'dashboard')
})

test('notes, the stub module page', async ({ page }) => {
  await page.goto('/notes')
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible()
  await shoot(page, 'notes')
})

test('settings', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await shoot(page, 'settings')
})

test('settings, connections', async ({ page }) => {
  await page.goto('/settings/connections')
  await expect(page.getByRole('heading', { name: /connections/i })).toBeVisible()
  await shoot(page, 'connections')
})

test('login, signed out', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/login')
  await expect(page.getByLabel(/email/i)).toBeVisible()
  await shoot(page, 'login')
})
