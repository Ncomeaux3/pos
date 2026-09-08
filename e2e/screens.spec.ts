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
  await expect(page.getByLabel(/owner email/i)).toBeVisible()
  await expect(page.getByText(/link expires in 15 min/i)).toBeVisible()
  await shoot(page, 'login')
})

test('login, link sent', async ({ page, context }) => {
  await context.clearCookies()
  // Rendered from the query string, so the sent view is reachable without
  // burning an email against the local auth rate limit.
  await page.goto('/login?sent=1&email=owner%40example.com')
  await expect(page.getByRole('heading', { name: /check your inbox/i })).toBeVisible()
  await expect(page.getByText(/expires/i)).toBeVisible()
  await shoot(page, 'login-sent')
})

test('login rejects a malformed address without clearing it', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/login')
  await page.getByLabel(/owner email/i).fill('not-an-email')
  // The browser's own type=email check would block submit first, so go around
  // it the way a scripted post would and prove the server validates too.
  await page.getByLabel(/owner email/i).evaluate((el: HTMLInputElement) => {
    el.form?.setAttribute('novalidate', 'true')
  })
  await page.getByRole('button', { name: /^send/i }).click()

  await expect(page.getByText(/enter a valid email/i)).toBeVisible()
  await expect(page.getByLabel(/owner email/i)).toHaveValue('not-an-email')
})
