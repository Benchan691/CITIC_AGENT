import { resolve } from 'node:path'
import tsconfigPaths from '../../vendor/deepseek-harness/node_modules/vite-tsconfig-paths/dist/index.js'
import { standardDecoratorPlugin, vitestExecArgv } from '../../vendor/deepseek-harness/vitest.shared.ts'

const root = import.meta.dirname
const vendorRoot = resolve(root, '../../vendor/deepseek-harness')
const vendorNodeModules = resolve(root, '../../vendor/deepseek-harness/node_modules')
const vendorPackages = resolve(vendorRoot, 'packages')
const vendorClient = resolve(vendorPackages, 'client')

export default {
  plugins: [
    tsconfigPaths({ projects: [resolve(vendorRoot, 'tsconfig.base.json')] }),
    standardDecoratorPlugin(),
  ],
  resolve: {
    alias: [
      { find: /^vitest$/, replacement: resolve(vendorNodeModules, 'vitest') },
      { find: /^@testing-library\/react$/, replacement: resolve(vendorNodeModules, '@testing-library/react') },
      { find: /^@deepseek-ai\/cordis$/, replacement: resolve(vendorRoot, 'vendor/cordis/src') },
      { find: /^@deepseek-ai\/dsh-client-runtime\/client$/, replacement: resolve(vendorClient, 'runtime/src/client') },
      { find: /^@deepseek-ai\/dsh-client-runtime$/, replacement: resolve(vendorClient, 'runtime/src') },
      { find: /^@deepseek-ai\/dsh-client-ui-slots$/, replacement: resolve(vendorClient, 'ui-slots/src') },
      { find: /^@deepseek-ai\/dsh-client-ui-primitives$/, replacement: resolve(vendorClient, 'ui-primitives/src') },
      { find: /^@deepseek-ai\/dsh-client-ui-renderer\/src\/(.*)$/, replacement: `${resolve(vendorClient, 'ui-renderer/src')}/$1` },
      { find: /^@deepseek-ai\/dsh-client-ui-renderer\/client$/, replacement: resolve(vendorClient, 'ui-renderer/src/client') },
      { find: /^@deepseek-ai\/dsh-client-ui-renderer$/, replacement: resolve(vendorClient, 'ui-renderer/src') },
      { find: /^@deepseek-ai\/dsh-client-locale\/src\/(.*)$/, replacement: `${resolve(vendorClient, 'locale/src')}/$1` },
      { find: /^@deepseek-ai\/dsh-client-locale\/client$/, replacement: resolve(vendorClient, 'locale/src/client') },
      { find: /^@deepseek-ai\/dsh-client-locale$/, replacement: resolve(vendorClient, 'locale/src') },
      { find: /^@deepseek-ai\/dsh-client-test-runtime$/, replacement: resolve(vendorPackages, 'test-support/client-runtime/src') },
      { find: /^@deepseek-ai\/dsh-invariants$/, replacement: resolve(vendorPackages, 'runtime-diagnostics/invariants/src') },
      { find: /^dsh-soc-agent-sidebar\/client$/, replacement: resolve(root, 'src/client/index.ts') },
      { find: /^dsh-soc-agent-sidebar\/invariant$/, replacement: resolve(root, 'src/invariant.ts') },
      { find: /^dsh-soc-agent-sidebar$/, replacement: resolve(root, 'src/index.ts') },
    ],
  },
  test: {
    include: ['tests/**/*.client.spec.{ts,tsx}'],
    environment: 'jsdom',
    execArgv: vitestExecArgv,
    pool: 'forks',
  },
}
