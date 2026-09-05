import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import {
  SocAuthService,
  SocStateStore,
  currentMcpRequestSession,
  withMcpRequestSession,
} from './ownership.js'

const require = createRequire(import.meta.url)
// The MCP bridge resolves its SDK from its own package directory. Resolve the
// same ESM module here; importing the app's dependency would patch a distinct
// pnpm-installed Client prototype and leave the bridge calls unscoped.
const mcpClientEntry = require.resolve('@deepseek-ai/dsh-mcp-client')
const mcpSdkCjsEntry = createRequire(mcpClientEntry).resolve('@modelcontextprotocol/sdk/client/index.js')
const mcpSdkEsmEntry = mcpSdkCjsEntry.replace(/[/\\]dist[/\\]cjs[/\\]/u, match => `${match.slice(0, -4)}esm${match.slice(-1)}`)
const { Client } = await import(pathToFileURL(mcpSdkEsmEntry).href)

export const name = 'soc-agent-auth-host'
export const inject = ['webServer', 'apiProxy', 'tools', 'agents', 'sessions']

function installMcpSessionMetadata() {
  const prototype = Client.prototype
  const marker = Symbol.for('citic.soc-agent.mcp-request-patch')
  const existing = prototype[marker]
  if (existing) {
    existing.references += 1
    return () => {
      existing.references -= 1
      if (existing.references > 0) return
      if (prototype.request === existing.wrapped) prototype.request = existing.original
      if (prototype[marker] === existing) delete prototype[marker]
    }
  }
  const original = prototype.request
  if (typeof original !== 'function') throw new Error('MCP client request API unavailable')
  const wrapped = function (request, resultSchema, options) {
    if (request?.method !== 'tools/call') {
      return original.call(this, request, resultSchema, options)
    }
    // Correlation IDs travel on every tool call so host, bridge, and Python
    // logs can be joined per operation; the session id stays host-resolved.
    const correlationId = randomUUID()
    const sessionId = currentMcpRequestSession()
    if (!sessionId) {
      return original.call(this, request, resultSchema, options)
    }
    const params = request.params && typeof request.params === 'object' ? request.params : {}
    return original.call(this, {
      ...request,
      params: {
        ...params,
        _meta: { ...(params._meta ?? {}), soc_session_id: sessionId, soc_correlation_id: correlationId },
      },
    }, resultSchema, options)
  }
  const state = { original, wrapped, references: 1 }
  Object.defineProperty(prototype, marker, { value: state, configurable: true })
  prototype.request = wrapped
  return () => {
    state.references -= 1
    if (state.references > 0) return
    if (prototype.request === wrapped) prototype.request = original
    if (prototype[marker] === state) delete prototype[marker]
  }
}

export function apply(ctx) {
  const testCredentials = (() => {
    try { return ctx.get?.('socAdminCredentials') } catch { return undefined }
  })()
  const auth = new SocAuthService(ctx, new SocStateStore(), {
    ...(testCredentials ? { adminCredentials: testCredentials } : {}),
  })
  const disposeTransport = auth.installTransport(ctx.webServer, ctx.apiProxy)
  const disposeMcpMetadata = installMcpSessionMetadata()
  ctx.effect(() => () => {
    disposeMcpMetadata()
    disposeTransport()
  }, 'soc-agent-auth: Harness transport integration')
  ctx.on('tools/execute', async (exec, next) => {
    const metadata = auth.mcpRequestMeta(exec)
    const sessionId = metadata?.soc_session_id
    if (!sessionId) return await next()
    return await withMcpRequestSession(sessionId, next)
  }, { global: true, prepend: true })
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
