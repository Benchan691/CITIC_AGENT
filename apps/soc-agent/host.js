import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACTION_CATALOG, ACTION_TOOLS, APPROVAL_TOOLS, DOMAIN_TOOLS, MEMORY_READ_TOOLS, MEMORY_WRITE_TOOLS, READ_ONLY_TOOLS } from './policy.js'
import {
  MEMORY_SOURCE_TYPES,
  MEMORY_TYPES,
  assertModelCannotSelectTenant,
  createMemoryContextRegistry,
  isMemoryTypeAllowed,
  normalizeMemoryScopeType,
  scopeKeyForTenant,
} from '../../packages/soc-memory/lib/tenant.js'
import { detectSecrets, normalizeTags, validateContent } from '../../packages/soc-memory/lib/store.js'
import { runAuthCommand } from './ownership.js'

export const name = 'soc-agent-host'
export const inject = ['agents', 'connection', 'tools', 'socAuth', 'sessions', 'settings']

const CHANNEL = '/soc-agent-config'
const ACTION_POLICY_NAMESPACE = 'soc-action-approval'
const CONTROL_TOOLS = new Set(['exit_plan_mode', 'ask_user_question'])
const HARD_ATTACHMENT_BYTES = 100_000_000
const HARD_MARKDOWN_CHARS = 2_000_000

export { ACTION_CATALOG, ACTION_TOOLS, APPROVAL_TOOLS, CONTROL_TOOLS, DOMAIN_TOOLS, MEMORY_READ_TOOLS, MEMORY_WRITE_TOOLS, READ_ONLY_TOOLS }

const ACTION_NAMES = new Set(ACTION_TOOLS)

class ActionPolicyError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ActionPolicyError'
    this.code = code
  }
}

function sessionIdOf(agent) {
  const id = agent?.session?.id ?? agent?.id
  return id === undefined || id === null ? undefined : String(id)
}

function rootsOf(ctx) {
  try {
    return typeof ctx.agents?.roots === 'function' ? ctx.agents.roots() : []
  } catch {
    return []
  }
}

function sessionStoreOf(ctx) {
  try {
    return ctx.sessions ?? ctx.get?.('sessions')
  } catch {
    return undefined
  }
}

function settingsOf(ctx) {
  try {
    return ctx.get?.('settings') ?? ctx.settings
  } catch {
    return undefined
  }
}

function actionSet(value, { strict = false } = {}) {
  if (!Array.isArray(value) || value.length > ACTION_TOOLS.length) {
    throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC action approval list is invalid.')
  }
  const result = new Set()
  for (const name of value) {
    if (typeof name !== 'string' || name.length === 0 || name.length > 200) {
      throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC action approval list is invalid.')
    }
    if (result.has(name)) {
      throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC action approval list contains duplicate actions.')
    }
    if (!ACTION_NAMES.has(name)) {
      if (strict) throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC action approval list contains an unknown action.')
      continue
    }
    result.add(name)
  }
  return result
}

function savedAutoApproveActions(ctx) {
  try {
    const value = settingsOf(ctx)?.get?.(ACTION_POLICY_NAMESPACE)
    return actionSet(value?.autoApproveActions ?? [])
  } catch {
    // A malformed or unavailable saved setting must never grant an action.
    return new Set()
  }
}

function resolveOwnedSession(ctx, sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 200) {
    throw new ActionPolicyError('soc-action-policy-invalid', 'A valid session is required.')
  }
  const roots = rootsOf(ctx)
  const root = roots.find(agent => sessionIdOf(agent) === sessionId)
  if (root?.session !== undefined) return { agent: root, session: root.session }
  const sessions = sessionStoreOf(ctx)
  const session = sessions?.get?.(sessionId)
  if (session === undefined) throw new ActionPolicyError('soc-action-session-not-found', 'The session is no longer available.')
  const agent = ctx.agents?.get?.(sessionId)
  if (agent !== undefined && !roots.includes(agent)) {
    throw new ActionPolicyError('soc-action-session-not-owned', 'The session is not owned by the interactive SOC agent.')
  }
  return { agent, session }
}

function policyValue(ctx, sessionPolicies, sessionId) {
  const session = sessionPolicies.get(sessionId)
  const actions = session ?? savedAutoApproveActions(ctx)
  return {
    actions: ACTION_CATALOG,
    autoApproveActions: [...actions],
    source: session === undefined ? 'defaults' : 'session',
  }
}

function policyError(error, sessionId) {
  if (error instanceof ActionPolicyError) {
    if (error.code === 'soc-action-session-not-found') {
      return {
        ok: false,
        error: {
          code: 'session-not-found',
          message: error.message,
          details: { sessionId: String(sessionId ?? '') },
        },
      }
    }
    return {
      ok: false,
      error: {
        code: 'bad-request',
        message: error.message,
        details: { issues: [] },
      },
    }
  }
  return internalError('The SOC action policy is unavailable.')
}

function bundleRoot() {
  return dirname(fileURLToPath(import.meta.url))
}

function serverRoot() {
  return process.env.DSH_SOC_AGENT_SERVER || join(bundleRoot(), 'server')
}

function workspaceRoot() {
  return process.env.MCP_SERVER_ROOT || process.env.MCP_SEVER_ROOT || dirname(dirname(bundleRoot()))
}

function ok(value) {
  return { ok: true, value }
}

function badRequest(message) {
  return { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } }
}

function internalError(message) {
  return { ok: false, error: { code: 'internal', message, details: {} } }
}

function adminFailureMessage(command, stderr, exitCode) {
  const lines = String(stderr).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const exception = [...lines].reverse().find(line => /^[\w.$]+(?:Error|Exception):\s*/.test(line))
  const detail = (exception ?? lines.at(-1) ?? `process exited with code ${String(exitCode)}`)
    .replace(/^[\w.$]+(?:Error|Exception):\s*/, '')
  const label = command === 'test-splunk' ? 'Splunk connection test failed' : `Admin operation "${command}" failed`
  return `${label}: ${detail}`
}

function runAdmin(command, arg, payload, signal) {
  return new Promise((resolvePromise, rejectPromise) => {
    const args = ['run', 'python', '-m', 'unified_mcp_server.admin_cli', command]
    if (arg !== undefined && arg !== '') args.push(arg)
    const child = spawn('uv', args, {
      cwd: serverRoot(),
      env: { ...process.env, MCP_SERVER_ROOT: workspaceRoot() },
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const abort = () => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      rejectPromise(new Error('attachment_conversion_cancelled'))
    }
    if (signal?.aborted) {
      abort()
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', error => {
      if (settled) return
      settled = true
      rejectPromise(new Error(adminFailureMessage(command, error.message, -1)))
    })
    child.on('close', code => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', abort)
      if (code !== 0) {
        if (command === 'convert-attachment') {
          try {
            const failure = JSON.parse(stderr.trim())
            if (failure?.code && failure?.message) {
              rejectPromise(new Error(`${failure.code}: ${failure.message}`))
              return
            }
          } catch { /* map malformed converter failures below */ }
          rejectPromise(new Error('attachment_conversion_failed: The attachment conversion failed.'))
          return
        }
        rejectPromise(new Error(adminFailureMessage(command, stderr, code)))
        return
      }
      try {
        resolvePromise(stdout.trim() ? JSON.parse(stdout) : {})
      } catch (error) {
        rejectPromise(error)
      }
    })
    if (payload !== undefined) child.stdin.end(JSON.stringify(payload))
    else child.stdin.end()
  })
}

function validateAttachmentPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('attachment_invalid_request')
  const filename = typeof payload.filename === 'string' ? payload.filename : ''
  const contentType = typeof payload.content_type === 'string' ? payload.content_type : ''
  const data = typeof payload.data === 'string' ? payload.data : ''
  if (!filename || filename.length > 255 || filename.includes('\0') || filename !== filename.split(/[\\/]/u).at(-1)) {
    throw new Error('attachment_invalid_filename')
  }
  if (contentType.length > 255) throw new Error('attachment_invalid_mime')
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(data) || data.length % 4 !== 0) throw new Error('attachment_invalid_request')
  const bytes = Buffer.from(data, 'base64')
  if (bytes.length > HARD_ATTACHMENT_BYTES) throw new Error('attachment_too_large')
  const limits = payload.limits && typeof payload.limits === 'object' ? payload.limits : {}
  const maxBytes = Number(limits.max_bytes ?? 10_000_000)
  const maxChars = Number(limits.max_chars ?? 200_000)
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > HARD_ATTACHMENT_BYTES) throw new Error('attachment_invalid_limits')
  if (!Number.isSafeInteger(maxChars) || maxChars < 1 || maxChars > HARD_MARKDOWN_CHARS) throw new Error('attachment_invalid_limits')
  return { filename, content_type: contentType, data, limits: { max_bytes: maxBytes, max_chars: maxChars } }
}

const MEMORY_TOOLS = new Set([...MEMORY_READ_TOOLS, ...MEMORY_WRITE_TOOLS])

function validateMemoryExecution(exec, memoryContext) {
  const args = exec?.arguments !== null && typeof exec?.arguments === 'object' ? exec.arguments : {}
  assertModelCannotSelectTenant(args)
  const scope = normalizeMemoryScopeType(args.scope, 'customer')
  const tenant = memoryContext?.get(exec?.agent) ?? {}
  const scopeKey = scopeKeyForTenant(scope, tenant)
  if (MEMORY_WRITE_TOOLS.includes(exec.name)) {
    const content = exec.name === 'soc_memory_correct' ? args.correctedContent : args.content
    validateContent(content)
    if (detectSecrets(content).length > 0) throw new Error('memory: content contains prohibited secret-like data')
    const type = args.type === undefined ? undefined : String(args.type).trim().toLowerCase()
    if (type !== undefined && (!MEMORY_TYPES.includes(type) || !isMemoryTypeAllowed(scope, type))) throw new Error('memory: type is not allowed in this scope')
    const sourceType = String(args.sourceType ?? '').trim().toLowerCase()
    if (!MEMORY_SOURCE_TYPES.includes(sourceType)) throw new Error('memory: sourceType is required and invalid')
    if (args.sourceRef !== undefined) {
      const sourceRef = String(args.sourceRef).trim()
      if (!/^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,255}$/u.test(sourceRef) || detectSecrets(sourceRef).length > 0) throw new Error('memory: sourceRef is invalid')
    }
    if (args.confidence !== undefined && (!Number.isFinite(args.confidence) || args.confidence < 0 || args.confidence > 1)) {
      throw new Error('memory: confidence must be a number from 0 to 1')
    }
    if (args.tags !== undefined) {
      if (!Array.isArray(args.tags) || args.tags.length > 16 || args.tags.some((tag) => typeof tag !== 'string')) throw new Error('memory: tags are invalid')
      normalizeTags(args.tags)
    }
  }
  return { scope, scopeKey, tenant }
}

/**
 * Bind a resolved tenant to an agent from trusted host code. This is
 * intentionally an in-process API; tenant IDs are never accepted over the
 * browser/settings RPC channel.
 */
export function bindMemoryContext(ctx, agent, context) {
  const memoryContext = ctx.get?.('socMemoryContext')
  if (memoryContext === undefined) throw new Error('memory_context_service_unavailable')
  return memoryContext.set(agent, context)
}

export function clearMemoryContext(ctx, agent) {
  const memoryContext = ctx.get?.('socMemoryContext')
  if (memoryContext === undefined) throw new Error('memory_context_service_unavailable')
  memoryContext.clear(agent)
}

async function handleEndpoint(endpoint, payload, signal, ctx, sessionPolicies) {
  switch (endpoint) {
    case 'get-action-catalog': return ok({ actions: ACTION_CATALOG })
    case 'get-action-policy': {
      const sessionId = payload?.session_id ?? payload?.sessionId
      resolveOwnedSession(ctx, sessionId)
      return ok(policyValue(ctx, sessionPolicies, String(sessionId)))
    }
    case 'set-session-action-policy': {
      const sessionId = payload?.session_id ?? payload?.sessionId
      resolveOwnedSession(ctx, sessionId)
      const actions = actionSet(payload?.auto_approve_actions ?? payload?.autoApproveActions, { strict: true })
      sessionPolicies.set(String(sessionId), actions)
      return ok(policyValue(ctx, sessionPolicies, String(sessionId)))
    }
    case 'reset-session-action-policy': {
      const sessionId = payload?.session_id ?? payload?.sessionId
      resolveOwnedSession(ctx, sessionId)
      sessionPolicies.delete(String(sessionId))
      return ok(policyValue(ctx, sessionPolicies, String(sessionId)))
    }
    case 'get-settings': return ok(await runAdmin('get-settings'))
    case 'update-settings': return ok(await runAdmin('update-settings', undefined, payload))
    case 'delete-setting': return ok(await runAdmin('delete-setting', payload?.key ?? ''))
    case 'list-accounts': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'add-account': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'update-account': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'delete-account': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'test-account': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'send-email': {
      const session = ctx.get('socAuth')?.currentSession?.()
      if (!session) throw new Error('authentication required')
      return ok(await runAuthCommand('send-email', { ...payload, session_id: session.id }))
    }
    case 'list-signatures': {
      const session = ctx.get('socAuth')?.currentSession?.()
      if (!session) throw new Error('authentication required')
      return ok(await runAuthCommand('list-signatures', { session_id: session.id }))
    }
    case 'test-splunk': return ok(await runAdmin('test-splunk'))
    case 'test-subscription-server': return ok(await runAdmin('test-subscription-server'))
    case 'convert-attachment': {
      const request = validateAttachmentPayload(payload)
      return ok(await runAdmin('convert-attachment', undefined, request, signal))
    }
    case 'migrate': return ok(await runAdmin('migrate'))
    default: return badRequest(`Unknown endpoint: ${endpoint}`)
  }
}

export function apply(ctx) {
  const sessionPolicies = new Map()
  let memoryContext = ctx.get?.('socMemoryContext')
  if (memoryContext === undefined) {
    memoryContext = createMemoryContextRegistry()
    try { ctx.provide?.('socMemoryContext', memoryContext) } catch { /* another host fiber may own the service */ }
  }
  ctx.on('agent/created', ({ agent }) => {
    if (!ctx.agents.roots().includes(agent)) return
    try { agent.ctx.tools.restrict({ allow: [...DOMAIN_TOOLS, ...CONTROL_TOOLS] }) } catch { /* scheduler tools register asynchronously; pre-execute enforces */ }
  })
  ctx.on('tools/pre-execute', (exec, next) => {
    if (!DOMAIN_TOOLS.has(exec.name) && !CONTROL_TOOLS.has(exec.name)) {
      return Promise.resolve({ kind: 'deny', reason: 'This harness exposes only approved Splunk, Zimbra, subscription, scheduling, and SOC memory tools.' })
    }
    if (MEMORY_TOOLS.has(exec.name)) {
      try {
        validateMemoryExecution(exec, memoryContext)
      } catch (error) {
        return Promise.resolve({ kind: 'deny', reason: error instanceof Error ? error.message : 'Memory scope or metadata validation failed.' })
      }
    }
    if (APPROVAL_TOOLS.has(exec.name)) {
      const agent = exec?.agent
      const sessionId = sessionIdOf(agent)
      const interactive = agent !== undefined && rootsOf(ctx).includes(agent)
      if (interactive && sessionId !== undefined) {
        const autoApproved = sessionPolicies.get(sessionId) ?? savedAutoApproveActions(ctx)
        if (autoApproved.has(exec.name)) return next()
      }
      return Promise.resolve({ kind: 'ask', reason: MEMORY_WRITE_TOOLS.includes(exec.name) ? 'This action changes persistent SOC memory and requires approval.' : 'This action changes a SOC system, sends email, or changes a persistent schedule.' })
    }
    return next()
  }, { global: true })
  ctx.on('agent/disposed', ({ agent }) => memoryContext.clear(agent))
  ctx.on('session/disposed', (session) => sessionPolicies.delete(String(session.id)))
  ctx.connection.rpc.handle(
    CHANNEL,
    async (endpoint, payload, signal) => {
      try {
        return await handleEndpoint(endpoint, payload ?? {}, signal, ctx, sessionPolicies)
      } catch (error) {
        if (endpoint === 'convert-attachment') {
          const message = error instanceof Error ? error.message : 'attachment_conversion_failed'
          const [code, ...rest] = message.split(': ')
          const stableCodes = new Set(['attachment_invalid_request', 'attachment_invalid_filename', 'attachment_invalid_mime', 'attachment_too_large', 'attachment_invalid_limits', 'attachment_conversion_cancelled', 'attachment_unsupported', 'attachment_converter_unavailable', 'attachment_malformed', 'attachment_encrypted', 'attachment_too_complex', 'attachment_conversion_failed'])
          const reason = stableCodes.has(code) ? code : 'attachment_conversion_failed'
          return {
            ok: false,
            error: {
              code: 'attachment-error',
              message: reason === code && rest.length > 0 ? rest.join(': ') : 'The attachment conversion failed.',
              details: { reason },
            },
          }
        }
        if (endpoint === 'get-action-policy' || endpoint === 'set-session-action-policy' || endpoint === 'reset-session-action-policy') {
          const sessionId = payload?.session_id ?? payload?.sessionId
          return policyError(error, sessionId)
        }
        return internalError(error instanceof Error ? error.message : String(error))
      }
    },
    { authority: 'loopback' },
  )
}
