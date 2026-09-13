import { access, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const paths = {}

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

for (const entry of await readdir(resolve(root, 'packages'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const directory = resolve(root, 'packages', entry.name)
  let manifest
  try { manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8')) } catch { continue }
  if (typeof manifest.name !== 'string') continue
  paths[manifest.name] = [`./packages/${entry.name}/src/index.ts`]
  if (await exists(resolve(directory, 'src/client/index.ts'))) {
    paths[`${manifest.name}/client`] = [`./packages/${entry.name}/src/client/index.ts`]
  }
  for (const exportName of Object.keys(manifest.exports ?? {})) {
    if (!exportName.startsWith('./') || exportName === './client' || exportName.includes('*')) continue
    const subpath = exportName.slice(2)
    const candidates = [
      [`src/${subpath}.ts`, `./packages/${entry.name}/src/${subpath}.ts`],
      [`src/${subpath}/index.ts`, `./packages/${entry.name}/src/${subpath}/index.ts`],
    ]
    for (const [disk, mapped] of candidates) {
      if (await exists(resolve(directory, disk))) { paths[`${manifest.name}/${subpath}`] = [mapped]; break }
    }
  }
}

await writeFile(resolve(root, 'tsconfig.soc-paths.json'), `${JSON.stringify({
  extends: './tsconfig.base.json',
  compilerOptions: { paths },
}, null, 2)}\n`)
