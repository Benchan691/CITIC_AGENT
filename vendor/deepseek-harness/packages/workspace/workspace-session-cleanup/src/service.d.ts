import { Context, Service } from '@deepseek-ai/cordis'
import type { SessionId, SessionStore } from '@deepseek-ai/dsh-session'
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
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
export declare class WorkspaceSessionCleanupError extends Error {
  readonly details: {
    normalizedWorkspacePath?: string
    deletedSessionCount?: number
    failedSessionIds?: readonly SessionId[]
  }
  constructor(message: string, details?: {
    normalizedWorkspacePath?: string
    deletedSessionCount?: number
    failedSessionIds?: readonly SessionId[]
  }, options?: ErrorOptions)
}
export declare class WorkspaceSessionCleanupService extends Service {
  static inject: string[]
  constructor(ctx: Context)
  previewWorkspaceSessionCleanup(workspacePath: string): Promise<WorkspaceSessionCleanupPreview>
  deleteWorkspaceSessions(workspacePath: string): Promise<number>
  private findCandidates
  private deleteSession
}
export type WorkspaceSessionCleanup = Pick<WorkspaceSessionCleanupService, 'previewWorkspaceSessionCleanup' | 'deleteWorkspaceSessions'>
export type WorkspaceSessionCleanupDependencies = {
  readonly persistence: SessionPersistence
  readonly sessions: SessionStore
}
//# sourceMappingURL=service.d.ts.map
