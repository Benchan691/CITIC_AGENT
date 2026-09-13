import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const tsc = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
if (!existsSync(tsc)) throw new Error('SOC type build requires the root TypeScript dependency; run pnpm install first')

const configs = readdirSync(join(root, 'packages'), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name.startsWith('soc-agent-'))
  .map(entry => join(root, 'packages', entry.name, 'tsconfig.types.json'))
  .filter(existsSync)
  .sort()

// The workspace path aliases intentionally point at source so package typechecks
// exercise the same contracts as the production bundles.  TypeScript's default
// `rootDir: src` cannot emit declarations for those imported sibling sources,
// though.  Emit into a disposable repository-root staging tree, then copy only
// each package's own declarations into its public `lib/types` directory.
const stagingRoot = join(root, '.data', 'soc-type-build')
rmSync(stagingRoot, { recursive: true, force: true })
mkdirSync(stagingRoot, { recursive: true })

try {
  for (const config of configs) {
    const packageRoot = dirname(config)
    const packageName = basename(packageRoot)
    const packageStage = join(stagingRoot, packageName)
    execFileSync(
      tsc,
      ['-p', config, '--rootDir', root, '--outDir', packageStage, '--pretty', 'false'],
      { cwd: root, stdio: 'inherit' },
    )

    const emittedSource = join(packageStage, 'packages', packageName, 'src')
    if (!existsSync(emittedSource)) throw new Error(`TypeScript emitted no declarations for ${packageName}`)
    cpSync(emittedSource, join(packageRoot, 'lib', 'types'), { recursive: true, force: true })
  }
} finally {
  rmSync(stagingRoot, { recursive: true, force: true })
}

console.log(`generated declarations for ${configs.length} SOC packages`)
