import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { replacementNames, replacements, upstream } from './replacement-map.mjs'

const root = resolve(import.meta.dirname, '..')
const unpackedRoot = process.argv[2]
if (!unpackedRoot) throw new Error('usage: node tooling/import-generated-typert.mjs <unpacked-package-parent>')

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rewriteReferences(value) {
  let output = value
  for (const [official, replacement] of replacementNames) {
    output = output.replace(new RegExp(`${escapeRegExp(official)}(?![A-Za-z0-9._-])`, 'g'), replacement)
  }
  return output
}

for (const entry of await readdir(unpackedRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const sourcePackage = resolve(unpackedRoot, entry.name, 'package')
  let manifest
  try { manifest = JSON.parse(await readFile(resolve(sourcePackage, 'package.json'), 'utf8')) } catch { continue }
  const row = replacements.find(candidate => candidate.officialName === manifest.name)
  if (row === undefined) continue
  const outputDirectory = resolve(root, 'packages', row.packageDir, 'lib')
  await mkdir(outputDirectory, { recursive: true })
  const hashes = {}
  for (const name of ['typert.host.d.ts', 'typert.host.js', 'typert.remote-client.d.ts', 'typert.remote-client.js']) {
    const source = await readFile(resolve(sourcePackage, 'lib', name), 'utf8')
    hashes[name] = createHash('sha256').update(source).digest('hex')
    await writeFile(resolve(outputDirectory, name), rewriteReferences(source))
  }
  await writeFile(resolve(root, 'packages', row.packageDir, 'TYPERT_BASELINE.json'), `${JSON.stringify({
    schemaVersion: 1,
    repository: upstream.repository,
    tag: upstream.tag,
    commit: upstream.commit,
    officialPackage: row.officialName,
    officialPackageVersion: manifest.version,
    sourceSha256: hashes,
  }, null, 2)}\n`)
}
