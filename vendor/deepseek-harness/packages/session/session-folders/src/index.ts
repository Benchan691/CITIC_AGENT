import { randomUUID } from 'node:crypto'
import { Context, Service } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import { FolderId, type FolderId as FolderIdType, type SessionHeader, type SessionId } from '@deepseek-ai/dsh-session'
import type { SessionFolderRecord } from '@deepseek-ai/dsh-session-persistence'

declare module '@deepseek-ai/cordis' {
  interface Context {
    sessionFolders: SessionFolderStore
  }
}

export interface FolderView extends SessionFolderRecord {
  sessionIds: SessionId[]
}

export class FolderNotFoundError extends Error {
  constructor(readonly folderId: FolderIdType) {
    super(`folder '${folderId}' not found`)
    this.name = 'FolderNotFoundError'
  }
}

export class FolderInvalidNameError extends Error {
  constructor(readonly folderName: string) {
    super('folder name must not be empty')
    this.name = 'FolderInvalidNameError'
  }
}

export class FolderNameConflictError extends Error {
  constructor(readonly folderName: string) {
    super(`folder '${folderName}' already exists`)
    this.name = 'FolderNameConflictError'
  }
}

export class SessionFolderStore extends Service {
  static inject = ['sessionPersistence', 'sessions']

  private readonly folders = new Map<FolderIdType, SessionFolderRecord>()
  private readonly sessionFolders = new Map<SessionId, FolderIdType>()
  private ready = false

  constructor(ctx: Context) {
    super(ctx, 'sessionFolders')
  }

  protected async [Service.init](): Promise<void> {
    const persistedFolders = await this.ctx.sessionPersistence.listFolders()
    for (const folder of persistedFolders) this.folders.set(folder.id, { ...folder })
    if (this.folders.size === 0) {
      const now = Date.now()
      const general: SessionFolderRecord = {
        id: FolderId(randomUUID()),
        name: 'General',
        createdAt: now,
        updatedAt: now,
      }
      await this.ctx.sessionPersistence.createFolder(general)
      this.folders.set(general.id, general)
    }
    await this.migrateExistingSessions()
    this.ready = true
  }

  async createFolder(name: string, description?: string): Promise<FolderView> {
    await this.waitReady()
    const normalized = name.trim()
    if (normalized.length === 0) throw new FolderInvalidNameError(name)
    if ([...this.folders.values()].some(folder => folder.name === normalized)) {
      throw new FolderNameConflictError(normalized)
    }
    const now = Date.now()
    const record: SessionFolderRecord = {
      id: FolderId(randomUUID()),
      name: normalized,
      ...description === undefined ? {} : { description },
      createdAt: now,
      updatedAt: now,
    }
    await this.ctx.sessionPersistence.createFolder(record)
    this.folders.set(record.id, record)
    return this.view(record.id)
  }

  async listFolders(): Promise<FolderView[]> {
    await this.waitReady()
    return [...this.folders.values()].map(folder => this.view(folder.id))
  }

  async getFolder(folderId: FolderIdType): Promise<FolderView | undefined> {
    await this.waitReady()
    return this.folders.has(folderId) ? this.view(folderId) : undefined
  }

  async renameFolder(folderId: FolderIdType, name: string, description?: string): Promise<FolderView> {
    await this.waitReady()
    const folder = this.require(folderId)
    const normalized = name.trim()
    if (normalized.length === 0) throw new FolderInvalidNameError(name)
    if ([...this.folders.values()].some(candidate => candidate.id !== folderId && candidate.name === normalized)) {
      throw new FolderNameConflictError(normalized)
    }
    await this.ctx.sessionPersistence.renameFolder(folderId, normalized, description)
    const updated = { ...folder, name: normalized, updatedAt: Date.now(), ...description === undefined ? {} : { description } }
    this.folders.set(folderId, updated)
    return this.view(folderId)
  }

  async deleteFolder(folderId: FolderIdType): Promise<number> {
    await this.waitReady()
    this.require(folderId)
    const ids = await this.listSessionsByFolder(folderId)
    let deleted = 0
    const failures: unknown[] = []
    for (const session of ids) {
      try {
        if (await this.deleteSession(session)) deleted++
      } catch (error: unknown) {
        failures.push(error)
      }
    }
    if (failures.length > 0) {
      throw new Error(`folder '${folderId}' cleanup failed after deleting ${deleted} of ${ids.length} sessions`, {
        cause: new AggregateError(failures, 'one or more folder session deletions failed'),
      })
    }
    await this.ctx.sessionPersistence.deleteFolder(folderId)
    this.folders.delete(folderId)
    for (const [sessionId, owner] of this.sessionFolders) {
      if (owner === folderId) this.sessionFolders.delete(sessionId)
    }
    return deleted
  }

  async moveSessionToFolder(sessionId: SessionId, folderId: FolderIdType): Promise<void> {
    await this.waitReady()
    this.require(folderId)
    if (!(await this.knownSession(sessionId))) throw new Error(`session '${sessionId}' not found`)
    await this.ctx.sessionPersistence.setSessionFolder(sessionId, folderId)
    this.sessionFolders.set(sessionId, folderId)
  }

  async listSessionsByFolder(folderId: FolderIdType): Promise<SessionId[]> {
    await this.waitReady()
    this.require(folderId)
    const sessions = await this.sessionHeaders()
    return sessions.filter(header => this.ownerOf(header) === folderId).map(header => header.id)
  }

  /** Return the logical owner cached for a session, when it has one. */
  folderIdForSession(sessionId: SessionId): FolderIdType | undefined {
    const live = this.ctx.sessions.get(sessionId)
    return live === undefined ? this.sessionFolders.get(sessionId) : this.ownerOf(live.header)
  }

  async deleteSession(sessionId: SessionId): Promise<boolean> {
    const live = this.ctx.sessions.get(sessionId)
    let deleted = false
    if (live !== undefined) {
      const agent = this.ctx.get('agents')?.get(sessionId)
      if (agent !== undefined) await agent.ctx.fiber.dispose()
      const remaining = this.ctx.sessions.get(sessionId)
      if (remaining !== undefined) {
        await this.ctx.sessions.flush(remaining)
        deleted = this.ctx.sessions.deleteSession(sessionId) || deleted
      } else {
        deleted = true
      }
    }
    deleted = await this.ctx.sessionPersistence.deleteSession(sessionId) || deleted
    this.sessionFolders.delete(sessionId)
    return deleted
  }

  private async migrateExistingSessions(): Promise<void> {
    const general = [...this.folders.values()].find(folder => folder.name === 'General') ?? [...this.folders.values()][0]
    if (general === undefined) throw new Error('folder migration has no default folder')
    for (const header of await this.sessionHeaders()) {
      const folderId = header.folderId ?? general.id
      if (!this.folders.has(folderId)) {
        await this.ctx.sessionPersistence.setSessionFolder(header.id, general.id)
        this.sessionFolders.set(header.id, general.id)
      } else {
        this.sessionFolders.set(header.id, folderId)
        if (header.folderId === undefined) await this.ctx.sessionPersistence.setSessionFolder(header.id, folderId)
      }
    }
  }

  private async sessionHeaders(): Promise<SessionHeader[]> {
    const byId = new Map<SessionId, SessionHeader>()
    for (const header of await this.ctx.sessionPersistence.list()) byId.set(header.id, header)
    for (const session of this.ctx.sessions.list()) byId.set(session.id, session.header)
    return [...byId.values()]
  }

  private ownerOf(header: SessionHeader): FolderIdType | undefined {
    return this.sessionFolders.get(header.id) ?? header.folderId
  }

  private async knownSession(id: SessionId): Promise<boolean> {
    return (await this.sessionHeaders()).some(header => header.id === id)
  }

  private view(folderId: FolderIdType): FolderView {
    const folder = this.require(folderId)
    const sessionIds = [...this.sessionFolders].filter(([, owner]) => owner === folderId).map(([id]) => id)
    return { ...folder, sessionIds }
  }

  private require(folderId: FolderIdType): SessionFolderRecord {
    const folder = this.folders.get(folderId)
    if (folder === undefined) throw new FolderNotFoundError(folderId)
    return folder
  }

  private waitReady(): Promise<void> {
    return this.ready
      ? Promise.resolve()
      : Promise.reject(new Error('session folder store is not started yet'))
  }
}

export { FolderId }
export type { FolderIdType }
export default SessionFolderStore
