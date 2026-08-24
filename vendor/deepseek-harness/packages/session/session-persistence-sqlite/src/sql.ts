/**
 * Closed, package-owned SQL resource loading for SQLite.
 * @module @deepseek-ai/dsh-session-persistence-sqlite/sql
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SQL_RESOURCES = [
  'begin',
  'begin-immediate',
  'commit',
  'delete-folder',
  'delete-session',
  'delete-events-from',
  'foreign-keys-on',
  'insert-event',
  'insert-folder',
  'insert-persistence-state',
  'journal-mode-delete',
  'journal-mode-persist',
  'journal-mode-truncate',
  'journal-mode-wal',
  'mmap-off',
  'migrate-16-to-18',
  'migrate-17-to-18',
  'rollback',
  'schema',
  'select-application-id',
  'select-events',
  'select-events-from',
  'select-folder-exists',
  'select-folders',
  'select-mmap-size',
  'select-packed-predecessors',
  'select-schema-objects',
  'select-session',
  'select-sessions',
  'select-store-id',
  'select-synchronous',
  'select-tail-events',
  'select-trusted-schema',
  'select-user-object-count',
  'select-user-version',
  'set-application-id',
  'set-user-version-17',
  'set-user-version-18',
  'set-session-folder',
  'synchronous-full',
  'trusted-schema-off',
  'update-session-revision',
  'update-folder',
  'upsert-session',
] as const

/** A resource basename selected exclusively by package code. */
export type SqlResourceName = typeof SQL_RESOURCES[number]

const cache = new Map<SqlResourceName, string>()

/**
 * Load an immutable SQL statement by closed resource name.
 * @param name - package-owned resource basename.
 * @returns the resource text.
 */
export function sql(name: SqlResourceName): string {
  const cached = cache.get(name)
  if (cached !== undefined) return cached
  const statement = readFileSync(
    fileURLToPath(new URL(`../resources/sql/${name}.sql`, import.meta.url)),
    'utf8',
  )
  cache.set(name, statement)
  return statement
}
