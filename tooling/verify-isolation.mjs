import { readFile, readdir } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { replacements } from './replacement-map.mjs'

const root = resolve(dirname(new URL(import.meta.url).pathname), '..')
const scanRoots = [join(root, 'apps', 'soc-agent'), join(root, 'packages')]
const ignoredDirectories = new Set(['coverage', 'node_modules', 'tests', '__tests__', '__snapshots__'])
const sourceExtensions = new Set(['.cjs', '.css', '.js', '.jsx', '.mjs', '.ts', '.tsx'])
const forbidden = new Set(replacements.map(replacement => replacement.officialName))
const failures = []

async function filesUnder(directory) {
  const files = []
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
      const absolute = join(current, entry.name)
      if (entry.isDirectory()) await visit(absolute)
      else if (entry.isFile()) files.push(absolute)
    }
  }
  await visit(directory)
  return files
}

function dependencySections(manifest) {
  return ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
    .flatMap(section => Object.keys(manifest[section] ?? {}).map(name => ({ section, name, value: manifest[section][name] })))
}

for (const scanRoot of scanRoots) {
  for (const file of await filesUnder(scanRoot)) {
    const path = relative(root, file)
    if (file.endsWith('package.json')) {
      const manifest = JSON.parse(await readFile(file, 'utf8'))
      for (const dependency of dependencySections(manifest)) {
        if (forbidden.has(dependency.name)) failures.push(`${path}: ${dependency.section} references ${dependency.name}`)
        if (typeof dependency.value === 'string' && /(?:file|link):.*vendor\/deepseek-harness/u.test(dependency.value)) {
          failures.push(`${path}: ${dependency.section}.${dependency.name} links into vendor/deepseek-harness`)
        }
      }
      continue
    }
    // Provenance manifests intentionally name the official source they were
    // forked from; they are audit metadata, not runtime imports.
    if (file.endsWith('UPSTREAM_BASELINE.json') || file.endsWith('snapshot-baseline.json')) continue
    if (!sourceExtensions.has(extname(file))) continue
    const source = await readFile(file, 'utf8')
    const specifiers = source.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/gu)
    for (const match of specifiers) {
      const specifier = match[1]
      if ([...forbidden].some(name => specifier === name || specifier.startsWith(`${name}/`))) {
        failures.push(`${path}: production import references ${specifier}`)
      }
      if (specifier.includes('vendor/deepseek-harness')) failures.push(`${path}: production import reaches into the vendor tree`)
    }
  }
}

for (const replacement of replacements) {
  const baselinePath = join(root, 'packages', replacement.packageDir, 'UPSTREAM_BASELINE.json')
  try {
    const baseline = JSON.parse(await readFile(baselinePath, 'utf8'))
    if (baseline.officialSourcePath !== replacement.sourcePath || baseline.commit !== 'fb2c4b9e698e30edb738bca4cf0618587db7d203') {
      failures.push(`${relative(root, baselinePath)}: baseline provenance does not match ${replacement.sourcePath}`)
    }
  } catch (error) {
    failures.push(`${relative(root, baselinePath)}: missing or invalid baseline manifest (${String(error)})`)
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`verified production isolation across ${replacements.length} official-to-SOC replacements`)
