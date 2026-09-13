import { fileURLToPath } from 'node:url'
import tsconfigPaths from '../../../vendor/deepseek-harness/node_modules/vite-tsconfig-paths/dist/index.js'
import { defineConfig } from '../../../vendor/deepseek-harness/node_modules/vitest/dist/config.js'
import { standardDecoratorPlugin, vitestExecArgv } from '../../../vendor/deepseek-harness/vitest.shared.ts'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const harnessRoot = fileURLToPath(new URL('../../../vendor/deepseek-harness', import.meta.url))

export default defineConfig({
  root: repoRoot,
  plugins: [
    tsconfigPaths({ projects: [`${harnessRoot}/tsconfig.base.json`] }),
    standardDecoratorPlugin(),
  ],
  test: {
    execArgv: vitestExecArgv,
    include: ['apps/soc-agent/tests/browser-smoke.test.mjs'],
    testTimeout: 180_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
})
