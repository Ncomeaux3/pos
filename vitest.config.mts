import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

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
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
})
