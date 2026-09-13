import type {
  SocAuth,
  SocPrincipal,
} from 'dsh-soc-agent-connection'

/** Stable authenticated identities shared by SOC Host package tests. */
export const testUserPrincipal = {
  kind: 'user',
  applicationSessionId: 'application-session-test',
  userId: 'user-test',
  zimbraEmail: 'analyst@example.test',
} as const satisfies SocPrincipal

export const testAdminPrincipal = {
  kind: 'admin',
  adminSessionId: 'admin-session-test',
  email: 'admin@example.test',
} as const satisfies SocPrincipal

/**
 * Extra ownership operations implemented by the production SOC authentication
 * service and consumed structurally by domain controllers.
 */
export interface TestSocAuth extends SocAuth {
  ownsSession(sessionId: string): Promise<boolean>
  ownsWorkspace(workspaceId: string): Promise<boolean>
  ownedSessionIds(): Promise<ReadonlySet<string>>
  ownedWorkspaceIds(): Promise<ReadonlySet<string>>
  workspaceForSession(sessionId: string): Promise<string | undefined>
  workspacePathForSession(sessionId: string): Promise<string | undefined>
  claimSession(sessionId: string, workspaceId: string): Promise<boolean>
  releaseSession(sessionId: string): Promise<void>
  claimWorkspace(workspaceId: string, path: string): Promise<boolean>
  releaseWorkspace(workspaceId: string): Promise<void>
}

export interface TestSocAuthOptions {
  readonly principal?: SocPrincipal
  readonly ownedSessionIds?: readonly string[]
  readonly ownedWorkspaceIds?: readonly string[]
  readonly workspaceId?: string
  readonly workspacePath?: string
}

/** Authenticated, ownership-aware SOC boundary fixture. */
export function createTestSocAuth(options: TestSocAuthOptions = {}): TestSocAuth {
  const principal = options.principal ?? testUserPrincipal
  const sessions = new Set(options.ownedSessionIds ?? ['session-1', 'session-root'])
  const workspaces = new Set(options.ownedWorkspaceIds ?? ['workspace-1'])
  const revocation = new AbortController()

  const requireUser = (): Extract<SocPrincipal, { readonly kind: 'user' }> => {
    if (principal.kind !== 'user') throw new Error('authentication required')
    return principal
  }
  const requireAdmin = (): Extract<SocPrincipal, { readonly kind: 'admin' }> => {
    if (principal.kind !== 'admin') throw new Error('admin authentication required')
    return principal
  }

  return {
    authenticateHttp: async () => principal,
    authenticateUpgrade: async () => principal,
    run: (_captured, operation) => operation(),
    requireUser,
    requireAdmin,
    revocationSignal: () => revocation.signal,
    ownsSession: async sessionId => sessions.has(String(sessionId)),
    ownsWorkspace: async workspaceId => workspaces.has(String(workspaceId)),
    ownedSessionIds: async () => new Set(sessions),
    ownedWorkspaceIds: async () => new Set(workspaces),
    workspaceForSession: async sessionId => sessions.has(String(sessionId))
      ? (options.workspaceId ?? 'workspace-1')
      : undefined,
    workspacePathForSession: async sessionId => sessions.has(String(sessionId))
      ? options.workspacePath
      : undefined,
    claimSession: async sessionId => { sessions.add(String(sessionId)); return true },
    releaseSession: async sessionId => { sessions.delete(String(sessionId)) },
    claimWorkspace: async workspaceId => { workspaces.add(String(workspaceId)); return true },
    releaseWorkspace: async workspaceId => { workspaces.delete(String(workspaceId)) },
  }
}
