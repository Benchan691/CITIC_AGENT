import { resolve } from 'node:path'
import tsconfigPaths from '../../vendor/deepseek-harness/node_modules/vite-tsconfig-paths/dist/index.js'
import { standardDecoratorPlugin, vitestExecArgv } from '../../vendor/deepseek-harness/vitest.shared.ts'

const root = import.meta.dirname
const vendorRoot = resolve(root, '../../vendor/deepseek-harness')
const vendorNodeModules = resolve(vendorRoot, 'node_modules')
const vendorClient = resolve(vendorRoot, 'packages/client')

export default {
  plugins: [
    tsconfigPaths({ projects: [resolve(vendorRoot, 'tsconfig.base.json')] }),
    standardDecoratorPlugin(),
  ],
  resolve: {
    alias: [
      { find: /^vitest$/, replacement: resolve(vendorNodeModules, 'vitest') },
      { find: /^@deepseek-ai\/cordis$/, replacement: resolve(vendorRoot, 'vendor/cordis/src') },
      { find: /^@deepseek-ai\/dsh-client-runtime\/client$/, replacement: resolve(vendorClient, 'runtime/src/client') },
      { find: /^@deepseek-ai\/dsh-client-runtime$/, replacement: resolve(vendorClient, 'runtime/src') },
      { find: /^@deepseek-ai\/dsh-client-ui-slots$/, replacement: resolve(vendorClient, 'ui-slots/src') },
      { find: /^@deepseek-ai\/dsh-client-ui-conversation\/client$/, replacement: resolve(vendorClient, 'ui-conversation/src/client') },
      { find: /^@deepseek-ai\/dsh-client-ui-conversation$/, replacement: resolve(vendorClient, 'ui-conversation/src') },
      { find: /^@deepseek-ai\/dsh-client-locale\/client$/, replacement: resolve(vendorRoot, 'packages/client/locale/src/client') },
      { find: /^@deepseek-ai\/dsh-client-locale$/, replacement: resolve(vendorRoot, 'packages/client/locale/src') },
      { find: /^dsh-soc-agent-brand\/client$/, replacement: resolve(root, 'src/client/index.ts') },
      { find: /^dsh-soc-agent-brand$/, replacement: resolve(root, 'src/index.ts') },
      { find: /^dsh-soc-agent-client\/client$/, replacement: resolve(root, '../soc-agent-client/src/client/index.ts') },
      { find: /^dsh-soc-agent-sidebar\/client$/, replacement: resolve(root, '../soc-agent-sidebar/src/client/index.ts') },
    ],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom',
    execArgv: vitestExecArgv,
    pool: 'forks',
  },
}
