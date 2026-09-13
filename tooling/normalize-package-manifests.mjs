import { access, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const officialVersion = '0.1.5-rc.2'
const frameworkVersions = new Map([
  ['@deepseek-ai/cordis', '4.0.2'],
  ['@deepseek-ai/cosmokit', '1.8.3'],
  ['@deepseek-ai/schemastery', '3.18.2'],
])
const removedPackages = new Set([
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-host-apiproxy',
])
const nodeTestPackages = new Set([
  'dsh-soc-agent-client',
  'dsh-soc-agent-admin',
  'dsh-soc-agent-action-policy',
  'dsh-soc-agent-attachments',
  'dsh-soc-agent-email-draft',
])

async function sourcePackageImports(directory) {
  const names = new Set()
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) {
        const source = await readFile(path, 'utf8')
        for (const match of source.matchAll(/(?:from\s+|import\s*\()(['"])([^'".][^'"]*)\1/g)) {
          const specifier = match[2]
          const parts = specifier.split('/')
          names.add(specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0])
        }
      }
    }
  }
  await visit(directory)
  return names
}

function officialExact(name, current) {
  if (frameworkVersions.has(name)) return frameworkVersions.get(name)
  if (name.startsWith('@deepseek-ai/dsh-')) return officialVersion
  return current
}

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

for (const entry of await readdir(resolve(root, 'packages'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const path = resolve(root, 'packages', entry.name, 'package.json')
  let manifest
  try { manifest = JSON.parse(await readFile(path, 'utf8')) } catch { continue }

  const dependencies = { ...(manifest.dependencies ?? {}) }
  const peers = { ...(manifest.peerDependencies ?? {}) }
  const dev = { ...(manifest.devDependencies ?? {}) }
  const optional = { ...(manifest.optionalDependencies ?? {}) }
  for (const section of [dependencies, peers, dev, optional]) {
    for (const name of removedPackages) delete section[name]
    for (const [name, version] of Object.entries(section)) {
      if (name.startsWith('dsh-soc-agent-')) {
        section[name] = section === dev ? 'workspace:^' : '0.1.0'
      } else {
        section[name] = officialExact(name, version)
      }
    }
  }

  // SOC implementations are direct profile dependencies. Cross-SOC runtime
  // edges are exact peers, with workspace links used only for development.
  for (const section of [dependencies, optional]) {
    for (const name of Object.keys(section)) {
      if (!name.startsWith('dsh-soc-agent-')) continue
      delete section[name]
      peers[name] = '0.1.0'
      dev[name] = 'workspace:^'
    }
  }

  const sourceImports = await sourcePackageImports(resolve(root, 'packages', entry.name, 'src'))
  for (const name of sourceImports) {
    if (name === manifest.name) continue
    const declared = name in dependencies || name in peers || name in dev || name in optional
    if (declared) continue
    if (name.startsWith('dsh-soc-agent-')) {
      peers[name] = '0.1.0'
      dev[name] = 'workspace:^'
    } else if (name.startsWith('@deepseek-ai/dsh-')) {
      dev[name] = officialVersion
    } else if (frameworkVersions.has(name)) {
      peers[name] = frameworkVersions.get(name)
      dev[name] = frameworkVersions.get(name)
    }
  }

  if ([
    'dsh-soc-agent-brand', 'dsh-soc-agent-admin', 'dsh-soc-agent-action-policy',
  ].includes(manifest.name)) {
    peers['@deepseek-ai/cordis'] = '4.0.2'
    dev['@deepseek-ai/cordis'] = '4.0.2'
  }
  if (manifest.name === 'dsh-soc-agent-attachments') {
    dev['@deepseek-ai/dsh-client-store'] = officialVersion
  }
  if (manifest.name === 'dsh-soc-agent-email-draft') {
    peers['dsh-soc-agent-ui-conversation'] = '0.1.0'
    dev['dsh-soc-agent-ui-conversation'] = 'workspace:^'
  }

  const clean = value => Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
  if (Object.keys(dependencies).length) manifest.dependencies = clean(dependencies)
  else delete manifest.dependencies
  if (Object.keys(peers).length) manifest.peerDependencies = clean(peers)
  else delete manifest.peerDependencies
  if (Object.keys(dev).length) manifest.devDependencies = clean(dev)
  else delete manifest.devDependencies
  if (Object.keys(optional).length) manifest.optionalDependencies = clean(optional)
  else delete manifest.optionalDependencies

  if (manifest.dsh?.client?.inject) {
    manifest.dsh.client.inject = manifest.dsh.client.inject.filter(name => !removedPackages.has(name))
  }
  const packageDirectory = resolve(root, 'packages', entry.name)
  const splitFaces = await exists(resolve(packageDirectory, 'tsconfig.host.json'))
    && await exists(resolve(packageDirectory, 'tsconfig.client.json'))
  manifest.scripts = {
    bundle: 'tsdown',
    typecheck: splitFaces
      ? 'tsc --noEmit -p tsconfig.host.json && tsc --noEmit -p tsconfig.client.json'
      : 'tsc --noEmit -p tsconfig.json',
    test: nodeTestPackages.has(manifest.name)
      ? 'node --import tsx --test tests/*.test.ts'
      : 'vitest run tests',
  }
  if (manifest.exports?.['.'] && typeof manifest.exports['.'] === 'object') {
    manifest.exports['.'].types = './src/index.ts'
  }
  if (manifest.exports?.['./client'] && typeof manifest.exports['./client'] === 'object') {
    manifest.exports['./client'].types = './src/client/index.ts'
  }
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`)

  const tsconfig = {
    extends: '../../tsconfig.soc-paths.json',
    include: ['src/**/*.ts', 'src/**/*.tsx'],
  }
  await writeFile(resolve(packageDirectory, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`)
  if (splitFaces) {
    await writeFile(resolve(packageDirectory, 'tsconfig.host.json'), `${JSON.stringify({
      extends: '../../tsconfig.soc-paths.json',
      include: ['src/**/*.ts'],
      exclude: ['src/client/**/*.ts', 'src/client/**/*.tsx'],
    }, null, 2)}\n`)
    await writeFile(resolve(packageDirectory, 'tsconfig.client.json'), `${JSON.stringify({
      extends: '../../tsconfig.soc-paths.json',
      include: ['src/client/**/*.ts', 'src/client/**/*.tsx'],
    }, null, 2)}\n`)
  }
  const typesConfig = {
    extends: './tsconfig.json',
    compilerOptions: {
      noEmit: false,
      emitDeclarationOnly: true,
      declaration: true,
      declarationMap: false,
      sourceMap: false,
      rewriteRelativeImportExtensions: true,
      rootDir: 'src',
      outDir: 'lib/types',
    },
  }
  await writeFile(resolve(packageDirectory, 'tsconfig.types.json'), `${JSON.stringify(typesConfig, null, 2)}\n`)
}
