import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'
import { standardDecoratorPlugin, vitestExecArgv } from './vitest.shared.ts'
import { SOC_UNSUPPORTED_WEB_TESTS } from '../../apps/soc-agent/tests/web-test-policy.js'

// Web browser lane: real host entry points, built-client interaction snapshots,
// and replayed keyless e2e scenarios outside the unit/e2e includes. Linux PR CI
// pins DSH_SNAPSHOT=replay and compares committed goldens; record/refresh remain
// explicit local workflows. Real-model cases self-skip without DEEPSEEK_API_KEY.
try {
  // Node >= 21.7 native; throws when the file does not exist.
  process.loadEnvFile(new URL('.env', import.meta.url).pathname)
} catch {
  // No .env — fine, the environment may already carry the variables.
}

export default defineConfig({
  // Same resolution note as vitest.config.ts: the tsconfig.base.json paths
  // facade has no include (match-all), so apps/web/tests resolves bare
  // workspace imports to source like every other lane.
  plugins: [
    tsconfigPaths({ projects: ['./tsconfig.base.json'] }),
    standardDecoratorPlugin(),
  ],
  test: {
    execArgv: vitestExecArgv,
    include: [
      'apps/web/tests/**/*.e2e.ts',
      'apps/web/tests/**/*.snapshot.ts',
    ],
    // The upstream Web suite remains the default. The SOC lane opts in with
    // DSH_SOC_AGENT=1 and excludes only tests whose product surface is absent
    // or intentionally replaced by the SOC composition.
    exclude: process.env.DSH_SOC_AGENT === '1' ? SOC_UNSUPPORTED_WEB_TESTS : [],
    // Local and record runs stay serial. CI runs workspace-mutating HMR and
    // dynamic Cordis lifecycle coverage before parallelizing the remaining files.
    testTimeout: 180_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
})
