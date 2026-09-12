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
  // The configured origin, not a hardcoded one. Cookies ignore the port, so
  // this happened to work on any localhost, which is exactly the kind of
  // accident that stops being one the day the suite runs against a host.
  await page.context().addCookies([
    { name: 'pos_theme', value: theme, url: process.env.E2E_BASE_URL ?? 'http://localhost:3000' },
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

  // The nav is built from manifests, so Dashboard has to be there for the
  // module contract to still be working.
  const nav = page.getByRole('navigation', { name: /modules|sections/i }).first()
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible()

  // The phone bar holds four named tabs and a More sheet, so which modules are
  // on the bar is a layout decision the design already made. What is worth
  // asserting is that both are reachable, wherever they sit.
  const mobile = (page.viewportSize()?.width ?? 0) < 720
  if (mobile) {
    await page.getByRole('group').getByText('More').click()
  }
  // By href: the sidebar prefixes each label with its two character index and
  // appends the pending count, so the accessible name is "RV Review 2", and
  // "Weekly review" would match a loose name filter anyway.
  await expect(nav.locator('a[href="/review"]')).toBeVisible()
  // PosSidebar.dc.html lists thirteen modules and Review. Notes is not one of
  // them, so the stub leaves the numbered rail and every index after it lines
  // up with the artboard. The route itself stays; the palette test proves it.
  await expect(nav.locator('a[href="/notes"]')).toHaveCount(0)

  if (!mobile) {
    // PosSidebar.dc.html at 1440x900: the order of the rail, top to bottom.
    const labels = await nav.locator('a').evaluateAll((links) =>
      links.map((a) => a.querySelector('.truncate')?.textContent?.trim()),
    )
    expect(labels).toEqual([
      'Dashboard',
      'Finance',
      'Skill Tree',
      'Tasks',
      'Goals',
      'Second Brain',
      'Insurance',
      'Ideas',
      'Fitness',
      'Health',
      'Home & Assets',
      'Meals',
      'Travel',
      'Review',
    ])

    // PosSidebar.dc.html: a row is 36px tall at least, its index is 11px mono,
    // and the Review badge is drawn in the accent, not the green.
    const row = nav.locator('a[href="/finance"]')
    const geometry = await row.evaluate((a) => {
      const index = a.querySelector('.label')!
      return {
        minHeight: getComputedStyle(a).minHeight,
        indexSize: getComputedStyle(index).fontSize,
      }
    })
    expect(geometry).toEqual({ minHeight: '36px', indexSize: '11px' })

    const badge = nav.locator('a[href="/review"] span').last()
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    )
    const badgeColor = await badge.evaluate((el) => getComputedStyle(el).color)
    const accentRgb = await page.evaluate((hex) => {
      const probe = document.createElement('span')
      probe.style.color = hex
      document.body.append(probe)
      const rgb = getComputedStyle(probe).color
      probe.remove()
      return rgb
    }, accent)
    expect(badgeColor).toBe(accentRgb)

    // POS Dashboard.dc.html at 1440x900: the artboard's nine tiles first, in
    // its default order, then every other module's tile in rail order. The
    // tile is 16px 20px inside a 1px --rule border, and the band's search is
    // the compact one with its placeholder.
    const bento = page.getByTestId('dashboard-bento')
    const eyebrows = await bento
      .locator(':scope > div')
      .evaluateAll((tiles) => tiles.map((t) => t.querySelector('.eyebrow')?.textContent?.trim()))
    expect(eyebrows.slice(0, 9)).toEqual([
      'Warnings',
      'Finance',
      'Tasks · today',
      'Review · agent proposals',
      'Goals',
      'Skill Tree',
      'System',
      'Model spend · month',
      'Next 7 days',
    ])
    expect(eyebrows.slice(9)).toEqual([
      'Second Brain',
      'Insurance',
      'Ideas',
      'Fitness',
      'Health',
      'Home & Assets',
      'Meals',
      'Travel',
      'Notes',
    ])
    const tile = await bento.locator(':scope > div > div').first().evaluate((el) => {
      const cs = getComputedStyle(el)
      const rule = getComputedStyle(document.documentElement).getPropertyValue('--rule').trim()
      const probe = document.createElement('span')
      probe.style.color = rule
      document.body.append(probe)
      const ruleRgb = getComputedStyle(probe).color
      probe.remove()
      return { padding: cs.padding, border: cs.borderTopColor === ruleRgb }
    })
    expect(tile).toEqual({ padding: '16px 20px', border: true })
    await expect(page.locator('header').getByText('What are you looking for?')).toBeVisible()

    // The footer is a list too: Dark (or Light) and Collapse are rows in it
    // with 13px labels, not a bar under it.
    const footer = page.getByRole('navigation', { name: /sections/i })
    await expect(footer.getByRole('button', { name: /^(Dark|Light)$/ })).toBeVisible()
    await expect(footer.getByRole('button', { name: 'Collapse' })).toBeVisible()
    const labelSize = await footer
      .getByRole('button', { name: 'Collapse' })
      .evaluate((b) => getComputedStyle(b).fontSize)
    expect(labelSize).toBe('13px')
  }

  // Closed with the summary that opened it. Escape does not close a `details`,
  // and the sheet is full width now, so leaving it open would be most of the
  // dashboard shot.
  if (mobile) {
    await page.getByRole('group').getByText('More').click()
    await expect(nav.locator('a[href="/review"]')).toBeHidden()
  }
  await shoot(page, 'dashboard')
})

test('dashboard, the week ahead and arranging the tiles', async ({ page }) => {
  await page.goto('/')

  // The strip is composed from what every module says is upcoming, so a dated
  // task from the Tasks module appears on a core screen without core reading
  // the tasks schema.
  await expect(page.getByText('Next 7 days')).toBeVisible()
  // Dated by the module that owns it, not by core.
  await expect(page.getByText('Pay the Amex statement')).toBeVisible()

  // Arrange lives in the header and the mode lives in the URL, which is what
  // lets the button be a link rather than a lifted piece of state.
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'Arrange' }).click()
  await expect(page).toHaveURL(/arrange=1/)
  await expect(page.getByText(/Arrange mode/)).toBeVisible()

  await page.getByRole('link', { name: 'Done', exact: true }).click()
  await expect(page.getByText(/Arrange mode/)).toBeHidden()
})

test('notes, the stub module page', async ({ page }) => {
  await page.goto('/notes')
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible()
  await shoot(page, 'notes')
})

test('skill tree, constellation and the selected skill panel', async ({ page }) => {
  // Three shots of the heaviest page in the app, each in two themes.
  test.slow()
  await page.goto('/skills')
  await expect(page.getByRole('heading', { name: 'Skill Tree' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Skill constellation' })).toBeVisible()

  // POS Skill Tree.dc.html opens on a skill (the top gainer), so the right
  // pane is never the empty explanation: the panel says how far the next
  // level is straight away.
  const detailPane = page.getByTestId('skill-tree-detail-pane')
  await expect(detailPane.getByText(/to Lv \d/)).toBeVisible()

  const mobile = (page.viewportSize()?.width ?? 0) < 720
  if (!mobile) {
    // Two flush halves under a 56px band, split by one rule; Reset view sits
    // in the band; the pips carry the artboard's six letter cuts; the hints
    // include the double click.
    const canvas = page.getByTestId('skill-tree-canvas-pane')
    const detail = page.getByTestId('skill-tree-detail-pane')
    const [cw, dw] = await Promise.all([
      canvas.evaluate((el) => el.getBoundingClientRect().width),
      detail.evaluate((el) => el.getBoundingClientRect().width),
    ])
    expect(Math.abs(cw - dw) / Math.max(cw, dw)).toBeLessThan(0.08)
    await expect(page.locator('header').getByRole('button', { name: 'Reset view' })).toBeVisible()
    await expect(page.getByText(/skills active/)).toHaveCount(0)
    const pips = await canvas.getByTestId('skill-pip-label').allTextContents()
    expect(pips.length).toBeGreaterThan(2)
    for (const label of pips) expect(label.trim().length).toBeLessThanOrEqual(6)
    await expect(canvas.getByText('Double-click: zoom')).toBeVisible()
  }
  await shoot(page, 'skills')

  // The demo seed classifies notes through the keyword rules, so Engineering
  // has real XP and real events without anything being staged for the shot.
  await page.getByRole('button', { name: /^Engineering$|^ENGINE$/i }).first().click()
  await expect(detailPane.getByText(/to Lv \d/)).toBeVisible()
  // Goals does not exist, so the goal weight is a dash rather than a number.
  // Exact: the digest column beside it is "Goal weight high, low activity",
  // which is the artboard's own wording for a different thing.
  await expect(page.getByText('Goal weight', { exact: true })).toBeVisible()

  // The selection is in the URL, which is what lets it survive the reload that
  // shoot() does to switch themes.
  await expect(page).toHaveURL(/skill=engineering/)
  await expect(page.getByText('Children', { exact: true })).toBeVisible()
  await shoot(page, 'skills-branch')

  // A leaf: the events behind it, each one a thing that can be dragged to
  // another skill, and the keywords that classify to it.
  await page.goto('/skills?skill=typescript')
  await expect(page.getByText(/Events · 30 days/)).toBeVisible()
  await expect(page.getByText(/Keywords · skills\.yaml/)).toBeVisible()
  await shoot(page, 'skills-leaf')
})

test('skill tree, the constellation hovers, selects, pans and zooms', async ({ page }) => {
  await page.goto('/skills')
  await page.waitForLoadState('networkidle')

  const star = page.locator('g[data-skill="coding"]')

  // Hover draws the design's card beside the star: what it is, how many
  // branches hang off it, their levels, and what the month came to.
  await page.locator('g[data-skill="health"]').hover({ force: true })
  await expect(page.getByText(/branches/)).toBeVisible()
  await expect(page.getByText(/XP in 30 days/)).toBeVisible()

  await star.hover({ force: true })
  await expect(page.getByText('Coding', { exact: true }).first()).toBeVisible()

  // Clicking a star opens it in the panel. This used to do nothing: the svg
  // captured the pointer on pointerdown, which retargets the click away from
  // the node and onto the canvas.
  await star.click({ force: true })
  await expect(page).toHaveURL(/skill=coding/)

  // Zoom anchors on the cursor, and a step is symmetric: in then out puts the
  // node back exactly where it was, at the size it was.
  const before = (await star.boundingBox())!
  const at = { x: before.x + before.width / 2, y: before.y + before.height / 2 }

  await page.mouse.move(at.x, at.y)
  await page.mouse.wheel(0, -240)
  const zoomed = (await star.boundingBox())!
  expect(zoomed.width).toBeGreaterThan(before.width)
  expect(Math.abs(zoomed.x + zoomed.width / 2 - at.x)).toBeLessThan(4)

  await page.mouse.wheel(0, 240)
  const back = (await star.boundingBox())!
  expect(Math.abs(back.x - before.x)).toBeLessThan(2)
  expect(Math.abs(back.y - before.y)).toBeLessThan(2)

  // Dragging pans and does not select: a pan that ends on a star is not a
  // click on it.
  await page.goto('/skills')
  await page.mouse.move(at.x, at.y)
  await page.mouse.down()
  await page.mouse.move(at.x + 90, at.y + 40, { steps: 8 })
  await page.mouse.up()
  await expect(page).not.toHaveURL(/skill=/)
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
  // The shortcut is a document listener React attaches on mount, so a press
  // before hydration lands on nothing and is not retried. This test failed
  // twice under load for exactly that reason.
  await page.waitForLoadState('networkidle')

  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog', { name: /command palette/i })
  await expect(palette).toBeVisible()

  // The Go to list is the same nav the sidebar builds, so it is there before
  // anything is typed.
  await expect(palette.getByRole('button', { name: /Settings/ })).toBeVisible()
  // Notes left the numbered rail to match the artboard; the palette is where
  // an enabled module with no row on the rail is still one keystroke away.
  await expect(palette.getByRole('button', { name: /^Notes/ })).toBeVisible()

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
  // route, so it needs no secret. The phone band has no button for it, as
  // its artboard has none (pull to sync is the gesture), so the phone reads
  // whatever the last run wrote.
  if ((page.viewportSize()?.width ?? 0) >= 720) {
    await page.getByRole('button', { name: /^run now$/i }).click()
    await expect(page.getByText(/^Run clean$|jobs? failed/i)).toBeVisible({ timeout: 20_000 })
    await page.reload()
  }

  // Tile labels are uppercased by CSS, so the DOM still says "Warnings".
  const main = page.getByRole('main')
  await expect(main.getByText('Warnings')).toBeVisible()
  await expect(main.getByText('System')).toBeVisible()
  await expect(main.getByText('Model spend')).toBeVisible()
  // One tile per module that wrote a digest, so the page needs no knowledge of
  // any module to show its numbers. The tile's head is the link in, as drawn.
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
  // No title block: the band carries the crumb with the view, and the count.
  await expect(page.getByText('Tasks / Today')).toBeVisible()
  await expect(page.getByText(/\d+ open · \d+ done today/)).toBeVisible()

  // Today holds what is due today and what slipped, because a slip is today.
  await expect(page.getByText(/^Today · \w{3} \w{3} \d+$/)).toBeVisible()
  await expect(page.getByText('Recurring detection tests')).toBeVisible()
  await expect(page.getByText('Read DDIA ch. 5, Replication')).toBeVisible()

  // The tabs in the artboard's order, Calendar before Review.
  const tabs = page.getByRole('tab')
  await expect(tabs).toHaveText([/Today/, /This week/, /By goal/, /By project/, /Calendar/, /Review/, /Done/])

  // The parser says what it understood before anything is saved.
  const line = page.getByLabel('Add a task')
  // Deliberately not a phrase any seeded task starts with, or the parsed title
  // matches a card on the board behind it as well as the preview.
  await line.fill('Ring the plumber !p1 #Home @tomorrow 15m')
  // The chips sit inside the field and carry the value alone, as the artboard
  // has them: the token that produced each one is still on the line beside it.
  const chips = page.locator('form:has([aria-label="Add a task"])')
  await expect(chips.getByText('Tomorrow')).toBeVisible()
  await expect(chips.getByText('P1')).toBeVisible()
  await expect(chips.getByText('Home')).toBeVisible()
  await expect(chips.getByText('15m')).toBeVisible()
  await line.fill('')

  await shoot(page, 'tasks')
})

test('tasks, a row expands in place and EDIT opens the form drawer', async ({ page }) => {
  await page.goto('/tasks')

  // One click opens the band under the row: notes, goal, skills, source.
  await page.getByRole('button', { name: /^Recurring detection tests/ }).click()
  const row = page.locator('article').filter({ hasText: 'Recurring detection tests' })
  await expect(row.getByText('Source:')).toBeVisible()
  await expect(row.getByText('Skills:')).toBeVisible()
  await expect(row.getByText('Same merchant, amount within 10 percent')).toBeVisible()
  await shoot(page, 'tasks-expanded')

  // EDIT opens the drawer, whose state is the URL so the shot survives.
  await page.getByRole('button', { name: 'Edit Recurring detection tests' }).click()
  await expect(page).toHaveURL(/task=/)
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Tasks / Edit')).toBeVisible()
  await expect(drawer.getByText('Linked skills')).toBeVisible()
  await shoot(page, 'tasks-drawer')

  // Edits hold until Save, then land as one write.
  await drawer.getByLabel('Estimate · min').fill('95')
  await drawer.getByRole('button', { name: /^Save/ }).click()
  await expect(page.getByText('Saved')).toBeVisible()
  await expect(page.locator('article').filter({ hasText: 'Recurring detection tests' }).getByText('95m')).toBeVisible()
})

test('tasks, the six views and the month grid', async ({ page }) => {
  await page.goto('/tasks')

  // Review holds agent-proposed work, which is a real row that does not count
  // until it is accepted.
  await page.getByRole('tab', { name: /Review/ }).click()
  await expect(page.getByText('Test the bank sync against three months of history')).toBeVisible()
  await expect(page.getByText('AGENT · REVIEW').first()).toBeVisible()
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

  // The month grid is a view like the others, so it is a tab rather than a
  // button beside them.
  await page.getByRole('tab', { name: 'Calendar' }).click()
  await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible()
  await expect(page.getByText(/\d+ open · \d+ with reminders/)).toBeVisible()
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

test('tasks, Delete asks and then removes the row', async ({ page }) => {
  await page.goto('/tasks')

  // Its own row, added on the line and removed from the band, so no other
  // test loses the one it was written against.
  const line = page.getByLabel('Add a task')
  await line.fill('Throw away this row @today')
  await line.press('Enter')
  await expect(page.getByText('Added. Throw away this row')).toBeVisible()

  await page.getByRole('button', { name: /^Throw away this row/ }).click()
  page.once('dialog', (d) => d.accept())
  await page
    .locator('article')
    .filter({ hasText: 'Throw away this row' })
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(page.getByText('Deleted')).toBeVisible()
  await expect(page.locator('article').filter({ hasText: 'Throw away this row' })).toHaveCount(0)
})

test('goals, progress by area with the rule behind each status', async ({ page }) => {
  await page.goto('/goals')
  await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible()
  // The band's summary, with the dot in the worst colour on the page.
  await expect(page.getByText(/\d+ active · \d+ at risk · \d+ stalled/)).toBeVisible()

  // Grouped by life area, each group counting what is on track, and every
  // status carries the sentence that produced it rather than only a colour.
  await expect(page.getByText(/^\d+ goals? · \d+ on track$/).first()).toBeVisible()
  const netWorth = page.locator('article').filter({ hasText: 'Net worth $300k' })
  await expect(netWorth.getByText('$247,200')).toBeVisible()
  await expect(netWorth.getByText('/ $300,000')).toBeVisible()
  await expect(page.getByText('No change in 40 days.')).toBeVisible()
  await expect(page.getByText(/Pace .* vs .* needed \(\d+%\)\./).first()).toBeVisible()

  // The demo history is shaped so every rule is on screen at once.
  await expect(page.getByText('STALLED').first()).toBeVisible()
  await expect(page.getByText('AT RISK').first()).toBeVisible()
  await expect(page.getByText('ON TRACK').first()).toBeVisible()

  // The card names the next linked task, which Tasks answers through core.
  await expect(netWorth.getByText(/^Next: /)).toBeVisible()

  await shoot(page, 'goals')
})

test('goals, the drawer shows the rule, both projections and what is linked', async ({ page }) => {
  await page.goto('/goals')
  await page.getByRole('button', { name: /Net worth \$300k/ }).click()

  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Status rule')).toBeVisible()
  await expect(drawer.getByText('Days left', { exact: true })).toBeVisible()
  // Two projections, labelled, because they disagree exactly when it matters.
  await expect(drawer.getByText('Projected · last 30d pace')).toBeVisible()
  await expect(drawer.getByText('Projected · all history')).toBeVisible()
  // Linked tasks come from Tasks through the contract, not from a join.
  await expect(drawer.getByText('Linked tasks')).toBeVisible()
  await expect(drawer.getByText('Pay the Amex statement')).toBeVisible()
  await expect(drawer.getByText('Linked skills')).toBeVisible()

  // The open goal is in the URL, which is what lets it survive the reload
  // shoot() does to switch themes. Without it the shot would show the list.
  await expect(page).toHaveURL(/goal=/)
  await shoot(page, 'goals-drawer')

  // Edit turns the drawer into a form; the picker lists what modules actually
  // register, so Tasks metrics appear here without Goals knowing its schema.
  await page.getByRole('dialog').getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page).toHaveURL(/edit=1/)
  const form = page.getByRole('dialog')
  await expect(form.getByText('Goals / Edit')).toBeVisible()
  await expect(form.getByLabel('Metric source')).toBeVisible()
  await expect(form.locator('option', { hasText: 'Tasks completed this week' })).toHaveCount(1)
  await expect(form.getByRole('button', { name: /^Save/ })).toBeVisible()
  await shoot(page, 'goals-edit')
})

test('goals, adding one inline from the page', async ({ page }) => {
  await page.goto('/goals')
  await page.waitForLoadState('networkidle')

  // The form is in the URL, which is what lets a half typed goal survive the
  // reload the theme toggle does.
  await page.getByRole('button', { name: '+ Add a goal inline' }).click()
  await expect(page).toHaveURL(/new=1/)

  // Scoped to the form: "Goal" also names a field in the drawer behind it.
  const form = page.locator('form').filter({ hasText: 'Deadline' })
  await form.getByLabel('Goal').fill('Swim 2km without stopping')
  await form.getByLabel('Target').fill('2')
  await form.getByLabel('Deadline').fill('2027-03-01')
  await form.getByRole('button', { name: 'Add', exact: true }).click()

  // The card, not the toast that also names it.
  await expect(
    page.getByRole('button', { name: /Swim 2km without stopping/ }).first(),
  ).toBeVisible()

  // And Delete takes it away again, after asking.
  await page.getByRole('button', { name: /Swim 2km without stopping/ }).first().click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Deleted')).toBeVisible()
  await expect(page.locator('article').filter({ hasText: 'Swim 2km without stopping' })).toHaveCount(0)
})

test('goals, a check-in moves the goal', async ({ page }) => {
  await page.goto('/goals')
  await page.getByRole('button', { name: /Deadlift 405/ }).click()

  const drawer = page.getByRole('dialog')
  await drawer.getByLabel('Check in on Deadlift 405').fill('355')
  await drawer.getByRole('button', { name: 'Check in' }).click()
  await expect(page.getByText('Checked in')).toBeVisible()

  // Twice on purpose: the card behind the drawer and the drawer's own Now
  // figure, both re-read from the database after the write.
  await expect(page.getByText('355 lb')).toHaveCount(2)

  // Stalled was the whole point of that goal's history; a fresh reading clears
  // it, which is the rule doing its job rather than a label being flipped.
  await expect(page.getByText('No change in 40 days.')).toBeHidden()
})

test('weekly review, six steps and a note built from the answers', async ({ page }) => {
  await page.goto('/weekly-review')
  await expect(page.getByRole('heading', { name: 'Weekly review' })).toBeVisible()

  // Step one is the artboard's six tiles, in its order, each from a module's
  // digest. POS Weekly Review.dc.html at 1440x900.
  const tiles = page.locator('main').getByText(
    /^(Tasks closed|Slipped|Spend vs budget|Net worth|Workouts|XP earned)$/,
  )
  await expect(tiles).toHaveText([
    'Tasks closed',
    'Slipped',
    'Spend vs budget',
    'Net worth',
    'Workouts',
    'XP earned',
  ])
  // The sentence under them is read off the tiles, so it names the modules that
  // wrote them rather than a fixed list.
  await expect(page.getByText(/^Pulled from .*Tasks.*\. Nothing here needs your input/)).toBeVisible()
  await expect(page.getByText(/^The shape of the week:/)).toBeVisible()
  await shoot(page, 'weekly-review')

  // Every click below needs a hydrated page: a click that lands before React
  // attaches is swallowed, and the assertions after it then pass or fail on
  // whatever the server rendered rather than on what the click did.
  await page.waitForLoadState('networkidle')

  // The band's theme button, as the artboard draws it beside the duration. It
  // names the theme you are on and shares the setting with the sidebar row,
  // so one click moves both. Desktop only: the sidebar is not on a phone.
  if ((page.viewportSize()?.width ?? 0) >= 720) {
    // shoot() leaves the cookie on dark but the page on its last shot, light.
    await page.reload()
    await page.waitForLoadState('networkidle')
    const band = page.locator('header').getByRole('button', { name: /^dark$/i })
    await band.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Light', exact: true })).toBeVisible()
    await page.locator('header').getByRole('button', { name: /^light$/i }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  }

  // The first step's primary is named for what it starts, not for advancing.
  await page.getByRole('button', { name: 'Start the review' }).click()
  await page.getByLabel('Add a win').fill('Shipped the notifications screen')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('Shipped the notifications screen')).toBeVisible()
  await shoot(page, 'weekly-review-wins')

  // Step three: every slipped item needs a decision, and the wizard says how
  // many are still owed rather than letting you walk past silently.
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText(/still undecided/)).toBeVisible()

  // Deciding one of them is what the step is for, so the count says so.
  await page.getByRole('radio', { name: /^Carry$/ }).first().click()
  await expect(page.getByText(/1 of \d+ decided/)).toBeVisible()

  await shoot(page, 'weekly-review-misses')

  // Steps four and five, for the shots: the goals hand over their own bars and
  // sentences, and the backlog lists what was carried before what is new.
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/step=goals/)
  await shoot(page, 'weekly-review-goals')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/step=plan/)
  await expect(page.getByText(/of 3 picked/)).toBeVisible()
  await shoot(page, 'weekly-review-plan')
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

  // Nothing is generated on the server that is not shown here first: the same
  // four blocks the note is written from are drawn on the step.
  await expect(page.getByText('Wins', { exact: true })).toBeVisible()
  await expect(page.getByText('Next week', { exact: true })).toBeVisible()

  // And it says where the note lands rather than implying a filing.
  await expect(page.getByText(/Saves to|Kept on the review/)).toBeVisible()

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

  const mobile = (page.viewportSize()?.width ?? 0) < 720
  if (!mobile) {
    // POS Finance.dc.html at 1440: one overview, no tabs; the four KPI cells in
    // its order; the accounts table's columns; the Budgets head's Edit limits;
    // 9px rows; the title block's sentence.
    await expect(page.getByRole('tablist')).toHaveCount(0)
    await expect(page.getByText('Balances, upcoming charges, and budgets. Synced nightly, amounts in USD.')).toBeVisible()
    const strip = page.getByTestId('finance-kpis')
    await expect(strip.locator('.eyebrow')).toHaveText([
      'Net worth',
      '30-day change',
      'Due in 14 days',
      /Budgets over \d+%/,
    ])
    const accounts = page.getByTestId('finance-accounts')
    await expect(accounts.locator('[data-table-head] span')).toHaveText(['Account', 'Institution', 'Balance', '30d', 'Share'])
    const rowPadding = await accounts
      .getByRole('button')
      .first()
      .evaluate((el) => getComputedStyle(el).padding)
    expect(rowPadding).toBe('9px 0px')
    await expect(page.getByRole('button', { name: /edit limits/i })).toBeVisible()
  }

  await shoot(page, 'finance')

  // Budgets: the tick is the month pace, and a fixed cost at its limit is not
  // flagged, because rent at 100 percent every month is not news. On the phone
  // this is a segment; on the desktop it is a card on the one page.
  if (mobile) {
    await page.getByRole('tab', { name: /Budgets/ }).click()
    await expect(page).toHaveURL(/tab=budgets/)
    await expect(page.getByText(/105% used/)).toBeVisible()
  } else {
    await expect(page.getByTestId('finance-budgets').getByText('Fixed', { exact: true })).toBeVisible()
  }
  await expect(page.getByText('Fixed', { exact: true }).first()).toBeVisible()
  await shoot(page, 'finance-budgets')
})

test('finance, the detector found the subscriptions and left the rest alone', async ({ page }) => {
  // The phone's Subscriptions segment; on the desktop the fortnight's charges
  // in the Upcoming card, which the detector also feeds.
  const mobile = (page.viewportSize()?.width ?? 0) < 720
  await page.goto(mobile ? '/finance?tab=subscriptions' : '/finance')
  const scope = mobile ? page : page.getByTestId('finance-upcoming')

  // Seeded recurring merchants, found by detectRecurring rather than listed by
  // the fixture.
  await expect(scope.getByText('Anthropic Claude Pro')).toBeVisible()
  await expect(scope.getByText('Neighbourhood Gym')).toBeVisible()

  // And nothing that merely repeats: the shops appear in the ledger many times
  // without a rhythm, and payroll is the most regular thing in the data.
  await expect(scope.getByText('Kroger')).toBeHidden()
  await expect(scope.getByText('Payroll')).toBeHidden()

  await shoot(page, 'finance-subscriptions')
})

test('finance, filing a transaction teaches the rule', async ({ page }) => {
  const mobile = (page.viewportSize()?.width ?? 0) < 720
  if (mobile) {
    await page.goto('/finance?tab=transactions')
  } else {
    // The desktop files from a drawer: the category under the merchant is the
    // control, as the artboard's row leaves no room for a button.
    await page.goto('/finance')
    await page.getByTestId('finance-accounts').getByRole('button', { name: /Credit card/ }).click()
    await expect(page).toHaveURL(/account=/)
  }

  const row = page.getByText('Coffee bar').first()
  await expect(row).toBeVisible()

  await page.getByRole('button', { name: /^File Coffee bar/ }).first().click()
  await page.getByRole('button', { name: 'Dining', exact: true }).first().click()
  await expect(page.getByText(/the rule learned it/)).toBeVisible()
  await shoot(page, 'finance-account')
})

test('finance, the limits drawer holds edits until Done', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 720, 'desktop drawer')
  await page.goto('/finance')
  await page.getByRole('button', { name: /edit limits/i }).click()
  await expect(page).toHaveURL(/limits=1/)
  await expect(page.getByRole('heading', { name: 'Budget limits' })).toBeVisible()
  await expect(page.getByText('No changes')).toBeVisible()
  // The shot first: shoot() reloads for its two themes, and a held edit is
  // exactly the kind of state that does not survive a reload.
  await shoot(page, 'finance-limits')
  await page.waitForLoadState('networkidle')

  // Move the threshold: nothing is written until Done, and the hint says so.
  const slider = page.getByRole('slider', { name: /alert threshold/i })
  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('1 unsaved change')).toBeVisible()

  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.getByText('No changes')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page).not.toHaveURL(/limits=1/)
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

  // POS Second Brain.dc.html: the band alone (the h1 is for the reader), the
  // folder row of chips in the artboard's order, no tab row.
  await expect(page.getByRole('heading', { name: 'Second Brain', level: 1 })).toHaveClass(/sr-only/)
  await expect(page.getByRole('tablist')).toHaveCount(0)
  await expect(page.getByText(/^Second Brain\s*\/\s*Inbox$/)).toBeVisible()
  // The count sits in the band from md up; the phone band has no room for it.
  if ((page.viewportSize()?.width ?? 0) >= 720) {
    await expect(page.getByText(/^\d+ notes$/)).toBeVisible()
  }
  await expect(page.getByRole('button', { name: /^Ingest/ })).toBeVisible()
  const folders = page.getByTestId('brain-folders').getByRole('button')
  await expect(folders).toHaveText(
    [/^Inbox/, /^Reading list/, /^articles/, /^books/, /^videos/, /^notes/, /^projects/, /^people/, /^daily/],
  )
  await expect(page.getByText('Inbox · drafts')).toBeVisible()
  await expect(page.getByText(/^\d+ awaiting$/)).toBeVisible()

  // The first row is open without a click, as the artboard has it. A draft is
  // a proposal about a note, not a note, and it waits here beside the text it
  // was drawn from rather than being taken on trust.
  await expect(page.getByText('Draft · awaiting your approval')).toBeVisible()
  await page.getByRole('button', { name: /Why solo builders ship one module at a time/ }).click()
  await expect(page.getByText(/The itch to start module two/)).toBeVisible()
  await expect(page.getByText('Source', { exact: true })).toBeVisible()
  await expect(page.getByText('Draft summary')).toBeVisible()
  for (const name of ['Discard', 'Edit', /^Accept/]) {
    await expect(page.getByRole('button', { name })).toBeVisible()
  }

  await shoot(page, 'second-brain')
})

// SPEC section 6's ingestion. The fetch itself needs the network, so what is
// checked here is the drawer being where a draft would start, and the refusal
// that happens before any request goes out.
test('second brain, a URL can be read into a draft', async ({ page }) => {
  await page.goto('/brain')
  await page.getByRole('button', { name: /^Ingest/ }).click()

  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText(/^Second Brain\s*\/\s*Ingest$/)).toBeVisible()
  await expect(drawer.getByTestId('brain-ingest-kinds').getByRole('button')).toHaveText([
    'URL',
    'YouTube',
    'Book',
    'Note',
  ])
  const url = drawer.getByLabel('URL', { exact: true })
  await expect(url).toBeVisible()
  await expect(drawer.getByRole('button', { name: /^Draft summary/ })).toBeDisabled()

  // A private address is refused before anything is fetched: this runs in a
  // server action, so the request would go out from inside the deployment.
  await url.fill('http://169.254.169.254/latest/meta-data/')
  await drawer.getByRole('button', { name: /^Draft summary/ }).click()
  await expect(page.getByText(/private network/)).toBeVisible()

  // The drawer lives in the URL, so it survives the two reloads of shoot().
  await expect(page).toHaveURL(/ingest=1/)
  await shoot(page, 'second-brain-ingest')
})

test('second brain, links resolve both ways and a dangling one is kept', async ({ page }) => {
  await page.goto('/brain?folder=note&note=reciprocal-rank-fusion')

  // The path eyebrow, and two notes that point at each other.
  await expect(page.getByText(/^notes\s*\/\s*reciprocal-rank-fusion\.md$/)).toBeVisible()
  await expect(page.getByText('Backlinks')).toBeVisible()
  await expect(page.getByRole('button', { name: '[[Hybrid search]]' })).toBeVisible()
  await expect(page.getByText('Links to write')).toHaveCount(0)

  // And one link points at a note nobody has written. It is kept and offered
  // on that note, because it is usually the best idea of what to write next.
  await page.goto('/brain?folder=article&note=the-boring-technology-club')
  await expect(page.getByText('Links to write')).toBeVisible()
  await expect(page.getByRole('button', { name: 'build order', exact: true })).toBeVisible()

  await page.goto('/brain?folder=note&note=reciprocal-rank-fusion')
  await shoot(page, 'second-brain-links')
})

test('second brain, the reading list is what was finished', async ({ page }) => {
  await page.goto('/brain?folder=reading')

  // Adding a book or an article here means it was read, so every accepted one
  // carries the date it was accepted and there is no button to press.
  await expect(page.getByText('Reading list', { exact: true }).nth(1)).toBeVisible()
  await expect(page.getByText(/^\d+ finished$/)).toBeVisible()
  const row = page.getByRole('button', { name: /Designing Data-Intensive Applications, ch\. 5/ })
  await expect(row).toContainText(/FINISHED · \w{3} \d+/)
  await expect(page.getByRole('button', { name: /Mark finished/ })).toHaveCount(0)

  await shoot(page, 'second-brain-reading')
})

test('second brain, accepting a draft moves it into the vault', async ({ page }) => {
  await page.goto('/brain?note=postgres-full-text-search-briefly')

  await page.getByRole('button', { name: /^Accept/ }).click()
  await expect(page.getByText('Accepted')).toBeVisible()

  // Out of the inbox and into its kind, and finished by being there.
  await page.goto('/brain?folder=article')
  const row = page.getByRole('button', { name: /Postgres full text search, briefly/ })
  await expect(row).toBeVisible()
  await expect(row).toContainText(/FINISHED · \w{3} \d+/)
  await expect(page.getByRole('button', { name: 'Send back to the inbox' })).toHaveCount(0)
})

test('travel, trips with confirmed spend only', async ({ page }) => {
  await page.goto('/travel')
  await expect(page.getByRole('heading', { name: 'Travel' })).toBeVisible()

  // POS Travel.dc.html: no page tabs; the loyalty strip under the band with
  // Manage; Upcoming, Past and Wishlist sections; a card that counts its
  // bookings; the globe's four controls.
  await expect(page.getByRole('tablist')).toHaveCount(0)
  await expect(page.getByTestId('travel-loyalty').getByRole('button', { name: /manage/i })).toBeVisible()
  for (const head of ['Upcoming', 'Past', 'Wishlist']) {
    await expect(page.getByTestId('travel-sections').getByText(head, { exact: true })).toBeVisible()
  }
  const tokyo = page.getByRole('button', { name: /Tokyo/ }).first()
  await expect(tokyo).toBeVisible()
  await expect(tokyo).toContainText(/\d\/4 booked/)
  // A pending booking is a guess about an email, so it does not move a budget:
  // the card's figure is confirmed spend against the plan.
  await expect(tokyo).toContainText(/\$[\d,]+ \/ \$[\d,]+/)
  for (const name of ['Zoom in', 'Zoom out', 'Reset view', /Flat|Globe/]) {
    await expect(page.getByTestId('travel-globe').getByRole('button', { name })).toBeVisible()
  }
  await shoot(page, 'travel')

  // The drawer opens from the card; the Budget tab has the planned total.
  await page.waitForLoadState('networkidle')
  await tokyo.click()
  await expect(page).toHaveURL(/trip=/)
  await page.getByRole('tab', { name: 'Budget' }).click()
  await expect(page.getByText('Planned · total')).toBeVisible()
  await shoot(page, 'travel-budget')
})

test('travel, the globe is drawn from real coordinates', async ({ page }) => {
  await page.goto('/travel')

  // Hand rolled orthographic projection, no d3 and no world-atlas download;
  // the land is a committed list of points.
  const globe = page.getByRole('img', { name: /Globe showing \d+ places/ })
  await expect(globe).toBeVisible()

  // Only the near side is drawn, so the pins on screen are fewer than the six
  // seeded places spread across four continents, and the land is many dots.
  const pins = globe.locator('[data-pin]')
  expect(await pins.count()).toBeGreaterThan(1)
  // One path for the land, a dash per point: thousands of them on the near side.
  const dashes = await globe.locator('[data-land]').getAttribute('d')
  expect((dashes?.match(/M/g) ?? []).length).toBeGreaterThan(500)

  // The pin's own tooltip is what makes a dot identifiable at all: a visited
  // place names itself and its country.
  await expect(globe.locator('[data-pin="past"] title').first()).toHaveText(/\w+, \w+/)
  await shoot(page, 'travel-map')
})

test('travel, a parsed booking waits in the trip inbox', async ({ page }) => {
  await page.goto('/travel')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /Tokyo/ }).first().click()
  // The drawer's state lives past the navigation that opens it; act after it.
  await expect(page).toHaveURL(/trip=/)
  await page.getByRole('tab', { name: /Inbox/ }).click()

  await expect(page.getByText('Check in, Kyoto')).toBeVisible()
  await expect(page.getByText(/confidence 94%/)).toBeVisible()
  await shoot(page, 'travel-inbox')

  await page.getByRole('button', { name: 'Add', exact: true }).first().click()
  await expect(page.getByText('Added to the trip')).toBeVisible()
})

test('travel, packing and budget lines are edited in the drawer', async ({ page }) => {
  await page.goto('/travel')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /Tokyo/ }).first().click()
  await expect(page).toHaveURL(/trip=/)

  await page.getByRole('tab', { name: 'Packing' }).click()
  const packed = page.getByText(/\d+ \/ \d+ packed/)
  const before = (await packed.textContent()) ?? ''
  await page.getByPlaceholder('Add an item').fill('Travel adapter')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('Travel adapter')).toBeVisible()
  await expect(packed).not.toHaveText(before)
  await shoot(page, 'travel-packing')

  await page.getByRole('tab', { name: 'Budget' }).click()
  await page.getByPlaceholder(/Add a category/).fill('Gifts 200')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('Gifts', { exact: true })).toBeVisible()
})

test('travel, cents per point uses only numbers you supply', async ({ page }) => {
  await page.goto('/travel')
  await page.waitForLoadState('networkidle')
  await page.getByTestId('travel-loyalty').getByRole('button', { name: /manage/i }).click()

  await page.getByLabel('Cash fare in dollars').fill('640')
  await page.getByLabel('Points required').fill('35000')

  // 64000 cents over 35000 points is 1.83 cents each, which is worth using.
  await expect(page.getByText('1.83c')).toBeVisible()
  await expect(page.getByText('worth using points')).toBeVisible()

  await page.getByLabel('Points required').fill('60000')
  await expect(page.getByText('pay cash', { exact: true })).toBeVisible()
  await shoot(page, 'travel-loyalty')
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

test('health, the rail says what is owed and what cover costs', async ({ page }) => {
  await page.goto('/health')

  // Three things that are true whichever tab is open.
  await expect(page.getByText('Due and overdue')).toBeVisible()
  await expect(page.getByText('Insurance and cost')).toBeVisible()

  // The cost comes from the Insurance module's digest, not from a number
  // copied into Health, so there is one figure and it is the current one.
  await expect(page.getByText('Premiums a year')).toBeVisible()
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

  // The band: how much of the week is planned and the protein average. The
  // phone band has no room for it, as on every other screen.
  const mobile = (page.viewportSize()?.width ?? 0) < 720
  if (!mobile) await expect(page.getByText(/\d+ \/ 28 planned · \d+g protein avg/)).toBeVisible()

  // Two tabs. The grocery list is a drawer and drafts sit in the recipe grid.
  const tabs = page.getByRole('tab')
  await expect(tabs).toHaveText([/^Week/, /^Recipes/])

  // Monday to Sunday as columns, slots as rows, a totals row under them.
  await expect(page.getByText('MON', { exact: true })).toBeVisible()
  await expect(page.getByText('SUN', { exact: true })).toBeVisible()
  await expect(page.getByText('TOTAL', { exact: true })).toBeVisible()

  // Today: what was eaten, against the one target the app has. A plan is not
  // a log until the meal is ticked.
  await expect(page.getByText('Eaten so far')).toBeVisible()
  await expect(page.getByText('Calories', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark eaten', exact: true }).first()).toBeVisible()

  // The week cells. The calorie target comes from Fitness through the
  // registry and is labelled an estimate rather than a prescription.
  await expect(page.getByText('Week · kcal / day')).toBeVisible()
  await expect(page.getByText('Week · protein / day')).toBeVisible()
  await expect(page.getByText('Week · cost')).toBeVisible()
  await expect(page.getByText('Cooked', { exact: true })).toBeVisible()
  await expect(page.getByText(/15 kcal a pound/)).toBeVisible()

  await shoot(page, 'meals')

  // A week paged to is read from the URL and has no Today strip.
  await page.goto('/meals?week=-1')
  await expect(page.getByText(/Last week · /)).toBeVisible()
  await expect(page.getByText('Eaten so far')).toHaveCount(0)
  await shoot(page, 'meals-week-last')
})

test('meals, the grocery list lists quantities rather than adding them', async ({ page }) => {
  await page.goto('/meals?drawer=grocery')

  // Grouped by recipe, quantities as written. The point is the sentence
  // under the list, which is the honest half.
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByRole('heading', { name: 'Grocery list' })).toBeVisible()
  await expect(drawer.getByText('Chicken thigh')).toBeVisible()
  await expect(drawer.getByText('600 g')).toBeVisible()
  await expect(drawer.getByText(/Quantities are as written and are not added up/)).toBeVisible()

  await shoot(page, 'meals-grocery')
})

test('meals, an imported recipe waits in the inbox', async ({ page }) => {
  await page.goto('/meals?tab=recipes')

  // A draft is a card at the top of the grid, tagged, with the decision on it.
  await expect(page.getByText('Sheet pan salmon')).toBeVisible()
  await expect(page.getByText('draft', { exact: true })).toBeVisible()

  // A pasted URL is read for its Recipe JSON-LD. A private address is refused
  // before anything is fetched: the fetch runs from inside the deployment.
  const url = page.getByPlaceholder('Paste a recipe URL to ingest')
  await expect(url).toBeVisible()
  await url.fill('http://169.254.169.254/latest/meta-data/')
  await page.getByRole('button', { name: 'Ingest', exact: true }).click()
  await expect(page.getByText(/private network/)).toBeVisible()
  await shoot(page, 'meals-recipes')

  await page.getByRole('button', { name: 'Accept', exact: true }).first().click()
  await expect(page.getByText('Added to the library')).toBeVisible()
  await expect(page.getByText('draft', { exact: true })).toHaveCount(0)

  // The filter is in the URL. Favourites is the one that is not a tag.
  await page.goto('/meals?tab=recipes&tag=favorites')
  await expect(page.getByText('Overnight oats')).toHaveCount(0)
  await expect(page.getByText('Turkey chili')).toBeVisible()
  await shoot(page, 'meals-recipes-favorites')
})

test('meals, a slot is picked, swapped and cleared from the drawer', async ({ page }) => {
  await page.goto('/meals')

  // An empty slot opens the pick list, favourites first.
  await page.getByRole('button', { name: 'Plan a meal' }).first().click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Pick a recipe')).toBeVisible()
  await shoot(page, 'meals-pick')
  await drawer.getByRole('button', { name: /Lentil soup/ }).click()
  await expect(drawer).toHaveCount(0)

  // A planned cell opens its recipe with the plan actions in the footer.
  await page.getByRole('button', { name: /^Turkey chili/ }).first().click()
  await expect(drawer.getByRole('heading', { name: 'Turkey chili' })).toBeVisible()
  await expect(drawer.getByText('Serves 6 · per-serving values')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Cook' })).toBeVisible()
  await shoot(page, 'meals-recipe')
  await drawer.getByRole('button', { name: 'Remove from plan' }).click()
  await expect(drawer).toHaveCount(0)
})

test('ideas, four stage columns with the scores on every card', async ({ page }) => {
  await page.goto('/ideas')
  await expect(page.getByRole('heading', { name: 'Ideas' })).toBeVisible()
  await expect(page.getByText(/\d+ ideas · \d+ stale/)).toBeVisible()

  // Every stage is a column at once, as the artboard draws it.
  for (const stage of ['Exploring', 'Validated', 'Building', 'Killed']) {
    await expect(page.getByRole('region', { name: stage })).toBeVisible()
  }

  // Quick wins first. Voice capture is cheap and high impact; the card carries
  // the quadrant, both scores and how long it has sat in its stage.
  const voice = page.locator('article').filter({ hasText: 'Voice capture for tasks' })
  await expect(voice.getByText('QUICK WIN')).toBeVisible()
  await expect(voice.getByText('IMPACT')).toBeVisible()
  await expect(voice.getByText('EFFORT')).toBeVisible()
  await expect(voice.getByText(/\d+d in stage/)).toBeVisible()
  await expect(voice.getByText('#voice')).toBeVisible()

  // Sitting still for two months is named on the card, not decided for you.
  await expect(page.getByText(/STALE · \d+d in stage/)).toBeVisible()

  await shoot(page, 'ideas')
})

test('ideas, the capture line reads tags and scores', async ({ page }) => {
  await page.goto('/ideas')
  const line = page.getByLabel('Capture an idea')
  await line.fill('Pocket receipt scanner #capture effort:low impact:high')
  await line.press('Enter')
  await expect(page.getByText('Captured. Pocket receipt scanner')).toBeVisible()

  const card = page.locator('article').filter({ hasText: 'Pocket receipt scanner' })
  await expect(card.getByText('QUICK WIN')).toBeVisible()
  await expect(card.getByText('#capture')).toBeVisible()

  // And Delete takes a capture that was never an idea away again.
  await card.click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Deleted')).toBeVisible()
  await expect(page.locator('article').filter({ hasText: 'Pocket receipt scanner' })).toHaveCount(0)
})

test('ideas, the effort and impact matrix places every live idea', async ({ page }) => {
  await page.goto('/ideas')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Effort × impact' }).click()
  await expect(page).toHaveURL(/view=matrix/)

  // The corners are named for what they mean, and an idea sits in the corner
  // its pill on the board claims.
  await expect(page.getByText('Quick wins')).toBeVisible()
  await expect(page.getByText('Money pits')).toBeVisible()
  await expect(page.getByRole('button', { name: /Voice capture for tasks/ })).toBeVisible()
  await shoot(page, 'ideas-matrix')
})

test('ideas, the drawer shows the stage, the moves and the Agent card', async ({ page }) => {
  await page.goto('/ideas')
  await page.locator('article').filter({ hasText: 'Automatic crypto tax lots' }).click()

  // Kept rather than deleted, because the reason is what stops the same idea
  // arriving again in six months.
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText(/none of it reconciles/)).toBeVisible()
  await expect(drawer.getByText('Move to')).toBeVisible()
  await expect(drawer.getByText('Agent', { exact: true })).toBeVisible()
  await expect(drawer.getByText('Linked skills')).toBeVisible()
  await expect(page).toHaveURL(/idea=/)
  await shoot(page, 'ideas-drawer')

  // Edit is a form that holds until Save.
  await page.getByRole('dialog').getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page).toHaveURL(/edit=1/)
  await expect(page.getByRole('dialog').getByText('One-line pitch')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', { name: /^Save/ })).toBeVisible()
  await shoot(page, 'ideas-edit')
})

test('home, the calendar is worked out from the history', async ({ page }) => {
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Home & assets' })).toBeVisible()

  // The band: the crumb on the left, the month's summary with its dot on the
  // right, and the page's one primary in the title block.
  await expect(page.getByText('Home / Assets')).toBeVisible()
  await expect(page.getByText(/\d+ jobs? due this month · \$[\d,]+ estimated/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log service' })).toBeVisible()

  // Money on the strip is compact; the full figure is not on the page.
  await expect(page.getByText('$743k')).toBeVisible()
  await expect(page.getByText('$743,140')).toHaveCount(0)

  // Every asset kind as a card: kind, state, name, the two cells.
  await expect(page.getByRole('button', { name: /^PROPERTY.*2412 Example Street/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^VEHICLE.*OVERDUE.*2021 pickup/ })).toBeVisible()
  await expect(page.getByText('VALUE', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('ANNUAL COST', { exact: true }).first()).toBeVisible()

  // The oil change was last done seven months ago on a six month interval, so
  // it is overdue. Nothing stored that: it falls out of the interval and the
  // date it was last done.
  await expect(page.getByText('Oil change and rotation').first()).toBeVisible()
  await expect(page.getByText('OVERDUE', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('DUE NOW', { exact: true }).first()).toBeVisible()

  // Twelve months, including the empty ones, because an empty month is
  // information. The selected month is written out in full under them.
  await expect(page.getByRole('button', { name: /^[A-Z]{3} \d\d /  })).toHaveCount(12)
  await expect(page.getByText(/^[A-Z]{3} \d{4}$/)).toBeVisible()

  await expect(page.getByText('COVER · EXPIRES · FILE')).toBeVisible()

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
  await expect(page.getByText('NO EXPIRY', { exact: true })).toBeVisible()

  // And the drawer carries the paperwork rather than a judgement about it.
  await deed.click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Recorded Jun 2019')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Close', exact: true })).toBeVisible()
})

test('home, the property card reads cover from Insurance', async ({ page }) => {
  await page.goto('/home')

  // The premium is Insurance's number, read through the registry, not a copy.
  // Finance holds no mortgage, so no mortgage is drawn.
  await expect(page.getByText(/^\$[\d,]+ \/ yr$/)).toBeVisible()
  await expect(page.getByText('Coverage comes from Insurance.')).toBeVisible()
  await expect(page.getByText(/Mortgage/)).toHaveCount(0)
})

test('home, logging service moves the schedule it belongs to', async ({ page }) => {
  await page.goto('/home?log=1')

  await page.getByLabel('Asset', { exact: true }).selectOption({ label: '2412 Example Street' })
  await page.getByLabel('What was done').fill('Gutter clean before the autumn')
  // Three months from today, so the next one lands inside the calendar window
  // where it can be counted.
  await page.getByRole('radio', { name: 'Every 3 mo' }).click()
  await expect(page.getByText(/The next one lands 3 months out/)).toBeVisible()
  await page.getByRole('button', { name: 'Save service' }).click()

  await expect(page.getByText(/Next one scheduled for [A-Z]{3} \d{4}/)).toBeVisible()

  // One schedule, not a second one beside it: logging a job that is already on
  // the calendar moves the row it belongs to.
  const month = page.getByRole('button', { name: /^[A-Z]{3} \d\d / }).nth(3)
  await month.click()
  await expect(page.getByText('Gutter clean before the autumn')).toHaveCount(1)
})

test('insurance, sorted by what expires first with numbers masked', async ({ page }) => {
  await page.goto('/insurance')
  await expect(page.getByRole('heading', { name: 'Insurance', exact: true })).toBeVisible()
  await expect(page.getByText('Insurance / Policies')).toBeVisible()
  await expect(page.getByText(/\d+ policies · \d+ expiring soon/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Add policy/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload PDF' })).toBeVisible()

  // Masked in the query, so the plaintext is not in this page at all.
  await expect(page.getByText('•••• 7730')).toBeVisible()
  await expect(page.getByText('**** 7730')).toHaveCount(0)
  await expect(page.getByText('LMD-48211-7730')).toHaveCount(0)

  // The soonest first: renters at 36 days, then the phone at 58. The kind sits
  // inside the Policy cell, so the row's text starts with it.
  const rows = page.getByRole('button', { name: /Lemonade|Apple|Progressive/ })
  await expect(rows.first()).toContainText('Lemonade')
  await expect(rows.first()).toHaveText(/^RENTERS/)
  await expect(rows.first()).toContainText(/\d+ days/)
  await expect(rows.first()).toContainText('EXPIRING')

  await shoot(page, 'insurance')
})

test('insurance, a policy number is revealed only when asked for', async ({ page }) => {
  await page.goto('/insurance')
  await page.getByRole('button', { name: /Apartment, renters/ }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('•••• 7730')).toBeVisible()
  // The drawer is in the URL, so it survives the reloads.
  await shoot(page, 'insurance-drawer')
  await dialog.getByRole('button', { name: /REVEAL/ }).click()
  await expect(dialog.getByText('LMD-48211-7730')).toBeVisible()

  await dialog.getByRole('button', { name: /HIDE/ }).click()
  await expect(page.getByText('LMD-48211-7730')).toHaveCount(0)

  // The rest of the drawer, as the artboard draws it.
  for (const head of ['Payment schedule', 'Renewal reminders', 'Documents', 'Agent']) {
    await expect(dialog.getByText(head, { exact: true })).toBeVisible()
  }
  await expect(dialog.getByText('renters-declarations-2026.pdf')).toBeVisible()
})

test('insurance, no deductible is not a deductible of zero', async ({ page }) => {
  await page.goto('/insurance')
  await page.getByRole('button', { name: /Term life/ }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('none', { exact: true })).toBeVisible()
  await expect(dialog.getByText('$0')).toHaveCount(0)
})

test('insurance, renewing keeps the same row', async ({ page }) => {
  await page.goto('/insurance')
  await page.getByRole('button', { name: /Apartment, renters/ }).click()

  const before = await page.getByRole('button', { name: /Apartment, renters/ }).count()
  await page.getByRole('button', { name: /Mark renewed · \w{3} \d+ \d{4}/ }).click()
  await expect(page.getByText(/Same row, so the history stays together/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Apartment, renters/ })).toHaveCount(before)
})

test('insurance, the edit form holds changes until Save', async ({ page }) => {
  await page.goto('/insurance')
  await page.getByRole('button', { name: /Apartment, renters/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByText('Insurance / Edit')).toBeVisible()
  await shoot(page, 'insurance-edit')

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Premium', { exact: true }).fill('15')
  await dialog.getByRole('button', { name: /^Save/ }).click()
  await expect(page.getByText('Saved')).toBeVisible()
  await expect(page.getByRole('button', { name: /Apartment, renters/ })).toContainText('$15')

  // Put it back, so the fixture is the same for the next run.
  await page.getByRole('dialog').getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('dialog').getByLabel('Premium', { exact: true }).fill('14')
  await page.getByRole('dialog').getByRole('button', { name: /^Save/ }).click()
  await expect(page.getByRole('button', { name: /Apartment, renters/ })).toContainText('$14')
})

test('insurance, new policy and upload drawers', async ({ page }) => {
  await page.goto('/insurance?policy=new&edit=1')
  await expect(page.getByText('Insurance / New policy')).toBeVisible()
  await shoot(page, 'insurance-new')

  await page.goto('/insurance?upload=1')
  await expect(page.getByText('Drop a policy PDF')).toBeVisible()
  await expect(page.getByText('Declarations pages work best.')).toBeVisible()
  await shoot(page, 'insurance-upload')
})

test('insurance, delete asks first and removes the row', async ({ page }) => {
  await page.goto('/insurance')
  await page.getByRole('button', { name: /Term life/ }).click()

  page.on('dialog', (d) => d.accept())
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('button', { name: /Term life/ })).toHaveCount(0)
})

test('meals, cook mode scales what can be scaled and says what cannot', async ({ page }) => {
  await page.goto('/meals?tab=recipes')
  await page.getByRole('button', { name: /^Turkey chili/ }).click()
  await expect(page.getByRole('dialog').getByText(/Use "Add to" above/)).toBeVisible()
  await shoot(page, 'meals-recipe-library')
  await page.getByRole('dialog').getByRole('button', { name: 'Cook' }).click()

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
  await page.locator('article').filter({ hasText: 'Share a read only dashboard link' }).click()

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
