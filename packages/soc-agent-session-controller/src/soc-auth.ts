import type { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'

export interface SocUserPrincipal {
  readonly kind: 'user'
  readonly applicationSessionId: string
  readonly userId: string
  readonly zimbraEmail: string
}

/** Structural authorization seam supplied by the SOC application host. */
export interface SocSessionAuth {
  requireUser(): SocUserPrincipal
  ownedSessionIds(): Promise<ReadonlySet<string>>
  ownsSession(sessionId: SessionId | string): Promise<boolean>
  workspaceForSession(sessionId: SessionId | string): Promise<string | undefined>
  ownsWorkspace(workspaceId: WorkspaceId | string): Promise<boolean>
  claimSession(sessionId: SessionId | string, workspaceId: WorkspaceId | string): Promise<boolean>
  releaseSession(sessionId: SessionId | string): Promise<void>
  ensureGeneral(userId: string): Promise<{ workspaceId: string; title: string }>
  bindAgentSession(sessionId: SessionId | string, applicationSessionId?: string): void
  unbindAgentSession(sessionId: SessionId | string): void
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    socAuth: SocSessionAuth
  }
}
