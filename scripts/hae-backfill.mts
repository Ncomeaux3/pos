// Posts a Health Auto Export manual export to the app's webhook, a month at
// a time. The app's REST automation cannot send a custom date range (its
// periods stop at the previous seven days, per help.healthyapps.dev, checked
// 2026-09-18), so history comes from Manual Export with a Custom range,
// aggregated by Days, JSON, shared to this machine, and this script does the
// posting. Each request stays small enough for the function's body and time
// limits, and the pause keeps under the app's 60 requests a minute.
//
//   HAE_SECRET=<secret from the Connections card> \
//   pnpm exec tsx scripts/hae-backfill.mts <export.json> [--url <webhook url>] [--dry-run]
//
// The URL defaults to production. --dry-run prints the requests and sends
// nothing.

import { readFileSync } from 'node:fs'
import { chunk } from './hae-backfill-lib'

const DEFAULT_URL = 'https://pos-gilt-rho.vercel.app/api/integrations/health_auto_export/webhook'
const PAUSE_MS = 1_500

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const url = args.includes('--url') ? args[args.indexOf('--url') + 1] : DEFAULT_URL
const dryRun = args.includes('--dry-run')
const secret = process.env.HAE_SECRET

if (!file || (!secret && !dryRun)) {
  console.error('usage: HAE_SECRET=... pnpm exec tsx scripts/hae-backfill.mts <export.json> [--url <url>] [--dry-run]')
  process.exit(1)
}

const requests = chunk(JSON.parse(readFileSync(file, 'utf8')))
for (const [i, body] of requests.entries()) {
  const text = JSON.stringify(body)
  const what = body.data.metrics
    ? `${body.data.metrics[0]?.data?.[0]?.date?.toString().slice(0, 7) ?? '?'}: ${body.data.metrics.length} metrics`
    : `${body.data.workouts?.length} workouts`
  const label = `${i + 1}/${requests.length} ${what}, ${(text.length / 1024).toFixed(0)} KB`
  if (dryRun) {
    console.log(label)
    continue
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-pos-secret': secret! },
    body: text,
  })
  console.log(`${label}: ${res.status}`)
  if (!res.ok) {
    console.error(await res.text())
    process.exit(1)
  }
  if (i < requests.length - 1) await new Promise((r) => setTimeout(r, PAUSE_MS))
}
