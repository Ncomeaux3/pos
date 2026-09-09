import { expect, test as setup } from '@playwright/test'

// Logging in for real rather than minting a session: the magic link flow is
// PKCE, so the code verifier cookie has to be set by the same browser context
// that asked for the link. Driving the actual form is the only honest way, and
// it doubles as the login smoke test.

const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:54324'
const STATE = 'e2e/.auth/owner.json'

type MailpitSummary = { ID: string; Created: string }

async function newestLinkFor(email: string, after: number): Promise<string | null> {
  const list = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=5`)
  if (!list.ok) return null

  const { messages = [] } = (await list.json()) as { messages?: MailpitSummary[] }
  for (const m of messages) {
    if (new Date(m.Created).getTime() < after) continue

    const body = await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)
    if (!body.ok) continue

    const { Text = '', HTML = '' } = (await body.json()) as { Text?: string; HTML?: string }
    const match = `${Text}\n${HTML}`.match(/https?:\/\/[^\s"'<>]*(?:\/auth\/v1\/verify|token=)[^\s"'<>]*/)
    if (match) return match[0].replace(/&amp;/g, '&')
  }
  return null
}

setup('sign in as the owner', async ({ page }) => {
  const email = process.env.OWNER_EMAIL
  expect(email, 'OWNER_EMAIL must be set in .env').toBeTruthy()

  // Anything already in the mailbox is from an earlier run.
  const sentAfter = Date.now() - 1000

  await page.goto('/login')
  await page.getByLabel(/owner email/i).fill(email!)
  await page.getByRole('button', { name: /^send/i }).click()
  await expect(page).toHaveURL(/sent=1/)

  // Sixty seconds, not ten. The mail usually lands in under a second, but on a
  // cold start the dev server is compiling routes while GoTrue is sending, and
  // a run once failed here with the message already in Mailpit a moment later.
  let link: string | null = null
  for (let i = 0; i < 120 && !link; i++) {
    link = await newestLinkFor(email!, sentAfter)
    if (!link) await page.waitForTimeout(500)
  }
  expect(link, 'no magic link arrived in Mailpit within 60s').toBeTruthy()

  await page.goto(link!)
  await expect(page).toHaveURL(/localhost:3000\/$/)

  await page.context().storageState({ path: STATE })
})
