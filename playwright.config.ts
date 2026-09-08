import { defineConfig, devices } from '@playwright/test'

// Screens are checked at the two widths the design was drawn at: 1440 for the
// desktop artboards and 402 for the iPhone frames. Vitest only collects from
// core, modules, integrations and scripts, so nothing here is picked up twice.

process.loadEnvFile('.env')

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },

  projects: [
    { name: 'setup', testMatch: /\.setup\.ts/ },
    {
      name: 'desktop',
      dependencies: ['setup'],
      testIgnore: /\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: 'e2e/.auth/owner.json',
      },
    },
    {
      name: 'mobile',
      dependencies: ['setup'],
      testIgnore: /\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 402, height: 874 },
        isMobile: false,
        storageState: 'e2e/.auth/owner.json',
      },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
