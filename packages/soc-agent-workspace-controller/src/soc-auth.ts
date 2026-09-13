import type { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'

export interface SocWorkspaceAuth {
  requireUser(): {
    readonly kind: 'user'
    readonly applicationSessionId: string
    readonly userId: string
    readonly zimbraEmail: string
  }
  ownedSessionIds(): Promise<ReadonlySet<string>>
  ownedWorkspaceIds(): Promise<ReadonlySet<string>>
  ownsSession(sessionId: SessionId | string): Promise<boolean>
  ownsWorkspace(workspaceId: WorkspaceId | string): Promise<boolean>
  isGeneralWorkspace(workspaceId: WorkspaceId | string): Promise<boolean>
  privateWorkspacePath(name: string): Promise<string>
  claimWorkspace(workspaceId: WorkspaceId | string, path: string): Promise<boolean>
  releaseWorkspace(workspaceId: WorkspaceId | string): Promise<void>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    socAuth: SocWorkspaceAuth
  }
}
