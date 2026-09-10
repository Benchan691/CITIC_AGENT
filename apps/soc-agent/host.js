import { spawn } from 'node:child_process'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACTION_CATALOG, ACTION_TOOLS, APPROVAL_TOOLS, ALWAYS_ASK_ACTION_TOOLS, CATALOG_ACTION_TOOLS, DETECTION_ACTION_TOOLS, DOMAIN_TOOLS, READ_ONLY_TOOLS, SPLUNK_LOOKUP_ACTION_TOOLS } from './policy.js'
import { runAuthCommand } from './ownership.js'
import { installInvestigationProjection } from './investigation.js'

export const name = 'soc-agent-host'
export const inject = ['agents', 'connection', 'tools', 'socAuth', 'sessions', 'settings', 'webServer']

const CHANNEL = '/soc-agent-config'
const ACTION_POLICY_NAMESPACE = 'soc-action-approval'
const CONTROL_TOOLS = new Set(['exit_plan_mode', 'ask_user_question'])
const CATALOG_ENDPOINTS = new Set([
  'catalog-list',
  'catalog-get',
  'catalog-customer-options',
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
const ADMIN_BRIDGE_SECRET = randomBytes(32).toString('hex')

function adminBridgeToken(command, actorId = '', kind = 'admin') {
  const claims = Buffer.from(JSON.stringify({
    version: 1,
    kind,
    command,
    actor_id: String(actorId || '').trim(),
    issued_at: Math.floor(Date.now() / 1000),
  })).toString('base64url')
  const signature = createHmac('sha256', ADMIN_BRIDGE_SECRET).update(claims).digest('base64url')
  return `${claims}.${signature}`
}

export { ACTION_CATALOG, ACTION_TOOLS, APPROVAL_TOOLS, ALWAYS_ASK_ACTION_TOOLS, CATALOG_ACTION_TOOLS, CONTROL_TOOLS, DETECTION_ACTION_TOOLS, DOMAIN_TOOLS, READ_ONLY_TOOLS, SPLUNK_LOOKUP_ACTION_TOOLS }

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

// Catalog editors normally run under the authenticated workspace session. The
// admin console has its own cookie, so allow that principal only for the
// customer catalog and pass its server-resolved email to the audit writer.
function requireCatalogPrincipal(ctx, catalog, { write = false } = {}) {
  const auth = ctx.get?.('socAuth')
  if (!auth) throw new Error('authentication required')
  if (write && catalog === 'customer') {
    const admin = auth.requireAdmin()
    const actor = String(admin?.email ?? '').trim()
    if (!actor) throw new Error('admin authentication required')
    return { actor_id: actor, admin: true }
  }
  let sessionError
  try {
    if (typeof auth.requireSession !== 'function') throw new Error('authentication required')
    const session = auth.requireSession()
    if (session?.id === undefined || session?.id === null) throw new Error('authentication required')
    return { session_id: String(session.id), admin: false }
  } catch (error) {
    sessionError = error
  }
  try {
    const admin = auth.requireAdmin()
    if (catalog !== 'customer') {
      throw new Error('administrator customer catalog access is limited to customer records')
    }
    const actor = String(admin?.email ?? '').trim()
    if (!actor) throw new Error('admin authentication required')
    return { actor_id: actor, admin: true }
  } catch (error) {
    if (error instanceof Error && error.message === 'administrator customer catalog access is limited to customer records') throw error
    throw sessionError ?? error
  }
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

function sendJson(response, status, value) {
  const data = Buffer.from(JSON.stringify(value))
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': data.length,
  })
  response.end(data)
}

async function readRawRequest(request, limit = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw new Error('request too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function readJsonRequest(request, limit = 64 * 1024) {
  const value = JSON.parse((await readRawRequest(request, limit)).toString('utf8') || '{}')
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('request must be an object')
  return value
}

function requestHeader(request, name) {
  const headers = request?.headers ?? {}
  return String(headers[name.toLowerCase()] ?? headers[name] ?? '').trim()
}

function alertWebhookSecrets() {
  const configured = new Map()
  const encoded = String(process.env.ALERT_INGEST_WEBHOOK_SECRETS_JSON ?? '').trim()
  if (encoded) {
    try {
      const parsed = JSON.parse(encoded)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [deployment, secret] of Object.entries(parsed)) {
          if (typeof secret === 'string' && secret.trim() && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,511}$/u.test(deployment)) {
            configured.set(deployment, secret.trim())
          }
        }
      }
    } catch {
      return configured
    }
  }
  // A single deployment may use the old variable during migration, but it
  // must be explicitly bound to a deployment instead of becoming global.
  const legacyDeployment = String(process.env.ALERT_INGEST_WEBHOOK_DEPLOYMENT ?? '').trim()
  const legacySecret = String(process.env.ALERT_INGEST_WEBHOOK_SECRET ?? '').trim()
  if (legacyDeployment && legacySecret && !configured.has(legacyDeployment)) configured.set(legacyDeployment, legacySecret)
  return configured
}

function verifyAlertWebhook(request, body, deployment) {
  const secret = alertWebhookSecrets().get(String(deployment ?? '').trim())
  if (!secret) return false
  const timestamp = requestHeader(request, 'x-citic-alert-timestamp')
  const signature = requestHeader(request, 'x-citic-alert-signature').replace(/^sha256=/iu, '')
  const replay = requestHeader(request, 'x-citic-alert-replay')
  if (!/^\d{1,12}$/u.test(timestamp) || !/^[a-f0-9]{64}$/iu.test(signature) || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/u.test(replay)) return false
  const seconds = Number(timestamp)
  if (!Number.isSafeInteger(seconds) || Math.abs(Math.floor(Date.now() / 1000) - seconds) > 300) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex')
  const actual = Buffer.from(signature, 'hex')
  const expectedBytes = Buffer.from(expected, 'hex')
  return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes)
}

async function serveAlertIngestWebhook(request, response) {
  if (request.method !== 'POST') {
    response.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' })
    response.end()
    return
  }
  if (alertWebhookSecrets().size === 0) {
    sendJson(response, 503, { error: 'alert ingestion webhook is not configured' })
    return
  }
  try {
    const body = await readRawRequest(request, 5 * 1024 * 1024 + 16 * 1024)
    const payload = JSON.parse(body.toString('utf8') || '{}')
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('alert payload must be an object')
    const deployment = typeof payload.deployment === 'string' ? payload.deployment.trim() : ''
    if (!deployment || !alertWebhookSecrets().has(deployment) || !verifyAlertWebhook(request, body, deployment)) {
      response.writeHead(401, { 'cache-control': 'no-store' })
      response.end('invalid alert signature')
      return
    }
    const replay = requestHeader(request, 'x-citic-alert-replay')
    const trustedPayload = {
      ...payload,
      _authenticated_deployment: deployment,
      _authenticated_replay_id: replay,
    }
    sendJson(response, 200, await runAdmin('receive-alert-run', undefined, trustedPayload, request.signal))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'alert ingestion failed'
    const status = message === 'request too large' || message.includes('payload must be an object') ? 400 : 500
    sendJson(response, status, { error: message.slice(0, 300) })
  }
}

async function serveAlertActionContextWebhook(request, response) {
  if (request.method !== 'POST') {
    response.writeHead(405, { allow: 'POST', 'cache-control': 'no-store' })
    response.end()
    return
  }
  if (alertWebhookSecrets().size === 0) {
    sendJson(response, 503, { error: 'alert action context endpoint is not configured' })
    return
  }
  try {
    // Context resolution carries identity/configuration only, never result
    // rows.  Keep a separate bounded request size for this lookup endpoint.
    const body = await readRawRequest(request, 512 * 1024)
    const payload = JSON.parse(body.toString('utf8') || '{}')
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('alert context must be an object')
    const deployment = typeof payload.deployment === 'string' ? payload.deployment.trim() : ''
    if (!deployment || !alertWebhookSecrets().has(deployment) || !verifyAlertWebhook(request, body, deployment)) {
      response.writeHead(401, { 'cache-control': 'no-store' })
      response.end('invalid alert signature')
      return
    }
    const replay = requestHeader(request, 'x-citic-alert-replay')
    const trustedPayload = {
      ...payload,
      _authenticated_deployment: deployment,
      _authenticated_replay_id: replay,
    }
    sendJson(response, 200, await runAdmin('resolve-alert-action-context', undefined, trustedPayload, request.signal))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'alert action context resolution failed'
    const status = message === 'request too large' || message.includes('context must be an object') ? 400 : 500
    sendJson(response, status, { error: message.slice(0, 300) })
  }
}

async function requireHttpAdmin(ctx, request, response) {
  const auth = ctx.get?.('socAuth')
  const admin = await auth?.requestAdmin?.(request)
  if (admin) return admin
  response.writeHead(401, { 'cache-control': 'no-store' })
  response.end('administrator authentication required')
  return undefined
}

async function serveAlertEmailSettings(request, response, ctx) {
  if (!(await requireHttpAdmin(ctx, request, response))) return
  if (request.method !== 'GET') { response.writeHead(405, { allow: 'GET' }); response.end(); return }
  try {
    const url = new URL(request.url || '/admin/alert-email/settings', 'http://localhost')
    const payload = {}
    for (const key of [
      'limit', 'registration_offset', 'review_offset', 'ownership_offset',
      'quarantine_offset', 'run_quarantine_offset', 'policy_offset',
    ]) {
      const value = url.searchParams.get(key)
      if (value !== null) payload[key] = value
    }
    sendJson(response, 200, await runAdmin('get-alert-email-settings', undefined, payload, request.signal))
  }
  catch { sendJson(response, 500, { error: 'alert email settings unavailable' }) }
}

async function saveAlertEmailAdminResource(request, response, ctx, command, validator) {
  const admin = await requireHttpAdmin(ctx, request, response)
  if (!admin) return
  if (request.method !== 'POST') { response.writeHead(405, { allow: 'POST' }); response.end(); return }
  try {
    const payload = validator(await readJsonRequest(request))
    sendJson(response, 200, await runAdmin(command, undefined, { ...payload, actor_id: admin.email }, request.signal))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'request failed'
    sendJson(response, message.startsWith('The ') ? 400 : 500, { error: message.slice(0, 400) })
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
    const bridgeKind = command === 'receive-alert-run' || command === 'resolve-alert-action-context' ? 'webhook' : 'admin'
    const bridgePayload = payload && typeof payload === 'object' ? { ...payload } : {}
    const actorId = typeof bridgePayload.actor_id === 'string' ? bridgePayload.actor_id : ''
    bridgePayload._host_capability = adminBridgeToken(command, actorId, bridgeKind)
    const child = spawn('uv', args, {
      cwd: serverRoot(),
      env: (() => {
        const environment = { ...process.env, MCP_SERVER_ROOT: workspaceRoot() }
        delete environment.SOC_ADMIN_EMAIL
        delete environment.SOC_ADMIN_PASSWORD
        environment.SOC_AGENT_BRIDGE_SECRET = ADMIN_BRIDGE_SECRET
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
    child.stdin.end(JSON.stringify(bridgePayload))
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
  if (payload.origin !== undefined && payload.origin !== 'human' && payload.origin !== 'agent') {
    throw new Error('The detection origin is invalid.')
  }
  return {
    operation,
    detection: payload.detection,
    ...(payload.name === undefined ? {} : { name: payload.name }),
    ...(payload.expected_fingerprint === undefined ? {} : { expected_fingerprint: payload.expected_fingerprint }),
    ...(payload.origin === undefined ? {} : { origin: payload.origin }),
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

function validateAlertEmailRulePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The alert email rule is invalid.')
  }
  if (payload.id !== undefined && (typeof payload.id !== 'string' || payload.id.trim() === '')) {
    throw new Error('The alert email rule ID is invalid.')
  }
  if (typeof payload.name !== 'string' || payload.name.trim() === '' || payload.name.length > 160) {
    throw new Error('The alert email rule name is invalid.')
  }
  for (const key of ['customer_id', 'ruleset_id']) {
    if (payload[key] !== undefined && payload[key] !== null && (typeof payload[key] !== 'string' || payload[key].trim() === '')) {
      throw new Error(`The alert email ${key} is invalid.`)
    }
  }
  if (payload.severities !== undefined && (!Array.isArray(payload.severities) || payload.severities.length === 0 || payload.severities.length > 5 || payload.severities.some(value => !['info', 'low', 'medium', 'high', 'critical'].includes(String(value).toLowerCase())))) {
    throw new Error('The alert email severities are invalid.')
  }
  if (payload.enabled !== undefined && typeof payload.enabled !== 'boolean') {
    throw new Error('The alert email enabled flag is invalid.')
  }
  return {
    ...(payload.id === undefined ? {} : { id: payload.id.trim() }),
    name: payload.name.trim(),
    ...(payload.customer_id === undefined ? {} : { customer_id: payload.customer_id }),
    ...(payload.ruleset_id === undefined ? {} : { ruleset_id: payload.ruleset_id }),
    ...(payload.severities === undefined ? {} : { severities: payload.severities.map(value => String(value).toLowerCase()) }),
    ...(payload.enabled === undefined ? {} : { enabled: payload.enabled }),
    ...(payload.routing === undefined ? {} : { routing: payload.routing }),
  }
}

function validateCustomerEmailConfigPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The customer email configuration is invalid.')
  }
  if (typeof payload.customer_id !== 'string' || payload.customer_id.trim() === '') {
    throw new Error('The customer ID is invalid.')
  }
  const config = payload.email_config
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('The customer email configuration is invalid.')
  }
  const lists = {}
  for (const key of ['recipients', 'cc', 'bcc']) {
    const value = config[key] ?? []
    if (!Array.isArray(value) || value.length > 50 || value.some(item => typeof item !== 'string' || item.length > 320 || !/^[^\s@]+@[^\s@]+$/u.test(item))) {
      throw new Error(`The customer ${key} list is invalid.`)
    }
    lists[key] = [...new Set(value.map(item => item.trim()))]
  }
  const language = String(config.language || 'EN').toUpperCase()
  const brand = String(config.brand || 'CPC').toUpperCase()
  if (!['EN', 'CN', 'ZH'].includes(language)) throw new Error('The customer language is invalid.')
  if (!['CPC', 'CEC'].includes(brand)) throw new Error('The customer brand is invalid.')
  if (payload.alert_delivery_enabled !== undefined && typeof payload.alert_delivery_enabled !== 'boolean') {
    throw new Error('The customer alert delivery flag is invalid.')
  }
  return {
    customer_id: payload.customer_id.trim(),
    email_config: { ...lists, language, brand },
    ...(payload.alert_delivery_enabled === undefined ? {} : { alert_delivery_enabled: payload.alert_delivery_enabled }),
  }
}

function validateAlertEmailPolicyPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The alert email policy is invalid.')
  }
  if (typeof payload.customer_id !== 'string' || payload.customer_id.trim() === '') {
    throw new Error('The customer ID is invalid.')
  }
  if (payload.registration_id !== undefined && payload.registration_id !== null && (typeof payload.registration_id !== 'string' || payload.registration_id.trim() === '')) {
    throw new Error('The alert registration ID is invalid.')
  }
  const policy = payload.policy
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new Error('The alert email policy is invalid.')
  const normalized = {}
  for (const key of ['detail_columns', 'required_columns', 'optional_columns']) {
    const values = policy[key] ?? []
    if (!Array.isArray(values) || values.length > 100 || values.some(item => typeof item !== 'string' || item.trim() === '' || item.length > 255)) {
      throw new Error(`The alert email ${key} list is invalid.`)
    }
    normalized[key] = [...new Set(values.map(item => item.trim()))]
  }
  if (policy.field_mappings !== undefined) {
    if (!Array.isArray(policy.field_mappings) || policy.field_mappings.length > 100) {
      throw new Error('The alert email field mappings are invalid.')
    }
    normalized.field_mappings = policy.field_mappings.map(mapping => {
      if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
        throw new Error('The alert email field mappings are invalid.')
      }
      const source = mapping.source ?? mapping.field ?? mapping.name
      const label = mapping.label ?? source
      if (typeof source !== 'string' || source.trim() === '' || source.length > 255 || source === '_raw' ||
          typeof label !== 'string' || label.trim() === '' || label.length > 255 ||
          (mapping.required !== undefined && typeof mapping.required !== 'boolean')) {
        throw new Error('The alert email field mappings are invalid.')
      }
      return { source: source.trim(), label: label.trim(), required: mapping.required === true }
    })
  }
  for (const key of ['max_display_rows', 'max_stored_rows']) {
    if (policy[key] !== undefined && (!Number.isInteger(policy[key]) || policy[key] < 1 || policy[key] > 1000)) {
      throw new Error(`The alert email ${key} value is invalid.`)
    }
    if (policy[key] !== undefined) normalized[key] = policy[key]
  }
  if (policy.row_filters !== undefined) {
    if (!Array.isArray(policy.row_filters) || policy.row_filters.length > 100) {
      throw new Error('The alert email row filters are invalid.')
    }
    normalized.row_filters = policy.row_filters.map(filter => {
      if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
        throw new Error('The alert email row filters are invalid.')
      }
      const source = filter.source ?? filter.field ?? filter.name
      const aliases = { eq: 'equals', '==': 'equals', equals: 'equals', ne: 'not_equals', '!=': 'not_equals', not_equals: 'not_equals', contains: 'contains', not_contains: 'not_contains', exists: 'exists', not_exists: 'not_exists' }
      const operator = aliases[String(filter.operator ?? filter.op ?? 'equals').trim().toLowerCase()]
      const value = filter.value
      if (typeof source !== 'string' || source.trim() === '' || source.length > 255 || source.trim() === '_raw' ||
          !operator || (value !== undefined && value !== null && !['string', 'number', 'boolean'].includes(typeof value)) ||
          (typeof value === 'number' && !Number.isFinite(value)) ||
          (typeof value === 'string' && value.length > 1000)) {
        throw new Error('The alert email row filters are invalid.')
      }
      const result = { source: source.trim(), operator }
      if ((operator !== 'exists' && operator !== 'not_exists') || value !== undefined) result.value = value ?? null
      return result
    })
  }
  if (policy.severity_source !== undefined &&
      (typeof policy.severity_source !== 'string' || policy.severity_source.length > 255 || policy.severity_source.trim() === '_raw')) {
    throw new Error('The alert email severity source is invalid.')
  }
  if (policy.severity_source !== undefined) normalized.severity_source = policy.severity_source.trim()
  if (policy.severity_mapping !== undefined) {
    if (!policy.severity_mapping || typeof policy.severity_mapping !== 'object' || Array.isArray(policy.severity_mapping) || Object.keys(policy.severity_mapping).length > 100) {
      throw new Error('The alert email severity mapping is invalid.')
    }
    const allowed = new Set(['info', 'low', 'medium', 'high', 'critical', 'unknown'])
    normalized.severity_mapping = {}
    for (const [source, target] of Object.entries(policy.severity_mapping)) {
      const value = String(target).toLowerCase()
      if (!source.trim() || source.length > 255 || !allowed.has(value)) throw new Error('The alert email severity mapping is invalid.')
      normalized.severity_mapping[source.trim().toLowerCase()] = value
    }
  }
  const fallback = String(policy.severity_fallback || 'unknown').toLowerCase()
  if (!['info', 'low', 'medium', 'high', 'critical', 'unknown'].includes(fallback)) throw new Error('The alert email severity fallback is invalid.')
  normalized.severity_fallback = fallback
  return {
    customer_id: payload.customer_id.trim(),
    ...(payload.registration_id ? { registration_id: payload.registration_id.trim() } : {}),
    policy: normalized,
  }
}

function validateAlertPolicyRemovalPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      typeof payload.customer_id !== 'string' || payload.customer_id.trim() === '' ||
      typeof payload.registration_id !== 'string' || payload.registration_id.trim() === '') {
    throw new Error('The alert policy override removal request is invalid.')
  }
  return { customer_id: payload.customer_id.trim(), registration_id: payload.registration_id.trim() }
}

function validateAlertIndexOwnershipPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The alert index ownership request is invalid.')
  }
  for (const key of ['deployment', 'index_name', 'customer_id']) {
    if (typeof payload[key] !== 'string' || payload[key].trim() === '') {
      throw new Error(`The alert ownership ${key} is invalid.`)
    }
  }
  if (payload.index_name.length > 255 || /[*?$`]/u.test(payload.index_name)) {
    throw new Error('The alert ownership index must be an exact index name.')
  }
  const status = String(payload.status ?? 'active').toLowerCase()
  if (!['active', 'review', 'retired'].includes(status)) throw new Error('The alert ownership status is invalid.')
  return {
    deployment: payload.deployment.trim(), index_name: payload.index_name.trim(),
    customer_id: payload.customer_id.trim(), status,
  }
}

function validateAlertRegistrationPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      typeof payload.registration_id !== 'string' || payload.registration_id.trim() === '' ||
      typeof payload.enabled !== 'boolean') {
    throw new Error('The alert registration request is invalid.')
  }
  return { registration_id: payload.registration_id.trim(), enabled: payload.enabled }
}

function validateAlertRelinkPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      typeof payload.registration_id !== 'string' || payload.registration_id.trim() === '' ||
      typeof payload.customer_id !== 'string' || payload.customer_id.trim() === '' ||
      !Array.isArray(payload.source_indexes) || payload.source_indexes.length === 0 || payload.source_indexes.length > 100) {
    throw new Error('The alert relink request is invalid.')
  }
  const source_indexes = payload.source_indexes.map(value => {
    if (typeof value !== 'string' || value.trim() === '' || value.length > 255 || /[*?$`]/u.test(value)) {
      throw new Error('The alert relink source index is invalid.')
    }
    return value.trim()
  })
  if (new Set(source_indexes).size !== source_indexes.length) throw new Error('The alert relink source indexes must be unique.')
  if (payload.review_id !== undefined && payload.review_id !== null && (typeof payload.review_id !== 'string' || payload.review_id.trim() === '')) {
    throw new Error('The alert review ID is invalid.')
  }
  return {
    registration_id: payload.registration_id.trim(), customer_id: payload.customer_id.trim(), source_indexes,
    ...(payload.review_id ? { review_id: payload.review_id.trim() } : {}),
  }
}

function validateAlertReviewResolutionPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      typeof payload.review_id !== 'string' || payload.review_id.trim() === '' ||
      typeof payload.customer_id !== 'string' || payload.customer_id.trim() === '' ||
      !Array.isArray(payload.source_indexes) || payload.source_indexes.length === 0 || payload.source_indexes.length > 100) {
    throw new Error('The alert review resolution request is invalid.')
  }
  const source_indexes = payload.source_indexes.map(value => {
    if (typeof value !== 'string' || value.trim() === '' || value.length > 255 || /[*?$`]/u.test(value)) {
      throw new Error('The alert review source index is invalid.')
    }
    return value.trim()
  })
  if (new Set(source_indexes).size !== source_indexes.length) throw new Error('The alert review source indexes must be unique.')
  return { review_id: payload.review_id.trim(), customer_id: payload.customer_id.trim(), source_indexes }
}

function validateHeldAlertReleasePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      typeof payload.event_id !== 'string' || payload.event_id.trim() === '' ||
      typeof payload.customer_id !== 'string' || payload.customer_id.trim() === '') {
    throw new Error('The held alert release request is invalid.')
  }
  return { event_id: payload.event_id.trim(), customer_id: payload.customer_id.trim() }
}

function validateAlertMigrationPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('The alert migration request is invalid.')
  const limit = payload.limit ?? 1000
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) throw new Error('The alert migration limit is invalid.')
  return { limit }
}

function validateAlertMigrationApplyPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      typeof payload.preview_run_id !== 'string' || payload.preview_run_id.trim() === '') {
    throw new Error('A reviewed migration preview run ID is required.')
  }
  return { preview_run_id: payload.preview_run_id.trim() }
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
    case 'get-alert-email-settings': requireAdmin(ctx); return ok(await runAdmin('get-alert-email-settings', undefined, payload))
    case 'get-alert-migration-report': requireAdmin(ctx); return ok(await runAdmin('get-alert-migration-report'))
    case 'update-settings': requireAdmin(ctx); return badRequest('Service configuration is managed by the server environment.')
    case 'delete-setting': requireAdmin(ctx); return badRequest('Service configuration is managed by the server environment.')
    case 'save-alert-email-rule': {
      const admin = requireAdmin(ctx)
      let request
      try {
        request = validateAlertEmailRulePayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The alert email rule is invalid.')
      }
      return ok(await runAdmin('save-alert-email-rule', undefined, { ...request, actor_id: admin.email }, signal))
    }
    case 'save-customer-email-config': {
      const admin = requireAdmin(ctx)
      let request
      try {
        request = validateCustomerEmailConfigPayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The customer email configuration is invalid.')
      }
      return ok(await runAdmin('save-customer-email-config', undefined, { ...request, actor_id: admin.email }, signal))
    }
    case 'save-alert-email-policy': {
      const admin = requireAdmin(ctx)
      let request
      try {
        request = validateAlertEmailPolicyPayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The alert email policy is invalid.')
      }
      return ok(await runAdmin('save-alert-email-policy', undefined, { ...request, actor_id: admin.email }, signal))
    }
    case 'remove-alert-email-policy-override': {
      const admin = requireAdmin(ctx)
      let request
      try { request = validateAlertPolicyRemovalPayload(payload) }
      catch (error) { return badRequest(error instanceof Error ? error.message : 'The alert policy override removal request is invalid.') }
      return ok(await runAdmin('remove-alert-email-policy-override', undefined, { ...request, actor_id: admin.email }, signal))
    }
    case 'set-alert-index-ownership': {
      const admin = requireAdmin(ctx)
      let request
      try { request = validateAlertIndexOwnershipPayload(payload) }
      catch (error) { return badRequest(error instanceof Error ? error.message : 'The alert index ownership request is invalid.') }
      return ok(await runAdmin('set-alert-index-ownership', undefined, { ...request, actor_id: admin.email }, signal))
    }
    case 'set-alert-registration': {
      const admin = requireAdmin(ctx)
      let request
      try { request = validateAlertRegistrationPayload(payload) }
      catch (error) { return badRequest(error instanceof Error ? error.message : 'The alert registration request is invalid.') }
      return ok(await runAdmin('set-alert-registration', undefined, { ...request, actor_id: admin.email }, signal))
    }
    case 'relink-alert-registration': {
      const admin = requireAdmin(ctx)
      let request
      try { request = validateAlertRelinkPayload(payload) }
      catch (error) { return badRequest(error instanceof Error ? error.message : 'The alert relink request is invalid.') }
      return ok(await runAdmin('relink-alert-registration', undefined, { ...request, actor_id: admin.email }, signal))
    }
    case 'resolve-alert-registration-review': {
      const admin = requireAdmin(ctx)
      let request
      try { request = validateAlertReviewResolutionPayload(payload) }
      catch (error) { return badRequest(error instanceof Error ? error.message : 'The alert review resolution request is invalid.') }
      return ok(await runAdmin('resolve-alert-registration-review', undefined, { ...request, actor_id: admin.email }, signal))
    }
    case 'release-held-alert': {
      const admin = requireAdmin(ctx)
      let request
      try { request = validateHeldAlertReleasePayload(payload) }
      catch (error) { return badRequest(error instanceof Error ? error.message : 'The held alert release request is invalid.') }
      return ok(await runAdmin('release-held-alert', undefined, { ...request, actor_id: admin.email }, signal))
    }
    case 'preview-alert-migration': {
      const admin = requireAdmin(ctx)
      let request
      try { request = validateAlertMigrationPayload(payload) }
      catch (error) { return badRequest(error instanceof Error ? error.message : 'The alert migration request is invalid.') }
      return ok(await runAdmin('preview-alert-migration', undefined, { ...request, actor_id: admin.email }, signal))
    }
    case 'backfill-alert-migration': {
      const admin = requireAdmin(ctx)
      let request
      try { request = validateAlertMigrationApplyPayload(payload) }
      catch (error) { return badRequest(error instanceof Error ? error.message : 'The alert migration apply request is invalid.') }
      return ok(await runAdmin('backfill-alert-migration', undefined, { ...request, actor_id: admin.email }, signal))
    }
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
      const request = validateCatalogNamePayload(payload)
      return ok(await runAuthCommand('catalog-list', { ...request, ...requireCatalogPrincipal(ctx, request.catalog) }))
    }
    case 'catalog-get':
    case 'catalog-history': {
      if (typeof payload?.record_id !== 'string' || payload.record_id.trim() === '') {
        return badRequest('The catalog record ID is invalid.')
      }
      const command = endpoint === 'catalog-get' ? 'catalog-get' : 'catalog-history'
      const request = validateCatalogNamePayload(payload)
      return ok(await runAuthCommand(command, {
        catalog: request.catalog,
        record_id: payload.record_id,
        ...requireCatalogPrincipal(ctx, request.catalog),
      }))
    }
    case 'catalog-customer-options': {
      return ok(await runAuthCommand('catalog-customer-options', {
        catalog: 'customer',
        ...requireCatalogPrincipal(ctx, 'customer'),
      }))
    }
    case 'catalog-publications': {
      const request = validateCatalogNamePayload(payload)
      return ok(await runAuthCommand('catalog-publications', { ...request, ...requireCatalogPrincipal(ctx, request.catalog) }))
    }
    case 'catalog-preview-publish': {
      const request = validateCatalogNamePayload(payload)
      return ok(await runAuthCommand('catalog-preview-publish', { ...request, ...requireCatalogPrincipal(ctx, request.catalog) }))
    }
    case 'save-catalog-record': {
      let request
      try {
        request = validateCatalogSavePayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The catalog save request is invalid.')
      }
      return ok(await runAuthCommand('save-catalog-record', { ...request, ...requireCatalogPrincipal(ctx, request.catalog, { write: true }) }))
    }
    case 'archive-catalog-record': {
      let request
      try {
        request = validateCatalogArchivePayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The catalog archive request is invalid.')
      }
      return ok(await runAuthCommand('archive-catalog-record', { ...request, ...requireCatalogPrincipal(ctx, request.catalog, { write: true }) }))
    }
    case 'publish-catalog': {
      const session = requireAdmin(ctx)
      return ok(await runAuthCommand('publish-catalog', {
        ...validateCatalogNamePayload(payload),
        actor_id: session.email,
      }))
    }
    case 'rollback-publication': {
      const session = requireAdmin(ctx)
      if (typeof payload?.publication_id !== 'string' || payload.publication_id.trim() === '') {
        return badRequest('The publication ID is invalid.')
      }
      return ok(await runAuthCommand('rollback-publication', {
        publication_id: payload.publication_id,
        actor_id: session.email,
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
      const alertEmailPage = ctx.webServer.register({
        kind: 'exact',
        path: '/admin/alert-email',
        handler: (request, response) => serveAdminPage(request, response, ctx.webServer),
      })
      const alertEmailPageTrailing = ctx.webServer.register({
        kind: 'exact',
        path: '/admin/alert-email/',
        handler: (request, response) => serveAdminPage(request, response, ctx.webServer),
      })
      const alertEmailSettings = ctx.webServer.register({
        kind: 'exact',
        path: '/admin/alert-email/settings',
        handler: (request, response) => serveAlertEmailSettings(request, response, ctx),
      })
      const alertEmailPreview = ctx.webServer.register({
        kind: 'exact', path: '/admin/alert-email/preview',
        handler: (request,response) => saveAlertEmailAdminResource(request,response,ctx,'preview-alert-email',value => value),
      })
      const alertEmailRule = ctx.webServer.register({
        kind: 'exact',
        path: '/admin/alert-email/rule',
        handler: (request, response) => saveAlertEmailAdminResource(
          request,
          response,
          ctx,
          'save-alert-email-rule',
          validateAlertEmailRulePayload,
        ),
      })
      const alertEmailCustomer = ctx.webServer.register({
        kind: 'exact',
        path: '/admin/alert-email/customer',
        handler: (request, response) => saveAlertEmailAdminResource(
          request,
          response,
          ctx,
          'save-customer-email-config',
          validateCustomerEmailConfigPayload,
        ),
      })
      const alertEmailPolicy = ctx.webServer.register({
        kind: 'exact',
        path: '/admin/alert-email/policy',
        handler: (request, response) => saveAlertEmailAdminResource(
          request,
          response,
          ctx,
          'save-alert-email-policy',
          validateAlertEmailPolicyPayload,
        ),
      })
      const alertEmailPolicyRemoval = ctx.webServer.register({
        kind: 'exact', path: '/admin/alert-email/policy/remove',
        handler: (request, response) => saveAlertEmailAdminResource(
          request, response, ctx, 'remove-alert-email-policy-override', validateAlertPolicyRemovalPayload,
        ),
      })
      const alertEmailOwnership = ctx.webServer.register({
        kind: 'exact', path: '/admin/alert-email/ownership',
        handler: (request, response) => saveAlertEmailAdminResource(
          request, response, ctx, 'set-alert-index-ownership', validateAlertIndexOwnershipPayload,
        ),
      })
      const alertEmailRegistration = ctx.webServer.register({
        kind: 'exact', path: '/admin/alert-email/registration',
        handler: (request, response) => saveAlertEmailAdminResource(
          request, response, ctx, 'set-alert-registration', validateAlertRegistrationPayload,
        ),
      })
      const alertEmailRelink = ctx.webServer.register({
        kind: 'exact', path: '/admin/alert-email/relink',
        handler: (request, response) => saveAlertEmailAdminResource(
          request, response, ctx, 'relink-alert-registration', validateAlertRelinkPayload,
        ),
      })
      const alertEmailReviewResolution = ctx.webServer.register({
        kind: 'exact', path: '/admin/alert-email/review/resolve',
        handler: (request, response) => saveAlertEmailAdminResource(
          request, response, ctx, 'resolve-alert-registration-review', validateAlertReviewResolutionPayload,
        ),
      })
      const alertEmailRelease = ctx.webServer.register({
        kind: 'exact', path: '/admin/alert-email/release',
        handler: (request, response) => saveAlertEmailAdminResource(
          request, response, ctx, 'release-held-alert', validateHeldAlertReleasePayload,
        ),
      })
      const alertMigrationPreview = ctx.webServer.register({
        kind: 'exact', path: '/admin/alert-email/migration/preview',
        handler: (request, response) => saveAlertEmailAdminResource(
          request, response, ctx, 'preview-alert-migration', validateAlertMigrationPayload,
        ),
      })
      const alertMigrationBackfill = ctx.webServer.register({
        kind: 'exact', path: '/admin/alert-email/migration/backfill',
        handler: (request, response) => saveAlertEmailAdminResource(
          request, response, ctx, 'backfill-alert-migration', validateAlertMigrationApplyPayload,
        ),
      })
      const alertIngestWebhook = ctx.webServer.register({
        kind: 'exact',
        path: '/api/soc-alerts/v1/runs',
        handler: (request, response) => serveAlertIngestWebhook(request, response),
      })
      const alertActionContextWebhook = ctx.webServer.register({
        kind: 'exact',
        path: '/api/soc-alerts/v1/action-context',
        handler: (request, response) => serveAlertActionContextWebhook(request, response),
      })
      return () => {
        admin?.()
        adminTrailing?.()
        catalogs?.()
        catalogsTrailing?.()
        alertEmailPage?.()
        alertEmailPageTrailing?.()
        alertEmailSettings?.()
        alertEmailPreview?.()
        alertEmailRule?.()
        alertEmailCustomer?.()
        alertEmailPolicy?.()
        alertEmailPolicyRemoval?.()
        alertEmailOwnership?.()
        alertEmailRegistration?.()
        alertEmailRelink?.()
        alertEmailReviewResolution?.()
        alertEmailRelease?.()
        alertMigrationPreview?.()
        alertMigrationBackfill?.()
        alertIngestWebhook?.()
        alertActionContextWebhook?.()
      }
    }, 'soc-agent-host: admin web surface')
  }
  installInvestigationProjection(ctx)
  ctx.on('agent/created', ({ agent }) => {
    if (!ctx.agents.roots().includes(agent)) return
    try { agent.ctx.tools.restrict({ allow: [...DOMAIN_TOOLS, ...CONTROL_TOOLS] }) } catch { /* scheduler tools register asynchronously; pre-execute enforces */ }
  })
  ctx.on('tools/pre-execute', (exec, next) => {
    if (!DOMAIN_TOOLS.has(exec.name) && !CONTROL_TOOLS.has(exec.name)) {
      return Promise.resolve({ kind: 'deny', reason: 'This harness exposes only approved Splunk, Zimbra, subscription, scheduling, and catalog tools.' })
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
          : 'This action changes a SOC system, sends email, or changes a persistent schedule.',
      })
    }
    return next()
  }, { global: true })
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
