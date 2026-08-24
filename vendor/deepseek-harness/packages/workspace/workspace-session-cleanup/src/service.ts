import { Context, Service } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Session, SessionHeader, SessionId, SessionStore } from '@deepseek-ai/dsh-session'
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import { realpath } from 'node:fs/promises'
import { isAbsolute, normalize, resolve } from 'node:path'

declare module '@deepseek-ai/cordis' {
  interface Context {
    workspaceSessionCleanup: WorkspaceSessionCleanupService
  }
}

export interface WorkspaceSessionSummary {
  sessionId: SessionId
  createdAt: number
  cwd: string
}

export interface WorkspaceSessionCleanupPreview {
  normalizedWorkspacePath: string
  matchingSessionCount: number
  matchingSessionIds: SessionId[]
  matchingSessions: WorkspaceSessionSummary[]
}

export class WorkspaceSessionCleanupError extends Error {
  constructor(
    message: string,
    readonly details: {
      normalizedWorkspacePath?: string
      deletedSessionCount?: number
      failedSessionIds?: readonly SessionId[]
    } = {},
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'WorkspaceSessionCleanupError'
  }
}

interface SessionCandidate {
  readonly header: SessionHeader
  readonly durable: boolean
}

function isMissingPath(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

async function canonicalWorkspacePath(input: string): Promise<string> {
  if (typeof input !== 'string' || input.length === 0 || input.trim().length === 0) {
    throw new WorkspaceSessionCleanupError('workspace path must be a non-empty string')
  }
  const absolute = resolve(input)
  try {
    return await realpath(absolute)
  } catch (error: unknown) {
    throw new WorkspaceSessionCleanupError(
      `cannot canonicalize workspace path '${input}': ${String(error)}`,
      {},
      { cause: error },
    )
  }
}

async function canonicalSessionPath(input: string): Promise<string | undefined> {
  if (typeof input !== 'string' || input.length === 0 || !isAbsolute(input)) return undefined
  const absolute = resolve(input)
  try {
    return await realpath(absolute)
  } catch (error: unknown) {
    if (!isMissingPath(error)) throw error
    // Historical headers may point at a directory that no longer exists. Keep
    // matching useful for syntactically equivalent paths without treating a
    // failed realpath as permission to follow a different symlink.
    return normalize(absolute)
  }
}

function sessionHeader(session: Session): SessionHeader {
  return session.header
}

export class WorkspaceSessionCleanupService extends Service {
  static inject = ['sessionPersistence', 'sessions']

  constructor(ctx: Context) {
    super(ctx, 'workspaceSessionCleanup')
  }

  async previewWorkspaceSessionCleanup(workspacePath: string): Promise<WorkspaceSessionCleanupPreview> {
    const normalizedWorkspacePath = await canonicalWorkspacePath(workspacePath)
    const candidates = await this.findCandidates(normalizedWorkspacePath)
    const matchingSessions = candidates.map(({ header }) => ({
      sessionId: header.id,
      createdAt: header.createdAt,
      cwd: header.cwd as string,
    }))
    return {
      normalizedWorkspacePath,
      matchingSessionCount: matchingSessions.length,
      matchingSessionIds: matchingSessions.map(session => session.sessionId),
      matchingSessions,
    }
  }

  async deleteWorkspaceSessions(workspacePath: string): Promise<number> {
    const normalizedWorkspacePath = await canonicalWorkspacePath(workspacePath)
    const candidates = await this.findCandidates(normalizedWorkspacePath)
    let deletedSessionCount = 0
    const failedSessionIds: SessionId[] = []
    const failures: unknown[] = []

    for (const candidate of candidates) {
      try {
        if (await this.deleteSession(candidate.header.id, candidate.durable)) deletedSessionCount += 1
      } catch (error: unknown) {
        failedSessionIds.push(candidate.header.id)
        failures.push(error)
      }
    }

    if (failures.length > 0) {
      throw new WorkspaceSessionCleanupError(
        `workspace session cleanup deleted ${deletedSessionCount} of ${candidates.length} sessions`,
        { normalizedWorkspacePath, deletedSessionCount, failedSessionIds },
        { cause: new AggregateError(failures, 'one or more session deletions failed') },
      )
    }
    return deletedSessionCount
  }

  private async findCandidates(normalizedWorkspacePath: string): Promise<SessionCandidate[]> {
    let persisted: SessionHeader[]
    let live: Session[]
    try {
      ;[persisted, live] = await Promise.all([
        this.ctx.sessionPersistence.list(),
        Promise.resolve(this.ctx.sessions.list()),
      ])
    } catch (error: unknown) {
      throw new WorkspaceSessionCleanupError(
        `cannot list Harness sessions for workspace cleanup: ${String(error)}`,
        { normalizedWorkspacePath },
        { cause: error },
      )
    }

    const byId = new Map<SessionId, SessionCandidate>()
    for (const header of persisted) byId.set(header.id, { header, durable: true })
    for (const session of live) byId.set(session.id, { header: sessionHeader(session), durable: byId.get(session.id)?.durable ?? false })

    const matching: SessionCandidate[] = []
    for (const candidate of byId.values()) {
      if (candidate.header.cwd === undefined) continue
      const normalizedCwd = await canonicalSessionPath(candidate.header.cwd)
      if (normalizedCwd === normalizedWorkspacePath) matching.push(candidate)
    }
    return matching
  }

  private async deleteSession(sessionId: SessionId, durable: boolean): Promise<boolean> {
    let deleted = false
    const live = this.ctx.sessions.get(sessionId)
    if (live !== undefined) {
      const agent = this.ctx.get('agents')?.get(sessionId) as Agent | undefined
      if (agent !== undefined) await agent.ctx.fiber.dispose()
      const remaining = this.ctx.sessions.get(sessionId)
      if (remaining !== undefined) {
        await this.ctx.sessions.flush(remaining)
        deleted = this.ctx.sessions.deleteSession(sessionId) || deleted
      } else {
        deleted = true
      }
    }
    if (durable) deleted = (await this.ctx.sessionPersistence.deleteSession(sessionId)) || deleted
    return deleted
  }
}

export type WorkspaceSessionCleanup = Pick<
  WorkspaceSessionCleanupService,
  'previewWorkspaceSessionCleanup' | 'deleteWorkspaceSessions'
>

// Keep the service's dependency types visible to TypeScript without creating a
// runtime dependency edge from this package to the concrete store classes.
export type WorkspaceSessionCleanupDependencies = {
  readonly persistence: SessionPersistence
  readonly sessions: SessionStore
}
