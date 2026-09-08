import { execFileSync } from 'node:child_process'
import { test as setup } from '@playwright/test'

// Seeding runs in its own tsx process rather than inside the Playwright runner,
// because core/* uses the @/ path alias and the pg pool, neither of which the
// runner's transform is set up for. tsx already resolves both.
setup('seed and index the demo fixture', () => {
  const out = execFileSync(
    'pnpm',
    ['exec', 'tsx', '--env-file=.env', 'e2e/seed.mts'],
    { encoding: 'utf8' },
  )
  console.log(out.trim())
})
