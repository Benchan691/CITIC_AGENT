import { randomUUID } from 'node:crypto'
import { SocAuthService, SocStateStore, closeAuthControlChannel } from './ownership.js'

export const name = 'soc-agent-auth-host'
export const inject = ['webServer', 'apiProxy', 'tools', 'agents', 'sessions']

export function apply(ctx) {
  const testCredentials = (() => {
    try { return ctx.get?.('socAdminCredentials') } catch { return undefined }
  })()
  const auth = new SocAuthService(ctx, new SocStateStore(), {
    ...(testCredentials ? { adminCredentials: testCredentials } : {}),
  })
  const disposeTransport = auth.installTransport(ctx.webServer, ctx.apiProxy)
  ctx.effect(() => () => {
    disposeTransport()
    void closeAuthControlChannel()
  }, 'soc-agent-auth: Harness transport integration')
  ctx.on('mcp/request-meta', async (exec, serverName, next) => {
    const upstream = await next()
    if (serverName !== 'soc_agent') return upstream
    const metadata = auth.mcpRequestMeta(exec)
    if (!metadata?.soc_session_id) return upstream
    const tenant = ctx.get('socMemoryContext')?.get(exec.agent)
    return {
      ...upstream,
      ...metadata,
      soc_investigation_id: String(exec.agent?.session?.id ?? exec.agent?.id ?? ''),
      soc_customer_id: tenant?.customerId ?? '',
      soc_correlation_id: randomUUID(),
      soc_deadline_ms: Date.now() + 180_000,
    }
  }, { global: true })
  ctx.provide('socAuth', auth)
  ctx.provide('connectionAuthorization', {
    authorizePrivilegedRequest: () => auth.authorizePrivilegedRequest(),
  })
  ctx.inject(['workspaceRegistry', 'sessionPersistence'], workspaceCtx => {
    auth.attachWorkspaceServices(workspaceCtx)
  })
  ctx.effect(() => {
    const disposers = auth.registerRoutes(ctx.webServer)
    return () => disposers.forEach(dispose => dispose())
  }, 'soc-agent-auth: HTTP routes')
  ctx.effect(() => () => { void auth.store.close() }, 'soc-agent-auth: PostgreSQL pool')
}
