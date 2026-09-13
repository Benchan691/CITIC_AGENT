import { runPythonCommand } from './python-command.js'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'
import { renderWorkspaceContext } from 'dsh-soc-agent-agent-instructions'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { ACTION_CATALOG, ACTION_TOOLS, APPROVAL_TOOLS, ALWAYS_ASK_ACTION_TOOLS, DOMAIN_TOOLS, MANAGED_TOOL_NAMES, OFFICIAL_SPLUNK_READ_TOOLS, READ_ONLY_TOOLS, TOOL_CATALOG } from './policy.js'
import { runAuthCommand } from './ownership.js'
import { testOfficialSplunkConnection } from './splunk-bridge.js'
import { installInvestigationProjection } from './investigation.js'

export const name = 'soc-agent-host'
export const inject = ['agents', 'connection', 'tools', 'socAuth', 'settings', 'webServer']

const CHANNEL = '/soc-agent-config'
const ACTION_POLICY_NAMESPACE = 'soc-action-approval'
const ACTION_MODES = Object.freeze(['soc', 'full'])
const ACTION_STATES = Object.freeze(['ask', 'auto', 'disabled'])
const BACKGROUND_NAMESPACE = 'soc-background'
const BACKGROUND_FILE = 'BACKGROUND.md'
const BACKGROUND_MAX_BYTES = 65_536
const BACKGROUND_MAX_SOURCE_BYTES = 1024 * 1024
const DEFAULT_BACKGROUND_PROMPTS = 5
const BackgroundSettings = z.object({
  enabled: z.boolean().default(true),
  repeatEveryUserPrompts: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_BACKGROUND_PROMPTS),
})
const CONTROL_TOOLS = new Set(['exit_plan_mode', 'ask_user_question'])
const HARD_ATTACHMENT_BYTES = 100_000_000
const HARD_MARKDOWN_CHARS = 2_000_000

export { ACTION_CATALOG, ACTION_TOOLS, APPROVAL_TOOLS, ALWAYS_ASK_ACTION_TOOLS, CONTROL_TOOLS, DOMAIN_TOOLS, MANAGED_TOOL_NAMES, OFFICIAL_SPLUNK_READ_TOOLS, READ_ONLY_TOOLS, TOOL_CATALOG }

const nodeRequire = createRequire(import.meta.url)

function requireAdmin(ctx) {
  const auth = ctx.get?.('socAuth')
  if (!auth || typeof auth.requireAdmin !== 'function') throw new Error('admin authentication required')
  return auth.requireAdmin()
}

function requireUser(ctx) {
  const auth = ctx.get?.('socAuth')
  if (!auth || typeof auth.requireUser !== 'function') throw new Error('authentication required')
  return auth.requireUser()
}

async function serveAdminPage(request, response, webServer) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' })
    response.end()
    return
  }
  let indexPath
  try {
    const frontendPackage = nodeRequire.resolve('@deepseek-ai/dsh-web-frontend/package.json')
    indexPath = join(dirname(frontendPackage), 'dist', 'index.html')
  } catch {
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

function settingsOf(ctx) {
  try {
    return ctx.get?.('settings') ?? ctx.settings
  } catch {
    return undefined
  }
}

function isBackgroundPath(path) {
  return path === BACKGROUND_FILE || path?.endsWith(`/${BACKGROUND_FILE}`)
}

function hasBackgroundMarker(message) {
  const source = message?.source
  if (source?.kind === 'plugin' && source.plugin === BACKGROUND_NAMESPACE) return true
  return source?.kind === 'agent-instructions'
    && Array.isArray(source.changes)
    && source.changes.some(change => change?.action !== 'remove' && isBackgroundPath(change?.path))
}

function isBackgroundMarker(message) {
  return hasBackgroundMarker(message) && message?.source?.backgroundDisabled !== true
}

function latestBackgroundMarker(events) {
  return events.findLastIndex(event => event?.type === 'user/message' && isBackgroundMarker(event.data))
}

function latestDisabledBackgroundMarker(events) {
  return events.findLastIndex(event => event?.type === 'user/message'
    && hasBackgroundMarker(event.data)
    && event.data?.source?.backgroundDisabled === true)
}

function userPromptCount(messages) {
  return messages.reduce((count, message) => count + (message?.source?.kind === 'user' ? 1 : 0), 0)
}

function stripBackgroundSections(text) {
  let result = text
  const backgroundHeading = /(?:Instructions from:|Additional instructions from:|Updated instructions from:|Instructions removed:) BACKGROUND\.md\n\n?/u
  const nextHeading = /\n(?:Instructions from:|Additional instructions from:|Updated instructions from:|Instructions removed:) [^\n]+\n\n?/u
  for (;;) {
    const match = backgroundHeading.exec(result)
    if (match === null) return result
    const headingEnd = match.index + match[0].length
    const remainder = result.slice(headingEnd)
    const next = remainder.search(nextHeading)
    const closing = remainder.indexOf('\n</system-reminder>')
    const end = next >= 0 && (closing < 0 || next < closing)
      ? next
      : closing >= 0
        ? closing
        : remainder.length
    result = result.slice(0, match.index) + remainder.slice(end)
  }
}

function suppressBackgroundMessage(message) {
  const source = message?.source
  if (source?.kind === 'plugin' && source.plugin === BACKGROUND_NAMESPACE) return undefined
  if (source?.kind !== 'agent-instructions' || !hasBackgroundMarker(message)) return message

  const content = Array.isArray(message.content) ? message.content : []
  let changed = false
  const nextContent = content.map(block => {
    if (block?.type !== 'text' || typeof block.text !== 'string') return block
    const text = stripBackgroundSections(block.text)
    if (text === block.text) return block
    changed = true
    return { ...block, text }
  })
  const nextSource = { ...source, backgroundDisabled: true }
  if (changed) return { ...message, content: nextContent, source: nextSource }
  const hasOtherInstruction = source.changes.some(change => !isBackgroundPath(change?.path))
  return hasOtherInstruction
    ? { ...message, source: nextSource }
    : { ...message, content: [{ type: 'text', text: '' }], source: nextSource }
}

async function readBackgroundMessage(signal) {
  const absolutePath = join(workspaceRoot(), BACKGROUND_FILE)
  const content = await readFile(absolutePath, { encoding: 'utf8', signal })
  if (Buffer.byteLength(content, 'utf8') > BACKGROUND_MAX_SOURCE_BYTES) {
    throw new Error(`${BACKGROUND_FILE} exceeds the ${String(BACKGROUND_MAX_SOURCE_BYTES)} byte source limit`)
  }
  const rendered = renderWorkspaceContext(
    [{ absolutePath, displayPath: BACKGROUND_FILE, content }],
    { maxBytes: BACKGROUND_MAX_BYTES },
  )
  if (!rendered.text) return undefined
  return createUserMessage({
    content: [{ type: 'text', text: rendered.text }],
    source: { kind: 'plugin', plugin: BACKGROUND_NAMESPACE, form: 'instructions' },
  })
}

function installBackgroundRefresh(ctx) {
  let currentSettings = () => ({ enabled: true, repeatEveryUserPrompts: DEFAULT_BACKGROUND_PROMPTS })
  const provider = settingsOf(ctx)
  if (typeof provider?.register === 'function') {
    const scope = provider.register(BACKGROUND_NAMESPACE, BackgroundSettings, { applies: 'live' })
    currentSettings = () => scope.get()
  }

  ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
    const decision = await next()
    if (decision.kind === 'reject' || signal?.aborted) return decision

    const settings = currentSettings()
    if (settings.enabled === false) {
      const messages = decision.messages.map(suppressBackgroundMessage).filter(message => message !== undefined)
      return messages.length === decision.messages.length && messages.every((message, index) => message === decision.messages[index])
        ? decision
        : { ...decision, messages }
    }
    if (decision.messages.some(isBackgroundMarker)) return decision

    const currentPrompts = userPromptCount(decision.messages)
    const interval = settings.repeatEveryUserPrompts
    if (currentPrompts === 0) return decision

    const events = agent?.session?.events ?? []
    const marker = latestBackgroundMarker(events)
    const disabledMarker = latestDisabledBackgroundMarker(events)
    if (marker < 0 || disabledMarker > marker) {
      try {
        const message = await readBackgroundMessage(signal)
        if (message === undefined) return decision
        const promptIndex = decision.messages.findLastIndex(item => item?.source?.kind === 'user')
        return {
          kind: 'enter',
          messages: decision.messages.toSpliced(promptIndex + 1, 0, message),
        }
      } catch (error) {
        if (!signal?.aborted) ctx.logger?.warn?.('soc-background: startup read failed: %o', error)
        return decision
      }
    }
    if (interval === 0) return decision
    const previousPrompts = userPromptCount(events.slice(marker + 1)
      .flatMap(event => event?.type === 'user/message' ? [event.data] : []))
    if (previousPrompts + currentPrompts < interval) return decision

    try {
      const message = await readBackgroundMessage(signal)
      if (message === undefined) return decision
      const promptIndex = decision.messages.findLastIndex(item => item?.source?.kind === 'user')
      return {
        kind: 'enter',
        messages: decision.messages.toSpliced(promptIndex + 1, 0, message),
      }
    } catch (error) {
      if (!signal?.aborted) ctx.logger?.warn?.('soc-background: refresh failed: %o', error)
      return decision
    }
  }, { prepend: true })
}

function parseMode(value, { strict = false } = {}) {
  if (value === undefined) return 'soc'
  if (value === null) {
    if (strict) throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC access mode must be "soc" or "full".')
    return 'soc'
  }
  if (typeof value === 'string' && ACTION_MODES.includes(value)) return value
  if (strict) throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC access mode must be "soc" or "full".')
  return 'soc'
}

function parseActionStates(value, { strict = false } = {}) {
  if (value === undefined) return new Map()
  if (value === null) {
    if (strict) throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC action state map is invalid.')
    return new Map()
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC action state map is invalid.')
  }
  const entries = Object.entries(value)
  if (entries.length > MANAGED_TOOL_NAMES.length) {
    throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC action state map is invalid.')
  }
  const result = new Map()
  for (const [name, state] of entries) {
    if (!MANAGED_TOOL_NAMES.includes(name) || typeof state !== 'string' || !ACTION_STATES.includes(state)) {
      if (strict) throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC action state map contains an unknown action or state.')
      continue
    }
    if (result.has(name)) {
      throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC action state map contains duplicate actions.')
    }
    result.set(name, state)
  }
  return result
}

function defaultActionState(name) {
  return APPROVAL_TOOLS.has(name) ? 'ask' : 'auto'
}

function normalizedActionPolicy(value, { strict = false } = {}) {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const mode = parseMode(candidate.mode, { strict })
  const configured = parseActionStates(candidate.actionStates, { strict })
  const actionStates = new Map()
  for (const name of MANAGED_TOOL_NAMES) {
    let state = configured.get(name)
    if (state === undefined) state = defaultActionState(name)
    actionStates.set(name, state)
  }
  return { mode, actionStates }
}

function actionStatesObject(actionStates) {
  return Object.fromEntries(actionStates)
}

function savedActionPolicy(ctx, exec) {
  try {
    const value = settingsOf(ctx)?.get?.(ACTION_POLICY_NAMESPACE)
    const policy = normalizedActionPolicy(value)
    const mode = ctx.get?.('socAuth')?.actionMode?.(exec)
    return mode === 'soc' || mode === 'full' ? { ...policy, mode } : policy
  } catch {
    // A malformed or unavailable saved setting must never grant an action.
    return normalizedActionPolicy(undefined)
  }
}

function policyValue(ctx) {
  const policy = savedActionPolicy(ctx)
  const actionStates = actionStatesObject(policy.actionStates)
  return {
    actions: ACTION_CATALOG,
    tools: TOOL_CATALOG,
    mode: policy.mode,
    actionStates,
    source: ctx.get?.('socAuth')?.actionMode?.() ? 'session' : 'deployment',
  }
}

function policyError(error) {
  if (error instanceof ActionPolicyError) {
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
  return runPythonCommand({
    module: 'unified_mcp_server.admin_cli', command, arg, payload, signal,
    timeoutMs: ADMIN_COMMAND_TIMEOUT_MS,
    mapError(kind, stderr, error) {
      if (kind === 'timeout') return new Error(`admin_operation_timeout: The "${command}" operation exceeded ${Math.round(ADMIN_COMMAND_TIMEOUT_MS / 1000)} seconds.`)
      if (kind === 'abort') return new Error('attachment_conversion_cancelled')
      if (kind === 'parse') return error
      if (kind === 'exit' && command === 'convert-attachment') {
        const failure = parseAdminFailure(stderr)
        return new Error(failure
          ? `${failure.code}: ${failure.message}`
          : 'attachment_conversion_failed: The attachment conversion failed.')
      }
      return new Error(adminFailureMessage(command, stderr))
    },
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

async function handleEndpoint(endpoint, payload, signal, ctx) {
  switch (endpoint) {
    case 'get-action-catalog': requireUser(ctx); return ok({ actions: ACTION_CATALOG, tools: TOOL_CATALOG })
    case 'get-admin-action-catalog': requireAdmin(ctx); return ok({ actions: ACTION_CATALOG, tools: TOOL_CATALOG })
    case 'get-action-policy': {
      requireUser(ctx)
      return ok(policyValue(ctx))
    }
    case 'set-action-mode': {
      requireUser(ctx)
      if (!payload || !ACTION_MODES.includes(payload.mode) || Object.keys(payload).some(key => key !== 'mode')) {
        return badRequest('Specify only mode: "soc" or "full".')
      }
      ctx.get('socAuth').setActionMode(payload.mode)
      return ok(policyValue(ctx))
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
      return ok(await runAuthCommand('send-email', { ...payload, session_id: session.applicationSessionId }))
    }
    case 'list-signatures': {
      const session = requireUser(ctx)
      return ok(await runAuthCommand('list-signatures', { session_id: session.applicationSessionId }))
    }
    case 'test-splunk': requireAdmin(ctx); return ok(await testOfficialSplunkConnection(ctx, signal))
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
  installBackgroundRefresh(ctx)
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
      return () => {
        admin?.()
        adminTrailing?.()
      }
    }, 'soc-agent-host: admin web surface')
  }
  installInvestigationProjection(ctx)
  ctx.on('agent/created', ({ agent }) => {
    if (!ctx.agents.roots().includes(agent)) return
    try { agent.ctx.tools.restrict({ allow: [...DOMAIN_TOOLS, ...CONTROL_TOOLS] }) } catch { /* MCP tools may still be registering; pre-execute enforces */ }
  })
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (!DOMAIN_TOOLS.has(exec.name) && !CONTROL_TOOLS.has(exec.name)) {
      return Promise.resolve({ kind: 'deny', reason: 'This harness exposes only approved Splunk, Zimbra, and subscription tools.' })
    }
    const policy = savedActionPolicy(ctx, exec)
    const configuredState = policy.actionStates.get(exec.name)
    if (policy.mode !== 'full' && configuredState === 'disabled') {
      return Promise.resolve({ kind: 'deny', reason: 'This SOC action is disabled by the administrator.' })
    }
    const state = policy.mode === 'full' ? 'auto' : (configuredState ?? defaultActionState(exec.name))
    if (state === 'ask') {
      const auth = ctx.get?.('socAuth')
      const principal = await auth?.principalForAgent?.(exec.agent)
      const harnessSessionId = String(exec.agent?.session?.id ?? exec.agent?.id ?? '')
      if (principal && auth.hasRememberedToolApproval?.(principal, harnessSessionId, exec.name)) {
        return next()
      }
      return Promise.resolve({
        kind: 'ask',
        reason: 'This action changes a SOC system or sends email.',
      })
    }
    return next()
  }, { global: true })
  ctx.connection.rpc.handle(
    CHANNEL,
    async (endpoint, payload, signal) => {
      try {
        return await handleEndpoint(endpoint, payload ?? {}, signal, ctx)
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
        if (endpoint === 'get-action-policy') {
          return policyError(error)
        }
        return internalError('The requested operation failed.')
      }
    },
    { authority: 'trusted-host' },
  )
}
