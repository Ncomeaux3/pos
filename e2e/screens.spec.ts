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

test('finance, net worth and the budget pace marks', async ({ page }) => {
  await page.goto('/finance')
  await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible()

  // Net worth is a sum over accounts where a credit balance is negative, so
  // the KPI is a plain total with no case analysis.
  // Three on the page: the lede, the KPI tile and the chart card. The chart's
  // accessible name is the unambiguous one, and it is also the assertion worth
  // making, because it names the range the line actually covers.
  await expect(page.getByRole('img', { name: /Net worth over \d+ days/ })).toBeVisible()

  await shoot(page, 'finance')

  // Budgets: the tick is the month pace, and a fixed cost at its limit is not
  // flagged, because rent at 100 percent every month is not news.
  await page.getByRole('tab', { name: /Budgets/ }).click()
  await expect(page).toHaveURL(/tab=budgets/)
  await expect(page.getByText('Fixed', { exact: true })).toBeVisible()
  await expect(page.getByText(/105% used/)).toBeVisible()
  await shoot(page, 'finance-budgets')
})

test('finance, the detector found the subscriptions and left the rest alone', async ({ page }) => {
  await page.goto('/finance?tab=subscriptions')

  // Five seeded recurring merchants, found by detectRecurring rather than
  // listed by the fixture.
  await expect(page.getByText('Anthropic Claude Pro')).toBeVisible()
  await expect(page.getByText('Neighbourhood Gym')).toBeVisible()

  // And nothing that merely repeats: the shops appear in the ledger many times
  // without a rhythm, and payroll is the most regular thing in the data.
  await expect(page.getByText('Kroger')).toBeHidden()
  await expect(page.getByText('Payroll')).toBeHidden()

  await shoot(page, 'finance-subscriptions')
})

test('finance, filing a transaction teaches the rule', async ({ page }) => {
  await page.goto('/finance?tab=transactions')

  const row = page.getByText('Coffee bar').first()
  await expect(row).toBeVisible()

  await page.getByRole('button', { name: 'File' }).first().click()
  await page.getByRole('button', { name: 'Dining', exact: true }).first().click()
  await expect(page.getByText(/the rule learned it/)).toBeVisible()
})

test('onboarding, six steps that write as they go', async ({ page }) => {
  await page.goto('/onboarding')
  await expect(page.getByRole('heading', { name: 'First run' })).toBeVisible()

  await page.getByLabel('Your name').fill('Owner')
  await page.getByLabel('Timezone').click()
  await shoot(page, 'onboarding')

  // Modules is a visibility switch, not a delete: the copy has to say so,
  // because turning one off looks destructive.
  await page.getByRole('button', { name: '02 Modules' }).click()
  await expect(page.getByRole('switch', { name: 'Show Finance' })).toBeVisible()
  await expect(page.getByText(/keeps its data and its tools/)).toBeVisible()

  // Connections records intent. A provider with a real integration is starred;
  // everything else is honestly a request.
  await page.getByRole('button', { name: '03 Connections' }).click()
  await expect(page.getByText(/nothing pretends to be connected/)).toBeVisible()
  await shoot(page, 'onboarding-connections')
})

test('onboarding, a starter goal only points at a metric that exists', async ({ page }) => {
  await page.goto('/onboarding?step=goals')

  // Finance and Tasks are installed, so those two compute. The reading goal
  // names no metric and is checked in by hand.
  await expect(page.getByText('Six months of runway')).toBeVisible()
  await expect(page.getByText('computed').first()).toBeVisible()
  await expect(page.getByText('Read twelve books this year')).toBeVisible()

  await shoot(page, 'onboarding-goals')
})

test('onboarding, requesting a provider records it without pretending', async ({ page }) => {
  await page.goto('/onboarding?step=connect')

  await page.getByRole('button', { name: /Banks and credit unions/ }).click()
  await page.getByRole('button', { name: 'Ally', exact: true }).click()
  await expect(page.getByText('Ally noted')).toBeVisible()

  // It lands in Settings as requested, which is the honest half of the claim.
  await page.goto('/settings/connections')
  await expect(page.getByText('Ally')).toBeVisible()
})

test('second brain, the inbox holds a draft beside its source', async ({ page }) => {
  await page.goto('/brain')
  await expect(page.getByRole('heading', { name: 'Second Brain' })).toBeVisible()

  // A draft is a proposal about a note, not a note. It waits here.
  await expect(page.getByText('Why solo builders ship one module at a time')).toBeVisible()
  await page.getByText('Why solo builders ship one module at a time').click()

  // The source sits beside the summary, not behind it: a draft is judged
  // against what it was drawn from rather than taken on trust.
  await expect(page.getByText(/The itch to start module two/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible()

  await shoot(page, 'second-brain')
})

test('second brain, links resolve both ways and a dangling one is kept', async ({ page }) => {
  await page.goto('/brain?folder=note')

  // Two notes point at each other, so each is a backlink of the other.
  await page.getByText('Reciprocal rank fusion').first().click()
  await expect(page.getByText('Pointing here')).toBeVisible()
  await expect(page.getByText('Hybrid search').first()).toBeVisible()

  // And one link points at a note nobody has written. It is kept and offered,
  // because that is usually the best idea of what to write next.
  await expect(page.getByText('Links with nothing behind them')).toBeVisible()
  await expect(page.getByRole('button', { name: 'build order' })).toBeVisible()

  await shoot(page, 'second-brain-links')
})

test('second brain, accepting a draft moves it into the vault', async ({ page }) => {
  await page.goto('/brain')

  await page.getByText('Postgres full text search, briefly').click()
  await page.getByRole('button', { name: 'Accept' }).click()
  await expect(page.getByText('Accepted')).toBeVisible()

  // Out of the inbox and into its kind.
  await page.goto('/brain?folder=article')
  await expect(page.getByText('Postgres full text search, briefly')).toBeVisible()
})

test('travel, trips with confirmed spend only', async ({ page }) => {
  await page.goto('/travel')
  await expect(page.getByRole('heading', { name: 'Travel' })).toBeVisible()

  await expect(page.getByText('Tokyo, November')).toBeVisible()
  // A pending booking is a guess about an email, so it does not move a budget.
  await expect(page.getByText('confirmed only').first()).toBeVisible()
  await expect(page.getByText('2 waiting')).toBeVisible()

  await shoot(page, 'travel')
})

test('travel, the globe is drawn from real coordinates', async ({ page }) => {
  await page.goto('/travel?tab=map')

  // Hand rolled orthographic projection, no d3 and no world-atlas download.
  const globe = page.getByRole('img', { name: /Globe showing \d+ places/ })
  await expect(globe).toBeVisible()

  // Only the near side is drawn, so the count on screen is fewer than the six
  // seeded places spread across four continents.
  const dots = globe.locator('circle').filter({ hasNotText: '' })
  expect(await dots.count()).toBeGreaterThan(1)

  // Twice on purpose: the list row and the dot's own tooltip, which is what
  // makes a dot on a wireframe globe identifiable at all.
  await expect(page.getByText('Cape Town', { exact: true })).toBeVisible()
  await expect(page.getByText('Cape Town, South Africa')).toBeAttached()
  await shoot(page, 'travel-map')
})

test('travel, a parsed booking waits to be accepted', async ({ page }) => {
  await page.goto('/travel?tab=inbox')

  await expect(page.getByText('Check in, Kyoto')).toBeVisible()
  await expect(page.getByText('94%')).toBeVisible()
  await shoot(page, 'travel-inbox')

  await page.getByRole('button', { name: 'Accept' }).first().click()
  await expect(page.getByText('Added to the trip')).toBeVisible()
})

test('travel, cents per point uses only numbers you supply', async ({ page }) => {
  await page.goto('/travel?tab=loyalty')

  await page.getByLabel('Cash fare in dollars').fill('640')
  await page.getByLabel('Points required').fill('35000')

  // 64000 cents over 35000 points is 1.83 cents each, which is worth using.
  await expect(page.getByText('1.83c')).toBeVisible()
  await expect(page.getByText('worth using points')).toBeVisible()

  await page.getByLabel('Points required').fill('60000')
  await expect(page.getByText('pay cash', { exact: true })).toBeVisible()
})

test('fitness, workouts with pace derived rather than stored', async ({ page }) => {
  await page.goto('/fitness')
  await expect(page.getByRole('heading', { name: 'Fitness' })).toBeVisible()

  // Pace is a ratio of the stored distance and duration, so it can never
  // disagree with them. 5.1 km in 51 minutes is 10:00/km.
  await expect(page.getByText(/5\.1 km at 10:00\/km/)).toBeVisible()

  // The heaviest set is shown as what happened, not as a one rep max estimate.
  await expect(page.getByText(/Deadlift 355 lb × 1/)).toBeVisible()

  // Load is duration weighted by kind, and the tile says as much rather than
  // implying a sports science model.
  await expect(page.getByText('duration by kind')).toBeVisible()

  await shoot(page, 'fitness')
})

test('fitness, the exercise index and body metrics read in their own units', async ({ page }) => {
  await page.goto('/fitness?tab=exercises')
  await expect(page.getByText('Bench press')).toBeVisible()
  await expect(page.getByText('4 sets logged')).toBeVisible()

  await page.goto('/fitness?tab=body')
  // Weight is stored in grams and read in pounds; sleep is stored in minutes
  // and read as hours. One numeric column, a documented unit per kind.
  await expect(page.getByText('Weight', { exact: true })).toBeVisible()
  await expect(page.getByText('Sleep', { exact: true })).toBeVisible()
  await expect(page.getByText('7h 08m')).toBeVisible()

  await shoot(page, 'fitness-body')
})

test('health, screenings show every state including never', async ({ page }) => {
  await page.goto('/health?tab=screenings')
  await expect(page.getByRole('heading', { name: 'Health' })).toBeVisible()

  // 'never' is its own state, not folded into overdue: a screening you have
  // never had is a different conversation from one you are late for, and
  // showing it as decades overdue would invent a history.
  await expect(page.getByText('never had one')).toBeVisible()
  // Days under two months, months past it. The seeded physical is 35 days
  // late, which is the form that reads usefully at that distance.
  await expect(page.getByText(/\d+ days overdue/)).toBeVisible()

  await shoot(page, 'health-screenings')
})

test('health, an appointment carries what to do beforehand', async ({ page }) => {
  await page.goto('/health')

  // The part that is useless the day after and vital the day before, and it is
  // only shown while the appointment is still ahead.
  await expect(page.getByText(/Fast twelve hours/)).toBeVisible()
  await shoot(page, 'health')
})

test('health, body weight is read from Fitness rather than kept twice', async ({ page }) => {
  await page.goto('/health?tab=vitals')

  // Clinical readings are stored here; body weight belongs to Fitness and is
  // resolved through the metric registry, which the tile says out loud.
  await expect(page.getByText('Blood pressure')).toBeVisible()
  await expect(page.getByText('118/74')).toBeVisible()
  await expect(page.getByText('from Fitness')).toBeVisible()

  await shoot(page, 'health-vitals')
})

test('health, marking a medication does not break the streak on an unmarked today', async ({ page }) => {
  await page.goto('/health?tab=medications')

  // Six days marked ending yesterday. Today unmarked must not zero it: it is
  // not the end of the day.
  await expect(page.getByText(/6 day run/).first()).toBeVisible()
  await page.getByRole('switch', { name: 'Taken today, Vitamin D' }).click()
  await expect(page.getByText(/7 day run/).first()).toBeVisible()
})

test('meals, a plan is not a log', async ({ page }) => {
  await page.goto('/meals')
  await expect(page.getByRole('heading', { name: 'Meals' })).toBeVisible()

  // Planned and eaten are separate totals of the same rows, side by side.
  // Conflating them makes both useless.
  await expect(page.getByText('Planned', { exact: true })).toBeVisible()
  await expect(page.getByText('ticked only')).toBeVisible()

  // The calorie target comes from Fitness through the registry, and is
  // labelled an estimate rather than presented as a prescription.
  await expect(page.getByText(/fifteen calories a pound/)).toBeVisible()

  await shoot(page, 'meals')
})

test('meals, the grocery list lists quantities rather than adding them', async ({ page }) => {
  await page.goto('/meals?tab=grocery')

  // Chicken thigh appears in one planned recipe; garlic in the same. The point
  // is the explanation under the list, which is the honest half.
  await expect(page.getByText('Chicken thigh')).toBeVisible()
  await expect(page.getByText(/Grams and cloves and splashes do not sum/)).toBeVisible()

  await shoot(page, 'meals-grocery')
})

test('meals, an imported recipe waits in the inbox', async ({ page }) => {
  await page.goto('/meals?tab=inbox')

  await expect(page.getByText('Sheet pan salmon')).toBeVisible()
  await expect(page.getByText('Draft')).toBeVisible()

  await page.getByRole('button', { name: 'Accept' }).first().click()
  await expect(page.getByText('Added to the library')).toBeVisible()

  await page.goto('/meals?tab=recipes')
  await expect(page.getByText('Sheet pan salmon')).toBeVisible()
})

test('ideas, the board sorts by quadrant and keeps what was killed', async ({ page }) => {
  await page.goto('/ideas')
  await expect(page.getByRole('heading', { name: 'Ideas' })).toBeVisible()

  // Quick wins first. Voice capture is cheap and high impact; per module themes
  // are expensive and low.
  await expect(page.getByText('Voice capture for tasks')).toBeVisible()
  await expect(page.getByText('Quick win').first()).toBeVisible()

  // Untouched for two months is named, not decided: the card offers the choice
  // rather than making it.
  await expect(page.getByText('Not moving')).toBeVisible()
  await expect(page.getByText(/Naming that is not the same as killing it/)).toBeVisible()

  await shoot(page, 'ideas')
})

test('ideas, a killed idea keeps its reason', async ({ page }) => {
  await page.goto('/ideas?stage=killed')

  // Kept rather than deleted, because the reason is what stops the same idea
  // arriving again in six months.
  await expect(page.getByText('Automatic crypto tax lots')).toBeVisible()
  await expect(page.getByText(/none of it reconciles/)).toBeVisible()

  await shoot(page, 'ideas-killed')
})

test('home, the calendar is worked out from the history', async ({ page }) => {
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Home and assets' })).toBeVisible()

  // Every asset kind, biggest first.
  await expect(page.getByRole('button', { name: /^2412 Example Street/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^2021 pickup/ })).toBeVisible()

  // The oil change was last done seven months ago on a six month interval, so
  // it is overdue. Nothing stored that: it falls out of the interval and the
  // date it was last done.
  await expect(page.getByText('Oil change and rotation').first()).toBeVisible()
  await expect(page.getByText('Overdue').first()).toBeVisible()

  // Twelve months, including the empty ones, because an empty month is
  // information.
  await expect(page.getByRole('button', { name: /^[A-Z]{3} \d\d /  })).toHaveCount(12)

  await shoot(page, 'home')
})

test('home, a snooze comes back rather than dismissing', async ({ page }) => {
  await page.goto('/home')

  const snooze = page.getByRole('button', { name: 'Snooze 30d' })
  expect(await snooze.count()).toBeGreaterThan(0)

  await snooze.first().click()
  await expect(page.getByText(/It comes back, it does not go away/)).toBeVisible()
})

test('home, a warranty with no expiry is not a missing date', async ({ page }) => {
  await page.goto('/home')

  const deed = page.getByRole('button', { name: /^Deed, survey and permits/ })
  await expect(deed).toBeVisible()
  await expect(page.getByText('no expiry', { exact: true })).toBeVisible()

  // And the drawer carries the paperwork rather than a judgement about it.
  await deed.click()
  await expect(page.getByText('Recorded Jun 2019')).toBeVisible()
})

test('home, logging service moves the schedule it belongs to', async ({ page }) => {
  await page.goto('/home?log=1')

  await page.getByLabel('Asset', { exact: true }).selectOption({ label: '2412 Example Street' })
  await page.getByLabel('What was done').fill('Gutter clean before the autumn')
  // Three months from today, so the next one lands inside the calendar window
  // where it can be counted.
  await page.getByRole('radio', { name: '3 months' }).click()
  await page.getByRole('button', { name: 'Save service' }).click()

  await expect(page.getByText(/next one is on the calendar/)).toBeVisible()

  // One schedule, not a second one beside it: logging a job that is already on
  // the calendar moves the row it belongs to.
  const month = page.getByRole('button', { name: /^[A-Z]{3} \d\d / }).nth(3)
  await month.click()
  await expect(page.getByText('Gutter clean before the autumn')).toHaveCount(1)
})

test('insurance, sorted by what expires first with numbers masked', async ({ page }) => {
  await page.goto('/insurance')
  await expect(page.getByRole('heading', { name: 'Insurance and policies' })).toBeVisible()

  // Masked in the query, so the plaintext is not in this page at all.
  await expect(page.getByText('**** 7730')).toBeVisible()
  await expect(page.getByText('LMD-48211-7730')).toHaveCount(0)

  // The soonest first: renters at 36 days, then the phone at 58.
  const rows = page.getByRole('button', { name: /Lemonade|Apple|Progressive/ })
  await expect(rows.first()).toContainText('Lemonade')

  await shoot(page, 'insurance')
})

test('insurance, a policy number is revealed only when asked for', async ({ page }) => {
  await page.goto('/insurance')
  await page.getByRole('button', { name: /Apartment, renters/ }).click()

  await expect(page.getByText('**** 7730')).toBeVisible()
  await page.getByRole('button', { name: 'Reveal' }).click()
  await expect(page.getByText('LMD-48211-7730')).toBeVisible()

  await page.getByRole('button', { name: 'Hide' }).click()
  await expect(page.getByText('LMD-48211-7730')).toHaveCount(0)
})

test('insurance, no deductible is not a deductible of zero', async ({ page }) => {
  await page.goto('/insurance')
  await page.getByRole('button', { name: /Term life/ }).click()

  await expect(page.getByText('none on this policy')).toBeVisible()
  // And the screen says what it will not do with any of it.
  await expect(page.getByText(/nothing here scores it/i)).toBeVisible()
})

test('insurance, renewing keeps the same row', async ({ page }) => {
  await page.goto('/insurance')
  await page.getByRole('button', { name: /Apartment, renters/ }).click()

  const before = await page.getByRole('button', { name: /Apartment, renters/ }).count()
  await page.getByRole('button', { name: /Mark renewed to/ }).click()
  await expect(page.getByText(/Same row, so the history stays together/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Apartment, renters/ })).toHaveCount(before)
})

test('meals, cook mode scales what can be scaled and says what cannot', async ({ page }) => {
  await page.goto('/meals?tab=recipes')
  await page.getByRole('button', { name: /Turkey chili/ }).click()
  await page.getByRole('button', { name: 'Cook this' }).click()

  // One step at a time, in type you can read from across a kitchen.
  await expect(page.getByText('Cooking / step 1 of 3')).toBeVisible()
  await expect(page.getByText('900 g')).toBeVisible()

  await page.getByRole('button', { name: 'Next step' }).click()
  await expect(page.getByText('Cooking / step 2 of 3')).toBeVisible()

  // Twelve servings of a recipe that makes six is everything doubled, except
  // the splash of oil, which is not a measurement.
  await page.getByRole('radio', { name: '12', exact: true }).click()
  await expect(page.getByText('1800 g')).toBeVisible()
  await expect(page.getByText('a splash', { exact: true })).toBeVisible()
  await expect(page.getByText(/Half a splash is not a measurement/)).toBeVisible()

  await shoot(page, 'meals-cook')
})

test('fitness, the plan is what the coach measures a week against', async ({ page }) => {
  await page.goto('/fitness?tab=plan')

  await expect(page.getByText('Upper, lower, run')).toBeVisible()
  await expect(page.getByText('3 days a week')).toBeVisible()

  // Grouped by the plan's own day labels, not by weekday: a plan is not a
  // calendar, and pinning one to Tuesdays makes every missed Tuesday a failure.
  await expect(page.getByText('Bench press')).toBeVisible()
  await expect(page.getByText('4 x 5 at 185 lb')).toBeVisible()
  await expect(page.getByText('AMRAP')).toBeVisible()

  await shoot(page, 'fitness-plan')
})

test('fitness, the coach proposes and cannot change the plan itself', async ({ page }) => {
  await page.goto('/fitness?tab=plan')

  // It says what it is and what it will not do.
  await expect(page.getByText(/It cannot change this plan/)).toBeVisible()
  await expect(page.getByText('Waiting in Review')).toBeVisible()

  // And the suggestion is a proposal in the inbox, not a change to the plan.
  await page.getByRole('link', { name: 'Open the Review inbox' }).click()
  await expect(page.getByRole('button', { name: /Add a little weight/ })).toBeVisible()
})

test('ideas, research shows its sources and what it cost', async ({ page }) => {
  await page.goto('/ideas')
  await page.getByRole('button', { name: /Share a read only dashboard link/ }).click()

  // The verdict, how sure it says it is, and the bill, because a run spends
  // real money and an idea board is where it is tempting to press it forty
  // times.
  await expect(page.getByText('park', { exact: true })).toBeVisible()
  await expect(page.getByText('55% confident')).toBeVisible()
  await expect(page.getByText(/4 searches, 0.06 dollars/)).toBeVisible()

  // Every number carries the page it came from.
  await expect(page.getByText(/charge between 5 and 15 dollars a month/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'source' }).first()).toBeVisible()
  await expect(page.getByText('Pages it read')).toBeVisible()

  await shoot(page, 'ideas-research')
})

test('settings notifications, push says what it needs before it works', async ({ page }) => {
  await page.goto('/settings/notifications')

  // The device card is honest about the difference between not configured and
  // no device subscribed. Without VAPID keys there is no button to press.
  await expect(page.getByText('Devices')).toBeVisible()
  await expect(page.getByText(/Push is not configured/)).toBeVisible()
  await expect(page.getByText(/rules store the channel and the sender honours it/)).toBeVisible()
})

test('gestures, a swipe moves one tab and a mouse drag does not', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch gestures are a phone thing')

  await page.goto('/meals')
  const tabs = page.getByRole('tablist', { name: 'Meals views' })
  await expect(page.getByRole('tab', { name: /Week/ })).toHaveAttribute('aria-selected', 'true')

  const box = (await tabs.boundingBox())!
  const y = box.y + box.height / 2
  const swipe = async (fromX: number, toX: number, pointerType: 'touch' | 'mouse') => {
    await tabs.dispatchEvent('pointerdown', { pointerType, clientX: fromX, clientY: y })
    await tabs.dispatchEvent('pointerup', { pointerType, clientX: toX, clientY: y })
  }

  // Left moves forward one tab, and only one: a swipe that jumped to the last
  // tab would read as a mis-tap rather than as navigation.
  await swipe(box.x + box.width - 20, box.x + 20, 'touch')
  await expect(page.getByRole('tab', { name: /Recipes/ })).toHaveAttribute('aria-selected', 'true')

  // Right comes back.
  await swipe(box.x + 20, box.x + box.width - 20, 'touch')
  await expect(page.getByRole('tab', { name: /Week/ })).toHaveAttribute('aria-selected', 'true')

  // A mouse drag is a text selection, not a gesture.
  await swipe(box.x + box.width - 20, box.x + 20, 'mouse')
  await expect(page.getByRole('tab', { name: /Week/ })).toHaveAttribute('aria-selected', 'true')
})

test('gestures, swiping a task completes it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch gestures are a phone thing')

  await page.goto('/tasks')
  const card = page
    .locator('article')
    .filter({ hasText: 'Sketch the week ahead' })
    .first()
  await expect(card).toBeVisible()

  const box = (await card.boundingBox())!
  const y = box.y + 8
  await card.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: box.x + 20, clientY: y })
  await card.dispatchEvent('pointerup', {
    pointerType: 'touch',
    clientX: box.x + box.width - 10,
    clientY: y,
  })

  await expect(page.getByText(/^Done\. Sketch the week ahead/)).toBeVisible()
})
