import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { testDatabaseUrl } from './scripts/test-db'

// .env is loaded here rather than by each suite, so DATABASE_URL can be
// rewritten to the test database before any worker starts.
process.loadEnvFile('.env')

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['{core,modules,integrations,scripts}/**/*.test.{ts,tsx}'],
    // Several suites read and write the same local Postgres tables. Running the
    // files in parallel makes them race, which showed up as the soft cap test
    // seeing another file's truncate. The whole suite runs in well under a
    // second, so serial costs nothing.
    fileParallelism: false,
    // Rebuilds pos_test from supabase/migrations before anything runs.
    globalSetup: ['./scripts/test-db.ts'],
    env: {
      // Every suite talks to pos_test. The suites delete from core.connections
      // and core.settings, and doing that to the development database wiped the
      // owner's real provider keys once already.
      DATABASE_URL: testDatabaseUrl(process.env.DATABASE_URL ?? 'postgresql://localhost/pos'),
    },
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
})
