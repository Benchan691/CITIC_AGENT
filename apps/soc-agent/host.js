import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACTION_CATALOG, ACTION_TOOLS, APPROVAL_TOOLS, ALWAYS_ASK_ACTION_TOOLS, CATALOG_ACTION_TOOLS, DETECTION_ACTION_TOOLS, DOMAIN_TOOLS, MEMORY_READ_TOOLS, MEMORY_WRITE_TOOLS, READ_ONLY_TOOLS, SPLUNK_LOOKUP_ACTION_TOOLS } from './policy.js'
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
export const inject = ['agents', 'connection', 'tools', 'socAuth', 'sessions', 'settings', 'webServer']

const CHANNEL = '/soc-agent-config'
const ACTION_POLICY_NAMESPACE = 'soc-action-approval'
const CONTROL_TOOLS = new Set(['exit_plan_mode', 'ask_user_question'])
const CATALOG_ENDPOINTS = new Set([
  'catalog-list',
  'catalog-get',
  'catalog-history',
  'catalog-publications',
  'catalog-preview-publish',
  'save-catalog-record',
  'archive-catalog-record',
  'publish-catalog',
  'rollback-publication',
])
const HARD_ATTACHMENT_BYTES = 100_000_000
const HARD_MARKDOWN_CHARS = 2_000_000
const HARD_LOOKUP_BYTES = 50_000_000

export { ACTION_CATALOG, ACTION_TOOLS, APPROVAL_TOOLS, ALWAYS_ASK_ACTION_TOOLS, CATALOG_ACTION_TOOLS, CONTROL_TOOLS, DETECTION_ACTION_TOOLS, DOMAIN_TOOLS, MEMORY_READ_TOOLS, MEMORY_WRITE_TOOLS, READ_ONLY_TOOLS, SPLUNK_LOOKUP_ACTION_TOOLS }

const ACTION_NAMES = new Set(ACTION_TOOLS)
const nodeRequire = createRequire(import.meta.url)

function requireAdmin(ctx) {
  const auth = ctx.get?.('socAuth')
  if (!auth || typeof auth.requireAdmin !== 'function') throw new Error('admin authentication required')
  return auth.requireAdmin()
}

function requireUser(ctx) {
  const auth = ctx.get?.('socAuth')
  if (!auth || typeof auth.requireSession !== 'function') throw new Error('authentication required')
  return auth.requireSession()
}

async function serveAdminPage(request, response, webServer) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' })
    response.end()
    return
  }
  let indexPath
  try {
    // The product package is loaded from a sibling workspace and does not
    // necessarily have the web frontend in its own dependency directory.
    // Resolve it through the maintained web-app package, just like the web
    // bundle does, then fall back to the checked-out workspace path.
    indexPath = nodeRequire.resolve(
      '@deepseek-ai/dsh-web-frontend/dist/index.html',
      { paths: [join(workspaceRoot(), 'vendor/deepseek-harness/packages/bundle/web-app')] },
    )
  } catch {
    indexPath = join(workspaceRoot(), 'vendor/deepseek-harness/apps/web/dist/index.html')
  }
  if (!indexPath) {
    response.writeHead(503, { 'cache-control': 'no-store' })
    response.end('admin interface unavailable')
    return
  }
  try {
    const html = await readFile(indexPath, 'utf8')
    const rendered = typeof webServer?.renderIndex === 'function'
      ? webServer.renderIndex(html)
      : html
    const data = Buffer.from(await rendered)
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': data.length,
    })
    if (request.method === 'HEAD') response.end()
    else response.end(data)
  } catch {
    response.writeHead(500, { 'cache-control': 'no-store' })
    response.end('admin interface unavailable')
  }
}

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
    // Draft families always require the harness approval flow; never
    // advertise a session-wide bypass for them to the UI.
    autoApproveActions: [...actions].filter(name => !ALWAYS_ASK_ACTION_TOOLS.includes(name)),
    source: session === undefined ? 'defaults' : 'session',
  }
}

function detectionApprovalReason(exec) {
  return 'This Splunk detection draft requires approval before it can run.'
}

function catalogApprovalReason(exec) {
  return 'This catalog change requires approval before it can run.'
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

function parseAdminFailure(stderr) {
  const lines = String(stderr || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  for (const line of lines.reverse()) {
    const candidates = [line]
    const start = line.indexOf('{')
    const end = line.lastIndexOf('}')
    if (start >= 0 && end > start && (start > 0 || end < line.length - 1)) candidates.push(line.slice(start, end + 1))
    for (const candidate of candidates) {
      try {
        const value = JSON.parse(candidate)
        if (value && typeof value === 'object' && typeof value.message === 'string' && typeof value.code === 'string') return value
      } catch { /* ignore traceback and launcher noise */ }
    }
  }
  return undefined
}

function adminFailureMessage(command, stderr = '') {
  const label = command === 'test-splunk'
    ? 'Splunk connection test failed'
    : command === 'test-subscription-server'
      ? 'Subscription server connection test failed'
      : `Admin operation "${command}" failed`
  const failure = parseAdminFailure(stderr)
  if (!failure) {
    return command === 'test-splunk' || command === 'test-subscription-server'
      ? `${label}: The test process did not return a diagnostic. Check the server .env configuration and server logs.`
      : `${label}: The requested operation failed.`
  }
  const message = failure.message.replace(/\s+/g, ' ').trim().slice(0, 400)
  if (!message) {
    return command === 'test-splunk' || command === 'test-subscription-server'
      ? `${label}: The test process returned an empty diagnostic. Check the server logs.`
      : `${label}: The requested operation failed.`
  }
  const details = failure.details && typeof failure.details === 'object' ? failure.details : {}
  const extra = []
  if (Number.isInteger(details.status_code)) extra.push(`HTTP status ${details.status_code}`)
  if (Array.isArray(details.missing_environment_variables)) {
    const missing = details.missing_environment_variables.filter(value => typeof value === 'string').slice(0, 20)
    if (missing.length) extra.push(`missing configuration: ${missing.join(', ')}`)
  }
  return `${label}: ${message}${extra.length ? ` (${extra.join('; ')})` : ''}`
}

// Admin helper subprocesses share the authenticated-command bound: a hung
// Python process must never hold the admin RPC open indefinitely.
const ADMIN_COMMAND_TIMEOUT_MS = Number(process.env.SOC_AUTH_COMMAND_TIMEOUT_MS ?? 185_000)

function runAdmin(command, arg, payload, signal) {
  return new Promise((resolvePromise, rejectPromise) => {
    const args = ['run', 'python', '-m', 'unified_mcp_server.admin_cli', command]
    if (arg !== undefined && arg !== '') args.push(arg)
    const child = spawn('uv', args, {
      cwd: serverRoot(),
      env: (() => {
        const environment = { ...process.env, MCP_SERVER_ROOT: workspaceRoot() }
        delete environment.SOC_ADMIN_EMAIL
        delete environment.SOC_ADMIN_PASSWORD
        return environment
      })(),
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timeoutTimer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      rejectPromise(new Error(`admin_operation_timeout: The "${command}" operation exceeded ${Math.round(ADMIN_COMMAND_TIMEOUT_MS / 1000)} seconds.`))
    }, ADMIN_COMMAND_TIMEOUT_MS)
    timeoutTimer.unref?.()
    const abort = () => {
      if (settled) return
      settled = true
      clearTimeout(timeoutTimer)
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
      clearTimeout(timeoutTimer)
      rejectPromise(new Error(adminFailureMessage(command)))
    })
    child.on('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timeoutTimer)
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
        rejectPromise(new Error(adminFailureMessage(command, stderr)))
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

function validateDetectionSavePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The detection save request is invalid.')
  }
  const operation = payload.operation
  if (operation !== 'write' && operation !== 'update') {
    throw new Error('The detection save operation is invalid.')
  }
  if (!payload.detection || typeof payload.detection !== 'object' || Array.isArray(payload.detection)) {
    throw new Error('The detection draft is invalid.')
  }
  if (payload.name !== undefined && (typeof payload.name !== 'string' || payload.name.trim() === '')) {
    throw new Error('The detection name is invalid.')
  }
  if (payload.expected_fingerprint !== undefined && payload.expected_fingerprint !== null && typeof payload.expected_fingerprint !== 'string') {
    throw new Error('The detection fingerprint is invalid.')
  }
  return {
    operation,
    detection: payload.detection,
    ...(payload.name === undefined ? {} : { name: payload.name }),
    ...(payload.expected_fingerprint === undefined ? {} : { expected_fingerprint: payload.expected_fingerprint }),
  }
}

const CATALOG_NAMES = new Set(['customer', 'rule', 'fix_source_type'])

function validateCatalogSavePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The catalog save request is invalid.')
  }
  const operation = payload.operation
  if (operation !== 'write' && operation !== 'update') {
    throw new Error('The catalog save operation is invalid.')
  }
  const catalog = payload.catalog
  if (typeof catalog !== 'string' || !CATALOG_NAMES.has(catalog)) {
    throw new Error('The catalog name is invalid.')
  }
  if (!payload.record || typeof payload.record !== 'object' || Array.isArray(payload.record)) {
    throw new Error('The catalog record draft is invalid.')
  }
  if (operation === 'update' && (typeof payload.record_id !== 'string' || payload.record_id.trim() === '')) {
    throw new Error('The catalog record ID is invalid.')
  }
  if (payload.record_id !== undefined && payload.record_id !== null && typeof payload.record_id !== 'string') {
    throw new Error('The catalog record ID is invalid.')
  }
  if (operation === 'update' && (!Number.isInteger(payload.expected_revision) || payload.expected_revision < 1)) {
    throw new Error('The catalog record revision is invalid.')
  }
  if (payload.reason !== undefined && typeof payload.reason !== 'string') {
    throw new Error('The change reason is invalid.')
  }
  return {
    catalog,
    operation,
    record: payload.record,
    ...(payload.record_id === undefined || payload.record_id === null ? {} : { record_id: payload.record_id }),
    ...(operation === 'update' ? { expected_revision: payload.expected_revision } : {}),
    ...(payload.reason ? { reason: payload.reason.slice(0, 500) } : {}),
  }
}

function validateCatalogArchivePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The catalog archive request is invalid.')
  }
  const catalog = payload.catalog
  if (typeof catalog !== 'string' || !CATALOG_NAMES.has(catalog)) {
    throw new Error('The catalog name is invalid.')
  }
  if (typeof payload.record_id !== 'string' || payload.record_id.trim() === '') {
    throw new Error('The catalog record ID is invalid.')
  }
  if (!Number.isInteger(payload.expected_revision) || payload.expected_revision < 1) {
    throw new Error('The catalog record revision is invalid.')
  }
  return {
    catalog,
    record_id: payload.record_id,
    expected_revision: payload.expected_revision,
    restore: payload.restore === true,
    ...(typeof payload.reason === 'string' && payload.reason ? { reason: payload.reason.slice(0, 500) } : {}),
  }
}

function validateCatalogNamePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The catalog request is invalid.')
  }
  const catalog = payload.catalog
  if (typeof catalog !== 'string' || !CATALOG_NAMES.has(catalog)) {
    throw new Error('The catalog name is invalid.')
  }
  return {
    catalog,
    ...(typeof payload.search === 'string' ? { search: payload.search } : {}),
    ...(Number.isInteger(payload.limit) ? { limit: payload.limit } : {}),
    ...(Number.isInteger(payload.offset) ? { offset: payload.offset } : {}),
    ...(payload.include_archived === undefined ? {} : { include_archived: payload.include_archived === true }),
  }
}

function validateLookupSavePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The lookup CSV save request is invalid.')
  }
  const operation = payload.operation
  if (!['write', 'update', 'delete'].includes(operation)) {
    throw new Error('The lookup CSV save operation is invalid.')
  }
  if (typeof payload.name !== 'string' || payload.name.trim() === '' || payload.name.length > 255) {
    throw new Error('The lookup CSV name is invalid.')
  }
  if (operation !== 'delete') {
    if (typeof payload.content !== 'string') throw new Error('The lookup CSV content is invalid.')
    if (Buffer.byteLength(payload.content, 'utf8') > HARD_LOOKUP_BYTES) {
      throw new Error('The lookup CSV content is too large.')
    }
  }
  if (operation !== 'write' && (typeof payload.expected_fingerprint !== 'string' || payload.expected_fingerprint.trim() === '')) {
    throw new Error('The lookup CSV fingerprint is invalid.')
  }
  if (payload.expected_fingerprint !== undefined && payload.expected_fingerprint !== null && typeof payload.expected_fingerprint !== 'string') {
    throw new Error('The lookup CSV fingerprint is invalid.')
  }
  return {
    operation,
    name: payload.name,
    ...(operation === 'delete' ? {} : { content: payload.content }),
    ...(payload.expected_fingerprint === undefined ? {} : { expected_fingerprint: payload.expected_fingerprint }),
  }
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
    case 'get-action-catalog': requireUser(ctx); return ok({ actions: ACTION_CATALOG })
    case 'get-action-policy': {
      requireUser(ctx)
      const sessionId = payload?.session_id ?? payload?.sessionId
      resolveOwnedSession(ctx, sessionId)
      return ok(policyValue(ctx, sessionPolicies, String(sessionId)))
    }
    case 'set-session-action-policy': {
      requireUser(ctx)
      const sessionId = payload?.session_id ?? payload?.sessionId
      resolveOwnedSession(ctx, sessionId)
      const actions = actionSet(payload?.auto_approve_actions ?? payload?.autoApproveActions, { strict: true })
      sessionPolicies.set(String(sessionId), actions)
      return ok(policyValue(ctx, sessionPolicies, String(sessionId)))
    }
    case 'reset-session-action-policy': {
      requireUser(ctx)
      const sessionId = payload?.session_id ?? payload?.sessionId
      resolveOwnedSession(ctx, sessionId)
      sessionPolicies.delete(String(sessionId))
      return ok(policyValue(ctx, sessionPolicies, String(sessionId)))
    }
    case 'get-settings': requireAdmin(ctx); return ok(await runAdmin('get-settings'))
    case 'update-settings': requireAdmin(ctx); return badRequest('Service configuration is managed by the server environment.')
    case 'delete-setting': requireAdmin(ctx); return badRequest('Service configuration is managed by the server environment.')
    case 'list-accounts': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'add-account': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'update-account': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'delete-account': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'test-account': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'send-email': {
      const session = requireUser(ctx)
      return ok(await runAuthCommand('send-email', { ...payload, session_id: session.id }))
    }
    case 'save-detection': {
      const session = requireUser(ctx)
      let request
      try {
        request = validateDetectionSavePayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The detection save request is invalid.')
      }
      return ok(await runAuthCommand('save-detection', { ...request, session_id: session.id }))
    }
    case 'catalog-list': {
      const session = requireUser(ctx)
      return ok(await runAuthCommand('catalog-list', { ...validateCatalogNamePayload(payload), session_id: session.id }))
    }
    case 'catalog-get':
    case 'catalog-history': {
      const session = requireUser(ctx)
      if (typeof payload?.record_id !== 'string' || payload.record_id.trim() === '') {
        return badRequest('The catalog record ID is invalid.')
      }
      const command = endpoint === 'catalog-get' ? 'catalog-get' : 'catalog-history'
      return ok(await runAuthCommand(command, {
        catalog: validateCatalogNamePayload(payload).catalog,
        record_id: payload.record_id,
        session_id: session.id,
      }))
    }
    case 'catalog-publications': {
      const session = requireUser(ctx)
      return ok(await runAuthCommand('catalog-publications', { ...validateCatalogNamePayload(payload), session_id: session.id }))
    }
    case 'catalog-preview-publish': {
      const session = requireUser(ctx)
      return ok(await runAuthCommand('catalog-preview-publish', { ...validateCatalogNamePayload(payload), session_id: session.id }))
    }
    case 'save-catalog-record': {
      const session = requireUser(ctx)
      let request
      try {
        request = validateCatalogSavePayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The catalog save request is invalid.')
      }
      return ok(await runAuthCommand('save-catalog-record', { ...request, session_id: session.id }))
    }
    case 'archive-catalog-record': {
      const session = requireUser(ctx)
      let request
      try {
        request = validateCatalogArchivePayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The catalog archive request is invalid.')
      }
      return ok(await runAuthCommand('archive-catalog-record', { ...request, session_id: session.id }))
    }
    case 'publish-catalog': {
      const session = requireAdmin(ctx)
      return ok(await runAuthCommand('publish-catalog', {
        ...validateCatalogNamePayload(payload),
        session_id: session.id,
      }))
    }
    case 'rollback-publication': {
      const session = requireAdmin(ctx)
      if (typeof payload?.publication_id !== 'string' || payload.publication_id.trim() === '') {
        return badRequest('The publication ID is invalid.')
      }
      return ok(await runAuthCommand('rollback-publication', {
        publication_id: payload.publication_id,
        session_id: session.id,
      }))
    }
    case 'save-lookup': {
      const session = requireUser(ctx)
      let request
      try {
        request = validateLookupSavePayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The lookup CSV save request is invalid.')
      }
      return ok(await runAuthCommand('save-lookup', { ...request, session_id: session.id }))
    }
    case 'list-signatures': {
      const session = requireUser(ctx)
      return ok(await runAuthCommand('list-signatures', { session_id: session.id }))
    }
    case 'test-splunk': requireAdmin(ctx); return ok(await runAdmin('test-splunk'))
    case 'test-subscription-server': requireAdmin(ctx); return ok(await runAdmin('test-subscription-server'))
    case 'convert-attachment': {
      requireAdmin(ctx)
      const request = validateAttachmentPayload(payload)
      return ok(await runAdmin('convert-attachment', undefined, request, signal))
    }
    case 'migrate': requireAdmin(ctx); return ok(await runAdmin('migrate'))
    default: return badRequest(`Unknown endpoint: ${endpoint}`)
  }
}

export function apply(ctx) {
  const sessionPolicies = new Map()
  if (typeof ctx.effect === 'function' && typeof ctx.webServer?.register === 'function') {
    ctx.effect(() => {
      const admin = ctx.webServer.register({
        kind: 'exact',
        path: '/admin',
        handler: (request, response) => serveAdminPage(request, response, ctx.webServer),
      })
      const adminTrailing = ctx.webServer.register({
        kind: 'exact',
        path: '/admin/',
        handler: (request, response) => serveAdminPage(request, response, ctx.webServer),
      })
      // The catalog management page reuses the admin shell; the RPC channel
      // enforces authentication and (for publishing) admin rights per call.
      const catalogs = ctx.webServer.register({
        kind: 'exact',
        path: '/catalogs',
        handler: (request, response) => serveAdminPage(request, response, ctx.webServer),
      })
      const catalogsTrailing = ctx.webServer.register({
        kind: 'exact',
        path: '/catalogs/',
        handler: (request, response) => serveAdminPage(request, response, ctx.webServer),
      })
      return () => {
        admin?.()
        adminTrailing?.()
        catalogs?.()
        catalogsTrailing?.()
      }
    }, 'soc-agent-host: admin web surface')
  }
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
      const alwaysAsk = ALWAYS_ASK_ACTION_TOOLS.includes(exec.name)
      const agent = exec?.agent
      const sessionId = sessionIdOf(agent)
      const interactive = agent !== undefined && rootsOf(ctx).includes(agent)
      if (!alwaysAsk && interactive && sessionId !== undefined) {
        const autoApproved = sessionPolicies.get(sessionId) ?? savedAutoApproveActions(ctx)
        if (autoApproved.has(exec.name)) return next()
      }
      return Promise.resolve({
        kind: 'ask',
        reason: alwaysAsk
          ? DETECTION_ACTION_TOOLS.includes(exec.name)
            ? detectionApprovalReason(exec)
            : SPLUNK_LOOKUP_ACTION_TOOLS.includes(exec.name)
              ? 'This Splunk lookup CSV change requires approval before it can run.'
              : catalogApprovalReason(exec)
          : MEMORY_WRITE_TOOLS.includes(exec.name)
            ? 'This action changes persistent SOC memory and requires approval.'
            : 'This action changes a SOC system, sends email, or changes a persistent schedule.',
      })
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
        if (error instanceof Error && error.message === 'admin authentication required') {
          return {
            ok: false,
            error: {
              code: 'admin-authentication-required',
              message: 'administrator authentication required',
              details: {},
            },
          }
        }
        if (error instanceof Error && error.message === 'authentication required') {
          return {
            ok: false,
            error: {
              code: 'authentication-required',
              message: 'authentication required',
              details: {},
            },
          }
        }
        if (endpoint === 'convert-attachment') {
          const message = error instanceof Error ? error.message : 'attachment_conversion_failed'
          const [code] = message.split(': ')
          const stableCodes = new Set(['attachment_invalid_request', 'attachment_invalid_filename', 'attachment_invalid_mime', 'attachment_too_large', 'attachment_invalid_limits', 'attachment_conversion_cancelled', 'attachment_unsupported', 'attachment_converter_unavailable', 'attachment_malformed', 'attachment_encrypted', 'attachment_too_complex', 'attachment_conversion_failed'])
          const reason = stableCodes.has(code) ? code : 'attachment_conversion_failed'
          return {
            ok: false,
            error: {
              code: 'attachment-error',
              message: 'The attachment conversion failed.',
              details: { reason },
            },
          }
        }
        if (endpoint === 'test-splunk' || endpoint === 'test-subscription-server') {
          const command = endpoint
          const prefix = command === 'test-splunk'
            ? 'Splunk connection test failed:'
            : 'Subscription server connection test failed:'
          const message = error instanceof Error ? error.message.trim() : ''
          if (message.startsWith(prefix)) return internalError(message)
          return internalError(`${prefix} ${message || 'The test process did not return a diagnostic. Check the server .env configuration and server logs.'}`)
        }
        if (endpoint === 'save-detection') {
          const code = typeof error?.code === 'string' ? error.code : 'internal'
          const message = code === 'internal'
            ? 'The detection could not be saved.'
            : error instanceof Error ? error.message : 'The detection could not be saved.'
          const details = error?.details && typeof error.details === 'object' ? error.details : {}
          return { ok: false, error: { code, message, details } }
        }
        if (endpoint === 'save-lookup') {
          const code = typeof error?.code === 'string' ? error.code : 'internal'
          const message = code === 'internal'
            ? 'The lookup CSV could not be saved.'
            : error instanceof Error ? error.message : 'The lookup CSV could not be saved.'
          const details = error?.details && typeof error.details === 'object' ? error.details : {}
          return { ok: false, error: { code, message, details } }
        }
        if (CATALOG_ENDPOINTS.has(endpoint)) {
          const code = typeof error?.code === 'string' ? error.code : 'internal'
          const message = code === 'internal'
            ? 'The catalog operation failed.'
            : error instanceof Error ? error.message : 'The catalog operation failed.'
          const details = error?.details && typeof error.details === 'object' ? error.details : {}
          return { ok: false, error: { code, message, details } }
        }
        if (endpoint === 'get-action-policy' || endpoint === 'set-session-action-policy' || endpoint === 'reset-session-action-policy') {
          const sessionId = payload?.session_id ?? payload?.sessionId
          return policyError(error, sessionId)
        }
        return internalError('The requested operation failed.')
      }
    },
    { authority: 'trusted-host' },
  )
}
