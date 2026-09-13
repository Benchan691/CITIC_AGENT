/** In-memory authenticated boundary used only by the browser composition test. */
export function apply(ctx) {
  const principal = {
    kind: 'user',
    applicationSessionId: 'browser-fixture-application',
    userId: 'browser-fixture-user',
    zimbraEmail: 'analyst@example.com',
  }
  const signal = new AbortController().signal
  const ownedSessions = new Set(['fixture-active', 'fixture-history', 'fixture-project'])
  const ownedWorkspaces = new Set(['fixture', 'project'])
  const auth = {
    authenticateHttp: async () => principal,
    authenticateUpgrade: async () => principal,
    run: (_captured, operation) => operation(),
    requireUser: () => principal,
    requireAdmin: () => { throw new Error('admin authentication required') },
    revocationSignal: () => signal,
    ownedSessionIds: async () => new Set(ownedSessions),
    ownedWorkspaceIds: async () => new Set(ownedWorkspaces),
    ownsSession: async sessionId => ownedSessions.has(String(sessionId)),
    ownsWorkspace: async workspaceId => ownedWorkspaces.has(String(workspaceId)),
    workspaceForSession: async () => 'fixture',
    workspacePathForSession: async () => undefined,
    claimSession: async sessionId => { ownedSessions.add(String(sessionId)); return true },
    releaseSession: async sessionId => { ownedSessions.delete(String(sessionId)) },
    claimWorkspace: async workspaceId => { ownedWorkspaces.add(String(workspaceId)); return true },
    releaseWorkspace: async workspaceId => { ownedWorkspaces.delete(String(workspaceId)) },
    ensureGeneral: async () => ({ workspaceId: 'fixture', path: '/fixture' }),
    isGeneralWorkspace: async workspaceId => String(workspaceId) === 'fixture',
    bindAgentSession: () => {},
    unbindAgentSession: () => {},
    principalForAgent: () => principal,
    principalForHarnessSession: () => principal,
    hasRememberedToolApproval: () => false,
    rememberToolApproval: () => true,
  }
  ctx.provide('socAuth', auth)
}
