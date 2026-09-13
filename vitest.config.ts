import { defineConfig } from 'vitest/config'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'
import { dirname, extname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { replacements } from './tooling/replacement-map.mjs'

const decoratorSyntax = /^\s*@[A-Za-z_$][\w$]*/m
const rootRequire = createRequire(import.meta.url)

function standardDecoratorPlugin() {
  return {
    name: 'soc-standard-decorators',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?', 1)[0]!
      if (!/\.[cm]?tsx?$/.test(file) || !decoratorSyntax.test(code)) return
      const result = ts.transpileModule(code, {
        fileName: file,
        compilerOptions: {
          target: ts.ScriptTarget.ES2024,
          module: ts.ModuleKind.ESNext,
          jsx: file.endsWith('x') ? ts.JsxEmit.ReactJSX : undefined,
          sourceMap: true,
        },
      })
      return {
        code: result.outputText.replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'),
        map: result.sourceMapText,
      }
    },
  }
}

function readPathAliases(configFile: string) {
  const parsed = ts.readConfigFile(configFile, ts.sys.readFile)
  if (parsed.error) throw new Error(ts.flattenDiagnosticMessageText(parsed.error.messageText, '\n'))
  const base = dirname(configFile)
  return Object.entries(parsed.config.compilerOptions?.paths ?? {}).flatMap(([name, targets]) => {
    const target = Array.isArray(targets) ? targets[0] : undefined
    return typeof target === 'string' ? [[name, resolve(base, target)] as const] : []
  })
}

function testAliases() {
  const root = fileURLToPath(new URL('.', import.meta.url))
  const upstream = readPathAliases(resolve(root, 'vendor/deepseek-harness/tsconfig.base.json'))
  const soc = readPathAliases(resolve(root, 'tsconfig.soc-paths.json'))
  const aliases = new Map(upstream)

  // Published Harness packages intentionally omit source files. Upstream tests
  // import a few package-internal fixtures, so route those test-only imports to
  // the immutable vendor snapshot.
  for (const [name, target] of upstream) {
    if (name.includes('*') || name.split('/').length !== 2) continue
    const sourceRoot = extname(target) ? dirname(target) : target
    aliases.set(`${name}/src/*`, `${sourceRoot}/*`)
  }

  // Generic upstream test kits must exercise the SOC implementation forks, not
  // create a second official renderer/controller singleton in the same test.
  const socByName = new Map(soc)
  for (const replacement of replacements) {
    for (const [name, target] of socByName) {
      if (name !== replacement.socName && !name.startsWith(`${replacement.socName}/`)) continue
      aliases.set(`${replacement.officialName}${name.slice(replacement.socName.length)}`, target)
    }
    aliases.set(
      `${replacement.officialName}/src/*`,
      resolve(root, 'packages', replacement.packageDir, 'src/*'),
    )
    aliases.set(
      `${replacement.socName}/src/*`,
      resolve(root, 'packages', replacement.packageDir, 'src/*'),
    )
  }
  for (const [name, target] of soc) aliases.set(name, target)

  return [...aliases]
    .sort(([left], [right]) => right.length - left.length)
    .map(([name, target]) => name.includes('*')
      ? {
          find: new RegExp(`^${name.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.*)')}$`),
          replacement: target.replace('*', '$1'),
        }
      : { find: name, replacement: target })
}

export default defineConfig({
  plugins: [standardDecoratorPlugin()],
  resolve: {
    alias: [
      { find: /^react$/, replacement: rootRequire.resolve('react') },
      { find: /^react\/jsx-runtime$/, replacement: rootRequire.resolve('react/jsx-runtime') },
      { find: /^react\/jsx-dev-runtime$/, replacement: rootRequire.resolve('react/jsx-dev-runtime') },
      { find: /^react-dom$/, replacement: rootRequire.resolve('react-dom') },
      { find: /^react-dom\/(.*)$/, replacement: `${dirname(rootRequire.resolve('react-dom'))}/$1` },
      { find: /^@testing-library\/react$/, replacement: rootRequire.resolve('@testing-library/react') },
      { find: /^@testing-library\/dom$/, replacement: rootRequire.resolve('@testing-library/dom') },
      ...testAliases(),
    ],
    dedupe: ['react', 'react-dom'],
  },
  test: {
    // Match the upstream rc.2 test topology: Host and pure Client state tests
    // run in Node; browser component suites opt into jsdom per file.
    environment: 'node',
    pool: 'forks',
    execArgv: process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : [],
    include: [
      'apps/soc-agent/**/*.spec.{ts,tsx}',
      'packages/*/tests/**/*.spec.{ts,tsx}',
      'tests/**/*.spec.{ts,tsx}',
    ],
    // Preserve module-factory replacements (notably node:crypto UUID probes)
    // while still isolating call history between tests.
    clearMocks: true,
  },
})
