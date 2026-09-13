import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { replacements, upstream } from './replacement-map.mjs'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = process.argv[2]
if (!sourceRoot) throw new Error('usage: node tooling/record-baselines.mjs <pristine-harness-root>')

async function filesUnder(directory) {
  const result = []
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = resolve(current, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) result.push(path)
    }
  }
  await visit(directory)
  return result
}

for (const row of replacements) {
  const source = resolve(sourceRoot, row.sourcePath)
  const hash = createHash('sha256')
  for (const file of await filesUnder(source)) {
    hash.update(relative(source, file).replaceAll('\\', '/'))
    hash.update('\0')
    hash.update(await readFile(file))
    hash.update('\0')
  }
  const manifest = {
    schemaVersion: 1,
    repository: upstream.repository,
    tag: upstream.tag,
    commit: upstream.commit,
    version: upstream.version,
    officialPackage: row.officialName,
    officialSourcePath: row.sourcePath,
    sourceSha256: hash.digest('hex'),
  }
  await writeFile(
    resolve(root, 'packages', row.packageDir, 'UPSTREAM_BASELINE.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
}
