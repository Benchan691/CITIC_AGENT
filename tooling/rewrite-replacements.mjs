import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { replacementNames, replacements, upstream } from './replacement-map.mjs'

const root = resolve(import.meta.dirname, '..')
const pristineRoot = process.argv[2]
if (!pristineRoot) throw new Error('usage: node tooling/rewrite-replacements.mjs <pristine-harness-root>')

const officialVersions = new Map()
async function collectPackageVersions(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) await collectPackageVersions(path)
    else if (entry.isFile() && entry.name === 'package.json') {
      const value = JSON.parse(await readFile(path, 'utf8'))
      if (typeof value.name === 'string' && typeof value.version === 'string') {
        officialVersions.set(value.name, value.version)
      }
    }
  }
}
await collectPackageVersions(pristineRoot)

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rewritePackageReferences(value) {
  let output = value
  for (const [official, replacement] of replacementNames) {
    output = output.replace(new RegExp(`${escapeRegExp(official)}(?![A-Za-z0-9._-])`, 'g'), replacement)
  }
  return output
}

function rewriteDependencyObject(input = {}, section) {
  const output = {}
  for (const [name, originalVersion] of Object.entries(input)) {
    const mapped = replacementNames.get(name)
    const nextName = mapped ?? name
    let version = originalVersion
    if (mapped !== undefined || name.startsWith('dsh-soc-agent-')) {
      version = section === 'devDependencies' ? 'workspace:^' : '0.1.0'
    } else if (typeof originalVersion === 'string' && originalVersion.startsWith('workspace:')) {
      const exact = officialVersions.get(name)
      // Pre-rc.2 SOC packages can still mention a package removed by the
      // upstream split. Keep the manifest parseable for the mechanical pass;
      // verify-isolation rejects it until its API is explicitly adapted.
      version = exact ?? '*'
    }
    output[nextName] = version
  }
  return Object.fromEntries(Object.entries(output).sort(([left], [right]) => left.localeCompare(right)))
}

function rewriteNames(value) {
  if (Array.isArray(value)) return value.map(rewriteNames)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewriteNames(child)]))
  }
  if (typeof value !== 'string') return value
  return rewritePackageReferences(value)
}

async function filesUnder(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.name === 'node_modules' || entry.name === 'lib') continue
    if (entry.isDirectory()) result.push(...await filesUnder(path))
    else if (entry.isFile()) result.push(path)
  }
  return result
}

for (const row of replacements) {
  const directory = resolve(root, 'packages', row.packageDir)
  const packagePath = resolve(directory, 'package.json')
  const manifest = rewriteNames(JSON.parse(await readFile(packagePath, 'utf8')))
  manifest.name = row.socName
  manifest.version = '0.1.0'
  manifest.license = manifest.license ?? 'Apache-2.0'
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    if (manifest[section] !== undefined) manifest[section] = rewriteDependencyObject(manifest[section], section)
  }

  // A replaced implementation is supplied by the profile as a direct package;
  // its SOC runtime collaborators are exact peers and workspace-only dev links.
  for (const section of ['dependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (!name.startsWith('dsh-soc-agent-')) continue
      delete manifest[section][name]
      manifest.peerDependencies = { ...(manifest.peerDependencies ?? {}), [name]: '0.1.0' }
      manifest.devDependencies = { ...(manifest.devDependencies ?? {}), [name]: 'workspace:^' }
    }
  }
  if (manifest.dependencies && Object.keys(manifest.dependencies).length === 0) delete manifest.dependencies
  if (manifest.optionalDependencies && Object.keys(manifest.optionalDependencies).length === 0) delete manifest.optionalDependencies
  if (manifest.peerDependencies) manifest.peerDependencies = rewriteDependencyObject(manifest.peerDependencies, 'peerDependencies')
  if (manifest.devDependencies) manifest.devDependencies = rewriteDependencyObject(manifest.devDependencies, 'devDependencies')
  manifest.scripts = {
    ...(manifest.scripts ?? {}),
    bundle: manifest.scripts?.bundle ?? 'tsdown',
    typecheck: 'tsc --noEmit -p tsconfig.json',
  }
  await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`)

  for (const file of await filesUnder(directory)) {
    if (!/\.(?:[cm]?[jt]sx?|json|md|ya?ml)$/.test(file) || file === packagePath) continue
    const source = await readFile(file, 'utf8')
    let output = source
    output = rewritePackageReferences(output)
    if (file.endsWith('tsdown.config.ts')) {
      output = output.replace(/from ['"][^'"]*tsdown\.client\.ts['"]/, "from '../../tooling/client/tsdown.client.ts'")
      output = output.replaceAll('lib/types/', 'src/')
      output = output.replace(/(['"]src\/[^'"]+)\.js(['"])/g, '$1.ts$2')
    }
    if (output !== source) await writeFile(file, output)
  }

  const tsconfig = {
    extends: '../../tsconfig.base.json',
    compilerOptions: { rootDir: 'src' },
    include: ['src/**/*.ts', 'src/**/*.tsx'],
  }
  await writeFile(resolve(directory, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`)
}

// Existing first-party packages must consume the replacements too. Their
// package-specific APIs are adapted separately; this pass only removes stale
// official implementation names.
for (const directoryEntry of await readdir(resolve(root, 'packages'), { withFileTypes: true })) {
  if (!directoryEntry.isDirectory()) continue
  const directory = resolve(root, 'packages', directoryEntry.name)
  for (const file of await filesUnder(directory)) {
    if (!/\.(?:[cm]?[jt]sx?|json|md|ya?ml)$/.test(file)) continue
    const source = await readFile(file, 'utf8')
    let output = source
    output = rewritePackageReferences(output)
    if (output !== source) await writeFile(file, output)
  }
}

console.log(`rewrote ${replacements.length} replacements for ${upstream.tag}`)
