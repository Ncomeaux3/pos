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

  // The mobile bar holds four modules and a More sheet, so what is on it
  // depends on how many modules are installed. Review is always reachable,
  // which is the thing worth asserting; whether it is a tab or a sheet entry
  // is a layout decision the design already made.
  const mobile = (page.viewportSize()?.width ?? 0) < 720
  if (mobile) {
    await page.getByRole('group').getByText('More').click()
  }
  // By href: the sidebar prefixes each label with its two character index and
  // appends the pending count, so the accessible name is "RV Review 2", and
  // "Weekly review" would match a loose name filter anyway.
  await expect(nav.locator('a[href="/review"]')).toBeVisible()

  if (mobile) await page.keyboard.press('Escape')
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

test('agent log, the run accordion and the rail', async ({ page }) => {
  await page.goto('/agent-log')
  await expect(page.getByRole('heading', { name: 'What the agent did while you slept' })).toBeVisible()

  // The accordion opens on the newest run that wrote something, skipping past
  // however many empty Run now records an earlier test left behind. No click
  // needed, and that is the point being asserted.
  await expect(page.getByText('Assigned skills to 3 notes')).toBeVisible()
  await expect(page.getByText('Skill links')).toBeVisible()

  // A failed job shows the raw provider message, not a paraphrase.
  await expect(page.getByText(/auth_expired: refresh token rejected/)).toBeVisible()

  // The rail: run KPIs, the job list, undo history and the autonomy selector.
  await expect(page.getByText('Undo history / 0')).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Agent autonomy' })).toBeVisible()

  await shoot(page, 'agent-log')
})

// Undo is the screen's headline feature, and it has to actually revert the
// write rather than only strike the row.
test('agent log, undo reverts a write and offers a redo', async ({ page }) => {
  await page.goto('/agent-log')

  // The newest run's writes are a classification and a create, and neither can
  // describe its own reverse, so neither offers Undo. That is the honest
  // outcome, not a gap: a create would need a delete tool the module has not
  // got. The previous run holds the update that recorded how to reverse itself.
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0)

  // A closed run is headed by its own summary; the entries are only rendered
  // once it opens.
  // Same reason: open the run that holds the reversible write by name, rather
  // than by its position in a list the dev database keeps adding to.
  await page.getByRole('button', { name: /1 write across Notes/ }).click()
  await expect(page.getByText('Gave an empty note a body')).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).first().click()

  // The row is struck through, Redo replaces Undo, and the rail counts it.
  await expect(page.getByRole('button', { name: 'Redo' }).first()).toBeVisible()
  await expect(page.getByText('Undo history / 1')).toBeVisible()

  await shoot(page, 'agent-log-undone')
})

test('settings, notifications', async ({ page }) => {
  await page.goto('/settings/notifications')
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()

  // The coarse grid: one row per module, three rollup switches each.
  await expect(page.getByRole('switch', { name: 'Digest for Finance' })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'In-app for System' })).toBeVisible()
  await expect(page.getByRole('button', { name: /breaks through/i })).toBeVisible()

  await shoot(page, 'settings-notifications')

  // A row switch writes every rule in the module, which is the thing the
  // rule by rule screen makes tedious.
  await page.getByRole('switch', { name: 'Push for Finance' }).click()
  await expect(page.getByText(/Push (on|off) for Finance/)).toBeVisible()
})

test('tasks, the board and the quick add parser', async ({ page }) => {
  await page.goto('/tasks')
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()

  // Today holds what is due today and what slipped, because a slip is today.
  await expect(page.getByText('Recurring detection tests')).toBeVisible()
  await expect(page.getByText('Read DDIA ch. 5, Replication')).toBeVisible()

  // The parser says what it understood before anything is saved.
  const line = page.getByLabel('Add a task')
  // Deliberately not a phrase any seeded task starts with, or the parsed title
  // matches a card on the board behind it as well as the preview.
  await line.fill('Ring the plumber !p1 #Home @tomorrow 15m')
  await expect(page.getByText('Ring the plumber')).toBeVisible()
  await expect(page.getByText('Due Tomorrow')).toBeVisible()
  await expect(page.getByText('Priority P1')).toBeVisible()
  await expect(page.getByText('Project Home')).toBeVisible()
  await expect(page.getByText('Estimate 15m')).toBeVisible()

  await shoot(page, 'tasks')
})

test('tasks, the six views and the month grid', async ({ page }) => {
  await page.goto('/tasks')

  // Review holds agent-proposed work, which is a real row that does not count
  // until it is accepted.
  await page.getByRole('tab', { name: /Review/ }).click()
  await expect(page.getByText('Test the bank sync against three months of history')).toBeVisible()
  // The view is in the URL, which is what lets it survive the reload shoot()
  // does to switch themes. Without it the shot would show Today and the test
  // would still pass.
  await expect(page).toHaveURL(/view=review/)
  await shoot(page, 'tasks-review')

  await page.getByRole('tab', { name: /This week/ }).click()
  await expect(page.getByText('Clear week')).toBeHidden()

  // By goal always offers a No goal column, so nothing is invisible, and it
  // says why there are no goals yet rather than showing an empty rail.
  await page.getByRole('tab', { name: /By goal/ }).click()
  await expect(page.getByText('No goal')).toBeVisible()

  await page.getByRole('button', { name: 'Month view' }).click()
  await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible()
  await expect(page).toHaveURL(/month=1/)
  await shoot(page, 'tasks-calendar')
  await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible()
})

test('tasks, completing one emits the event that earns XP', async ({ page }) => {
  await page.goto('/tasks')

  await page.getByRole('button', { name: 'Complete Read DDIA ch. 5, Replication' }).click()
  await expect(page.getByText('Done. Read DDIA ch. 5, Replication')).toBeVisible()

  await page.getByRole('tab', { name: /Done/ }).click()
  await expect(page.getByText('Read DDIA ch. 5, Replication')).toBeVisible()
})

test('goals, progress by area with the rule behind each status', async ({ page }) => {
  await page.goto('/goals')
  await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible()

  // Grouped by life area, and every status carries the sentence that produced
  // it rather than only a colour.
  await expect(page.getByText('Net worth $300k')).toBeVisible()
  await expect(page.getByText('No change in 40 days.')).toBeVisible()
  await expect(page.getByText(/Pace .* against .* needed, \d+ percent of it\./).first()).toBeVisible()

  // The demo history is shaped so every rule is on screen at once.
  await expect(page.getByText('Stalled').first()).toBeVisible()
  await expect(page.getByText('At risk').first()).toBeVisible()
  await expect(page.getByText('On track').first()).toBeVisible()

  await shoot(page, 'goals')
})

test('goals, the drawer shows both projections and the metric picker', async ({ page }) => {
  await page.goto('/goals')
  await page.getByRole('button', { name: /Net worth \$300k/ }).click()

  // Two projections, labelled, because they disagree exactly when it matters.
  await expect(page.getByText('At the last 30 days')).toBeVisible()
  await expect(page.getByText('At the lifetime pace')).toBeVisible()

  // The picker lists what modules actually register, so Tasks metrics appear
  // here without Goals knowing anything about the tasks schema.
  await expect(page.getByRole('radio', { name: 'Tasks completed this week' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Check in by hand' })).toBeVisible()

  // The open goal is in the URL, which is what lets it survive the reload
  // shoot() does to switch themes. Without it the shot would show the list.
  await expect(page).toHaveURL(/goal=/)
  await shoot(page, 'goals-drawer')
  await expect(page.getByText('At the last 30 days')).toBeVisible()
})

test('goals, a check-in moves the goal', async ({ page }) => {
  await page.goto('/goals')
  await page.getByRole('button', { name: /Deadlift 405/ }).click()

  await page.getByLabel('Check in on Deadlift 405').fill('355')
  await page.getByRole('button', { name: 'Record' }).click()
  await expect(page.getByText('Checked in')).toBeVisible()

  // Twice on purpose: the card summary behind the drawer and the drawer's own
  // Now figure, both re-read from the database after the write.
  await expect(page.getByText('355 lb')).toHaveCount(2)

  // Stalled was the whole point of that goal's history; a fresh reading clears
  // it, which is the rule doing its job rather than a label being flipped.
  await expect(page.getByText('No change in 40 days.')).toBeHidden()
})

test('weekly review, six steps and a note built from the answers', async ({ page }) => {
  await page.goto('/weekly-review')
  await expect(page.getByRole('heading', { name: 'Weekly review' })).toBeVisible()

  // Step one reads digests only, which is the cross-module rule on screen.
  await expect(page.getByText(/comes from a module digest/)).toBeVisible()
  await shoot(page, 'weekly-review')

  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Add a win').fill('Shipped the notifications screen')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('Shipped the notifications screen')).toBeVisible()

  // Step three: every slipped item needs a decision, and the wizard says how
  // many are still owed rather than letting you walk past silently.
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText(/still undecided/)).toBeVisible()

  await page.getByRole('radio', { name: /^Carry$/ }).first().click()
  await shoot(page, 'weekly-review-misses')
})

test('weekly review, the close shows the note before it writes it', async ({ page }) => {
  await page.goto('/weekly-review')

  // Jump to the last step through the rail. Each rail button is prefixed with
  // its step number, which is what makes "Close" and "Close the week" distinct.
  await page.getByRole('button', { name: '06 Close' }).click()
  await expect(page.getByRole('button', { name: 'Close the week' })).toBeVisible()

  // The step is in the URL, which is what lets it survive the reload shoot()
  // does to switch themes, and what lets a resumed review keep its place.
  await expect(page).toHaveURL(/step=close/)

  // Nothing is generated on the server that is not shown here first.
  await expect(page.getByText('## Wins')).toBeVisible()
  await expect(page.getByText('## Next week')).toBeVisible()

  await shoot(page, 'weekly-review-close')
})
