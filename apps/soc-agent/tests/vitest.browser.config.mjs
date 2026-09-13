import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'
import { standardDecoratorPlugin, vitestExecArgv } from '../../../vendor/deepseek-harness/vitest.shared.ts'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const harnessRoot = fileURLToPath(new URL('../../../vendor/deepseek-harness', import.meta.url))
const upstreamScaffold = `${harnessRoot}/apps/web/tests/scaffold.ts`
const pickerFixture = `    { id: 'directory-picker', disabled: true },
    { insert: [
      { id: 'directory-picker-browse', name: '@deepseek-ai/dsh-host-directory-picker-browse' },
      { id: 'ui-directory-picker-browse', name: '@deepseek-ai/dsh-client-ui-directory-picker-browse' },
    ] },`

function suppressUpstreamDirectoryPickerFixture() {
  return {
    name: 'soc-suppress-upstream-directory-picker-fixture',
    enforce: 'pre',
    transform(source, id) {
      if (id.split('?', 1)[0] !== upstreamScaffold) return undefined
      if (!source.includes(pickerFixture)) {
        throw new Error('the pinned rc.2 browser scaffold directory-picker fixture changed')
      }
      return source.replace(pickerFixture, "    { id: 'directory-picker', disabled: true },")
    },
  }
}

export default defineConfig({
  root: repoRoot,
  plugins: [
    suppressUpstreamDirectoryPickerFixture(),
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
