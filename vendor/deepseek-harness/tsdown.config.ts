import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'tsdown'
import { typertPlugin } from './packages/typert/generator/lib/types/tsdown-plugin.js'

function subdirectories(path: string): string[] {
  return readdirSync(resolve(import.meta.dirname, path), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => `${path}/${entry.name}`)
}

function workspacePackages(): string[] {
  // Old checkouts can retain generated directories after a package is removed.
  return [
    ...subdirectories('vendor'),
    ...subdirectories('packages').flatMap(subdirectories),
    'apps/cli',
  ].filter(path => existsSync(resolve(import.meta.dirname, path, 'package.json')))
}

function isBuildFaceClient(value: unknown): boolean {
  if (value === undefined || value === 'host') return false
  if (value === 'client') return true
  throw new Error(`tsdown: --env.DSH_BUILD_FACE must be host or client, received ${String(value)}`)
}

/**
 * The ordinary workspace build consumes JavaScript emitted by the Host
 * TypeScript project and runs Typert. The Client pass selects packages that
 * declare a browser bundle and lets their package-local configs emit both
 * their Node loader entry and browser artifact.
 */
export default defineConfig(({ env }) => {
  const client = isBuildFaceClient(env?.DSH_BUILD_FACE)
  return {
    workspace: workspacePackages(),
    entry: client ? '' : ['lib/types/{index,invariant,startup}.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    plugins: client ? [] : [typertPlugin({ mode: 'workspace', faces: ['host'] })],
  }
})
