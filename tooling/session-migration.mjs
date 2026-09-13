#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const modulePath = resolve(root, 'packages/soc-agent-session-persistence-jsonl/lib/migration.js')

function usage() {
  console.error(`Usage:
  node tooling/session-migration.mjs --validate --root PATH --compression none|zstd [--ownership-manifest PATH] [--skip-ownership-check]
  node tooling/session-migration.mjs --migrate --root PATH --compression none|zstd --backup-dir PATH --ownership-manifest PATH [--postgres-uri URI] [--skip-postgres-backup] [--skip-ownership-check]
  node tooling/session-migration.mjs --rollback --root PATH --backup-dir PATH --yes`)
}

function parseArgs(argv) {
  const values = { mode: undefined }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--validate' || value === '--migrate' || value === '--rollback') {
      if (values.mode !== undefined) throw new Error('choose exactly one operation')
      values.mode = value.slice(2)
      continue
    }
    if (value === '--skip-ownership-check' || value === '--skip-postgres-backup' || value === '--yes') {
      values[value.slice(2).replaceAll('-', '')] = true
      continue
    }
    if (!value.startsWith('--')) throw new Error(`unexpected argument: ${value}`)
    const key = value.slice(2).replaceAll('-', '')
    const next = argv[index + 1]
    if (next === undefined || next.startsWith('--')) throw new Error(`${value} requires a value`)
    values[key] = next
    index += 1
  }
  return values
}

function required(values, key) {
  const value = values[key]
  if (typeof value !== 'string' || value.length === 0) throw new Error(`--${key.replaceAll(/([A-Z])/g, '-$1').toLowerCase()} is required`)
  return value
}

async function main() {
  const values = parseArgs(process.argv.slice(2))
  if (values.mode === undefined) {
    usage()
    process.exitCode = 2
    return
  }
  if (!existsSync(modulePath)) {
    throw new Error('the SOC persistence maintenance bundle is missing; run `pnpm --filter dsh-soc-agent-session-persistence-jsonl bundle` first')
  }
  const migration = await import(modulePath)
  if (values.mode === 'validate') {
    const result = await migration.auditSessionRoot({
      root: required(values, 'root'),
      compression: required(values, 'compression'),
      ...(values.ownershipmanifest === undefined ? {} : { ownershipManifest: values.ownershipmanifest }),
      ...(values.skipownershipcheck === true ? { skipOwnershipCheck: true } : {}),
    })
    console.log(JSON.stringify(result, null, 2))
    return
  }
  if (values.mode === 'migrate') {
    const result = await migration.migrateSessionRoot({
      root: required(values, 'root'),
      compression: required(values, 'compression'),
      backupDir: required(values, 'backupdir'),
      ...(values.ownershipmanifest === undefined ? {} : { ownershipManifest: values.ownershipmanifest }),
      ...(values.postgresuri === undefined ? {} : { postgresUri: values.postgresuri }),
      ...(values.skipownershipcheck === true ? { skipOwnershipCheck: true } : {}),
      ...(values.skippostgresbackup === true ? { skipPostgresBackup: true } : {}),
    })
    console.log(JSON.stringify(result, null, 2))
    return
  }
  const result = await migration.rollbackSessionRoot({
    root: required(values, 'root'),
    backupDir: required(values, 'backupdir'),
    yes: values.yes === true,
  })
  console.log(JSON.stringify(result, null, 2))
}

try {
  await main()
} catch (error) {
  console.error(`session migration failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
