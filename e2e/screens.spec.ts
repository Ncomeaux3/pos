import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'

// One smoke test per screen: load it, assert the elements that carry meaning
// are there, and capture the shot at this project's width in both themes. The
// shots are the evidence that a screen matches its prototype; they are
// gitignored, because the prototypes are the baseline, not a committed png.

const SHOTS = 'e2e/__screens__'

// Rebuilt before each project rather than once for the run: the approval test
// writes a note and consumes a proposal, so desktop would leave mobile with a
// different fixture than it was written against.
//
// Seeding runs in its own tsx process because core/* uses the @/ path alias and
// the pg pool, neither of which the Playwright runner's transform handles.
test.beforeAll(() => {
  execFileSync('pnpm', ['exec', 'tsx', '--env-file=.env', 'e2e/seed.mts'], { encoding: 'utf8' })
})

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

test('skill tree, constellation and the selected skill panel', async ({ page }) => {
  await page.goto('/skills')
  await expect(page.getByRole('heading', { name: 'Skill Tree' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Skill constellation' })).toBeVisible()

  // Nothing selected: the right rail explains what a click does rather than
  // showing an empty panel.
  await expect(page.getByText(/nothing selected/i)).toBeVisible()
  await shoot(page, 'skills')

  // The demo seed classifies notes through the keyword rules, so Engineering
  // has real XP and real events without anything being staged for the shot.
  await page.getByRole('button', { name: 'Engineering' }).click()
  // Unique to the selected panel: the constellation and the character list both
  // say "Engineering", but only the panel says how far the next level is.
  await expect(page.getByText(/to Lv \d/)).toBeVisible()
  // Goals does not exist, so the goal weight is a dash rather than a number.
  await expect(page.getByText('Goal weight')).toBeVisible()

  // The selection is in the URL, which is what lets it survive the reload that
  // shoot() does to switch themes. Without this the shot would show the empty
  // panel and the test would still pass.
  await expect(page).toHaveURL(/skill=engineering/)
  await shoot(page, 'skills-selected')
  await expect(page.getByText('Goal weight')).toBeVisible()
})

test('settings, skills', async ({ page }) => {
  await page.goto('/settings/skills')
  await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Show deleted skills' })).toBeVisible()
  await expect(page.getByText('Hiding deleted')).toBeVisible()
  await shoot(page, 'settings-skills')

  // Renaming, then deleting, then restoring: the three writes the tab exists
  // for, each through the module's own tool.
  await page.getByRole('button', { name: 'Rename TypeScript' }).click()
  await page.getByRole('textbox').first().fill('TS')
  await page.getByRole('textbox').first().press('Enter')
  await expect(page.getByText('was TypeScript')).toBeVisible()

  // Reset drops every override, so the tab returns to the committed yaml. Two
  // presses: nothing here is a modal, per the design.
  await page.getByRole('button', { name: /Reset to skills.yaml/ }).click()
  await page.getByRole('button', { name: /Drop 1 edit/ }).click()
  await expect(page.getByText('was TypeScript')).toBeHidden()
})

test('search, empty and with results', async ({ page }) => {
  await page.goto('/search')
  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible()
  await expect(page.getByText(/nothing searched/i)).toBeVisible()
  await shoot(page, 'search-empty')

  await page.getByLabel(/search everything/i).fill('deadlift')
  await page.getByLabel(/search everything/i).press('Enter')

  await expect(page).toHaveURL(/q=deadlift/)
  await expect(page.getByText('Deadlift form check')).toBeVisible()
  // The scope chips only list modules that actually have a hit.
  await expect(page.getByRole('link', { name: /^Everything/ })).toBeVisible()
  await shoot(page, 'search-results')
})

test('search falls back to closest matches instead of a dead end', async ({ page }) => {
  await page.goto('/search?q=zzzznotathing')
  await expect(page.getByText(/nothing matched/i)).toBeVisible()
})

test('command palette opens on cmd k and finds an entity', async ({ page }) => {
  await page.goto('/')

  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog', { name: /command palette/i })
  await expect(palette).toBeVisible()

  // The Go to list is the same nav the sidebar builds, so it is there before
  // anything is typed.
  await expect(palette.getByRole('button', { name: /Settings/ })).toBeVisible()

  await page.getByLabel(/command palette search/i).fill('deadlift')
  await expect(palette.getByRole('button', { name: /Deadlift form check/ })).toBeVisible()
  await shoot(page, 'command-palette')

  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()
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

test('review inbox, list and sticky detail panel', async ({ page }) => {
  await page.goto('/review')
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()

  const list = page.getByRole('button', { name: /Draft a weekly summary note/ })
  await expect(list).toBeVisible()
  // The bulk action never offers to approve a guarded write, and one of the two
  // seeded proposals is guarded.
  await expect(page.getByRole('button', { name: /approve all non-guarded \(1\)/i })).toBeVisible()

  // Selecting drives the panel; the newest proposal is selected by default, so
  // the guarded one has to be asked for.
  await list.click()
  await expect(page.getByText(/none of them link to each other/i)).toBeVisible()
  await expect(page.getByText(/approving writes to Notes immediately/i)).toBeVisible()

  await shoot(page, 'review')
})

test('approving a proposal runs the tool and moves the row', async ({ page }) => {
  await page.goto('/review')

  await page.getByRole('button', { name: /Add a body to an empty note/ }).click()
  await page.getByRole('button', { name: /^approve$/i }).click()

  await expect(page.getByText(/^Approved:/)).toBeVisible()

  await page.goto('/review?tab=approved')
  await expect(page.getByRole('button', { name: /Add a body to an empty note/ })).toBeVisible()

  // And the write actually happened: approve() calls the module's own tool.
  await page.goto('/notes')
  await expect(page.getByText('Recurring: every 3 months.').first()).toBeVisible()
})

test('settings, agents and mcp', async ({ page }) => {
  await page.goto('/settings/agents')
  await expect(page.getByRole('heading', { name: /agents and mcp/i })).toBeVisible()

  // The command is the whole point of the screen: it is what you paste.
  await expect(page.getByText(/claude mcp add --transport http pos/)).toBeVisible()

  // The token is masked until asked for, so it is not sitting in the HTML of a
  // screen left open.
  await expect(page.getByText('••••••••••••••••')).toBeVisible()

  // Every tool the endpoint actually serves is listed, read and write marked.
  await expect(page.getByText('notes.get_digest')).toBeVisible()
  await expect(page.getByText('core.search')).toBeVisible()

  await shoot(page, 'settings-agents')
})

test('changing autonomy is what decides whether an agent write is held', async ({ page }) => {
  await page.goto('/settings/agents')

  await page.getByRole('radio', { name: /observe only/i }).click()
  await expect(page.getByText(/autonomy: observe only/i)).toBeVisible()

  // Put it back, so the fixture is the same for whatever runs next.
  await page.getByRole('radio', { name: /propose, i approve/i }).click()
  await expect(page.getByText(/autonomy: propose/i)).toBeVisible()
})

test('dashboard renders the nightly run', async ({ page }) => {
  await page.goto('/')

  // Run now is a server action behind requireOwner, not a call to the cron
  // route, so it needs no secret.
  await page.getByRole('button', { name: /^run now$/i }).click()
  await expect(page.getByText(/^Run clean$|jobs? failed/i)).toBeVisible({ timeout: 20_000 })

  await page.reload()

  // Tile labels are uppercased by CSS, so the DOM still says "Warnings".
  const main = page.getByRole('main')
  await expect(main.getByText('Warnings')).toBeVisible()
  await expect(main.getByText('System')).toBeVisible()
  await expect(main.getByText('Model spend')).toBeVisible()
  // One tile per module that wrote a digest, so the page needs no knowledge of
  // any module to show its numbers.
  await expect(main.getByRole('link', { name: /open notes/i })).toBeVisible()

  await shoot(page, 'dashboard-live')
})

test('notifications, rules table and the alert centre', async ({ page }) => {
  await page.goto('/notifications')
  await expect(page.getByRole('heading', { name: 'What reaches you, and when' })).toBeVisible()

  // The seeded rule set, the schedule above it and the preview rail that
  // follows the selected row. All three are the screen.
  await expect(page.getByText('Statement due')).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Morning digest on' })).toBeVisible()
  await expect(page.getByText('Push, lock screen')).toBeVisible()

  // Both halves of the alert centre. Counts are not asserted: the dev database
  // carries real alerts from nightly runs alongside the seeded ones, so the
  // fixture is deterministic in content, not in total.
  //
  // The title appears twice on purpose, once as the alert row and once in the
  // push preview of the rule behind it.
  await expect(page.getByText('Chase Sapphire due in 3 days')).toHaveCount(2)
  await expect(page.getByText(/^History \//)).toBeVisible()
  await expect(page.getByText('Backup complete, 30 snapshots kept')).toBeVisible()

  await shoot(page, 'notifications')
})

// The expander is the whole editing surface, so it gets its own shot.
test('notifications, a rule expanded', async ({ page }) => {
  await page.goto('/notifications')
  await page.getByText('Policy renewal').first().click()

  await expect(page.getByRole('radio', { name: 'Immediate' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Email' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Breaks quiet hours' })).toBeVisible()

  await shoot(page, 'notifications-rule')
})
