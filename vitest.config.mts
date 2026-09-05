import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['{core,modules,integrations,scripts}/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
})
