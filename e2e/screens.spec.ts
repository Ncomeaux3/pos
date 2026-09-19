import { execFileSync } from 'node:child_process'
import { expect, test as base, type Locator, type Page } from '@playwright/test'

// CI's dev server serves a chunk per module, and on its runner the gap between
// first paint and hydration is close to a second. A click in that gap lands on
// a button with no handler yet, and the test then waits for a change nobody
// asked for (a tab that never switched, a long press that never armed). So
// every goto waits for the network to go quiet, which is after the last chunk
// has loaded and, in practice, after hydration.
const test = base.extend({
  page: async ({ page }, run) => {
    const goto = page.goto.bind(page)
    page.goto = (url, options) => goto(url, { waitUntil: 'networkidle', ...options })
    await run(page)
  },
})

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

/**
 * The page band (breadcrumb, status) is the desktop's: below md the header is
 * one row with the title and at most one action, and the band is not drawn.
 */
async function expectBand(page: Page, locator: Locator) {
  if ((page.viewportSize()?.width ?? 0) < 768) await expect(locator).toBeHidden()
  else await expect(locator).toBeVisible()
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

  // The nav is built from manifests, so Today has to be there for the
  // module contract to still be working.
  const nav = page.getByRole('navigation', { name: /modules|sections/i }).first()
  const mobile = (page.viewportSize()?.width ?? 0) < 768
  await expect(nav.getByRole('link', { name: 'Today' })).toBeVisible()

  // The phone bar holds Today, Tasks, Finance and Browse, and Browse is the
  // page where Review lives. What is worth asserting is that Review is
  // reachable, wherever it sits.
  if (mobile) {
    await expect(nav.locator('a[href="/browse"]')).toBeVisible()
    await page.goto('/browse')
    await expect(page.getByRole('link', { name: /^Review/ })).toBeVisible()
    await page.goto('/')

    // Phone Home is a Today page: the headline plus five tiles (2026-09-13
    // decision) - warnings, finance, tasks, review, timeline. Every other
    // tile is desktop only.
    await expect(page.getByTestId('dashboard-bento').locator(':scope > div:visible')).toHaveCount(5)
  } else {
    // By href: the sidebar prefixes each label with its two character index and
    // appends the pending count, so the accessible name is "RV Review 2", and
    // "Weekly review" would match a loose name filter anyway.
    await expect(nav.locator('a[href="/review"]')).toBeVisible()
  }
  // PosSidebar.dc.html lists thirteen modules and Review. Notes is not one of
  // them, so the stub leaves the numbered rail and every index after it lines
  // up with the artboard. The route itself stays; the palette test proves it.
  await expect(nav.locator('a[href="/notes"]')).toHaveCount(0)

  if (!mobile) {
    // The Holon rail, top to bottom: Today, then Plan, Knowledge and Life
    // under their headings, then Review with the weekly review beside it.
    const labels = await nav.locator('a').evaluateAll((links) =>
      links.map((a) => a.querySelector('.truncate')?.textContent?.trim()),
    )
    expect(labels).toEqual([
      'Today',
      'Tasks',
      'Goals',
      'Skills',
      'Second Brain',
      'Ideas',
      'Finance',
      'Health',
      'Fitness',
      'Meals',
      'Travel',
      'Home & Property',
      'Insurance',
      'Review',
      'Weekly review',
    ])
    await expect(nav.getByText('Plan', { exact: true })).toBeVisible()
    await expect(nav.getByText('Knowledge', { exact: true })).toBeVisible()
    await expect(nav.getByText('Life', { exact: true })).toBeVisible()

    // A rail row is a 38px pill with the route's icon before its label, and
    // the Review badge is filled with the action colour.
    const row = nav.locator('a[href="/finance"]')
    const geometry = await row.evaluate((a) => ({
      height: getComputedStyle(a).height,
      radius: getComputedStyle(a).borderRadius,
      icon: a.querySelector('svg') !== null,
    }))
    expect(geometry).toEqual({ height: '38px', radius: '10px', icon: true })

    const badge = nav.locator('a[href="/review"] span').last()
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    )
    const badgeColor = await badge.evaluate((el) => getComputedStyle(el).backgroundColor)
    const accentRgb = await page.evaluate((hex) => {
      const probe = document.createElement('span')
      probe.style.backgroundColor = hex
      document.body.append(probe)
      const rgb = getComputedStyle(probe).backgroundColor
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
    expect(eyebrows.slice(0, 8)).toEqual([
      'Warnings',
      'Finance',
      'Tasks · today',
      'Review · agent proposals',
      'Goals',
      'Skills',
      'Model spend · month',
      'Next 7 days',
    ])
    expect(eyebrows.slice(8)).toEqual([
      'Second Brain',
      'Ideas',
      'Health',
      'Fitness',
      'Meals',
      'Travel',
      'Home & Property',
      'Insurance',
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
    // The band's search, with the artboard's question rather than PageHeader's default.
    await expect(page.getByRole('button', { name: /What are you looking for/ })).toBeVisible()

    // The footer holds the three-way theme control and the Collapse row.
    const footer = page.getByRole('navigation', { name: /sections/i })
    const themeGroup = footer.getByRole('group', { name: 'Theme' })
    await expect(themeGroup.getByRole('button', { name: 'System', exact: true })).toBeVisible()
    // No cookie yet, so the page follows the device and System is pressed.
    await expect(themeGroup.getByRole('button', { name: 'System', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(footer.getByRole('button', { name: 'Collapse' })).toBeVisible()
    const labelSize = await footer
      .getByRole('button', { name: 'Collapse' })
      .evaluate((b) => getComputedStyle(b).fontSize)
    expect(labelSize).toBe('13px')
  }

  await shoot(page, 'dashboard')
})

test('browse lists the rail groups', async ({ page }) => {
  await page.goto('/browse')
  // Same source as the rail, in the rail's groups, minus Today (the first
  // tab) and Search (the band above). Plan, Knowledge, Life, Review, Utilities.
  const lists = page.getByRole('list')
  await expect(lists).toHaveCount(5)
  await expect(lists.nth(0).getByRole('link')).toHaveCount(3)
  await expect(lists.nth(2).getByRole('link')).toHaveCount(7)
  await expect(lists.nth(2).getByRole('link', { name: 'Finance' })).toBeVisible()
  // Not in the list: the desktop rail beside it still has its own Today.
  await expect(page.getByRole('main').getByRole('link', { name: 'Today' })).toHaveCount(0)

  const utilities = await lists.last().getByRole('link').evaluateAll((links) =>
    links.map((a) => a.textContent?.trim()),
  )
  expect(utilities).toEqual(['Notifications', 'Agent log', 'Settings'])
  await expect(lists.nth(3).getByRole('link', { name: /^Review/ })).toBeVisible()
  await shoot(page, 'browse')
})

test('phone header shows back off a tab root and not on one', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The back control is a phone thing')

  // Tasks is a tab: nothing to go back to.
  await page.goto('/tasks')
  await expect(page.getByRole('link', { name: 'Back' })).toHaveCount(0)

  // Goals is not, and a cold open has no history, so Back is a link to Browse.
  await page.goto('/goals')
  const back = page.getByRole('link', { name: 'Back' })
  await expect(back).toBeVisible()
  await expect(back).toHaveAttribute('href', '/browse')
})

test('home shows Run now on the phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The phone header is a phone thing')

  // Today is a tab root, so its phone header is title plus one action, no
  // Back: the one thing to do from a phone after a run is press it again.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back' })).toHaveCount(0)
  // The phone header's own Run now, first in DOM order; the desktop band's
  // copy of the same button sits after it, hidden below md.
  await expect(page.getByRole('button', { name: 'Run now' }).first()).toBeVisible()

  // A Today page fits in two swipes: the seed's warnings and proposals show
  // two and one rows here, the rest behind a link. The budget grew by one
  // headline line for the greeting (Holon phase 2); phase 3 recomposes Today
  // and sets it again.
  await expect(page.getByRole('button', { name: /^Dismiss / })).toHaveCount(2)
  await expect(page.getByRole('link', { name: /and \d+ more/ })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(1840)
})

test('dashboard, the week ahead and arranging the tiles', async ({ page }) => {
  await page.goto('/')

  // The strip is composed from what every module says is upcoming, so a dated
  // task from the Tasks module appears on a core screen without core reading
  // the tasks schema.
  await expect(page.getByText('Next 7 days')).toBeVisible()
  // Dated by the module that owns it, not by core. The strip's entry is a
  // link named by its day; the Tasks tile lists the same title as a button.
  const amex = page.getByRole('link', { name: /Pay the Amex statement$/ })
  await expect(amex).toBeVisible()
  // The row opens the task's own drawer, not the module root (v1.1 Phase 1).
  await expect(amex).toHaveAttribute('href', /\?task=/)

  // Arrange is desktop only (2026-09-13 decision): the toggle lives in the
  // desktop band and stays hidden below md.
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    // Arrange lives in the header and the mode lives in the URL, which is what
    // lets the button be a link rather than a lifted piece of state.
    await page.waitForLoadState('networkidle')
    await page.getByRole('link', { name: 'Arrange' }).click()
    await expect(page).toHaveURL(/arrange=1/)
    await expect(page.getByText(/Arrange mode/)).toBeVisible()

    // The layout is one setting on the server (v1.1 Phase 5), so a hidden
    // tile stays hidden across a reload and comes back from the Hidden row.
    const main = page.getByRole('main')
    const saved = () =>
      page.waitForResponse(
        (r) => r.request().method() === 'POST' && 'next-action' in r.request().headers(),
      )
    let acted = saved()
    await page.getByRole('button', { name: 'Hide llm' }).click()
    await expect(main.getByText('Model spend · month')).toBeHidden()
    await acted
    await page.reload()
    await expect(main.getByText('Model spend · month')).toBeHidden()
    acted = saved()
    await page.getByTestId('dashboard-hidden').getByRole('button', { name: 'Show llm' }).click()
    await expect(main.getByText('Model spend · month')).toBeVisible()
    await acted

    await page.getByRole('link', { name: 'Done', exact: true }).click()
    await expect(page.getByText(/Arrange mode/)).toBeHidden()
  } else {
    await expect(page.getByRole('link', { name: 'Arrange' })).toBeHidden()
  }
})

test('skill tree, constellation and the selected skill panel', async ({ page }) => {
  // Three shots of the heaviest page in the app, each in two themes.
  test.slow()
  await page.goto('/skills')
  await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Skill constellation' })).toBeVisible()

  // POS Skill Tree.dc.html opens on a skill (the top gainer), so the right
  // pane is never the empty explanation: the panel says how far the next
  // level is straight away.
  const detailPane = page.getByTestId('skill-tree-detail-pane')
  await expect(detailPane.getByText(/to Lv \d/)).toBeVisible()

  const mobile = (page.viewportSize()?.width ?? 0) < 768
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
    // The sky and its columns end where the window does. The page ran 20px
    // over once, and that was the whole reason the columns needed a scroll.
    const [scrollHeight, innerHeight] = await page.evaluate(() => [
      document.documentElement.scrollHeight,
      window.innerHeight,
    ])
    expect(scrollHeight).toBe(innerHeight)
  } else {
    // The first phone screen is the tree and its four columns: the columns
    // end above the tab bar without a scroll.
    const [columnsBottom, tabBarTop] = await page.evaluate(() => [
      document.querySelector('[data-testid="skill-tree-canvas-pane"] > div:last-child')!.getBoundingClientRect().bottom,
      document.querySelector('nav.fixed')!.getBoundingClientRect().top,
    ])
    expect(columnsBottom).toBeLessThanOrEqual(tabBarTop)
  }
  // One nebula per attribute, inside the pan and zoom group so it moves with
  // the tree rather than staying behind when the tree zooms away from it.
  const attributeCount = await page.getByTestId('skill-pip-label').count()
  await expect(page.locator('.skill-view circle[fill="url(#skill-neb)"]')).toHaveCount(attributeCount)
  await shoot(page, 'skills')

  // The demo seed classifies ideas and tasks through the keyword rules, so Engineering
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

test('skill tree, a trackpad burst zooms smoothly and the main stars are blue', async ({ page }) => {
  await page.goto('/skills')
  await page.waitForLoadState('networkidle')

  const svg = page.getByRole('img', { name: 'Skill constellation' })
  const box = (await svg.boundingBox())!
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const group = svg.locator('> g').last()
  const scaleOf = async () =>
    Number(/scale\(([\d.]+)\)/.exec((await group.getAttribute('transform')) ?? '')?.[1])
  const burst = async (el: SVGSVGElement, at: { x: number; y: number; n: number }) => {
    for (let i = 0; i < at.n; i++) {
      el.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -8,
          deltaMode: 0,
          clientX: at.x,
          clientY: at.y,
          bubbles: true,
          cancelable: true,
        }),
      )
    }
    // data-moving is set inside the component's animation frame and cleared
    // 120ms after the last one. Read it here, one frame after the burst,
    // rather than from a separate expect whose round trip on a slow runner
    // arrives after it has cleared.
    await new Promise(requestAnimationFrame)
    return el.querySelector(':scope > g:last-of-type')!.hasAttribute('data-moving')
  }

  // The listener is attached by the client component after hydration, which
  // is later than networkidle. One event at a time until the canvas answers.
  await page.mouse.move(at.x, at.y)
  await expect
    .poll(async () => {
      await svg.evaluate(burst, { ...at, n: 1 })
      return scaleOf()
    })
    .toBeGreaterThan(1)
  // The last poll's event lands a frame later; read the base once it has.
  await page.waitForTimeout(100)
  const base = await scaleOf()

  // A trackpad sends many small deltas inside one frame. Thirty of them,
  // dispatched back to back with no chance for React to commit in between,
  // must land where the sum of the deltas says: base * exp(240 * 0.003). A
  // handler that reads a stale zoom applies every one of them to the same
  // base and lands one step up instead, which is the jump you feel.
  expect(await svg.evaluate(burst, { ...at, n: 30 })).toBe(true)
  await expect.poll(scaleOf).toBeGreaterThan(base)
  // The flag clears once the view has been still. While it is set the halo
  // is only its blur, so it hides rather than showing as a flat disc three
  // times the star.
  const halo = page.locator('g[data-skill="engineering"] > circle').first()
  await svg.evaluate(burst, { ...at, n: 1 })
  await expect(halo).toBeHidden()
  await expect(group).not.toHaveAttribute('data-moving', '')
  await expect(halo).toBeVisible()

  // Thirty-one deltas of eight: the burst and the one that checked the halo.
  const ratio = (await scaleOf()) / base
  expect(ratio).toBeGreaterThan(Math.exp(248 * 0.003) * 0.98)
  expect(ratio).toBeLessThan(Math.exp(248 * 0.003) * 1.02)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  // The svg is absolutely positioned, as the artboard's is. In flow with a
  // percentage height, every transform write dirtied layout up to the page
  // and each zoom frame laid out the whole app: 55 long tasks in a one
  // second gesture on a Retina 120Hz screen, none once it was absolute.
  expect(await svg.evaluate((el) => getComputedStyle(el).position)).toBe('absolute')

  // The artboard paints the centre and the five attributes pale blue; accent
  // is a leaf gaining fast, nothing else.
  for (const id of ['__you', 'engineering']) {
    const body = page.locator(`g[data-skill="${id}"] > circle`).nth(2)
    await expect(body).toHaveAttribute('fill', '#9fd1ff')
  }
})

test('skill tree, the constellation hovers, selects, pans and zooms', async ({ page }) => {
  await page.goto('/skills')
  await page.waitForLoadState('networkidle')

  const star = page.locator('g[data-skill="coding"]')

  // Hover draws the design's card beside the star: what it is, how many
  // branches hang off it, their levels, and what the month came to.
  await page.locator('g[data-skill="health"]').hover({ force: true })
  await expect(page.getByText(/branches/)).toBeVisible()
  await expect(page.getByText(/XP IN 30 DAYS/)).toBeVisible()

  // A leaf's card is the artboard's: XP against the next level with a bar,
  // the month, the goal weight, then its keywords. Centred under the star.
  const travel = page.locator('g[data-skill="travel"]')
  await travel.hover({ force: true })
  const card = page.getByTestId('skill-hover-card')
  await expect(page.getByText(/^XP$/)).toBeVisible()
  await expect(page.getByText('Last 30 days')).toBeVisible()
  await expect(page.getByText(/FLIGHT|TRIP/)).toBeVisible()
  // Below the star, or above it on a canvas too short to fit it below;
  // either way clear of the star and centred on it.
  const dot = (await travel.locator('circle').nth(2).boundingBox())!
  const cardBox = (await card.boundingBox())!
  const clear = cardBox.y >= dot.y + dot.height || cardBox.y + cardBox.height <= dot.y
  expect(clear).toBe(true)
  // Travel sits near the left edge, so the card is held inside the canvas
  // rather than centred off it.
  const canvas = (await page.getByRole('img', { name: 'Skill constellation' }).boundingBox())!
  expect(cardBox.x).toBeGreaterThanOrEqual(canvas.x)

  // The centre star has one too: the character and its attributes.
  await page.locator('g[data-skill="__you"]').hover({ force: true })
  await expect(page.getByText('Engineering', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Life ops', { exact: true }).first()).toBeVisible()

  // The lit limb reaches the centre: hovering a leaf lights its attribute's
  // edge to You as well as its own. The walk up the parents used to stop one
  // short, since an attribute has no parent row.
  await star.hover({ force: true })
  await expect(page.locator('line[data-edge="engineering"]')).toHaveAttribute('stroke', '#ffffff')
  await expect(page.locator('line[data-edge="coding"]')).toHaveAttribute('stroke', '#ffffff')
  await expect(page.locator('line[data-edge="health"]')).not.toHaveAttribute('stroke', '#ffffff')

  await star.hover({ force: true })
  await expect(page.getByText('Coding', { exact: true }).first()).toBeVisible()

  // Clicking a star opens it in the panel. This used to do nothing: the svg
  // captured the pointer on pointerdown, which retargets the click away from
  // the node and onto the canvas.
  await star.click({ force: true })
  await expect(page).toHaveURL(/skill=coding/)

  // The centre star opens too: the character, its five attributes with their
  // levels, and the month's events across every skill. It used to be inert.
  const pane = page.getByTestId('skill-tree-detail-pane')
  await page.locator('g[data-skill="__you"]').click({ force: true })
  await expect(page).toHaveURL(/skill=__you/)
  await expect(pane.getByText('Character', { exact: true })).toBeVisible()
  await expect(pane.getByRole('heading', { name: 'You' })).toBeVisible()
  await expect(pane.getByText('Attributes', { exact: true })).toHaveCount(2)
  await expect(pane.getByRole('button', { name: /Engineering/ })).toBeVisible()
  await expect(pane.getByText(/Events · 30 days/)).toBeVisible()
  await expect(pane.getByText(/Keywords/)).toHaveCount(0)
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

  // Double-click flies to the star over 250ms rather than cutting: the view
  // is somewhere between the two a frame later, and centred on the star once
  // it has landed.
  const svg = page.getByRole('img', { name: 'Skill constellation' })
  const group = svg.locator('> g').last()
  const scaleOf = async () =>
    Number(/scale\(([\d.]+)\)/.exec((await group.getAttribute('transform')) ?? '')?.[1])
  const z0 = await scaleOf()
  const target = Math.max(1.6, z0 * 1.5)
  // The mid-flight value is read from a per-frame sampler started before the
  // double-click, not after a fixed wait: 60ms read exactly 1 on one CI run
  // and 1.5995 on another (the flight is wall-clock, the runner was slow),
  // while the parallel run of the same commit passed both times.
  type Sampled = SVGSVGElement & { __flight?: string[] }
  await svg.evaluate((el: Sampled) => {
    const g = el.querySelector(':scope > g:last-child')!
    const seen: string[] = (el.__flight = [])
    const tick = () => {
      seen.push(g.getAttribute('transform') ?? '')
      if (seen.length < 120) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  // On the body circle: the group's centre can fall between star and label,
  // which is the canvas, not the node.
  await star.locator('circle').nth(2).dblclick({ force: true })
  await expect.poll(scaleOf).toBeCloseTo(target, 6)
  const flown = await svg.evaluate((el: Sampled) =>
    (el.__flight ?? []).map((t) => Number(/scale\(([\d.]+)\)/.exec(t)?.[1])),
  )
  expect(flown.some((s) => s > z0 && s < target * 0.99)).toBe(true)
  // The body circle, not the group: the group's box takes in the label
  // under the star and sits low of it.
  const svgBox = (await svg.boundingBox())!
  const landed = (await star.locator('circle').nth(2).boundingBox())!
  expect(Math.abs(landed.x + landed.width / 2 - (svgBox.x + svgBox.width / 2))).toBeLessThan(4)
  expect(Math.abs(landed.y + landed.height / 2 - (svgBox.y + svgBox.height / 2))).toBeLessThan(4)
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
  // One title on every tab; the tab is the crumb and carries its count.
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Skills \d+$/ })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Engineering · Coding')).toBeVisible()
  await shoot(page, 'settings-skills')
  // The name stays readable at 402: the keywords drop to their own line
  // rather than squeezing the input to two characters.
  const nameBox = (await page.getByRole('textbox', { name: 'Rename TypeScript' }).boundingBox())!
  expect(nameBox.width).toBeGreaterThanOrEqual(120)

  // Renaming, then resetting: the writes the tab exists for, each through the
  // module's own tool. The name is the artboard's transparent input.
  await page.getByRole('textbox', { name: 'Rename TypeScript' }).fill('TS')
  await page.getByRole('textbox', { name: 'Rename TypeScript' }).press('Enter')
  await expect(page.getByText('was TypeScript')).toBeVisible()

  // Reset drops every override, so the tab returns to the committed yaml. Two
  // presses: nothing here is a modal, per the design.
  await page.getByRole('button', { name: /Reset to skills.yaml/ }).click()
  await page.getByRole('button', { name: /Drop 1 edit/ }).click()
  await expect(page.getByText('was TypeScript')).toBeHidden()
})

test('search, empty and with results', async ({ page }) => {
  await page.goto('/search')
  // No title block: the band is the crumb and Quick search; the box sits low
  // on an empty page with every module's chip under it and nothing else.
  await expectBand(page, page.getByRole('button', { name: /Quick search/ }))
  await expect(page.getByRole('link', { name: 'Everything', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Finance', exact: true }).first()).toBeVisible()
  await shoot(page, 'search-empty')

  await page.getByLabel(/search everything/i).fill('deadlift')
  await page.getByLabel(/search everything/i).press('Enter')

  await expect(page).toHaveURL(/q=deadlift/)
  await expect(page.getByText('Deadlift 405')).toBeVisible()
  // The scope chips carry counts once there is a query, and only list modules
  // that actually have a hit.
  await expect(page.getByRole('link', { name: /^Everything \d+$/ })).toBeVisible()
  // Every row shows how old it is and its match bar.
  await expect(page.getByText(/\d+ days? ago|today/).first()).toBeVisible()
  await expect(page.getByText('match').first()).toBeVisible()
  await shoot(page, 'search-results')

  // A row opens the preview drawer, in the URL, with the fields strip.
  await page.getByRole('button', { name: /Deadlift 405/ }).click()
  await expect(page).toHaveURL(/open=/)
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Module', { exact: true })).toBeVisible()
  await expect(drawer.getByText('When', { exact: true })).toBeVisible()
  await expect(drawer.getByRole('button', { name: /Open in/ })).toBeVisible()
  await shoot(page, 'search-drawer')
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
  // anything is typed, each row with its group as the hint.
  await expect(palette.getByText('Go to')).toBeVisible()
  await expect(palette.getByRole('button', { name: /Settings/ })).toBeVisible()
  await expect(palette.getByRole('button', { name: /Finance Life/ })).toBeVisible()
  await page.getByLabel(/command palette search/i).fill('deadlift')
  await expect(palette.getByRole('button', { name: /Deadlift 405/ })).toBeVisible()
  await shoot(page, 'command-palette')

  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()
})

test('settings', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  const mobile = (page.viewportSize()?.width ?? 0) < 768
  if (!mobile) await expect(page.getByText(/\d+ of \d+ connected/)).toBeVisible()

  // The cap is the artboard's slider; the nightly strip reads the cron on the
  // owner's clock and counts the jobs the app holds, not backups it does not.
  await expect(page.getByRole('slider', { name: 'Cap per month' })).toBeVisible()
  await expect(page.getByText(/0 9 \* \* \* UTC · \d\d:\d\d \w+/)).toBeVisible()
  await expect(page.getByText('Jobs registered')).toBeVisible()

  // The app shipped with no way out at all: no sign out anywhere, which on a
  // single owner install is easy to miss and impossible to work around, and it
  // made the passkey path untestable because testing it starts signed out.
  // Not clicked here: every test in this file shares one stored session, and
  // signing out revokes the refresh token inside it.
  await expect(page.getByRole('button', { name: /^sign out$/i })).toBeVisible()

  await shoot(page, 'settings')
})

test('settings, connections', async ({ page }) => {
  await page.goto('/settings/connections')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Connections \d+$/ })).toHaveAttribute('aria-current', 'page')

  // One card per provider with its auth kind and a status mark; a connected
  // one carries the last test and when it was connected. The fixture enables
  // the Health Auto Export webhook, so at least one card is connected.
  await expect(page.getByText('CONNECTED', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Last test').first()).toBeVisible()
  await expect(page.getByText(/^(Connected since|Token expires)$/).first()).toBeVisible()
  await expect(page.getByText('NOT CONNECTED').first()).toBeVisible()
  await shoot(page, 'connections')
})

test('login, signed out', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/login')
  await expect(page.getByLabel(/owner email/i)).toBeVisible()
  await expect(page.getByLabel(/owner email/i)).toHaveAttribute('placeholder', /.+/)
  await expect(page.getByText(/code expires in 15 min/i)).toBeVisible()
  // The band names the install: one owner, no version string.
  await expect(page.getByText(/^single owner$/i)).toBeVisible()
  // The arrow glyph is aria-hidden, so the accessible name stays plain.
  await expect(page.getByRole('button', { name: /^send sign-in code$/i })).toBeVisible()
  await shoot(page, 'login')
})

test('login, code sent', async ({ page, context }) => {
  await context.clearCookies()
  // Rendered from the query string, so the sent view is reachable without
  // burning an email against the local auth rate limit.
  await page.goto('/login?sent=1&email=owner%40example.com')
  await expect(page.getByRole('heading', { name: /enter the code/i })).toBeVisible()
  await expect(page.getByText(/expires/i)).toBeVisible()
  // The field a phone actually types into, and the autofill hint that makes
  // iOS offer the code above the keyboard rather than sending them to Mail.
  const code = page.getByLabel(/sign in code/i)
  await expect(code).toBeVisible()
  await expect(code).toHaveAttribute('autocomplete', 'one-time-code')
  await expect(code).toHaveAttribute('inputmode', 'numeric')
  await expect(page.getByText(/noreply@cmxlogic.com/)).toHaveCount(0)
  await shoot(page, 'login-sent')
})

test('the code field keeps every digit of a code longer than six', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/login?sent=1&email=owner%40example.com')

  const code = page.getByLabel(/sign in code/i)
  // Email OTP Length is a Supabase project setting from 6 to 10. A field that
  // stops at 6 silently drops the end of an 8 digit code and then reports the
  // owner's correct code as wrong, which is what shipped on 2026-09-14.
  await code.pressSequentially('4839-20 17')
  await expect(code).toHaveValue('48392017')

  // Nothing is submitted on its own: the length that would trigger it is a
  // guess this app does not get to make.
  await expect(page).toHaveURL(/sent=1/)
  await expect(page.getByText(/wrong or expired/i)).toHaveCount(0)

  // The code is not a real one, so the screen comes back with the field marked
  // rather than signing anyone in.
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.getByText(/wrong or expired/i)).toBeVisible()
})

test('login shows why a link bounced, which is the phone failure', async ({ page, context }) => {
  await context.clearCookies()
  // What app/auth/callback/route.ts redirects to when the PKCE verifier cookie
  // is missing, which is every link opened outside the browser that asked.
  await page.goto('/login?error=expired')
  await expect(page.getByText(/different browser than the one that asked/i)).toBeVisible()
})

test('login, resend restarts the countdown', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/login?sent=1&email=owner%40example.com')

  // Let the countdown tick down from 15:00 before asking for it again.
  await page.waitForTimeout(1200)
  await expect(page.getByText('14:5', { exact: false })).toBeVisible()

  await page.getByRole('button', { name: 'Resend' }).click()
  await expect(page.getByText('15:00')).toBeVisible()
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
  const heading = page.getByRole('heading', { name: 'Review' })
  await expect(heading).toBeVisible()

  // The band: crumb on the left, the pending count with its dot on the right,
  // above the title rather than beside the bulk button.
  await expectBand(page, page.getByText('Review / Pending'))
  const pendingCount = page.getByText(/^\d+ pending$/)
  await expectBand(page, pendingCount)
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    const countBox = await pendingCount.boundingBox()
    const headingBox = await heading.boundingBox()
    expect(countBox!.y).toBeLessThan(headingBox!.y)
  }

  await expect(page.getByRole('tab', { name: /Pending/ })).toHaveAttribute('aria-selected', 'true')

  const list = page.getByRole('button', { name: /Draft a weekly summary idea/ })
  await expect(list).toBeVisible()
  // The bulk action never offers to approve a guarded write, and one of the two
  // seeded proposals is guarded.
  await expect(page.getByRole('button', { name: /approve all non-guarded \(1\)/i })).toBeVisible()

  // The card: "{agent} · {when}", the state word and the meta line.
  const first = page.getByRole('button', { name: /Add a pitch to a bare idea/ })
  await expect(first).toHaveText(/ideas\.tidy · (\d\d:\d\d today|yesterday|\d+ days ago)/)
  await expect(first).toContainText('PENDING')
  await expect(first).toContainText('64% confident')
  await expect(list).toContainText('GUARDED')

  // The panel for the default selection: Current / After, the strip, the
  // three actions.
  await expect(page.getByText('Current', { exact: true })).toBeVisible()
  await expect(page.getByText('After', { exact: true })).toBeVisible()
  await expect(page.getByText('Recurring: every 3 months.')).toBeVisible()
  for (const label of ['Confidence', 'Evidence', 'Affects']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: /^approve$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible()

  // Edit turns the After cell into an input; Escape puts it back.
  await page.getByRole('button', { name: 'Edit' }).click()
  const draft = page.getByRole('textbox', { name: /after/i })
  await expect(draft).toHaveValue('Recurring: every 3 months.')
  await expect(page.getByRole('button', { name: /save & approve/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel edit' })).toBeVisible()
  await draft.press('Escape')
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
  await shoot(page, 'review-first')

  // Selecting drives the panel; the newest proposal is selected by default, so
  // the guarded one has to be asked for. The selection lives in the URL so it
  // survives the reloads the shot takes.
  await list.click()
  await expect(page).toHaveURL(/sel=/)
  await expect(page.getByText(/none of them link to each other/i)).toBeVisible()
  const guarded = page.getByText(/approving writes to Ideas immediately/i)
  await expect(guarded).toBeVisible()
  await expect(guarded).not.toContainText('is_manual')

  await shoot(page, 'review')

  // The tab is a link: it lands on its own URL.
  await page.getByRole('tab', { name: /Approved/ }).click()
  await expect(page).toHaveURL(/tab=approved/)
})

test('approving a proposal runs the tool and moves the row', async ({ page }) => {
  await page.goto('/review')

  await page.getByRole('button', { name: /Add a pitch to a bare idea/ }).click()
  await page.getByRole('button', { name: /^approve$/i }).click()

  await expect(page.getByText(/^Approved:/)).toBeVisible()

  await page.goto('/review?tab=approved')
  await expect(page.getByRole('button', { name: /Add a pitch to a bare idea/ })).toBeVisible()
  // The write stays: reopening would run the tool again, so there is no Undo
  // here, only the record of what ran.
  await expect(page.getByText('Approved. ideas.write ran.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0)
  await shoot(page, 'review-approved')

  // And the write actually happened: approve() calls the module's own tool.
  await page.goto('/ideas')
  await expect(page.getByText('Recurring: every 3 months.').first()).toBeVisible()
})

test('review, dismiss and undo keep the row', async ({ page }) => {
  await page.goto('/review')
  const coach = page.getByRole('button', { name: /Add a little weight/ })
  await coach.click()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByText('Dismissed', { exact: true })).toBeVisible()

  await page.goto('/review?tab=dismissed')
  await expect(page.getByText('Dismissed. The agent will not re-propose this for 30 days. Undo puts it back in the inbox.')).toBeVisible()
  await shoot(page, 'review-dismissed')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Back in the inbox', { exact: true })).toBeVisible()

  await page.goto('/review')
  await expect(page.getByRole('button', { name: /Add a little weight/ })).toBeVisible()
})

test('review, inbox clear', async ({ page }) => {
  // Runs after the approval test, so two guarded proposals are left. Both go,
  // the empty inbox is shot, both come back.
  await page.goto('/review')
  for (const name of [/Draft a weekly summary idea/, /Add a little weight/]) {
    await page.getByRole('button', { name }).click()
    await page.getByRole('button', { name: 'Dismiss' }).click()
    await expect(page.getByText('Dismissed', { exact: true })).toBeVisible()
  }
  await expect(page.getByText('inbox clear')).toBeVisible()
  await expect(page.getByText(/after the nightly run at \d\d:\d\d\./)).toBeVisible()
  await shoot(page, 'review-empty')

  await page.goto('/review?tab=dismissed')
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText('Back in the inbox', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(1 - i)
  }
})

test('settings, agents and mcp', async ({ page }) => {
  await page.goto('/settings/agents')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  // The command is the whole point of the screen: it is what you paste, with
  // the token masked inline until asked for.
  await expect(page.getByText(/claude mcp add --transport http pos/)).toBeVisible()
  await expect(page.getByText(/Bearer ••••••••/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reveal token' })).toBeVisible()
  await expect(page.getByText(/LIVE · \d+ TOOLS/)).toBeVisible()

  // Reads collapse to one open row; every write is listed with its mode.
  await expect(page.getByText('*.get_digest · *.query · core.search')).toBeVisible()
  await expect(page.getByText('GUARDED').first()).toBeVisible()
  await expect(page.getByText('finance.write')).toBeVisible()

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
  const mobile = (page.viewportSize()?.width ?? 0) < 768

  // Run now is a server action behind requireOwner, not a call to the cron
  // route, so it needs no secret. On both widths: a job runs from a button
  // that says so, and pulling down is a refresh, not a run. Two copies of the
  // button exist (phone header and desktop band); only one is visible.
  await page.getByRole('button', { name: /^run now$/i }).filter({ visible: true }).click()
  await expect(page.getByText(/^Run clean$|jobs? failed/i)).toBeVisible({ timeout: 20_000 })
  await page.reload()

  // Tile labels are uppercased by CSS, so the DOM still says "Warnings".
  const main = page.getByRole('main')
  await expect(main.getByText('Warnings')).toBeVisible()
  // The System tile is gone (v1.1 Phase 1): the run line at the top of the
  // page is the health corner and links to the Agent Log.
  await expect(main.getByRole('link', { name: /Agent Log$/ })).toHaveAttribute('href', '/agent-log')
  if (!mobile) {
    // Model spend and the module tiles are desktop only on the phone
    // (2026-09-13 decision): Home is warnings, finance, tasks, review, timeline.
    await expect(main.getByText('Model spend')).toBeVisible()
    // One tile per module that wrote a digest, so the page needs no knowledge of
    // any module to show its numbers. The tile's head is the link in, as drawn.
    await expect(main.getByRole('link', { name: /open ideas/i })).toBeVisible()
  }

  // Snooze holds the notification row itself, not its rule, so the row is gone
  // now and still gone after a reload (v1.1 Phase 1; before this the button
  // wrote to a rule id that did not exist and the row came straight back).
  const snoozeButton = main.getByRole('button', { name: 'Snooze' }).first()
  await expect(snoozeButton).toBeVisible()
  const snoozedTitle = (await snoozeButton.locator('../..').locator('a.text-ink').first().textContent()) ?? ''
  expect(snoozedTitle).not.toBe('')
  // Every warning row goes somewhere (v1.1 Phase 5): the nightly digest's row
  // opens the alert centre.
  await expect(main.getByRole('link', { name: snoozedTitle, exact: true })).toHaveAttribute(
    'href',
    /^\//,
  )
  await snoozeButton.click()
  // The row goes optimistically; wait for the server action itself before
  // reloading, or the reload can race the write it is meant to prove.
  const acted = page.waitForResponse(
    (r) => r.request().method() === 'POST' && 'next-action' in r.request().headers(),
  )
  await main.getByRole('button', { name: '1d' }).first().click()
  await expect(main.getByText(snoozedTitle, { exact: true })).toHaveCount(0)
  await acted
  await page.reload()
  await expect(main.getByText('Warnings')).toBeVisible()
  await expect(main.getByText(snoozedTitle, { exact: true })).toHaveCount(0)

  await shoot(page, 'dashboard-live')
})

test('notifications, rules table and the alert centre', async ({ page }) => {
  await page.goto('/notifications')
  await expect(page.getByRole('heading', { name: 'What reaches you, and when' })).toBeVisible()

  // The band and schedule card join every generated string with a middle dot,
  // matching the artboard, not a slash or "to".
  await expectBand(page, page.getByText(/rules active · \d+ held/))
  await expect(page.getByText(/Quiet 22:00–06:30 · /)).toBeVisible()

  // The rules table's column header, and one row's channel/timing strings,
  // join with the same middle dot. Statement due carries all three channels
  // and a 3 day lead, so its row spells out both joins at once.
  await expect(page.getByText('Channels · timing · state')).toBeVisible()
  await expect(page.getByText('PUSH · EMAIL · IN-APP').first()).toBeVisible()
  await expect(page.getByText('IMMEDIATE · 3 days')).toBeVisible()

  // A live Insurance rule's module label reads amber, not the flat green
  // every module used to share. Scoped to the row itself: the filter pill
  // above the table also renders the word "Insurance".
  const policyRow = page.getByRole('button', { name: /Policy renewal/ })
  await expect(policyRow.getByText('INSURANCE', { exact: true })).toHaveClass(/text-warn/)

  // The seeded rule set, the schedule above it and the preview rail that
  // follows the selected row. All three are the screen.
  await expect(page.getByText('Statement due')).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Morning digest on' })).toBeVisible()
  await expect(page.getByText('Push, lock screen')).toBeVisible()
  // The recipient is whatever settings.digest_email or OWNER_EMAIL resolves
  // to in this database, not a hardcoded literal; assert the shape rather than
  // a specific address, since the dev database's digest_email is mutable.
  await expect(page.getByText(/[\w.+-]+@[\w-]+\.\w+/)).toBeVisible()

  // Both halves of the alert centre. Counts are not asserted: the dev database
  // carries real alerts from nightly runs alongside the seeded ones, so the
  // fixture is deterministic in content, not in total.
  //
  // The title appears twice on purpose, once as the alert row and once in the
  // push preview of the rule behind it.
  await expect(page.getByText('Chase Sapphire due in 3 days')).toHaveCount(2)
  await expect(page.getByText(/^Alert centre · \d+ unread/)).toBeVisible()
  await expect(page.getByText(/^History ·/)).toBeVisible()
  await expect(page.getByText('Backup complete, 30 snapshots kept')).toBeVisible()

  // An unread alert's module label is flat accent, like the artboard, not the
  // rules table's per-module colour and not the old flat green.
  const chaseAlert = page.locator('div.bg-brand-soft', { hasText: 'Chase Sapphire due in 3 days' })
  await expect(chaseAlert.getByText('FINANCE', { exact: true })).toHaveClass(/text-brand/)

  // The email digest's section header is a plain accent label and a plain
  // item count, not the shared Eyebrow (fixed ink-3) or a Chip pill.
  const digestCard = page.locator('div.bg-bg-elev', { hasText: 'Your morning digest' })
  await expect(digestCard.getByText('Finance', { exact: true })).toHaveClass(/text-brand/)
  await expect(digestCard.getByText('1 item').first()).toBeVisible()

  await shoot(page, 'notifications')
})

// The expander is the whole editing surface, so it gets its own shot.
test('notifications, a rule expanded', async ({ page }) => {
  await page.goto('/notifications')
  await page.getByText('Policy renewal').first().click()

  await expect(page.getByRole('radio', { name: 'Immediate' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Email' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Breaks quiet hours' })).toBeVisible()
  await expect(page.getByText('Snooze / mute')).toBeVisible()

  // The snoozed note spells out the day count ("7 days"), not the state
  // chip's compact "7D". Snoozing and then muting/unmuting clears the snooze
  // again, so the rule is back to ON for later tests and the shot below.
  await page.getByRole('button', { name: '7d' }).click()
  await expect(page.getByText('Snoozed for 7 days, then back on.')).toBeVisible()
  await page.getByRole('button', { name: 'Mute' }).click()
  await page.getByRole('button', { name: 'Unmute' }).click()
  await expect(page.getByText('Active. 3 channels.')).toBeVisible()

  await shoot(page, 'notifications-rule')
})

// Pausing turns the button amber, like the artboard, not the teal "selected"
// treatment other toggles use. Persisted in settings, so it survives shoot()'s
// reloads. Resets itself so later tests see the live state.
test('notifications, pause all turns amber', async ({ page }) => {
  await page.goto('/notifications')
  await page.getByRole('button', { name: 'Pause all' }).click()

  const resume = page.getByRole('button', { name: 'Resume all' })
  await expect(resume).toBeVisible()
  await expect(resume).toHaveClass(/border-warn/)
  await expectBand(page, page.getByText(/rules active · \d+ held/))

  await shoot(page, 'notifications-paused')

  await page.getByRole('button', { name: 'Resume all' }).click()
  await expect(page.getByRole('button', { name: 'Pause all' })).toBeVisible()
})

// Inbox zero: the last test in this block, since marking every alert read
// leaves the fixture that way until the next project's reseed.
test('notifications, inbox clear', async ({ page }) => {
  await page.goto('/notifications')
  await page.getByRole('button', { name: 'Mark all read' }).click()

  await expect(page.getByText('Inbox zero')).toBeVisible()
  await expect(
    page.getByText('Everything raised so far has been read.'),
  ).toBeVisible()

  await shoot(page, 'notifications-empty')
})

test('agent log, the run accordion and the rail', async ({ page }) => {
  await page.goto('/agent-log')
  await expect(page.getByRole('heading', { name: 'What the agent did while you slept' })).toBeVisible()

  // The band names the run with the artboard's punctuation: a middle dot
  // between the write count and the failure count, both pluralised honestly.
  await expectBand(page, page.getByText(/Last run .+ · \d+ writes? · \d+ jobs? failed/))

  // The accordion opens on the newest run that wrote something, skipping past
  // however many empty Run now records an earlier test left behind. No click
  // needed, and that is the point being asserted.
  await expect(page.getByText('Assigned skills to 3 ideas')).toBeVisible()
  await expect(page.getByText('Skill links')).toBeVisible()

  // A failed job shows the raw provider message, not a paraphrase.
  await expect(page.getByText(/auth_expired: refresh token rejected/)).toBeVisible()

  // Its module is 'core', which has no registered jobs to rerun: Retry now
  // only ever appears on a failed job whose module is real, so it is honestly
  // absent here rather than a button that would run nothing.
  await expect(page.getByRole('button', { name: 'Retry now' })).toHaveCount(0)

  // The Jobs rail humanises a snake or dash case job name rather than
  // inventing artboard prose it does not run.
  await expect(page.getByText('Ideas / Nightly digest')).toBeVisible()

  // The rail: run KPIs (headed "This run", the artboard's wording), the job
  // list, undo history and the autonomy selector.
  await expect(page.getByText('This run', { exact: true })).toBeVisible()
  await expect(page.getByText('Undo history / 0')).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Agent autonomy' })).toBeVisible()

  // The filter pills read in the sidebar's module order (Skills is order
  // 20, Ideas is 80), not the order entries happened to be written in: the
  // seed writes the ideas row first.
  const pills = page.getByRole('radiogroup', { name: 'Filter the log by module' }).getByRole('radio')
  const labels = await pills.allTextContents()
  expect(labels.indexOf('Skills')).toBeLessThan(labels.indexOf('Ideas'))

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
  await page.getByRole('button', { name: /1 write across Ideas/ }).click()
  await expect(page.getByText('Gave a bare idea some notes')).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).first().click()

  // The row is struck through, Redo replaces Undo, and the rail counts it.
  await expect(page.getByRole('button', { name: 'Redo' }).first()).toBeVisible()
  await expect(page.getByText('Undo history / 1')).toBeVisible()

  await shoot(page, 'agent-log-undone')
})

test('settings, notifications', async ({ page }) => {
  await page.goto('/settings/notifications')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  // The channel strip and the coarse grid: one row per module, three rollup
  // switches each, and what triggers them.
  await expect(page.getByRole('switch', { name: 'Email digest' })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Digest for Finance' })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'In-app for System' })).toBeVisible()
  await expect(page.getByText('WHAT TRIGGERS IT')).toBeVisible()
  await expect(page.getByText('No push between')).toBeVisible()
  await expect(page.getByRole('button', { name: /breaks through/i })).toBeVisible()

  await shoot(page, 'settings-notifications')

  // A row switch writes every rule in the module, which is the thing the
  // rule by rule screen makes tedious.
  await page.getByRole('switch', { name: 'Push for Finance' }).click()
  await expect(page.getByText(/Push (on|off) for Finance/)).toBeVisible()
})

test('tasks, the board and the quick add parser', async ({ page }) => {
  await page.goto('/tasks')
  const mobile = (page.viewportSize()?.width ?? 0) < 768
  // No title block: the band carries the crumb with the view, and the count.
  await expectBand(page, page.getByText('Tasks / Today'))
  await expectBand(page, page.getByText(/\d+ open · \d+ done today/))

  // Today holds what is due today and what slipped, because a slip is today.
  await expect(page.getByText(/^Today · \w{3} \w{3} \d+$/)).toBeVisible()
  await expect(page.getByText('Recurring detection tests')).toBeVisible()
  await expect(page.getByText('Read DDIA ch. 5, Replication')).toBeVisible()

  // The tabs in the artboard's order, Calendar before Review. The phone
  // collapses to three; the rest sit behind the filter toggle.
  const tabs = page.getByRole('tab')
  if (mobile) {
    await expect(tabs).toHaveText([/Today/, /This week/, /Calendar/])
  } else {
    await expect(tabs).toHaveText([/Today/, /This week/, /By goal/, /By project/, /Calendar/, /Review/, /Done/])
  }

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
  const viewport = page.viewportSize()!
  const mobile = viewport.width < 768

  if (mobile) {
    // No inline expand and no EDIT button at this width: the row itself
    // opens the drawer.
    await page.getByRole('button', { name: /^Recurring detection tests/ }).click()
  } else {
    // One click opens the band under the row: notes, goal, skills, source.
    await page.getByRole('button', { name: /^Recurring detection tests/ }).click()
    const row = page.locator('article').filter({ hasText: 'Recurring detection tests' })
    await expect(row.getByText('Source:')).toBeVisible()
    await expect(row.getByText('Skills:')).toBeVisible()
    await expect(row.getByText('Same merchant, amount within 10 percent')).toBeVisible()
    await expect(page).toHaveURL(/open=/)
    await shoot(page, 'tasks-expanded')

    // EDIT opens the drawer, whose state is the URL so the shot survives.
    await page.getByRole('button', { name: 'Edit Recurring detection tests' }).click()
  }

  await expect(page).toHaveURL(/task=/)
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Tasks / Edit')).toBeVisible()
  await expect(drawer.getByText('Linked skills')).toBeVisible()
  await shoot(page, 'tasks-drawer')

  // On the phone the drawer is PosPhone's sheet: full width, on the bottom
  // edge, at most 74% of the screen.
  if (mobile) {
    // Measured once the 260ms slide in has landed: one tap opens it now, so
    // the first paint can still be mid flight.
    await expect.poll(async () => Math.round((await drawer.boundingBox())!.y + (await drawer.boundingBox())!.height)).toBe(viewport.height)
    const box = (await drawer.boundingBox())!
    expect(box.x).toBe(0)
    expect(box.width).toBe(viewport.width)
    expect(box.height).toBeLessThanOrEqual(viewport.height * 0.78 + 1)
  }

  // Edits hold until Save, then land as one write.
  await drawer.getByLabel('Estimate · min').fill('95')
  await drawer.getByRole('button', { name: /^Save/ }).click()
  const toast = page.getByText('Saved')
  await expect(toast).toBeVisible()
  // The toast clears the phone tab bar rather than sitting under it.
  if (mobile) {
    const bar = (await page.getByRole('navigation', { name: 'Sections' }).boundingBox())!
    const t = (await toast.boundingBox())!
    expect(t.y + t.height).toBeLessThan(bar.y)
  }
  await expect(page.locator('article').filter({ hasText: 'Recurring detection tests' }).getByText('95m')).toBeVisible()
})

test('tasks, the six views and the month grid', async ({ page }) => {
  await page.goto('/tasks')
  const mobile = (page.viewportSize()?.width ?? 0) < 768
  // A view switch is client bucketing of rows already on the page: it writes
  // the URL through the History API and asks the server for nothing. The
  // reloads shoot() does are document requests, so they do not count here.
  let rsc = 0
  page.on('request', (req) => {
    if (req.url().includes('_rsc')) rsc += 1
  })
  // Review and By goal moved off the segment row on the phone; the filter
  // toggle behind the row reaches them instead.
  const openView = async (name: string | RegExp) => {
    if (mobile) {
      await page.getByRole('button', { name: 'Filter task views' }).click()
      await page.getByRole('radio', { name }).click()
    } else {
      await page.getByRole('tab', { name }).click()
    }
  }

  // Review holds agent-proposed work, which is a real row that does not count
  // until it is accepted.
  await openView(/Review/)
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
  await openView(/By goal/)
  await expect(page.getByText('No goal')).toBeVisible()

  // The month grid is a view like the others, so it is a tab rather than a
  // button beside them.
  await page.getByRole('tab', { name: 'Calendar' }).click()
  await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible()
  await expect(page.getByText(/\d+ open · \d+ with reminders/)).toBeVisible()
  await expect(page).toHaveURL(/month=1/)
  await shoot(page, 'tasks-calendar')
  await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible()
  expect(rsc, 'RSC requests across the view switches').toBe(0)

  if (mobile) {
    // The grid fits the pane: no sideways scroll, and a day's task is a dot
    // that opens it.
    const pane = page.locator('[data-segments-pane]')
    expect(await pane.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    const dot = pane.locator('button:has(> span.rounded-full)').first()
    const title = (await dot.getAttribute('aria-label')) ?? ''
    await dot.click()
    // The drawer is named by the task's title now, not the crumb.
    await expect(page.getByRole('dialog', { name: title })).toBeVisible()
    await expect(page.getByRole('dialog').getByLabel('Title')).toHaveValue(title)
  }
})

test('tasks, completing one emits the event that earns XP', async ({ page }) => {
  // The dashboard's Tasks tile reads the latest digest, and every write tool
  // recomputes it (v1.1 Phase 5), so the count moves without Run now.
  await page.goto('/')
  const tasksMeta = page.getByRole('main').getByRole('link', { name: /of \d+ done/ })
  const before = await tasksMeta.textContent()

  await page.goto('/tasks')
  const mobile = (page.viewportSize()?.width ?? 0) < 768

  await page.getByRole('button', { name: 'Complete Read DDIA ch. 5, Replication' }).click()
  await expect(page.getByText('Done. Read DDIA ch. 5, Replication')).toBeVisible()

  await page.goto('/')
  await expect(tasksMeta).toBeVisible()
  expect(await tasksMeta.textContent()).not.toBe(before)
  await page.goto('/tasks')

  if (mobile) {
    await page.getByRole('button', { name: 'Filter task views' }).click()
    await page.getByRole('radio', { name: /Done/ }).click()
  } else {
    await page.getByRole('tab', { name: /Done/ }).click()
  }
  // Exact, because the toast "Done. Read DDIA ch. 5, Replication" is still on
  // screen and a substring match resolved to both.
  await expect(page.getByText('Read DDIA ch. 5, Replication', { exact: true })).toBeVisible()
})

test('tasks, a skill linked by hand shows MANUAL, survives a reload and reaches the tree', async ({ page }) => {
  // On the phone the row itself opens the drawer; on the desktop it expands
  // and EDIT opens it.
  const mobile = (page.viewportSize()?.width ?? 0) < 768
  const open = async () => {
    await page.goto('/tasks')
    await page.getByRole('button', { name: /^Recurring detection tests/ }).click()
    if (!mobile) await page.getByRole('button', { name: 'Edit Recurring detection tests' }).click()
  }
  await open()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Linked skills')).toBeVisible()

  // The seed upserts the task and its registry row, so a link from the other
  // Playwright project is still there. Start clean.
  const unlink = drawer.getByRole('button', { name: 'Unlink Negotiation' })
  if (await unlink.isVisible()) {
    const cleared = page.waitForResponse((r) => r.request().method() === 'POST' && r.ok())
    await unlink.click()
    await cleared
  }

  await drawer.getByRole('button', { name: 'Link a skill' }).click()
  // The chip is optimistic, so wait for the action's POST before reloading.
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.ok())
  await drawer.getByRole('combobox', { name: 'Skill' }).selectOption('negotiation')
  const chip = drawer.locator('span').filter({ hasText: /^NegotiationMANUAL×$/ })
  await expect(chip).toBeVisible()
  await saved

  // The row is the server's, not the optimistic guess: it is still there after
  // a reload, and the drawer reopens because its state is the URL.
  await page.reload()
  await expect(drawer.getByRole('link', { name: 'Negotiation' })).toBeVisible()
  await expect(chip).toBeVisible()

  // The Skill Tree reads the same row: the task's creation event now sits
  // under Negotiation.
  await page.goto('/skills?skill=negotiation')
  await expect(page.getByText('Recurring detection tests').first()).toBeVisible()

  await open()
  const removed = page.waitForResponse((r) => r.request().method() === 'POST' && r.ok())
  await drawer.getByRole('button', { name: 'Unlink Negotiation' }).click()
  await expect(drawer.getByRole('link', { name: 'Negotiation' })).toBeHidden()
  await removed
})

test('travel, a skill linked by hand on a trip shows MANUAL and survives a reload', async ({ page }) => {
  await page.goto('/travel')
  await page.waitForLoadState('networkidle')
  await page.getByTestId('travel-sections').getByRole('button', { name: /Tokyo/ }).first().click()
  const drawer = page.getByRole('dialog')
  await expect(page).toHaveURL(/trip=/)
  await expect(drawer.getByText('Linked skills')).toBeVisible()

  // The seed upserts the trip and its registry row, so a link from the other
  // Playwright project is still there. Start clean.
  const unlink = drawer.getByRole('button', { name: 'Unlink Negotiation' })
  if (await unlink.isVisible()) {
    const cleared = page.waitForResponse((r) => r.request().method() === 'POST' && r.ok())
    await unlink.click()
    await cleared
  }

  await drawer.getByRole('button', { name: 'Link a skill' }).click()
  // The chip is optimistic, so wait for the action's POST before reloading.
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.ok())
  await drawer.getByRole('combobox', { name: 'Skill' }).selectOption('negotiation')
  const chip = drawer.locator('span').filter({ hasText: /^NegotiationMANUAL×$/ })
  await expect(chip).toBeVisible()
  await saved

  await page.reload()
  await expect(chip).toBeVisible()

  const removed = page.waitForResponse((r) => r.request().method() === 'POST' && r.ok())
  await drawer.getByRole('button', { name: 'Unlink Negotiation' }).click()
  await expect(drawer.getByRole('link', { name: 'Negotiation' })).toBeHidden()
  await removed
})

test('every remaining entity drawer carries the Linked skills block', async ({ page }) => {
  const drawer = page.getByRole('dialog')

  await page.goto('/insurance')
  await page.getByRole('button', { name: /Apartment, renters/ }).click()
  await expect(drawer.getByText('Linked skills')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Link a skill' })).toBeVisible()

  await page.goto('/meals?tab=recipes')
  await page.getByRole('button', { name: /Turkey chili/ }).first().click()
  await expect(drawer.getByText('Linked skills')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Link a skill' })).toBeVisible()

  await page.goto('/home')
  await page.getByRole('button', { name: /HVAC, four ton/ }).click()
  await expect(drawer.getByText('Linked skills')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Link a skill' })).toBeVisible()

  // Both health views share the drawer file, so both carry the block.
  await page.goto('/health')
  await page.getByRole('button', { name: /Annual physical/ }).first().click()
  await expect(drawer.getByText('Linked skills')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Link a skill' })).toBeVisible()
  await page.goto('/health')
  await page.getByRole('button', { name: /Annual lab panel/ }).first().click()
  await expect(drawer.getByText('Linked skills')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Link a skill' })).toBeVisible()

  // A workout has no drawer: the row expands under itself and the Skill
  // column keeps the first name.
  await page.goto('/fitness')
  const row = page.getByRole('button', { name: /Easy run/ }).first()
  await row.click()
  await expect(page.getByText('Linked skills')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Link a skill' })).toBeVisible()
  await row.click()
  await expect(page.getByText('Linked skills')).toHaveCount(0)
})

test('phone Tasks shows three segments', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The collapsed segment row is a phone thing')

  await page.goto('/tasks')
  const tabs = page.getByRole('tab')
  await expect(tabs).toHaveText([/Today/, /This week/, /Calendar/])

  // The other four views sit behind the filter toggle, not lost.
  await page.getByRole('button', { name: 'Filter task views' }).click()
  await expect(page.getByRole('radio', { name: /By goal/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: /By project/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Review/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Done/ })).toBeVisible()
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
  // On the phone the tap opened the drawer, whose footer holds Delete; on
  // the desktop it expanded the row, which holds its own.
  const mobile = (page.viewportSize()?.width ?? 0) < 768
  await (mobile ? page.getByRole('dialog') : page.locator('article').filter({ hasText: 'Throw away this row' }))
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(page.getByText('Deleted')).toBeVisible()
  await expect(page.locator('article').filter({ hasText: 'Throw away this row' })).toHaveCount(0)
})

test('tasks, a project lends its goal to its tasks, and the plus knows its column', async ({ page }) => {
  await page.goto('/tasks?view=project')

  // Projects is a drawer over the By project view. A project made here takes a
  // goal, and from then on a task filed under it counts toward that goal.
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  const projects = page.getByRole('dialog')
  await projects.getByLabel('New project').fill('Phase6')
  await projects.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('Added. Phase6')).toBeVisible()
  await projects.getByLabel('Phase6 goal').selectOption({ label: 'Net worth $300k' })
  await expect(page.getByText('Saved')).toBeVisible()
  await page.keyboard.press('Escape')

  const line = page.getByLabel('Add a task')
  await line.fill('Fund the brokerage #Phase6')
  await line.press('Enter')
  await expect(page.getByText('Added. Fund the brokerage')).toBeVisible()

  // The goal drawer lists it through the linked seam, which reads the same
  // coalesce as the board: the task has no goal of its own.
  await page.goto('/goals')
  await page.getByRole('button', { name: /Net worth \$300k/ }).click()
  const goal = page.getByRole('dialog')
  await expect(goal.getByText('Linked tasks')).toBeVisible()
  await expect(goal.getByText('Fund the brokerage').first()).toBeVisible()

  // The plus on a By goal column opens New task with that goal chosen, and
  // Pick a date reveals a native date input that takes any day.
  await page.goto('/tasks?view=goal')
  await page.getByRole('button', { name: 'New task in Net worth $300k' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Tasks / New task')).toBeVisible()
  await expect(drawer.getByLabel(/^Goal/).locator('option:checked')).toHaveText('Net worth $300k')
  await drawer.getByLabel('Due', { exact: true }).selectOption('date')
  const date = drawer.getByLabel('Due date')
  await date.fill('2026-12-24')
  await expect(date).toHaveValue('2026-12-24')
})

test('goals, progress by area with the rule behind each status', async ({ page }) => {
  await page.goto('/goals')
  await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible()
  // The band's summary, with the dot in the worst colour on the page.
  await expectBand(page, page.getByText(/\d+ active · \d+ at risk · \d+ stalled/))

  // Grouped by life area, each group counting what is on track, and every
  // status carries the sentence that produced it rather than only a colour.
  await expect(page.getByText(/^\d+ goals? · \d+ on track$/).first()).toBeVisible()
  const netWorth = page.locator('article').filter({ hasText: 'Net worth $300k' })
  await expect(netWorth.getByText('$247,200')).toBeVisible()
  await expect(netWorth.getByText('/ $300,000')).toBeVisible()
  await expect(page.getByText('No change in 40 days.')).toBeVisible()
  await expect(page.getByText(/Pace .* vs .* needed \(\d+%\)\./).first()).toBeVisible()

  // The demo history is shaped so every rule is on screen at once.
  // The card badges, not the band's "1 STALLED", which the phone does not draw.
  await expect(page.getByText('STALLED', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('AT RISK', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('ON TRACK', { exact: true }).first()).toBeVisible()

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
  const mobile = (page.viewportSize()?.width ?? 0) < 768

  // The form is in the URL, which is what lets a half typed goal survive the
  // reload the theme toggle does.
  await page.getByRole('button', { name: '+ Add a goal inline' }).click()
  await expect(page).toHaveURL(/new=1/)

  if (mobile) {
    // One field on the phone; Next opens the drawer for the rest.
    const form = page.locator('form').filter({ hasText: 'Goal' })
    await form.getByLabel('Goal').fill('Swim 2km without stopping')
    await form.getByRole('button', { name: 'Next' }).click()

    const drawer = page.getByRole('dialog')
    await drawer.getByLabel('Target', { exact: true }).fill('2')
    await drawer.getByLabel('Deadline').fill('2027-03-01')
    await drawer.getByRole('button', { name: 'Create' }).click()
  } else {
    // Scoped to the form: "Goal" also names a field in the drawer behind it.
    const form = page.locator('form').filter({ hasText: 'Deadline' })
    await form.getByLabel('Goal').fill('Swim 2km without stopping')
    await form.getByLabel('Target').fill('2')
    await form.getByLabel('Deadline').fill('2027-03-01')
    await form.getByRole('button', { name: 'Add', exact: true }).click()
  }

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
  // The shell's negative margin matches the phone's 18px body, so nothing
  // scrolls sideways at 402.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize()!.width)

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

  // The band's theme control: System, Light, Dark. It shares the setting
  // with the sidebar's control, so one press moves both. System removes the
  // attribute and the page follows the device. Desktop only: the sidebar is
  // not on a phone.
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    // shoot() leaves the cookie on dark but the page on its last shot, light.
    await page.reload()
    await page.waitForLoadState('networkidle')
    const band = page.locator('header').getByRole('group', { name: 'Theme' })
    const rail = page.getByRole('navigation', { name: 'Sections' }).getByRole('group', { name: 'Theme' })
    await band.getByRole('button', { name: 'Light', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(rail.getByRole('button', { name: 'Light', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await band.getByRole('button', { name: 'System', exact: true }).click()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme')
    await band.getByRole('button', { name: 'Dark', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  }

  // The first step's primary is named for what it starts, not for advancing.
  await page.getByRole('button', { name: 'Start the review' }).click()
  await page.getByLabel('Add a win').fill('Shipped the notifications screen')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('Shipped the notifications screen')).toBeVisible()
  await expect(page).toHaveURL(/step=wins/)
  await shoot(page, 'weekly-review-wins')

  // Step three: every slipped item needs a decision, and the wizard says how
  // many are still owed rather than letting you walk past silently.
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText(/still undecided/)).toBeVisible()

  // Deciding one of them is what the step is for, so the count says so.
  await page.getByRole('radio', { name: /^Carry$/ }).first().click()
  await expect(page.getByText(/1 of \d+ decided/)).toBeVisible()
  await expect(page).toHaveURL(/step=misses/)

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
  //
  // Both numbers, not just the first. The axis is thirty days whatever came
  // back from the query, and the second number is how many of those days a
  // balance was actually recorded on. The seed writes 31 days and the window
  // holds 30 of them, so a chart that has gone back to drawing one point per
  // row rather than one per day fails here rather than looking plausible.
  await expect(
    page.getByRole('img', { name: /Net worth over 30 days, 30 of them recorded/ }),
  ).toBeVisible()

  const mobile = (page.viewportSize()?.width ?? 0) < 768
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
    // Rows sit inside the grouped surface with a 16px inset; the overview keeps
    // its 9px row height (`overviewRow`) until Phase 5 restyles Finance.
    expect(rowPadding).toBe('9px 16px')
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
  const mobile = (page.viewportSize()?.width ?? 0) < 768
  await page.goto(mobile ? '/finance?tab=subscriptions' : '/finance')
  // The desktop cards are in the phone's DOM too, hidden, so scope to the pane.
  const scope = mobile ? page.locator('[data-segments-pane]') : page.getByTestId('finance-upcoming')

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
  const mobile = (page.viewportSize()?.width ?? 0) < 768
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
  test.skip((page.viewportSize()?.width ?? 0) < 768, 'desktop drawer')
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

  // Typed one key at a time, because the drawer once refocused its panel on
  // every keystroke and only the first character landed. A pasted amount
  // arrives the way money() prints it, with the sign and the comma.
  const limit = page.getByLabel(/^Monthly limit for/).first()
  await limit.fill('')
  await limit.pressSequentially('1500')
  await expect(limit).toHaveValue('1500')
  await limit.fill('$1,250.50')
  await expect(page.getByText('2 unsaved changes')).toBeVisible()

  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.getByText('No changes')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page).not.toHaveURL(/limits=1/)
})

test('finance segments swipe from overview to accounts and the URL follows', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch gestures are a phone thing')

  await page.goto('/finance')
  await expect(page.getByRole('tab', { name: /Overview/ })).toHaveAttribute('aria-selected', 'true')

  const pane = page.locator('[data-segments-pane]')
  const box = (await pane.boundingBox())!
  const y = box.y + 40
  await pane.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: box.x + box.width - 20, clientY: y })
  await pane.dispatchEvent('pointerup', { pointerType: 'touch', clientX: box.x + 20, clientY: y })

  await expect(page.getByRole('tab', { name: /Accounts/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/tab=accounts/)
})

test('onboarding, six steps that write as they go', async ({ page }) => {
  await page.goto('/onboarding')
  await expect(page.getByRole('heading', { name: 'Start with the basics' })).toBeVisible()

  await page.getByLabel('Your name').fill('Owner')
  await page.getByLabel('Timezone').click()
  await shoot(page, 'onboarding')

  // Modules is a visibility switch, not a delete. The artboard draws it as a
  // grid of numbered, clickable cards with an ON/OFF state word, not a
  // switch row, so the switch role is gone from this step.
  await page.getByRole('button', { name: '02 Modules' }).click()
  await expect(page.getByText(/every module can be added later/i)).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Show Finance' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /01[\s\S]*ON[\s\S]*Finance/ })).toBeVisible()
  await expect(page.getByText(/connector categories unlock/)).toBeVisible()

  // Turn a module off here so its categories render greyed on the next step,
  // rather than disappearing.
  await page.getByRole('button', { name: /Travel/ }).click()

  // Connections records intent. A provider with a real integration is starred;
  // everything else is honestly a request.
  await page.getByRole('button', { name: '03 Connections' }).click()
  await expect(page.getByText(/nothing pretends to be connected/)).toBeVisible()

  // A category whose module is off stays visible, greyed, with a way to turn
  // the module back on, rather than disappearing.
  const airlineCategory = page.getByText('Airline loyalty').locator('..')
  await expect(airlineCategory).toContainText('Travel module off')
  // The step shows before the router has written it; the shot reloads.
  await expect(page).toHaveURL(/step=connect/)
  await shoot(page, 'onboarding-connections-module-off')
  await airlineCategory.getByRole('button', { name: 'Add Travel module' }).click()
  await expect(page.getByText('Travel module off')).toHaveCount(0)

  // A category that carries Finance and Goals' real numbers says so until
  // something in it is requested.
  await expect(page.getByRole('button', { name: /Banks & credit unions/ })).toContainText('Needed')

  // The global search narrows every category's providers by name.
  await page.getByLabel('Search every connector').fill('wells fargo')
  await expect(page.getByText('Matches · 1')).toBeVisible()
  await page.getByLabel('Search every connector').fill('')

  // Requesting a listed provider clears the Needed flag and lists it as
  // Requested; a name with no integration is recorded the same way, through
  // the manual add.
  await page.getByRole('button', { name: /Banks & credit unions/ }).click()
  await page.getByRole('button', { name: 'Chase', exact: true }).click()
  await expect(page.getByText('Requested · 1')).toBeVisible()
  await expect(page.getByRole('button', { name: /Banks & credit unions/ })).not.toContainText('Needed')

  await page.getByRole('button', { name: 'Add manually' }).click()
  await page.getByLabel('Name of the institution').fill('Local Credit Union')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('Local Credit Union noted')).toBeVisible()
  await expect(page.getByText('Requested · 2')).toBeVisible()

  // Clean up: leave connections as this test found them for whatever runs next.
  await page.getByRole('button', { name: 'Local Credit Union', exact: true }).click()
  await page.getByRole('button', { name: 'Chase', exact: true }).first().click()
  await expect(page.getByText(/Requested ·/)).toHaveCount(0)

  await shoot(page, 'onboarding-connections')
})

test('onboarding, a starter goal only points at a metric that exists', async ({ page }) => {
  await page.goto('/onboarding?step=goals')

  // Finance and Tasks are installed, so those two compute. The reading goal
  // names no metric and is checked in by hand.
  await expect(page.getByText('Six months of runway')).toBeVisible()
  await expect(page.getByText('computed').first()).toBeVisible()
  await expect(page.getByText('Read twelve books this year')).toBeVisible()

  // No check-in cadence control anywhere: nothing in goals.write stores one.
  await expect(page.getByRole('button', { name: 'Weekly', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Quarterly', exact: true })).toHaveCount(0)

  await shoot(page, 'onboarding-goals')
})

test("onboarding, a goal's target and deadline are editable", async ({ page }) => {
  await page.goto('/onboarding?step=goals')

  // Picking a goal reveals its own Target and By when inputs, holding what
  // is typed. "Read twelve books this year" is the third and last of the
  // three starter goals.
  //
  // The round trip through Finish is not exercised here: finish() marks
  // core.settings.onboarding_completed_at permanently, and nothing in this
  // screen's scope (no core/settings.ts, no e2e/seed.mts) can clear it back
  // for the tests that run after, including this file's own next one, which
  // needs the wizard rather than the "you are set up" screen. Reported as a
  // Blocked item rather than left silently short of the plan.
  await page.getByRole('button', { name: 'Add', exact: true }).nth(2).click()
  const targetInput = page.getByLabel('Read twelve books this year target')
  await targetInput.fill('7')
  await expect(targetInput).toHaveValue('7')

  const dateInput = page.getByLabel('Read twelve books this year deadline')
  await dateInput.fill('2030-03-01')
  await expect(dateInput).toHaveValue('2030-03-01')
})

test('onboarding, requesting a provider records it without pretending', async ({ page }) => {
  await page.goto('/onboarding?step=connect')

  await page.getByRole('button', { name: /Banks & credit unions/ }).click()
  await page.getByRole('button', { name: 'Ally', exact: true }).click()
  await expect(page.getByText('Ally noted')).toBeVisible()

  // It lands in Settings as requested, which is the honest half of the claim.
  await page.goto('/settings/connections')
  await expect(page.getByText('Ally')).toBeVisible()
})

test('onboarding, the morning digest hour is the cron\'s, not an input', async ({ page }) => {
  await page.goto('/onboarding?step=notify')

  // One nightly run a day, so the morning hour is read from the cron and shown
  // as a value. The evening hour is still the owner's to set.
  const morning = page.getByLabel('Morning digest time')
  await expect(morning).toHaveText(/^\d\d:\d\d$/)
  await expect(morning).not.toHaveJSProperty('tagName', 'INPUT')
  await expect(page.getByLabel('Evening digest time')).toHaveJSProperty('tagName', 'INPUT')
})

test('onboarding, first run copy names no source count', async ({ page }) => {
  await page.goto('/onboarding?step=ready')

  // The step's own lede, above the h2.
  const lede = page.getByText(/write its first digest for the morning/i)
  await expect(lede).toBeVisible()
  // A real, computed hour (HH:MM), not a hardcoded one.
  await expect(lede).toContainText(/tonight at \d\d:\d\d/i)

  // The First run card, above the Summary table, names no source count.
  const card = page.getByText(/classifies what it finds/i)
  await expect(card).toBeVisible()
  await expect(card).not.toContainText(/backfills 90 days/i)
  await expect(card).not.toContainText(/pulls \d+ source/i)

  // The Summary table uses the artboard's keys.
  await expect(page.getByText('NAME', { exact: true })).toBeVisible()
  await expect(page.getByText('ALERTS', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Nothing here is locked in. Connections, modules and rules all live in Settings once you are inside.'),
  ).toBeVisible()

  // Each summary row jumps back to the step it summarises.
  await page.getByRole('button', { name: 'Change' }).first().click()
  await expect(page.getByRole('heading', { name: 'Start with the basics' })).toBeVisible()
})

test('second brain, the inbox holds a draft beside its source', async ({ page }) => {
  await page.goto('/brain')

  // POS Second Brain.dc.html: the band alone (the h1 is for the reader), the
  // folder row of chips in the artboard's order, no tab row.
  await expect(page.getByRole('heading', { name: 'Second Brain', level: 1 })).toHaveClass(/sr-only/)
  await expect(page.getByRole('tablist')).toHaveCount(0)
  await expect(page.getByText(/^Second Brain\s*\/\s*Inbox$/)).toBeVisible()
  // The count sits in the band from md up; the phone band has no room for it.
  if ((page.viewportSize()?.width ?? 0) >= 768) {
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
  await expect(page).toHaveURL(/note=/)

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

// docs/plans/brain-capture.md Phase 2: the capture box above the list. Twenty
// characters is enough to ask for related notes; the first line is the title.
test('second brain, the capture box saves a note and shows related while typing', async ({ page }) => {
  await page.goto('/brain')
  const box = page.getByTestId('brain-capture')
  await expect(page.getByTestId('brain-hubs').getByRole('button', { name: /^Unfiled/ })).toBeVisible()

  const title = `Captured ${Date.now()}`
  await box.getByRole('textbox', { name: 'Capture' }).fill(`${title}\nHybrid search over notes.`)
  await expect(box.getByText('Related', { exact: true })).toBeVisible()

  await box.getByRole('button', { name: /^Save/ }).click()
  await expect(page.getByText('Saved')).toBeVisible()
  await expect(page).toHaveURL(/folder=note/)
  await expect(page.getByRole('button', { name: /^Captured/ }).first()).toContainText(title)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
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
  const tokyo = page.getByTestId('travel-sections').getByRole('button', { name: /Tokyo/ }).first()
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
  await expect(page).toHaveURL(/tab=budget/)
  await shoot(page, 'travel-budget')
})

test('travel, the globe is drawn from real coordinates', async ({ page }) => {
  await page.goto('/travel')

  // Hand rolled orthographic projection, no d3 and no world-atlas download;
  // the land is a committed list of rings.
  const globe = page.getByRole('group', { name: /Globe showing \d+ places/ })
  await expect(globe).toBeVisible()

  // Only the near side is drawn, so the pins on screen are fewer than the six
  // seeded places spread across four continents. It opens level on the US,
  // so Austin is on the near side.
  const pins = globe.locator('[data-pin]')
  expect(await pins.count()).toBeGreaterThan(1)
  await expect(globe.locator('[data-pin="past"] title', { hasText: 'Austin' })).toHaveCount(1)
  // One path for the land: a closed subpath per ring on the near side, and
  // a ring cut by the horizon is joined along the rim with an arc.
  const land = globe.locator('[data-land]')
  const home = (await land.getAttribute('d')) ?? ''
  expect((home.match(/Z/g) ?? []).length).toBeGreaterThan(100)
  expect(home).toContain('A')

  // The pin's own tooltip is what makes a dot identifiable at all: a visited
  // place names itself and its country.
  await expect(globe.locator('[data-pin="past"] title').first()).toHaveText(/\w+, \w+/)
  await shoot(page, 'travel-map')

  // A hand on the globe: drag right and the land under it goes right. It used
  // to go left, while a vertical drag already followed the hand, so the two
  // axes disagreed.
  const svg = page.getByTestId('travel-globe').locator('svg')
  const sbox = (await svg.boundingBox())!
  // The same pin before and after: which pins are on the near side changes
  // as the globe turns, so `first()` alone could name a different one.
  const pinName = (await globe.locator('[data-pin="past"] title').first().textContent()) ?? ''
  const pin = globe.locator('[data-pin="past"]').filter({ hasText: pinName })
  const before = (await pin.boundingBox())!.x
  await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height * 0.7)
  await page.mouse.down()
  await page.mouse.move(sbox.x + sbox.width / 2 + 40, sbox.y + sbox.height * 0.7, { steps: 4 })
  await page.mouse.up()
  await expect.poll(async () => (await pin.boundingBox())!.x).toBeGreaterThan(before)
  // The drag moved the land too, and Reset brings it back to the same view.
  expect(await land.getAttribute('d')).not.toBe(home)
  await page.getByTestId('travel-globe').getByRole('button', { name: 'Reset view' }).click()
  await expect(land).toHaveAttribute('d', home)

  // Past 2x every pin names itself; two presses of + is 2.25x. The wheel
  // handler is a native non-passive listener, so the page under the globe
  // does not scroll when it zooms. The zoom is about the centre, so a pin
  // far from it leaves the box: Lisbon at the rim, and Austin at 30 north
  // clears the top at 2.25x. Mexico City at 19 north stays.
  const past = globe.locator('[data-pin="past"]').filter({ hasText: 'Mexico City' })
  await expect(past.locator('[data-label]')).toHaveCount(0)
  const controls = page.getByTestId('travel-globe')
  await controls.getByRole('button', { name: 'Zoom in' }).click()
  await controls.getByRole('button', { name: 'Zoom in' }).click()
  await expect(past.locator('[data-label]')).toBeVisible()
  const name = (await past.locator('[data-label]').textContent()) ?? ''

  // A grey pin opens its trip, or itself when it has none: the seeded places
  // have none.
  await past.locator('circle').first().click({ force: true })
  await expect(page.getByRole('dialog', { name })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // And from the keyboard: the pin is a button.
  await past.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name })).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Visited')
})

test('travel, a pin opens on a tap and stays shut through a drag', async ({ page }) => {
  await page.goto('/travel')
  const globe = page.getByRole('group', { name: /Globe showing \d+ places/ })
  await expect(globe).toBeVisible()
  const pin = globe.locator('[data-pin="past"]').filter({ hasText: 'Mexico City' })
  // The finger-sized target is the first, transparent circle; the visible
  // dot is a hair across. A press 9px off the dot's centre still lands.
  const dot = (await pin.locator('circle').last().boundingBox())!
  await page.mouse.click(dot.x + dot.width / 2 + 9, dot.y + dot.height / 2)
  await expect(page).toHaveURL(/place=/)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // A drag that starts on a pin turns the globe and opens nothing.
  await page.goto('/travel')
  await expect(globe).toBeVisible()
  const land = globe.locator('[data-land]')
  const home = (await land.getAttribute('d')) ?? ''
  const box = (await pin.locator('circle').last().boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 })
  await page.mouse.up()
  await expect.poll(() => land.getAttribute('d')).not.toBe(home)
  await expect(page).not.toHaveURL(/place=/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
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
  await expect(page).toHaveURL(/tab=inbox/)
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

// Geocoding happens in a server action, so page.route on the Open-Meteo URL
// (the plan's original idea) cannot intercept it: the fetch runs on the
// server, not in the page. This test hits the real API instead and is
// skipped in CI, where there is no network.
test('travel, typing a destination suggests places and fills the coordinates', async ({ page }) => {
  test.skip(!!process.env.CI, 'needs network')
  await page.goto('/travel')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /New trip/ }).click()

  // One row per destination since v1.1 Phase 9, each with its own datalist, so
  // the suggestions are the row's rather than the form's.
  const row = page.getByTestId('destination-row').first()
  const destination = row.getByLabel('Destination', { exact: true })
  await destination.fill('Austin')
  const option = row.locator('datalist option[value*="Austin"]').first()
  await expect(option).toHaveCount(1, { timeout: 10_000 })
  const label = (await option.getAttribute('value')) ?? ''

  await destination.fill(label)
  await expect(row.getByLabel('Lat', { exact: true })).toHaveValue(/^-?\d+(\.\d+)?$/)
  await expect(row.getByLabel('Lon', { exact: true })).toHaveValue(/^-?\d+(\.\d+)?$/)
})

// v1.1 Phase 9. A trip held one destination, so four trips to the same country
// were four trips. This is the scenario from docs/plans/pos-v1-1.md: a trip
// with two destinations, a pin for each, one taken away again, and a second
// trip merged in. It builds
// its own trip and deletes it at the end, because the travel tests that follow
// read the seeded fixture and a stray trip would change what they count.
test('travel, a trip holds a list of destinations', async ({ page }) => {
  // Both confirms in this test are the drawer's: merging asks first, and so
  // does removing a trip.
  page.on('dialog', (d) => d.accept())

  await page.goto('/travel')
  const globe = page.getByRole('group', { name: /Globe showing \d+ places/ })
  // The label counts every pin, not the ones on the near side, so it is a
  // number this test can hold still while the globe turns.
  const pinned = async () => {
    const label = (await globe.getAttribute('aria-label')) ?? ''
    return Number(/(\d+)/.exec(label)?.[1] ?? -1)
  }
  const before = await pinned()

  await page.getByRole('button', { name: /New trip/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Trip', { exact: true }).fill('Iberia, spring')

  // Coordinates are typed rather than picked from the suggestions: the
  // suggestion list comes from the geocoder and CI has no network.
  const rows = page.getByTestId('destination-row')
  // Every field is read back after it is filled. The row's onChange builds the
  // next row from the prop it was rendered with, so a fill that lands before
  // React has re-rendered would quietly revert the field before it, and the
  // failure would otherwise surface three steps later as a wrong date span.
  const fill = async (i: number, name: string, lat: string, lon: string, start: string, end: string) => {
    const row = rows.nth(i)
    for (const [label, value] of [
      [/^Destination/, name],
      ['Lat', lat],
      ['Lon', lon],
      ['Arrive', start],
      ['Leave', end],
    ] as const) {
      const input = typeof label === 'string' ? row.getByLabel(label, { exact: true }) : row.getByLabel(label)
      await input.fill(value)
      await expect(input).toHaveValue(value)
    }
  }

  // A new trip opens on one empty row. Never zero: a form with nowhere to type
  // has nowhere to start.
  await expect(rows).toHaveCount(1)
  await fill(0, 'Lisbon', '38.72', '-9.14', '2027-04-02', '2027-04-06')

  await dialog.getByRole('button', { name: '+ Add destination' }).click()
  await expect(rows).toHaveCount(2)
  await fill(1, 'Porto', '41.15', '-8.61', '2027-04-06', '2027-04-11')

  await dialog.getByRole('button', { name: /^Create/ }).click()
  await expect(page.getByText('Trip created')).toBeVisible()

  // Both destinations are pinned, not just the trip.
  await expect.poll(pinned).toBe(before + 2)

  await page.getByTestId('travel-sections').getByRole('button', { name: /Iberia, spring/ }).first().click()
  await expect(page).toHaveURL(/trip=/)

  // What was saved, read back off the form. This is the direct evidence and it
  // comes first: the trip's own dates below are derived from these rows, so a
  // row that lost a date should fail here, naming the field, rather than there.
  await page.getByRole('button', { name: 'Edit details' }).click()
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0).getByLabel(/^Destination/)).toHaveValue('Lisbon')
  await expect(rows.nth(1).getByLabel(/^Destination/)).toHaveValue('Porto')
  await expect(rows.nth(1).getByLabel('Lat', { exact: true })).toHaveValue('41.15')
  await expect(rows.nth(1).getByLabel('Arrive', { exact: true })).toHaveValue('2027-04-06')
  await expect(rows.nth(1).getByLabel('Leave', { exact: true })).toHaveValue('2027-04-11')
  // No shot of the open form: shoot() reloads to swap the theme, and whether
  // the form is open is React state rather than the URL, so it would come back
  // showing the drawer behind it.

  // Cancel goes back to the trip, where its own place and dates are a summary
  // of those rows: the first row's city, and the span across both rather than
  // either one.
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toContainText('Lisbon')
  await expect(dialog).toContainText(/Apr 2.+Apr 11/)

  // Taking one away takes its pin with it, and the span shrinks back.
  await page.getByRole('button', { name: 'Edit details' }).click()
  await rows.nth(1).getByRole('button', { name: 'Remove Porto' }).click()
  await expect(rows).toHaveCount(1)
  await dialog.getByRole('button', { name: /^Save/ }).click()
  await expect(page.getByText('Saved')).toBeVisible()
  await expect.poll(pinned).toBe(before + 1)
  await expect(dialog).toContainText(/Apr 2.+Apr 6/)

  // Merging: a second trip to the same country folds into the first as one
  // more destination. Its pin survives the merge, the trip does not, and the
  // first trip's span stretches to cover it.
  await page.keyboard.press('Escape')
  await expect(page).not.toHaveURL(/trip=/)
  await page.getByRole('button', { name: /New trip/ }).click()
  await dialog.getByLabel('Trip', { exact: true }).fill('Madrid, after')
  await expect(rows).toHaveCount(1)
  await fill(0, 'Madrid', '40.42', '-3.70', '2027-04-12', '2027-04-18')
  await dialog.getByRole('button', { name: /^Create/ }).click()
  await expect(page.getByText('Trip created')).toBeVisible()
  await expect.poll(pinned).toBe(before + 2)

  await page.getByTestId('travel-sections').getByRole('button', { name: /Madrid, after/ }).first().click()
  await expect(page).toHaveURL(/trip=/)
  await dialog.getByLabel('Merge into').selectOption({ label: 'Iberia, spring' })
  await expect(page.getByText('Trips merged')).toBeVisible()
  await expect(page).not.toHaveURL(/trip=/)
  await expect(page.getByTestId('travel-sections')).not.toContainText('Madrid, after')
  await expect.poll(pinned).toBe(before + 2)

  await page.getByTestId('travel-sections').getByRole('button', { name: /Iberia, spring/ }).first().click()
  await expect(dialog).toContainText(/Apr 2.+Apr 18/)
  await page.getByRole('button', { name: 'Edit details' }).click()
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(1).getByLabel(/^Destination/)).toHaveValue('Madrid')
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  // Put the fixture back for the travel tests after this one. Deleting the one
  // trip left takes both pins with it.
  await page.getByRole('button', { name: 'Delete trip' }).click()
  await expect(page.getByText('Trip deleted')).toBeVisible()
  await expect.poll(pinned).toBe(before)
})

test('fitness, workouts with pace derived rather than stored', async ({ page }) => {
  await page.goto('/fitness')
  await expect(page.getByRole('heading', { name: 'Fitness' })).toBeVisible()

  // Pace is a ratio of the stored distance and duration, so it can never
  // disagree with them. 5.1 km in 51 minutes is 10:00/km.
  await expect(page.getByText(/5\.1 km at 10:00\/km/)).toBeVisible()

  // The heaviest set is shown as what happened, not as a one rep max estimate.
  await expect(page.getByText(/Deadlift 355 lb × 1/)).toBeVisible()

  if ((page.viewportSize()?.width ?? 0) >= 768) {
    // The band's crumb, the mono span beside the title, and the tiles in the
    // artboard's shape: the week, the heaviest set with when it happened, the
    // fitness goal from the Goals digest in its status colour, the body weight.
    await expect(page.getByText('Fitness / Overview')).toBeVisible()
    await expect(page.getByText(/\d+ WORKOUTS · \d{4} → TODAY/i)).toBeVisible()
    await expect(page.getByText(/\d+ workouts$/).first()).toBeVisible()
    await expect(page.getByText(/\d+H \d{2}M · LOAD \d+/i)).toBeVisible()
    await expect(page.getByText('Leg press · best set')).toBeVisible()
    await expect(page.getByText(/360 ×10/)).toBeVisible()
    await expect(page.getByText(/YESTERDAY · LOWER/i)).toBeVisible()
    // Digests are live (v1.1 Phase 5): the goals check-in test earlier in the
    // run moves Deadlift from 340 stalled to 355 at risk, and the tile follows.
    await expect(page.getByText(/3(40|55) \/ 405/)).toBeVisible()
    await expect(page.getByText(/(STALLED|AT RISK) · \d+%/i)).toBeVisible()
    // Load lives in the This week sub-line now, not a tile of its own, and
    // XP is not drawn: the weight lives in the skills schema.
    await expect(page.getByText('duration by kind')).toHaveCount(0)
    await expect(page.locator('[data-table-head] > span')).toHaveText(['Date', 'Workout', 'Time', 'Skill'])
  }

  // The recent workouts card: the sources of the rows shown, and the first
  // row's date, name, best set, time and skill.
  await expect(page.getByText('Recent workouts')).toBeVisible()
  await expect(page.getByText(/10 BY HAND/i)).toBeVisible()
  await expect(page.getByText(/^\w{3} \d{2}$/).first()).toBeVisible()
  await expect(page.getByText(/Leg press 360 lb × 10/)).toBeVisible()
  await expect(page.getByText('58m', { exact: true })).toBeVisible()
  // The Kind filter's option carries the same word, hidden; the visible one is the skill.
  await expect(page.getByText('Strength', { exact: true }).locator('visible=true').first()).toBeVisible()

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

  // The Body metrics tile reads the latest weight and when it was measured.
  await expect(page.getByText(/^\d+ lb$/).first()).toBeVisible()
  await expect(page.getByText(/MEASURED \w{3} \d{2}/i)).toBeVisible()

  await shoot(page, 'fitness-body')
})

test('fitness, trends put a metric on a date axis and fetch the longer ranges', async ({ page }) => {
  await page.goto('/fitness?tab=trends')

  // The seed writes a weight every third day for 40 days. Thirty days of the
  // default metric come with the page: ten readings on a thirty day axis, not
  // ten evenly spaced points. (Eleven if the webhook test's reading landed on
  // a different owner-day than the seed's.)
  await expect(page.getByRole('img', { name: /Weight over 30 days, 1[01] of them recorded/ })).toBeVisible()
  await expect(page.getByText(/Weight · 30 days/)).toBeVisible()

  // The longer ranges come from a server action, and the axis grows with them.
  await page.getByRole('radio', { name: '90 days' }).click()
  await expect(page.getByRole('img', { name: /Weight over 90 days, 1[45] of them recorded/ })).toBeVisible()

  // Another metric: the one sleep reading is one point, and it reads in its unit.
  await page.getByLabel('Metric').selectOption('sleep_minutes')
  await expect(page.getByRole('img', { name: /Sleep over 90 days, 1 of them recorded/ })).toBeVisible()
  await expect(page.getByText(/First reading 7h 08m/)).toBeVisible()

  await shoot(page, 'fitness-trends')
})

test('fitness, the workout filter narrows the list and survives a reload', async ({ page }) => {
  await page.goto('/fitness')
  await expect(page.getByText(/Leg press 360 lb × 10/)).toBeVisible()

  // Kind narrows the rows through a server action; the URL carries the filter.
  await page.getByLabel('Kind').selectOption('run')
  await expect(page.getByText(/Leg press 360 lb × 10/)).toHaveCount(0)
  await expect(page.getByText('Easy run').first()).toBeVisible()
  await expect(page).toHaveURL(/kind=run/)

  // A reload arrives with the filter set and fetches the narrowed list once.
  await page.reload()
  await expect(page.getByText('Easy run').first()).toBeVisible()
  await expect(page.getByText(/Leg press 360 lb × 10/)).toHaveCount(0)

  // A date window on top: the two easy runs are 4 and 16 days back.
  const day = (back: number) => {
    const d = new Date()
    d.setDate(d.getDate() - back)
    return d.toLocaleDateString('en-CA')
  }
  await page.getByLabel('From').fill(day(10))
  await expect(page.getByText('Easy run')).toHaveCount(1)
  await expect(page.getByText('Tempo run')).toHaveCount(1)

  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByText(/Leg press 360 lb × 10/)).toBeVisible()
  await expect(page).not.toHaveURL(/kind=/)
})

test('health, one page with the artboard\'s panes and the status in the band', async ({ page }) => {
  await page.goto('/health')
  await expect(page.getByRole('heading', { name: 'Health' })).toBeVisible()
  const mobile = (page.viewportSize()?.width ?? 0) < 768
  if (!mobile) await expect(page.getByText(/(\d+ screenings? overdue|Nothing overdue) · (next visit|nothing booked)/)).toBeVisible()

  // Body weight belongs to Fitness and the tile says so; clinical readings show
  // where they came from, and a delta only against a real previous reading.
  await expect(page.getByText('FITNESS', { exact: true })).toBeVisible()
  await expect(page.getByText('118/74')).toBeVisible()
  await expect(page.getByText(/-8 · since \w{3} \d{4}/)).toBeVisible()

  // Appointments as month-day cards with the status tag; Upcoming and History
  // are pills, not a page tab.
  await expect(page.getByRole('tab', { name: 'Upcoming' })).toBeVisible()
  const physical = page.getByRole('button', { name: /Annual physical/ }).first()
  await expect(physical).toBeVisible()
  await expect(physical.getByText('confirmed')).toBeVisible()
  await page.getByRole('tab', { name: 'History' }).click()
  await expect(page.getByRole('button', { name: /Eye exam/ }).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Upcoming' }).click()

  // Records carry their type, date and whether a file is behind them.
  await expect(page.getByText('RECORD', { exact: true })).toBeVisible()
  await expect(page.getByText('NO FILE').first()).toBeVisible()

  await shoot(page, 'health')
})

test('health, a weight posted to the Apple webhook shows on the page', async ({ page }) => {
  // The secret lives in core.connections and the card is the one place it is
  // shown, so the test reads it where the owner would.
  await page.goto('/settings/connections')
  const card = page.locator('div.border').filter({ has: page.getByText('Health Auto Export', { exact: true }) }).first()
  await card.getByRole('button', { name: 'REVEAL' }).click()
  const secret = (await card.locator('span.flex-1.break-all').textContent())?.trim() ?? ''
  expect(secret.length).toBeGreaterThan(10)

  // 177.7 lb today, in the payload shape the app documents. Health reads the
  // latest weight live through the registry, no digest in between.
  const today = new Date().toLocaleDateString('en-CA')
  const res = await page.request.post('/api/integrations/health_auto_export/webhook', {
    headers: { 'x-pos-secret': secret },
    data: { data: { metrics: [{ name: 'weight_body_mass', units: 'lb', data: [{ qty: 177.7, date: `${today} 07:30:00 -0500` }] }] } },
  })
  expect(res.status()).toBe(200)

  await page.goto('/health')
  const weight = page.locator('div.border').filter({ has: page.getByText('FITNESS', { exact: true }) })
  await expect(weight.getByText('178', { exact: true })).toBeVisible()

  // And the Fitness band now says when Apple data last arrived.
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await page.goto('/fitness')
    await expect(page.getByText(/Apple data last arrived \d{2}:\d{2}/)).toBeVisible()
  }
})
test('health, the rail says what is owed with the app\'s own actions', async ({ page }) => {
  await page.goto('/health')

  // Never is its own state, not folded into overdue: a screening you have
  // never had is a different conversation from one you are late for.
  await expect(page.getByText('NEVER DONE', { exact: true })).toBeVisible()
  // A screening whose appointment is booked reads SCHEDULED and opens it.
  await expect(page.getByText('SCHEDULED').first()).toBeVisible()
  await page.getByRole('button', { name: 'View appointment' }).first().click()
  await expect(page.getByRole('dialog').getByText('PREP', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog').getByText(/Fast twelve hours/)).toBeVisible()
  await expect(page).toHaveURL(/appt=/)
  await shoot(page, 'health-drawer')

  // The cost comes from the Insurance module's digest, not from a number
  // copied into Health, so there is one figure and it is the current one.
  await expect(page.getByText('Premiums a year')).toBeVisible()
})

test('health, marking a medication moves the count', async ({ page }) => {
  await page.goto('/health')
  await expect(page.getByText(/^0 of 2 marked today\./)).toBeVisible()
  await page.getByRole('button', { name: 'Taken today, Vitamin D' }).click()
  await expect(page.getByText(/^1 of 2 marked today\./)).toBeVisible()
  await page.getByRole('button', { name: 'Taken today, Vitamin D' }).click()
  await expect(page.getByText(/^0 of 2 marked today\./)).toBeVisible()
})

test('health, log a visit files a past date under records', async ({ page }) => {
  await page.goto('/health')
  await page.getByRole('button', { name: 'Log a visit' }).click()
  await expect(page.getByRole('dialog').getByText('New entry')).toBeVisible()
  await expect(page).toHaveURL(/new=1/)
  // Shot first: shoot() reloads, and what is typed in the form does not
  // survive that. The open drawer does, because it is in the URL.
  await shoot(page, 'health-form')

  const drawer = page.getByRole('dialog')
  await drawer.getByRole('radio', { name: 'Lab' }).click()
  await drawer.getByPlaceholder('Annual physical').fill('Ferritin')
  await drawer.getByLabel('DATE').fill('2026-06-01')
  await drawer.getByPlaceholder('$40 copay').fill('$12')
  await expect(drawer.getByText('Past date: this files under Records.')).toBeVisible()
  await drawer.getByRole('button', { name: 'Save entry' }).click()
  await expect(page.getByText('Saved to records.')).toBeVisible()

  // first(): the desktop and mobile projects share the database, so the
  // second run finds the first run's row as well.
  const row = page.getByRole('button', { name: /Ferritin/ }).first()
  await expect(row).toBeVisible()
  await row.click()
  await expect(page.getByRole('dialog').getByText('$12')).toBeVisible()
})

test('meals, a plan is not a log', async ({ page }) => {
  await page.goto('/meals')
  await expect(page.getByRole('heading', { name: 'Meals' })).toBeVisible()

  // The band: how much of the week is planned and the protein average. The
  // phone band has no room for it, as on every other screen.
  const mobile = (page.viewportSize()?.width ?? 0) < 768
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
  await expect(page).toHaveURL(/pick=/)
  await shoot(page, 'meals-pick')
  await drawer.getByRole('button', { name: /Lentil soup/ }).click()
  await expect(drawer).toHaveCount(0)

  // A planned cell opens its recipe with the plan actions in the footer.
  await page.getByRole('button', { name: /^Turkey chili/ }).first().click()
  await expect(drawer.getByRole('heading', { name: 'Turkey chili' })).toBeVisible()
  await expect(drawer.getByText('Serves 6 · per-serving values')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Cook' })).toBeVisible()
  await expect(page).toHaveURL(/recipe=/)
  await shoot(page, 'meals-recipe')
  await drawer.getByRole('button', { name: 'Remove from plan' }).click()
  await expect(drawer).toHaveCount(0)
})

test('ideas, four stage columns with the scores on every card', async ({ page }) => {
  await page.goto('/ideas')
  await expect(page.getByRole('heading', { name: 'Ideas' })).toBeVisible()
  await expectBand(page, page.getByText(/\d+ ideas · \d+ stale/))

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
  await expectBand(page, page.getByText('Home / Assets'))
  await expectBand(page, page.getByText(/\d+ jobs? due this month · \$[\d,]+ estimated/))
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
  await expect(page.getByText(/^[A-Z]{3} \d{4}$/).first()).toBeVisible()

  await expect(page.getByText('COVER · EXPIRES · FILE')).toBeVisible()

  await shoot(page, 'home')
})

test('home, a snooze comes back rather than dismissing', async ({ page }) => {
  await page.goto('/home')

  // Waited for, not counted: a count read before the tiles render is 0.
  const snooze = page.getByRole('button', { name: 'Snooze 30d' }).first()
  await expect(snooze).toBeVisible()

  await snooze.click()
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
  // Last: below md the sheet's own band button also reads Close.
  await expect(drawer.getByRole('button', { name: 'Close', exact: true }).last()).toBeVisible()
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
  await expectBand(page, page.getByText('Insurance / Policies'))
  await expectBand(page, page.getByText(/\d+ policies · \d+ expiring soon/))
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
  await expect(page).toHaveURL(/policy=/)
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
  await expect(page).toHaveURL(/edit=1/)
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
  await expect(page).toHaveURL(/recipe=/)
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
  await expect(page).toHaveURL(/servings=12/)
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

test('fitness, the plan drawer edits the plan in force', async ({ page }) => {
  await page.goto('/fitness?tab=plan')
  await page.getByRole('button', { name: 'Edit' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByLabel('Plan name')).toHaveValue('Upper, lower, run')

  // A second day: the row's order is its position, so the new one lands last
  // and the tab groups it under its own label.
  await drawer.getByRole('button', { name: 'Add exercise' }).click()
  const n = await drawer.getByRole('button', { name: /^Remove exercise \d+$/ }).count()
  await drawer.getByLabel(`Day ${n}`, { exact: true }).fill('Cardio')
  await drawer.getByLabel(`Exercise ${n}`, { exact: true }).fill('Bike intervals')
  await drawer.getByLabel(`Reps ${n}`, { exact: true }).fill('6 x 2 min')
  await drawer.getByRole('button', { name: 'Save plan' }).click()
  await expect(drawer).toHaveCount(0)
  await expect(page.getByText('Cardio', { exact: true })).toBeVisible()
  await expect(page.getByText('Bike intervals')).toBeVisible()
  await expect(page.getByText('3 x 6 x 2 min')).toBeVisible()
  // The seeded rows and their notes survived the rewrite.
  await expect(page.getByText('4 x 5 at 185 lb')).toBeVisible()
  await expect(page.getByText('Bodyweight is fine.')).toBeVisible()

  // And out again, so the mobile run and the coach see the seeded plan.
  await page.getByRole('button', { name: 'Edit' }).click()
  await drawer.getByRole('button', { name: `Remove exercise ${n}` }).click()
  await drawer.getByRole('button', { name: 'Save plan' }).click()
  await expect(drawer).toHaveCount(0)
  await expect(page.getByText('Bike intervals')).toHaveCount(0)
  await expect(page.getByText('3 days a week')).toBeVisible()
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

  // pnpm setup requires the VAPID keys, so "not configured" is not a state a
  // set-up database reaches; the card distinguishes configured-with-no-device
  // from a subscribed device, and this is the former.
  await expect(page.getByText('Devices')).toBeVisible()
  await expect(page.getByText(/No device is subscribed/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Turn on push for this device' })).toBeVisible()
})

test('gestures, a swipe moves one tab and a mouse drag does not', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch gestures are a phone thing')

  await page.goto('/meals')
  await expect(page.getByRole('tab', { name: /Week/ })).toHaveAttribute('aria-selected', 'true')

  // The pane under the row is the gesture's target: the whole section, not
  // the 40px row.
  const pane = page.locator('[data-segments-pane]')
  const box = (await pane.boundingBox())!
  const y = box.y + 40
  const swipe = async (fromX: number, toX: number, pointerType: 'touch' | 'mouse') => {
    await pane.dispatchEvent('pointerdown', { pointerType, clientX: fromX, clientY: y })
    await pane.dispatchEvent('pointerup', { pointerType, clientX: toX, clientY: y })
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

test('goals segment swipe reaches Archive', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch gestures are a phone thing')

  await page.goto('/goals')
  await expect(page.getByRole('tab', { name: /Active/ })).toHaveAttribute('aria-selected', 'true')

  const pane = page.locator('[data-segments-pane]')
  const box = (await pane.boundingBox())!
  const y = box.y + 40
  await pane.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: box.x + box.width - 20, clientY: y })
  await pane.dispatchEvent('pointerup', { pointerType: 'touch', clientX: box.x + 20, clientY: y })

  await expect(page.getByRole('tab', { name: /Archive/ })).toHaveAttribute('aria-selected', 'true')
})

test('gestures, swiping a task completes it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch gestures are a phone thing')

  // On This week, not Today: the row sits inside the segment pane, and a
  // right swipe that also moved the pane would land on Today.
  await page.goto('/tasks?view=week')
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
  await expect(page.getByRole('tab', { name: 'This week' })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/view=week/)
})

test('gestures, a swiped task reads as done before the server answers', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch gestures are a phone thing')

  // Hold the server action so the only way the row can flip is optimistically.
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/tasks**', async (route) => {
    if (!route.request().headers()['next-action']) return route.continue()
    await held
    return route.continue()
  })

  await page.goto('/tasks')
  const card = page.locator('article').filter({ hasText: 'Lower, deadlift day' }).first()
  await expect(card.getByRole('button', { name: /^Complete Lower, deadlift/ })).toBeVisible()

  const box = (await card.boundingBox())!
  const y = box.y + 8
  await card.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: box.x + 20, clientY: y })
  await card.dispatchEvent('pointerup', { pointerType: 'touch', clientX: box.x + box.width - 10, clientY: y })

  // Gone from Today while the request is still held, and no toast yet: the
  // row moved on the guess, not on the answer.
  await expect(card).toHaveCount(0)
  await expect(page.getByText(/^Done\. Lower, deadlift/)).toHaveCount(0)
  release()
  await expect(page.getByText(/^Done\. Lower, deadlift/)).toBeVisible()
})

test('a drawer is a history entry, so Back closes it', async ({ page }) => {
  await page.goto('/tasks')
  const mobile = (page.viewportSize()?.width ?? 0) < 768
  if (mobile) {
    // No EDIT button at this width: the row itself opens the drawer.
    await page.getByRole('button', { name: /^Recurring detection tests/ }).click()
  } else {
    await page.getByRole('button', { name: 'Edit Recurring detection tests' }).click()
  }
  await expect(page).toHaveURL(/task=/)
  await expect(page.getByRole('dialog')).toBeVisible()

  // Opening pushed, not replaced: the phone's Back gesture and button, and the
  // browser's, land on the list with the drawer gone.
  await page.goBack()
  await expect(page).not.toHaveURL(/task=/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('gestures, pulling down from the top refreshes the screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch gestures are a phone thing')

  await page.goto('/finance')
  // The listener is registered by an effect after hydration; wait for the
  // page to go quiet so the first pointer event is not dropped on the floor.
  await page.waitForLoadState('networkidle')
  const x = 200
  await page.dispatchEvent('body', 'pointerdown', { pointerType: 'touch', clientX: x, clientY: 120 })
  await page.dispatchEvent('body', 'pointermove', { pointerType: 'touch', clientX: x, clientY: 180 })
  await expect(page.getByText('Release to refresh')).toBeVisible()
  // The release asks the router for the page again: one RSC request.
  const fetched = page.waitForRequest((r) => r.url().includes('/finance') && r.headers()['rsc'] === '1')
  await page.dispatchEvent('body', 'pointerup', { pointerType: 'touch', clientX: x, clientY: 220 })
  await fetched

  // The strip says so while the fetch runs, then goes; the page is still Finance.
  await expect(page.getByText(/Refreshing|Release to refresh/)).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Finance', level: 1 })).toBeVisible()
})

// v1.1 Phase 8. The sky sits at the top of the phone screen, so every drag on
// it reached the two listeners that watch the whole document: a pull down
// armed a refresh and a drag from the left edge went back. The globe never
// sat high enough to find this out. Both now step aside for a canvas marked
// data-gesture-surface.
test('gestures, dragging the constellation pans it and does not refresh or go back', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch gestures are a phone thing')

  // A page to go back to, so an edge swipe that fires has somewhere to land
  // and this test can tell the difference.
  await page.goto('/')
  await page.goto('/skills')
  await page.waitForLoadState('networkidle')

  const sky = page.getByRole('img', { name: 'Skill constellation' })
  const box = (await sky.boundingBox())!
  const transform = () => sky.locator('g[transform]').first().getAttribute('transform')
  const before = await transform()

  // Down the screen from near the top, which is the gesture that used to arm
  // the refresh. pointerId and isPrimary are what React reads to decide this
  // is the first finger.
  const touch = (clientX: number, clientY: number) => ({
    pointerType: 'touch',
    pointerId: 1,
    isPrimary: true,
    clientX,
    clientY,
  })
  const x = box.x + box.width / 2
  const top = box.y + 24
  await sky.dispatchEvent('pointerdown', touch(x, top))
  await sky.dispatchEvent('pointermove', touch(x, top + 40))
  await sky.dispatchEvent('pointermove', touch(x, top + 90))

  await expect(page.getByText('Release to refresh')).toHaveCount(0)
  await sky.dispatchEvent('pointerup', touch(x, top + 90))

  // The sky moved with the finger, and the drag selected nothing.
  await expect.poll(transform).not.toBe(before)
  await expect(page).toHaveURL(/\/skills$/)

  // From the left edge rightwards: a pan, not a back navigation.
  const panned = await transform()
  const y = box.y + box.height / 2
  await sky.dispatchEvent('pointerdown', touch(box.x + 8, y))
  await sky.dispatchEvent('pointermove', touch(box.x + 60, y))
  await sky.dispatchEvent('pointerup', touch(box.x + 120, y))

  await expect(page).toHaveURL(/\/skills$/)
  await expect.poll(transform).not.toBe(panned)
})

test('gestures, holding a dashboard tile enters arrange mode', async ({ page }, testInfo) => {
  // Arrange is desktop only (2026-09-13 decision): a phone hold is a no-op.
  test.skip(testInfo.project.name === 'mobile', 'Arrange is desktop only')

  await page.goto('/')
  const tile = page.getByTestId('dashboard-bento').locator('> div').first()
  await expect(tile).toBeVisible()
  const box = (await tile.boundingBox())!
  const at = { clientX: box.x + 40, clientY: box.y + 40 }

  // A hold of PosPhone's 480ms is the way in, now desktop only.
  await tile.dispatchEvent('pointerdown', { pointerType: 'touch', ...at })
  await expect(page).toHaveURL(/arrange=1/)
  await expect(page.getByText(/^Arrange mode/)).toBeVisible()

  // A tap lifts before the timer and stays put.
  await page.goto('/')
  await tile.dispatchEvent('pointerdown', { pointerType: 'touch', ...at })
  await page.waitForTimeout(100)
  await tile.dispatchEvent('pointerup', { pointerType: 'touch', ...at })
  await page.waitForTimeout(600)
  await expect(page).not.toHaveURL(/arrange/)

  // A finger that scrolls is not pressing.
  await tile.dispatchEvent('pointerdown', { pointerType: 'touch', ...at })
  await tile.dispatchEvent('pointermove', { pointerType: 'touch', clientX: at.clientX, clientY: at.clientY + 30 })
  await page.waitForTimeout(600)
  await expect(page).not.toHaveURL(/arrange/)

  // A slow mouse click is not a gesture.
  await tile.dispatchEvent('pointerdown', { pointerType: 'mouse', ...at })
  await page.waitForTimeout(600)
  await expect(page).not.toHaveURL(/arrange/)
})
