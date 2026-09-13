import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.json'] })],
  test: {
    environment: 'jsdom',
    include: [
      'apps/soc-agent/**/*.spec.{ts,tsx}',
      'packages/*/tests/**/*.spec.{ts,tsx}',
      'tests/**/*.spec.{ts,tsx}',
    ],
    restoreMocks: true,
  },
})
