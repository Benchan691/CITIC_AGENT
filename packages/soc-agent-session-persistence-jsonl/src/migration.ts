/**
 * Fail-closed maintenance tooling for a SOC JSONL session root.
 *
 * This module deliberately lives beside the SOC persistence fork so the
 * migration command uses the same released format catalog, physical framing,
 * ownership-independent path rules, and immutable successor publisher as the
 * running backend. It never edits the upstream vendor snapshot.
 *
 * @module dsh-soc-agent-session-persistence-jsonl/migration
 */

import { createHash, randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { promisify } from 'node:util'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import {
  SessionFormatUnsupportedMigrationError,
  sessionFormatCatalog,
} from '@deepseek-ai/dsh-session-format-catalog'
import type {
  SessionFormatArtifact,
  SessionFormatHeader,
} from '@deepseek-ai/dsh-session-format'
import type { SessionId } from '@deepseek-ai/dsh-session'
import {
  generationLogFilename,
  generationLogPath,
  parseGenerationLogFilename,
  sessionDir,
  type JsonlCompression,
} from './format.ts'
import { LEASE_FILENAME } from './lease.ts'
import {
  prepareJsonlMigration,
  readCurrentJsonlGeneration,
  readStableJsonlFile,
  verifyJsonlCurrentGeneration,
  type JsonlGenerationFormatAdapter,
  type JsonlPhysicalIdentity,
  type PreparedJsonlMigration,
} from './generation.ts'
import {
  decompressZstdFrame,
  scanZstdFrames,
} from './zstd.ts'

const execFileAsync = promisify(execFile)
const BACKUP_MANIFEST = 'session-root-backup.json'
const MIGRATION_MANIFEST = 'session-root-migration.json'

/** A compact, JSON-safe summary of one validated Session header. */
export interface SessionHeaderSummary {
  readonly storedVersion: number
  readonly version: number
  readonly id: string
  readonly createdAt: number
  readonly cwd: string | null
  readonly parentSession: string | null
  readonly isSeeded: boolean
  readonly origin: 'subagent' | null
  readonly delegationDepth: number
  readonly agentPreset: string | null
}

/** One generation report included in validation and migration output. */
export interface SessionGenerationReport {
  readonly path: string
  readonly currentPath: string
  readonly storedVersion: number
  readonly selected: boolean
  readonly header: SessionHeaderSummary
  readonly eventCount: number
  readonly inheritedEventCount: number
  readonly bytes: number
  readonly sha256: string
}

/** All generations belonging to one physical Session directory. */
export interface SessionRootReport {
  readonly directory: string
  readonly id: string
  readonly cwd: string | null
  readonly selectedVersion: number
  readonly generations: readonly SessionGenerationReport[]
}

/** One regular file captured in a backup manifest. */
export interface SessionRootFileManifest {
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}

/** On-disk ownership/workspace mapping accepted by the cutover tool. */
export interface SessionOwnershipManifest {
  readonly sessions: readonly SessionOwnershipEntry[]
  readonly workspaces: readonly WorkspaceOwnershipEntry[]
}

/** Ownership row for one persisted Session id. */
export interface SessionOwnershipEntry {
  readonly id: string
  readonly userId: string
  readonly workspaceId: string
  readonly cwd?: string
}

/** Ownership row for one logical workspace. */
export interface WorkspaceOwnershipEntry {
  readonly id: string
  readonly userId: string
  readonly path: string
  readonly title?: string
  readonly general?: boolean
}

/** Result of a complete read-only root audit. */
export interface SessionRootAudit {
  readonly root: string
  readonly compression: JsonlCompression
  readonly currentVersion: number
  readonly sessions: readonly SessionRootReport[]
  readonly files: readonly SessionRootFileManifest[]
}

/** Options shared by validation and migration. */
export interface SessionRootAuditOptions {
  readonly root: string
  readonly compression: JsonlCompression
  /** A JSON path or already parsed ownership manifest. */
  readonly ownershipManifest?: string | SessionOwnershipManifest
  /** Explicitly bypass ownership validation; intended only for offline fixtures. */
  readonly skipOwnershipCheck?: boolean
}

/** Options for publishing verified v3 successors and making backups. */
export interface SessionRootMigrationOptions extends SessionRootAuditOptions {
  readonly backupDir: string
  readonly postgresUri?: string
  readonly skipPostgresBackup?: boolean
}

/** Result of a maintenance migration. */
export interface SessionRootMigrationResult {
  readonly backupDir: string
  readonly postgresDump: string | null
  readonly publishedSessionIds: readonly string[]
  readonly before: SessionRootAudit
  readonly after: SessionRootAudit
}

/** Result of restoring a previously verified immutable backup. */
export interface SessionRootRollbackResult {
  readonly restoredFrom: string
  readonly displacedCurrentRoot: string
}

interface GenerationWork extends SessionGenerationReport {
  readonly prepared?: PreparedJsonlMigration
  readonly identity: JsonlPhysicalIdentity
}

interface SessionWork extends SessionRootReport {
  readonly generations: readonly GenerationWork[]
}

interface RootWork extends SessionRootAudit {
  readonly sessions: readonly SessionWork[]
  readonly filePaths: readonly string[]
}

interface FileSnapshot {
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}

interface BackupManifest {
  readonly schemaVersion: 1
  readonly createdAt: string
  readonly sourceRoot: string
  readonly compression: JsonlCompression
  readonly currentVersion: number
  readonly files: readonly SessionRootFileManifest[]
  readonly postgresDump: string | null
}

const generationFormat: JsonlGenerationFormatAdapter = {
  currentVersion: sessionFormatCatalog.currentVersion,
  createRestore: header => sessionFormatCatalog.createRestore(header, {
    recovery: 'strict',
    validation: 'current',
  }),
  encodeHeader: (header, inheritedEventCount) =>
    sessionFormatCatalog.encodeCurrentHeader(header, inheritedEventCount),
  encodeEvent: event => sessionFormatCatalog.encodeCurrentEvent(event),
  isUnsupportedMigrationError: (error): error is SessionFormatUnsupportedMigrationError =>
    error instanceof SessionFormatUnsupportedMigrationError,
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function digest(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function identityKey(value: JsonlPhysicalIdentity): string {
  return [value.dev, value.ino, value.size, value.mtimeNs, value.ctimeNs].join(':')
}

function pathInside(root: string, candidate: string): boolean {
  const remainder = relative(resolve(root), resolve(candidate))
  return remainder === ''
    || (remainder !== '..' && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder))
}

function relativeFilePath(root: string, path: string): string {
  return relative(root, path).split(sep).join('/')
}

async function assertDirectory(path: string, subject: string): Promise<void> {
  let info
  try {
    info = await lstat(path)
  } catch (error: unknown) {
    throw new Error(`${subject} is not available: ${path}`, { cause: error })
  }
  if (info.isSymbolicLink()) throw new Error(`${subject} must not be a symbolic link: ${path}`)
  if (!info.isDirectory()) throw new Error(`${subject} must be a directory: ${path}`)
}

async function assertRegularFile(path: string, subject: string): Promise<void> {
  let info
  try {
    info = await lstat(path)
  } catch (error: unknown) {
    throw new Error(`${subject} is not available: ${path}`, { cause: error })
  }
  if (info.isSymbolicLink()) throw new Error(`${subject} must not be a symbolic link: ${path}`)
  if (!info.isFile()) throw new Error(`${subject} must be a regular file: ${path}`)
}

function summaryOf(storedVersion: number, header: SessionFormatHeader): SessionHeaderSummary {
  return {
    storedVersion,
    version: header.version,
    id: String(header.id),
    createdAt: header.createdAt,
    cwd: header.cwd === undefined ? null : String(header.cwd),
    parentSession: header.parentSession === undefined ? null : String(header.parentSession),
    isSeeded: header.isSeeded,
    origin: header.origin === undefined ? null : header.origin,
    delegationDepth: header.delegationDepth,
    agentPreset: header.agentPreset === undefined ? null : String(header.agentPreset),
  }
}

function headerFromResult(
  value: unknown,
  expectedVersion: number,
  path: string,
): SessionFormatHeader {
  const result = sessionFormatCatalog.readHeader(value)
  if (result.status === 'malformed') {
    throw new Error(`corrupt session header in ${path}: ${result.reason}`)
  }
  if (result.status === 'unsupported') {
    throw new Error(`unsupported session format in ${path}: ${result.reason}`)
  }
  if (result.storedVersion !== expectedVersion) {
    throw new Error(
      `session generation filename identifies v${expectedVersion}, `
      + `but its header identifies v${result.storedVersion}: ${path}`,
    )
  }
  return result.header
}

function headerRecordFromBytes(bytes: Buffer, compression: JsonlCompression, path: string): Buffer {
  if (compression === 'none') {
    const end = bytes.indexOf(0x0A)
    if (end === -1) throw new Error(`corrupt session log has no complete header line: ${path}`)
    return bytes.subarray(0, end + 1)
  }
  const scan = scanZstdFrames(bytes, 1)
  const first = scan.frames[0]
  if (first === undefined) throw new Error(`corrupt Zstandard session log has no header frame: ${path}`)
  return bytes.subarray(first.start, first.end)
}

async function readRawHeader(
  bytes: Buffer,
  compression: JsonlCompression,
  path: string,
): Promise<unknown> {
  if (compression === 'none') {
    const record = headerRecordFromBytes(bytes, compression, path)
    try {
      return JSON.parse(record.subarray(0, -1).toString('utf8'))
    } catch (error: unknown) {
      throw new Error(`corrupt session header is not valid JSON: ${path}`, { cause: error })
    }
  }
  const frame = headerRecordFromBytes(bytes, compression, path)
  let plaintext: Buffer
  try {
    plaintext = await decompressZstdFrame(frame)
  } catch (error: unknown) {
    throw new Error(`corrupt Zstandard session header frame: ${path}`, { cause: error })
  }
  if (plaintext.length === 0 || plaintext.at(-1) !== 0x0A || plaintext.indexOf(0x0A) !== plaintext.length - 1) {
    throw new Error(`corrupt Zstandard session header frame is not one JSONL record: ${path}`)
  }
  try {
    return JSON.parse(plaintext.subarray(0, -1).toString('utf8'))
  } catch (error: unknown) {
    throw new Error(`corrupt session header is not valid JSON: ${path}`, { cause: error })
  }
}

/** Reject all physical damage before the format catalog is allowed to recover anything. */
async function assertCompletePhysicalLog(
  bytes: Buffer,
  compression: JsonlCompression,
  path: string,
): Promise<void> {
  if (bytes.length === 0) throw new Error(`empty session log: ${path}`)
  if (compression === 'none') {
    if (bytes.at(-1) !== 0x0A) throw new Error(`session log has a torn plaintext tail: ${path}`)
    headerRecordFromBytes(bytes, compression, path)
    return
  }
  const scan = scanZstdFrames(bytes)
  if (scan.frames.length === 0) throw new Error(`empty Zstandard session log: ${path}`)
  if (scan.tornStart !== undefined) {
    throw new Error(`session log has a torn Zstandard tail at byte ${scan.tornStart}: ${path}`)
  }
  for (const [index, frame] of scan.frames.entries()) {
    try {
      const plaintext = await decompressZstdFrame(bytes.subarray(frame.start, frame.end))
      if (index === 0 && (plaintext.length === 0
        || plaintext.at(-1) !== 0x0A
        || plaintext.indexOf(0x0A) !== plaintext.length - 1)) {
        throw new Error('header frame is not exactly one newline-terminated record')
      }
    } catch (error: unknown) {
      throw new Error(`corrupt Zstandard frame ${index} in ${path}`, { cause: error })
    }
  }
}

function assertGenerationIdentity(
  root: string,
  path: string,
  storedVersion: number,
  header: SessionFormatHeader,
  compression: JsonlCompression,
): void {
  const expected = resolve(generationLogPath(
    root,
    header.cwd,
    String(header.id) as SessionId,
    storedVersion,
    compression,
  ))
  if (resolve(path) !== expected) {
    throw new Error(
      `session header id/cwd does not identify its physical path: ${path}; expected ${expected}`,
    )
  }
  const expectedDirectory = resolve(sessionDir(root, header.cwd, String(header.id) as SessionId))
  if (resolve(dirname(path)) !== expectedDirectory) {
    throw new Error(`session directory does not match header identity: ${path}`)
  }
}

async function assertUnchanged(
  path: string,
  identity: JsonlPhysicalIdentity,
  sha256: string,
): Promise<void> {
  const after = await readStableJsonlFile(path)
  const afterDigest = digest(after.bytes)
  if (identityKey(after.identity) !== identityKey(identity) || afterDigest !== sha256) {
    throw new Error(`session generation changed during maintenance validation: ${path}`)
  }
}

async function auditGeneration(
  root: string,
  path: string,
  storedVersion: number,
  selected: boolean,
  compression: JsonlCompression,
): Promise<GenerationWork> {
  const currentVersion = sessionFormatCatalog.currentVersion
  if (storedVersion > currentVersion) {
    throw new Error(`session generation v${storedVersion} is newer than installed v${currentVersion}: ${path}`)
  }
  const source = await readStableJsonlFile(path)
  const sourceDigest = digest(source.bytes)
  await assertCompletePhysicalLog(source.bytes, compression, path)
  const currentPath = join(dirname(path), generationLogFilename(currentVersion, compression))

  if (storedVersion === currentVersion) {
    const current = await readCurrentJsonlGeneration(path, compression)
    if (identityKey(current.identity) !== identityKey(source.identity) || current.digest !== sourceDigest) {
      throw new Error(`current session generation changed during audit: ${path}`)
    }
    const header = current.meta as unknown as SessionFormatHeader
    assertGenerationIdentity(root, path, storedVersion, header, compression)
    return {
      path,
      currentPath,
      storedVersion,
      selected,
      header: summaryOf(storedVersion, header),
      eventCount: current.events.length,
      inheritedEventCount: Number(current.inheritedEventCount),
      bytes: source.bytes.length,
      sha256: sourceDigest,
      identity: source.identity,
    }
  }

  const rawHeader = await readRawHeader(source.bytes, compression, path)
  const historicalHeader = headerFromResult(rawHeader, storedVersion, path)
  assertGenerationIdentity(root, path, storedVersion, historicalHeader, compression)
  let prepared: PreparedJsonlMigration
  try {
    prepared = await prepareJsonlMigration({
      sourcePath: path,
      sourceVersion: storedVersion,
      currentPath,
      compression,
      format: generationFormat,
      verifyCurrentFile: verifyJsonlCurrentGeneration,
      validateHistoricalHeader: headerValue => {
        const header = headerFromResult(headerValue, storedVersion, path)
        assertGenerationIdentity(root, path, storedVersion, header, compression)
      },
    })
  } catch (error: unknown) {
    throw new Error(`historical session generation failed validation: ${path}`, { cause: error })
  }
  const artifact = prepared.artifact
  const logicalHeader = artifact.header
  assertGenerationIdentity(root, path, storedVersion, logicalHeader, compression)
  await assertUnchanged(path, source.identity, sourceDigest)
  return {
    path,
    currentPath,
    storedVersion,
    selected,
    header: summaryOf(storedVersion, logicalHeader),
    eventCount: artifact.events.length,
    inheritedEventCount: artifact.inheritedEventCount,
    bytes: source.bytes.length,
    sha256: sourceDigest,
    identity: source.identity,
    ...(selected ? { prepared } : {}),
  }
}

async function auditSession(
  root: string,
  directory: string,
  generationPaths: readonly { path: string; version: number }[],
  compression: JsonlCompression,
): Promise<SessionWork> {
  const selectedVersion = generationPaths.at(-1)?.version
  if (selectedVersion === undefined) throw new Error(`session directory has no generation: ${directory}`)
  const generations = [] as GenerationWork[]
  for (const generation of generationPaths) {
    generations.push(await auditGeneration(
      root,
      generation.path,
      generation.version,
      generation.version === selectedVersion,
      compression,
    ))
  }
  const first = generations[0] as GenerationWork
  for (const generation of generations.slice(1)) {
    if (generation.header.id !== first.header.id || generation.header.cwd !== first.header.cwd) {
      throw new Error(`generations in one session directory disagree on id/cwd: ${directory}`)
    }
  }
  return {
    directory,
    id: first.header.id,
    cwd: first.header.cwd,
    selectedVersion,
    generations,
  }
}

async function listRootFiles(root: string): Promise<readonly FileSnapshot[]> {
  const files: FileSnapshot[] = []
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(directory, entry.name)
      const info = await lstat(path)
      if (info.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${path}`)
      if (info.isDirectory()) {
        await visit(path)
        continue
      }
      if (!info.isFile()) throw new Error(`session root contains a non-regular entry: ${path}`)
      const before = await stat(path, { bigint: true })
      const bytes = await readFile(path)
      const after = await stat(path, { bigint: true })
      if (before.dev !== after.dev || before.ino !== after.ino
        || before.size !== after.size || before.mtimeNs !== after.mtimeNs
        || before.ctimeNs !== after.ctimeNs) {
        throw new Error(`session root file changed while being fingerprinted: ${path}`)
      }
      files.push({ path, bytes: bytes.length, sha256: digest(bytes) })
    }
  }
  await visit(root)
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

function publicFiles(root: string, files: readonly FileSnapshot[]): readonly SessionRootFileManifest[] {
  return files.map(file => ({
    path: relativeFilePath(root, file.path),
    bytes: file.bytes,
    sha256: file.sha256,
  }))
}

async function readOwnershipManifest(
  value: string | SessionOwnershipManifest,
): Promise<SessionOwnershipManifest> {
  if (typeof value !== 'string') return value
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(value, 'utf8'))
  } catch (error: unknown) {
    throw new Error(`ownership manifest is not valid JSON: ${value}`, { cause: error })
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ownership manifest must be a JSON object')
  }
  return parsed as SessionOwnershipManifest
}

function recordArray(value: unknown, subject: string, idKey: string): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${subject}[${index}] must be an object`)
    }
    return item as Record<string, unknown>
  })
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).map(([id, item]) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`${subject}[${JSON.stringify(id)}] must be an object`)
      }
      const record = item as Record<string, unknown>
      return { ...record, [idKey]: record[idKey] ?? id }
    })
  }
  throw new Error(`${subject} must be an array or object map`)
}

function requiredString(value: unknown, subject: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${subject} must be a non-empty string`)
  return value
}

function normalizeOwnership(value: SessionOwnershipManifest): SessionOwnershipManifest {
  const source = value as unknown as Record<string, unknown>
  const sessionRows = recordArray(source.sessions ?? source.sessionOwners, 'ownership.sessions', 'id')
  const workspaceRows = recordArray(source.workspaces ?? source.workspaceOwners, 'ownership.workspaces', 'id')
  const sessions: SessionOwnershipEntry[] = []
  const workspaces: WorkspaceOwnershipEntry[] = []
  const sessionIds = new Set<string>()
  const workspaceIds = new Set<string>()
  for (const [index, row] of sessionRows.entries()) {
    const id = requiredString(row.id, `ownership.sessions[${index}].id`)
    if (sessionIds.has(id)) throw new Error(`ownership manifest repeats session ${JSON.stringify(id)}`)
    sessionIds.add(id)
    const cwd = row.cwd === undefined ? undefined : requiredString(row.cwd, `ownership.sessions[${index}].cwd`)
    sessions.push({
      id,
      userId: requiredString(row.userId, `ownership.sessions[${index}].userId`),
      workspaceId: requiredString(row.workspaceId, `ownership.sessions[${index}].workspaceId`),
      ...(cwd === undefined ? {} : { cwd }),
    })
  }
  for (const [index, row] of workspaceRows.entries()) {
    const id = requiredString(row.id, `ownership.workspaces[${index}].id`)
    if (workspaceIds.has(id)) throw new Error(`ownership manifest repeats workspace ${JSON.stringify(id)}`)
    workspaceIds.add(id)
    const path = requiredString(row.path, `ownership.workspaces[${index}].path`)
    if (!isAbsolute(path)) throw new Error(`ownership.workspaces[${index}].path must be absolute`)
    workspaces.push({
      id,
      userId: requiredString(row.userId, `ownership.workspaces[${index}].userId`),
      path: resolve(path),
      ...(row.title === undefined ? {} : { title: requiredString(row.title, `ownership.workspaces[${index}].title`) }),
      ...(row.general === true ? { general: true } : {}),
    })
  }
  return { sessions, workspaces }
}

function isGeneralWorkspace(workspace: WorkspaceOwnershipEntry): boolean {
  return workspace.general === true || workspace.title?.toLowerCase() === 'general'
    || basename(workspace.path).toLowerCase() === 'general'
}

function validateOwnership(
  audit: readonly SessionWork[],
  manifest: SessionOwnershipManifest,
): void {
  const normalized = normalizeOwnership(manifest)
  const sessions = new Map(normalized.sessions.map(entry => [entry.id, entry]))
  const workspaces = new Map(normalized.workspaces.map(entry => [entry.id, entry]))
  const discovered = new Set(audit.map(session => session.id))
  for (const session of normalized.sessions) {
    if (!discovered.has(session.id)) {
      throw new Error(`ownership manifest contains an unknown session ${JSON.stringify(session.id)}`)
    }
  }
  for (const session of audit) {
    const owner = sessions.get(session.id)
    if (owner === undefined) throw new Error(`ownership manifest has no owner for session ${JSON.stringify(session.id)}`)
    const selected = session.generations.find(generation => generation.selected) as GenerationWork
    if (owner.cwd !== undefined && owner.cwd !== selected.header.cwd) {
      throw new Error(`ownership cwd disagrees with session header ${JSON.stringify(session.id)}`)
    }
    const workspace = workspaces.get(owner.workspaceId)
    if (workspace === undefined) {
      throw new Error(`ownership manifest has no workspace ${JSON.stringify(owner.workspaceId)} for session ${JSON.stringify(session.id)}`)
    }
    if (workspace.userId !== owner.userId) {
      throw new Error(`session/workspace ownership disagrees for ${JSON.stringify(session.id)}`)
    }
    if (selected.header.cwd === null) {
      if (!isGeneralWorkspace(workspace)) {
        throw new Error(`session ${JSON.stringify(session.id)} has no cwd but is not in General`)
      }
    } else if (resolve(selected.header.cwd) !== resolve(workspace.path)) {
      throw new Error(`session/workspace path disagrees for ${JSON.stringify(session.id)}`)
    }
  }
}

function toPublicAudit(root: RootWork): SessionRootAudit {
  return {
    root: root.root,
    compression: root.compression,
    currentVersion: root.currentVersion,
    sessions: root.sessions.map(session => ({
      directory: session.directory,
      id: session.id,
      cwd: session.cwd,
      selectedVersion: session.selectedVersion,
      generations: session.generations.map(generation => ({
        path: generation.path,
        currentPath: generation.currentPath,
        storedVersion: generation.storedVersion,
        selected: generation.selected,
        header: generation.header,
        eventCount: generation.eventCount,
        inheritedEventCount: generation.inheritedEventCount,
        bytes: generation.bytes,
        sha256: generation.sha256,
      })),
    })),
    files: root.files,
  }
}

/**
 * Audit every project/session/generation in a copied or maintenance root.
 * No recovery or truncation is allowed: torn, unknown, unsupported, or
 * structurally unexpected data rejects the complete audit.
 */
export async function auditSessionRoot(options: SessionRootAuditOptions): Promise<SessionRootAudit> {
  const root = resolve(options.root)
  const compression = options.compression
  if (compression !== 'none' && compression !== 'zstd') throw new Error(`unsupported JSONL compression: ${compression}`)
  await assertDirectory(root, 'session root')
  const entries = await readdir(root, { withFileTypes: true })
  const sessions: SessionWork[] = []
  const ids = new Set<string>()

  for (const entry of entries) {
    const path = join(root, entry.name)
    const info = await lstat(path)
    if (info.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${path}`)
    if (entry.name === '.quarantine') {
      if (!info.isDirectory()) throw new Error(`session root quarantine must be a directory: ${path}`)
      const quarantineEntries = await readdir(path)
      if (quarantineEntries.length > 0) {
        throw new Error(`session root quarantine is not empty: ${path}`)
      }
      continue
    }
    if (!info.isDirectory()) throw new Error(`session root contains an unexpected file: ${path}`)
    const projectEntries = await readdir(path, { withFileTypes: true })
    const generationPaths: { path: string; version: number }[] = []
    for (const sessionEntry of projectEntries) {
      const sessionPath = join(path, sessionEntry.name)
      const sessionInfo = await lstat(sessionPath)
      if (sessionInfo.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${sessionPath}`)
      if (!sessionInfo.isDirectory()) {
        throw new Error(`project directory contains an unexpected flat artifact: ${sessionPath}`)
      }
      const sessionFiles = await readdir(sessionPath, { withFileTypes: true })
      const generations: { path: string; version: number }[] = []
      for (const fileEntry of sessionFiles) {
        const filePath = join(sessionPath, fileEntry.name)
        const version = parseGenerationLogFilename(fileEntry.name, compression)
        const oppositeVersion = parseGenerationLogFilename(
          fileEntry.name,
          compression === 'zstd' ? 'none' : 'zstd',
        )
        if (oppositeVersion !== undefined) {
          throw new Error(`session root mixes JSONL compression encodings: ${filePath}`)
        }
        const fileInfo = await lstat(filePath)
        if (fileInfo.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${filePath}`)
        if (fileEntry.name === LEASE_FILENAME) {
          if (!fileInfo.isFile()) throw new Error(`session lock is not a regular file: ${filePath}`)
          continue
        }
        if (version === undefined) {
          throw new Error(`session directory contains an unexpected entry: ${filePath}`)
        }
        if (!fileInfo.isFile()) throw new Error(`session generation is not a regular file: ${filePath}`)
        generations.push({ path: filePath, version })
      }
      if (generations.length === 0) throw new Error(`session directory contains no generation: ${sessionPath}`)
      generations.sort((left, right) => left.version - right.version)
      const session = await auditSession(root, sessionPath, generations, compression)
      if (ids.has(session.id)) throw new Error(`duplicate session id in root: ${JSON.stringify(session.id)}`)
      ids.add(session.id)
      sessions.push(session)
      for (const generation of session.generations) generationPaths.push({ path: generation.path, version: generation.storedVersion })
    }
    // Empty project directories are harmless remnants after a permanent delete.
    void generationPaths
  }

  if (!options.skipOwnershipCheck && options.ownershipManifest !== undefined) {
    validateOwnership(sessions, await readOwnershipManifest(options.ownershipManifest))
  }
  const files = await listRootFiles(root)
  return toPublicAudit({
    root,
    compression,
    currentVersion: sessionFormatCatalog.currentVersion,
    sessions,
    files: publicFiles(root, files),
    filePaths: files.map(file => file.path),
  })
}

async function freshAuditWork(options: SessionRootAuditOptions): Promise<RootWork> {
  const root = resolve(options.root)
  const compression = options.compression
  if (compression !== 'none' && compression !== 'zstd') throw new Error(`unsupported JSONL compression: ${compression}`)
  await assertDirectory(root, 'session root')
  const entries = await readdir(root, { withFileTypes: true })
  const sessions: SessionWork[] = []
  const ids = new Set<string>()
  for (const entry of entries) {
    const project = join(root, entry.name)
    const info = await lstat(project)
    if (info.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${project}`)
    if (entry.name === '.quarantine') {
      if (!info.isDirectory()) throw new Error(`session root quarantine must be a directory: ${project}`)
      if ((await readdir(project)).length > 0) throw new Error(`session root quarantine is not empty: ${project}`)
      continue
    }
    if (!info.isDirectory()) throw new Error(`session root contains an unexpected file: ${project}`)
    for (const sessionEntry of await readdir(project, { withFileTypes: true })) {
      const directory = join(project, sessionEntry.name)
      const sessionInfo = await lstat(directory)
      if (sessionInfo.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${directory}`)
      if (!sessionInfo.isDirectory()) throw new Error(`project directory contains an unexpected flat artifact: ${directory}`)
      const generations: { path: string; version: number }[] = []
      for (const fileEntry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, fileEntry.name)
        const version = parseGenerationLogFilename(fileEntry.name, compression)
        const oppositeVersion = parseGenerationLogFilename(
          fileEntry.name,
          compression === 'zstd' ? 'none' : 'zstd',
        )
        if (oppositeVersion !== undefined) throw new Error(`session root mixes JSONL compression encodings: ${path}`)
        const fileInfo = await lstat(path)
        if (fileInfo.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${path}`)
        if (fileEntry.name === LEASE_FILENAME) {
          if (!fileInfo.isFile()) throw new Error(`session lock is not a regular file: ${path}`)
          continue
        }
        if (version === undefined) throw new Error(`session directory contains an unexpected entry: ${path}`)
        if (!fileInfo.isFile()) throw new Error(`session generation is not a regular file: ${path}`)
        generations.push({ path, version })
      }
      if (generations.length === 0) throw new Error(`session directory contains no generation: ${directory}`)
      generations.sort((left, right) => left.version - right.version)
      const session = await auditSession(root, directory, generations, compression)
      if (ids.has(session.id)) throw new Error(`duplicate session id in root: ${JSON.stringify(session.id)}`)
      ids.add(session.id)
      sessions.push(session)
    }
  }
  if (!options.skipOwnershipCheck && options.ownershipManifest !== undefined) {
    validateOwnership(sessions, await readOwnershipManifest(options.ownershipManifest))
  }
  const files = await listRootFiles(root)
  const publicAudit = toPublicAudit({
    root,
    compression,
    currentVersion: sessionFormatCatalog.currentVersion,
    sessions,
    files: publicFiles(root, files),
    filePaths: files.map(file => file.path),
  })
  return {
    ...publicAudit,
    sessions,
    filePaths: files.map(file => file.path),
  }
}

function assertBackupPathSafe(root: string, backupDir: string): void {
  if (pathInside(root, backupDir) || pathInside(backupDir, root)) {
    throw new Error(`backup directory must be disjoint from the session root: ${backupDir}`)
  }
}

async function ensureEmptyDirectory(path: string): Promise<void> {
  try {
    const info = await lstat(path)
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`backup path is not a directory: ${path}`)
    if ((await readdir(path)).length !== 0) throw new Error(`backup directory is not empty: ${path}`)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') {
      await mkdir(path, { recursive: true, mode: 0o700 })
      return
    }
    throw error
  }
}

async function verifyBackupFiles(
  root: string,
  expected: readonly SessionRootFileManifest[],
): Promise<void> {
  const actual = await listRootFiles(root)
  const byPath = new Map(actual.map(file => [relativeFilePath(root, file.path), file]))
  const expectedPaths = new Set(expected.map(file => file.path))
  if (byPath.size !== expectedPaths.size || [...byPath.keys()].some(path => !expectedPaths.has(path))) {
    throw new Error(`backup file inventory differs from its manifest: ${root}`)
  }
  for (const file of expected) {
    const actualFile = byPath.get(file.path)
    if (actualFile === undefined || actualFile.bytes !== file.bytes || actualFile.sha256 !== file.sha256) {
      throw new Error(`backup file bytes differ from its manifest: ${file.path}`)
    }
  }
}

async function createBackup(
  root: RootWork,
  backupDir: string,
  postgresUri: string | undefined,
  skipPostgresBackup: boolean,
): Promise<{ backupDir: string; postgresDump: string | null }> {
  const target = resolve(backupDir)
  assertBackupPathSafe(root.root, target)
  await ensureEmptyDirectory(target)
  const sessionsTarget = join(target, 'sessions')
  await cp(root.root, sessionsTarget, {
    recursive: true,
    force: false,
    errorOnExist: true,
    preserveTimestamps: true,
  })
  await verifyBackupFiles(sessionsTarget, root.files)

  let postgresDump: string | null = null
  if (!skipPostgresBackup) {
    if (typeof postgresUri !== 'string' || postgresUri.trim() === '') {
      throw new Error('a PostgreSQL URI is required for migration unless --skip-postgres-backup is explicit')
    }
    postgresDump = join(target, 'ownership-settings.dump')
    try {
      await execFileAsync('pg_dump', [
        '--format=custom',
        '--file',
        postgresDump,
        postgresUri,
      ], { maxBuffer: 1024 * 1024 })
    } catch (error: unknown) {
      throw new Error('PostgreSQL ownership/settings backup failed; no successor was published', { cause: error })
    }
    await assertRegularFile(postgresDump, 'PostgreSQL backup')
  }

  const manifest: BackupManifest = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    sourceRoot: root.root,
    compression: root.compression,
    currentVersion: root.currentVersion,
    files: root.files,
    postgresDump: postgresDump === null ? null : basename(postgresDump),
  }
  await writeFile(join(target, BACKUP_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx',
  })
  return { backupDir: target, postgresDump }
}

async function loadBackupManifest(backupDir: string): Promise<BackupManifest> {
  const path = join(resolve(backupDir), BACKUP_MANIFEST)
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'))
  } catch (error: unknown) {
    throw new Error(`backup manifest is not readable: ${path}`, { cause: error })
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)
    || (parsed as { schemaVersion?: unknown }).schemaVersion !== 1
    || !Array.isArray((parsed as { files?: unknown }).files)) {
    throw new Error(`backup manifest is malformed: ${path}`)
  }
  return parsed as BackupManifest
}

/**
 * Back up the exact session root and PostgreSQL ownership/settings data, then
 * publish only verified v3 successors. A partial interruption is resumable:
 * historical generations remain intact and an existing target is accepted
 * only when its bytes verify exactly.
 */
export async function migrateSessionRoot(
  options: SessionRootMigrationOptions,
): Promise<SessionRootMigrationResult> {
  if (!options.skipOwnershipCheck && options.ownershipManifest === undefined) {
    throw new Error('an ownership manifest is required for migration unless --skip-ownership-check is explicit')
  }
  const beforeWork = await freshAuditWork(options)
  const backup = await createBackup(
    beforeWork,
    options.backupDir,
    options.postgresUri,
    options.skipPostgresBackup === true,
  )
  for (const session of beforeWork.sessions) {
    for (const generation of session.generations) {
      if (!generation.selected || generation.storedVersion >= beforeWork.currentVersion) continue
      if (generation.prepared === undefined) throw new Error(`historical session was not prepared: ${generation.path}`)
      await assertUnchanged(generation.path, generation.identity, generation.sha256)
      try {
        await generation.prepared.publish()
      } catch (error: unknown) {
        throw new Error(`could not publish verified successor for ${session.id}`, { cause: error })
      }
      await verifyJsonlCurrentGeneration(
        generation.currentPath,
        beforeWork.compression,
        session.id,
        generation.eventCount,
      )
      await assertUnchanged(generation.path, generation.identity, generation.sha256)
    }
  }
  const afterWork = await freshAuditWork(options)
  const publishedSessionIds = beforeWork.sessions
    .filter(session => session.selectedVersion < beforeWork.currentVersion)
    .map(session => session.id)
  await writeFile(join(backup.backupDir, MIGRATION_MANIFEST), `${JSON.stringify({
    schemaVersion: 1,
    completedAt: new Date().toISOString(),
    publishedSessionIds,
    before: toPublicAudit(beforeWork),
    after: toPublicAudit(afterWork),
  }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  return {
    backupDir: backup.backupDir,
    postgresDump: backup.postgresDump,
    publishedSessionIds,
    before: toPublicAudit(beforeWork),
    after: toPublicAudit(afterWork),
  }
}

/** Restore a verified backup, retaining the current root as a timestamped rollback sibling. */
export async function rollbackSessionRoot(options: {
  readonly root: string
  readonly backupDir: string
  readonly yes: boolean
}): Promise<SessionRootRollbackResult> {
  if (!options.yes) throw new Error('rollback is destructive to the current root; pass --yes to confirm')
  const root = resolve(options.root)
  const backupDir = resolve(options.backupDir)
  assertBackupPathSafe(root, backupDir)
  const manifest = await loadBackupManifest(backupDir)
  const sessionsBackup = join(backupDir, 'sessions')
  await assertDirectory(sessionsBackup, 'backup session root')
  await verifyBackupFiles(sessionsBackup, manifest.files)
  await assertDirectory(root, 'current session root')
  const displaced = `${root}.rollback-${Date.now()}-${randomBytes(4).toString('hex')}`
  await rename(root, displaced)
  try {
    await cp(sessionsBackup, root, {
      recursive: true,
      force: false,
      errorOnExist: true,
      preserveTimestamps: true,
    })
    await verifyBackupFiles(root, manifest.files)
  } catch (error: unknown) {
    try {
      await rm(root, { recursive: true, force: true })
      await rename(displaced, root)
    } catch (restoreError: unknown) {
      throw new AggregateError([asError(error), asError(restoreError)], 'rollback failed and current root could not be restored')
    }
    throw new Error('rollback failed; current root was restored', { cause: error })
  }
  return { restoredFrom: sessionsBackup, displacedCurrentRoot: displaced }
}

/** Names used by the CLI and tests without exposing private file names. */
export const sessionMigrationFiles = Object.freeze({
  backupManifest: BACKUP_MANIFEST,
  migrationManifest: MIGRATION_MANIFEST,
})
