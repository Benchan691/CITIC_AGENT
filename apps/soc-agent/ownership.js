import pg from 'pg'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'

const { Pool } = pg
const SESSION_COOKIE = 'soc_session'
const SESSION_TTL_SECONDS = 24 * 60 * 60
const SESSION_REPLACED_REASON = 'new_device_login'
const SESSION_REPLACED_MESSAGE = 'A new device logged in to this account. You have been signed out.'
const ADMIN_SESSION_COOKIE = 'soc_admin_session'
const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60
const ADMIN_EMAIL_ENV = 'SOC_ADMIN_EMAIL'
const ADMIN_PASSWORD_ENV = 'SOC_ADMIN_PASSWORD'
const USERNAME = /^[A-Za-z0-9_-]+$/u
const PRIVATE_HTTP_PATHS = new Set(['/api', '/_dsh/memory/settings'])
const PRIVATE_UPGRADE_PATHS = new Set(['/api/events.mux', '/api/events.host'])
const STORAGE_ENV_NAMES = ['APP_POSTGRES_URI', 'LANGGRAPH_POSTGRES_URI', 'POSTGRES_URI']
const PRIVILEGED_API_METHODS = new Set([
  'agentPreset.read',
  'agentPreset.copy',
  'agentPreset.openDocument',
  'agentPreset.remove',
  'host.pickDirectory',
  'host.listDirectory',
  'host.createDirectory',
  'host.openPath',
  'settings.describe',
  'settings.openDocument',
  'settings.update',
  'settings.replace',
  'settings.mutate',
  'credentials.describe',
  'credentials.set',
  'credentials.unset',
  'llm.discoverModels',
])
const MIXED_API_METHODS = new Set(['llm.providers', 'llm.models'])

function storageUriFromServerEnv(serverRoot) {
  try {
    const values = parseEnv(readFileSync(join(serverRoot, '.env'), 'utf8'))
    return STORAGE_ENV_NAMES.map(name => String(values[name] ?? '').trim()).find(Boolean) ?? ''
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    return ''
  }
}

export function resolveApplicationStorageUri(env = process.env, serverRoot) {
  const ambient = STORAGE_ENV_NAMES.map(name => String(env[name] ?? '').trim()).find(Boolean)
  if (ambient) return ambient
  const bundleRoot = dirname(fileURLToPath(import.meta.url))
  return storageUriFromServerEnv(serverRoot || env.DSH_SOC_AGENT_SERVER || join(bundleRoot, 'server'))
}

function adminValuesFromServerEnv(serverRoot) {
  try {
    return parseEnv(readFileSync(join(serverRoot, '.env'), 'utf8'))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    return {}
  }
}

/** Resolve the required static admin identity without ever exposing its values. */
export function resolveAdminCredentials(env = process.env, serverRoot) {
  const bundleRoot = dirname(fileURLToPath(import.meta.url))
  const fileValues = adminValuesFromServerEnv(
    serverRoot || env.DSH_SOC_AGENT_SERVER || join(bundleRoot, 'server'),
  )
  const read = name => {
    const ambient = env[name]
    if (typeof ambient === 'string' && ambient.trim()) return ambient
    return String(fileValues[name] ?? '')
  }
  const email = read(ADMIN_EMAIL_ENV).trim().toLowerCase()
  const password = read(ADMIN_PASSWORD_ENV)
  if (!email || !password.trim()) {
    throw new Error(`${ADMIN_EMAIL_ENV} and ${ADMIN_PASSWORD_ENV} are required`)
  }
  return { email, password }
}

function childEnvironment() {
  const environment = {
    ...process.env,
    MCP_SERVER_ROOT: configuredWorkspaceRoot(),
  }
  // Static admin credentials are consumed only by this Node host. They must
  // never cross the process boundary into a Python child.
  delete environment[ADMIN_EMAIL_ENV]
  delete environment[ADMIN_PASSWORD_ENV]
  return environment
}

function configuredWorkspaceRoot() {
  const bundleRoot = dirname(fileURLToPath(import.meta.url))
  return process.env.MCP_SERVER_ROOT || process.env.MCP_SEVER_ROOT || dirname(dirname(bundleRoot))
}

function userWorkspaceRoot(userId) {
  return join(configuredWorkspaceRoot(), '.data', 'soc-workspaces', String(userId))
}

function generalWorkspacePath(userId) {
  return join(userWorkspaceRoot(userId), 'general')
}

function isGeneralWorkspacePath(path, userId) {
  return resolve(String(path ?? '')) === resolve(generalWorkspacePath(userId))
}

function isWithinPath(root, candidate) {
  const remainder = relative(resolve(root), resolve(candidate))
  return remainder === '' || (remainder !== '..' && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder))
}

function responseError(request, code, message, details = {}) {
  return {
    rpcId: request?.rpcId,
    result: { ok: false, error: { code, message, details } },
  }
}

function notFound(request, kind) {
  return responseError(request, `${kind}-not-found`, `${kind} not found`)
}

function okResult(response) {
  return response?.result?.ok === true
}

function valueOf(response) {
  return okResult(response) ? response.result.value : undefined
}

function requestPayload(request) {
  return request?.payload !== undefined ? request.payload : (request ?? {})
}

function sessionIdOf(agent) {
  return String(agent?.id ?? agent?.session?.id ?? '')
}

function cookieValue(request) {
  const raw = String(request?.headers?.cookie ?? '')
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SESSION_COOKIE) {
      try { return decodeURIComponent(rest.join('=')) } catch { return '' }
    }
  }
  return ''
}

function requestCookieValue(request, name) {
  const raw = String(request?.headers?.cookie ?? '')
  for (const part of raw.split(';')) {
    const [cookieName, ...rest] = part.trim().split('=')
    if (cookieName === name) {
      try { return decodeURIComponent(rest.join('=')) } catch { return '' }
    }
  }
  return ''
}

function secureCookie(request) {
  const forwarded = String(request?.headers?.['x-forwarded-proto'] ?? '').split(',', 1)[0].trim().toLowerCase()
  return forwarded === 'https' || Boolean(request?.socket?.encrypted)
}

function cookieHeader(value, request, maxAge = SESSION_TTL_SECONDS) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${String(maxAge)}`,
  ]
  if (secureCookie(request)) parts.push('Secure')
  return parts.join('; ')
}

function adminCookieHeader(value, request, maxAge = ADMIN_SESSION_TTL_SECONDS) {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${String(maxAge)}`,
  ]
  if (secureCookie(request)) parts.push('Secure')
  return parts.join('; ')
}

function sameSiteRequest(request) {
  const fetchSite = String(request?.headers?.['sec-fetch-site'] ?? '').toLowerCase()
  if (fetchSite === 'cross-site') return false
  const origin = request?.headers?.origin
  if (!origin) return true
  try {
    return new URL(origin).host === String(request.headers.host ?? '')
  } catch {
    return false
  }
}

async function readJson(request, limit = 32 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw new Error('request too large')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  const value = JSON.parse(text || '{}')
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('request must be an object')
  return value
}

function sendJson(response, status, body, headers = {}) {
  const data = Buffer.from(JSON.stringify(body))
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': data.length,
    ...headers,
  })
  response.end(data)
}

function workspacePath(value) {
  return typeof value === 'string' ? resolve(value) : ''
}

function isPrivateHttpRoute(path) {
  const value = String(path ?? '')
  return PRIVATE_HTTP_PATHS.has(value) || value.startsWith('/soc-agent-')
}

function apiMethodFromPath(path) {
  const value = String(path ?? '')
  return value.startsWith('/api/') ? value.slice('/api/'.length) : ''
}

export function isPrivilegedApiPath(path) {
  return PRIVILEGED_API_METHODS.has(apiMethodFromPath(path))
}

export function isMixedApiPath(path) {
  return MIXED_API_METHODS.has(apiMethodFromPath(path))
}

function isPrivateUpgradeRoute(path) {
  return PRIVATE_UPGRADE_PATHS.has(String(path ?? ''))
}

export class SocStateStore {
  constructor(uri = resolveApplicationStorageUri()) {
    this.pool = String(uri).trim() ? new Pool({ connectionString: String(uri).trim(), max: 10 }) : undefined
  }

  async ensureSchema() {
    if (!this.pool) return
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS soc_users (
        id TEXT PRIMARY KEY,
        zimbra_email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS soc_app_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES soc_users(id) ON DELETE CASCADE,
        zimbra_token_encrypted TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS soc_app_sessions_user_idx ON soc_app_sessions(user_id);
      CREATE INDEX IF NOT EXISTS soc_app_sessions_expiry_idx ON soc_app_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS soc_session_revocations (
        session_id TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS soc_workspace_owners (
        workspace_id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL REFERENCES soc_users(id) ON DELETE CASCADE,
        workspace_path TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS soc_session_owners (
        session_id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL REFERENCES soc_users(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS soc_session_owners_user_idx ON soc_session_owners(owner_user_id);
      CREATE INDEX IF NOT EXISTS soc_session_owners_workspace_idx ON soc_session_owners(workspace_id);
      CREATE TABLE IF NOT EXISTS soc_folder_owners (
        folder_id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL REFERENCES soc_users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS soc_bootstrap (
        key TEXT PRIMARY KEY,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
  }

  async close() {
    await this.pool?.end()
  }

  async session(id) {
    if (!this.pool || !USERNAME.test(String(id ?? ''))) return undefined
    const result = await this.pool.query(`
      SELECT s.id, s.user_id, u.zimbra_email, s.expires_at
      FROM soc_app_sessions AS s JOIN soc_users AS u ON u.id = s.user_id
      WHERE s.id = $1
    `, [id])
    const row = result.rows[0]
    if (!row) return undefined
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await this.deleteSession(id)
      return undefined
    }
    return { id: String(row.id), userId: String(row.user_id), email: String(row.zimbra_email), expiresAt: new Date(row.expires_at) }
  }

  async activeSessionForUser(userId) {
    if (!this.pool || !userId) return undefined
    const result = await this.pool.query(`
      SELECT id
      FROM soc_app_sessions
      WHERE user_id = $1 AND expires_at > NOW()
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `, [userId])
    const row = result.rows[0]
    return row ? await this.session(String(row.id)) : undefined
  }

  async deleteSession(id) {
    if (!this.pool || !id) return false
    const result = await this.pool.query('DELETE FROM soc_app_sessions WHERE id = $1 RETURNING id', [id])
    return result.rowCount === 1
  }

  async consumeSessionRevocation(id) {
    if (!this.pool || !id) return undefined
    const result = await this.pool.query(`
      DELETE FROM soc_session_revocations
      WHERE session_id = $1 AND expires_at > NOW()
      RETURNING reason
    `, [String(id)])
    const reason = result.rows[0]?.reason
    return reason ? String(reason) : undefined
  }

  async workspaceOwner(id) {
    if (!this.pool || !id) return undefined
    const result = await this.pool.query('SELECT owner_user_id, workspace_path FROM soc_workspace_owners WHERE workspace_id = $1', [id])
    const row = result.rows[0]
    return row ? { userId: String(row.owner_user_id), path: String(row.workspace_path) } : undefined
  }

  async workspaceOwnerByPath(path) {
    if (!this.pool || !path) return undefined
    const result = await this.pool.query('SELECT workspace_id, owner_user_id FROM soc_workspace_owners WHERE workspace_path = $1', [path])
    const row = result.rows[0]
    return row ? { workspaceId: String(row.workspace_id), userId: String(row.owner_user_id) } : undefined
  }

  async userWorkspaceIds(userId) {
    if (!this.pool) return new Set()
    const result = await this.pool.query('SELECT workspace_id FROM soc_workspace_owners WHERE owner_user_id = $1', [userId])
    return new Set(result.rows.map(row => String(row.workspace_id)))
  }

  async claimWorkspace(workspaceId, userId, path) {
    if (!this.pool || !workspaceId || !userId) return false
    const result = await this.pool.query(`
      INSERT INTO soc_workspace_owners (workspace_id, owner_user_id, workspace_path)
      VALUES ($1, $2, $3)
      ON CONFLICT (workspace_id) DO UPDATE
      SET workspace_path = EXCLUDED.workspace_path
      WHERE soc_workspace_owners.owner_user_id = EXCLUDED.owner_user_id
      RETURNING owner_user_id
    `, [workspaceId, userId, path])
    return result.rowCount === 1
  }

  async deleteWorkspace(workspaceId) {
    if (!this.pool || !workspaceId) return
    await this.pool.query('DELETE FROM soc_session_owners WHERE workspace_id = $1', [workspaceId])
    await this.pool.query('DELETE FROM soc_workspace_owners WHERE workspace_id = $1', [workspaceId])
  }

  async sessionOwner(id) {
    if (!this.pool || !id) return undefined
    const result = await this.pool.query('SELECT owner_user_id, workspace_id FROM soc_session_owners WHERE session_id = $1', [id])
    const row = result.rows[0]
    return row ? { userId: String(row.owner_user_id), workspaceId: String(row.workspace_id) } : undefined
  }

  async userSessionIds(userId) {
    if (!this.pool) return new Set()
    const result = await this.pool.query(`
      SELECT sessions.session_id
      FROM soc_session_owners AS sessions
      JOIN soc_workspace_owners AS workspaces
        ON workspaces.workspace_id = sessions.workspace_id
      WHERE sessions.owner_user_id = $1
        AND workspaces.owner_user_id = $1
    `, [userId])
    return new Set(result.rows.map(row => String(row.session_id)))
  }

  async claimSession(sessionId, userId, workspaceId) {
    if (!this.pool || !sessionId || !userId || !workspaceId) return false
    const result = await this.pool.query(`
      INSERT INTO soc_session_owners (session_id, owner_user_id, workspace_id)
      SELECT $1, $2, $3
      WHERE EXISTS (
        SELECT 1 FROM soc_workspace_owners
        WHERE workspace_id = $3 AND owner_user_id = $2
      )
      ON CONFLICT (session_id) DO NOTHING
      RETURNING session_id
    `, [sessionId, userId, workspaceId])
    if (result.rowCount === 1) return true
    const owner = await this.sessionOwner(sessionId)
    if (!owner || owner.userId !== userId || owner.workspaceId !== workspaceId) return false
    return (await this.workspaceOwner(workspaceId))?.userId === userId
  }

  async deleteSessionOwner(sessionId) {
    if (!this.pool || !sessionId) return
    await this.pool.query('DELETE FROM soc_session_owners WHERE session_id = $1', [sessionId])
  }

  async folderOwner(id) {
    if (!this.pool || !id) return undefined
    const result = await this.pool.query('SELECT owner_user_id FROM soc_folder_owners WHERE folder_id = $1', [id])
    return result.rows[0] ? String(result.rows[0].owner_user_id) : undefined
  }

  async userFolderIds(userId) {
    if (!this.pool) return new Set()
    const result = await this.pool.query('SELECT folder_id FROM soc_folder_owners WHERE owner_user_id = $1', [userId])
    return new Set(result.rows.map(row => String(row.folder_id)))
  }

  async claimFolder(folderId, userId) {
    if (!this.pool || !folderId || !userId) return false
    const result = await this.pool.query(`
      INSERT INTO soc_folder_owners (folder_id, owner_user_id) VALUES ($1, $2)
      ON CONFLICT (folder_id) DO NOTHING RETURNING folder_id
    `, [folderId, userId])
    if (result.rowCount === 1) return true
    return (await this.folderOwner(folderId)) === userId
  }

  async deleteFolder(folderId) {
    if (!this.pool || !folderId) return
    await this.pool.query('DELETE FROM soc_folder_owners WHERE folder_id = $1', [folderId])
  }

  async clearLegacyWorkspaceState(registry, persistence) {
    if (!this.pool) return
    const marker = await this.pool.query("SELECT 1 FROM soc_bootstrap WHERE key = 'workspace-ownership-v1'")
    if (marker.rowCount !== 0) return
    await this.pool.query('DELETE FROM soc_session_owners')
    await this.pool.query('DELETE FROM soc_workspace_owners')
    await this.pool.query('DELETE FROM soc_folder_owners')
    if (registry) {
      for (const workspace of registry.list()) await registry.delete(workspace.id)
    }
    if (persistence) {
      for (const session of await persistence.list()) await persistence.deleteSession(session.id)
    }
    await this.pool.query("INSERT INTO soc_bootstrap (key) VALUES ('workspace-ownership-v1') ON CONFLICT (key) DO NOTHING")
  }
}

function parseAuthFailure(stderr) {
  const lines = String(stderr || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  for (const line of lines.reverse()) {
    try {
      const value = JSON.parse(line)
      if (value && typeof value === 'object' && typeof value.code === 'string' && typeof value.message === 'string') return value
    } catch { /* ignore launcher noise */ }
  }
  return undefined
}

function authCommandError(command, stderr = '') {
  if (command === 'login') return new Error('authentication_failed')
  const failure = parseAuthFailure(stderr)
  if (failure) {
    const error = new Error(failure.message)
    error.code = failure.code
    error.details = failure.details && typeof failure.details === 'object' ? failure.details : {}
    return error
  }
  return new Error(command === 'logout' ? 'logout_failed' : 'operation_failed')
}

// Privileged helper subprocesses are bounded so a hung Python process can
// never hold an authenticated UI request open indefinitely. Publication runs
// the same bound: the Splunk upload and read-back must finish within it.
const AUTH_COMMAND_TIMEOUT_MS = Number(process.env.SOC_AUTH_COMMAND_TIMEOUT_MS ?? 185_000)
const CONTROL_CHANNEL_START_TIMEOUT_MS = 60_000
// 'off' always spawns a fresh interpreter; 'auto' (default) uses the
// persistent control channel and falls back to spawning when it is unusable.
const controlChannelMode = () => String(process.env.SOC_CONTROL_CHANNEL ?? 'auto').toLowerCase()

async function spawnAuthCommand(command, payload) {
  const { spawn } = await import('node:child_process')
  const bundleRoot = dirname(fileURLToPath(import.meta.url))
  const serverRoot = process.env.DSH_SOC_AGENT_SERVER || join(bundleRoot, 'server')
  const workspaceRoot = process.env.MCP_SERVER_ROOT || process.env.MCP_SEVER_ROOT || dirname(dirname(bundleRoot))
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('uv', ['run', 'python', '-m', 'unified_mcp_server.auth_cli', command], {
      cwd: serverRoot,
      env: childEnvironment(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timeoutTimer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      const error = authCommandError(command)
      error.code = 'operation_timeout'
      rejectPromise(error)
    }, AUTH_COMMAND_TIMEOUT_MS)
    timeoutTimer.unref?.()
    const fail = () => {
      if (settled) return
      settled = true
      clearTimeout(timeoutTimer)
      child.kill('SIGTERM')
      rejectPromise(authCommandError(command))
    }
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', fail)
    child.on('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timeoutTimer)
      if (code !== 0) {
        rejectPromise(authCommandError(command, stderr))
        return
      }
      try { resolvePromise(JSON.parse(stdout || '{}')) } catch { rejectPromise(authCommandError(command)) }
    })
    child.stdin.end(JSON.stringify(payload ?? {}))
  })
}

let controlChannel = null
let controlChannelStarting = null

async function startControlChannel() {
  const { spawn } = await import('node:child_process')
  const bundleRoot = dirname(fileURLToPath(import.meta.url))
  const serverRoot = process.env.DSH_SOC_AGENT_SERVER || join(bundleRoot, 'server')
  const child = spawn('uv', ['run', 'python', '-m', 'unified_mcp_server.control_server'], {
    cwd: serverRoot,
    env: childEnvironment(),
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const channel = {
    child,
    pending: new Map(),
    nextId: 1,
    lineBuffer: '',
    ready: { settled: false, timer: null },
    broken: false,
  }
  const failPending = message => {
    channel.broken = true
    if (!channel.ready.settled) {
      channel.ready.settled = true
      clearTimeout(channel.ready.timer)
      rejectReady(Object.assign(new Error('control channel failed to start'), { controlUnavailable: true }))
    }
    for (const entry of channel.pending.values()) {
      clearTimeout(entry.timer)
      const error = new Error(message)
      error.code = entry.sent ? 'operation_outcome_unknown' : 'operation_failed'
      error.controlUnavailable = !entry.sent
      if (entry.sent) error.message = 'The connection ended before the operation was confirmed. Check its result before trying again.'
      entry.reject(error)
    }
    channel.pending.clear()
  }
  child.on('error', error => {
    failPending(`control channel unavailable: ${String(error)}`)
  })
  child.on('close', () => {
    failPending('control channel exited before responding')
  })
  child.stderr.on('data', () => { /* diagnostics only; errors travel in responses */ })
  child.stdout.on('data', chunk => {
    channel.lineBuffer += String(chunk)
    let newlineIndex = channel.lineBuffer.indexOf('\n')
    while (newlineIndex !== -1) {
      const line = channel.lineBuffer.slice(0, newlineIndex).trim()
      channel.lineBuffer = channel.lineBuffer.slice(newlineIndex + 1)
      newlineIndex = channel.lineBuffer.indexOf('\n')
      if (Buffer.byteLength(line) + 1 > 8_000_000) {
        channel.close()
        return
      }
      if (!line) continue
      let response
      try { response = JSON.parse(line) } catch { continue }
      if (response?.ready !== undefined && !channel.ready.settled) {
        channel.ready.settled = true
        clearTimeout(channel.ready.timer)
        if (response.ready === true) resolveReady()
        else {
          rejectReady(Object.assign(new Error('control channel failed to start'), { controlUnavailable: true }))
          failPending('control channel failed to start')
        }
        continue
      }
      const entry = channel.pending.get(String(response?.id ?? ''))
      if (!entry) continue
      channel.pending.delete(String(response.id))
      clearTimeout(entry.timer)
      if (response.ok === true) entry.resolve(response.result ?? {})
      else {
        const failure = response.error && typeof response.error === 'object' ? response.error : {}
        const error = new Error(String(failure.message ?? 'The requested operation failed.'))
        error.code = String(failure.code ?? 'operation_failed')
        error.details = failure.details && typeof failure.details === 'object' ? failure.details : {}
        entry.reject(error)
      }
    }
    if (Buffer.byteLength(channel.lineBuffer) > 8_000_000) channel.close()
  })
  channel.close = () => { failPending('control channel closed'); child.kill('SIGTERM') }
  const writeLock = { current: Promise.resolve() }
  channel.send = request => {
    const result = writeLock.current.then(() => new Promise((resolvePromise, rejectPromise) => {
      if (channel.broken || child.stdin.destroyed) {
        rejectPromise(Object.assign(new Error('control channel is not usable'), { controlUnavailable: true }))
        return
      }
      const entry = channel.pending.get(String(request.id))
      if (!entry) { resolvePromise(); return } // A queued write may have timed out before transmission.
      const line = `${JSON.stringify(request)}\n`
      if (Buffer.byteLength(line) > 8_000_000) {
        rejectPromise(Object.assign(new Error('The operation exceeds the request size limit.'), { code: 'invalid_request' }))
        return
      }
      entry.sent = true
      child.stdin.write(line, writeError => {
        if (writeError) rejectPromise(Object.assign(new Error('The operation may have been received. Check its result before trying again.'), { code: 'operation_outcome_unknown' }))
        else resolvePromise()
      })
    }))
    writeLock.current = result.catch(() => {})
    return result
  }
  let resolveReady, rejectReady
  channel.ready = new Promise((resolvePromise, rejectPromise) => {
    resolveReady = resolvePromise
    rejectReady = rejectPromise
  })
  channel.ready.settled = false
  channel.ready.timer = setTimeout(() => {
    if (channel.ready.settled) return
    channel.ready.settled = true
    rejectReady(Object.assign(new Error('control channel startup timed out'), { controlUnavailable: true }))
    failPending('control channel startup timed out')
    child.kill('SIGTERM')
  }, CONTROL_CHANNEL_START_TIMEOUT_MS)
  channel.ready.timer.unref?.()
  try {
    await channel.ready
  } catch (error) {
    failPending('control channel failed to start')
    throw error
  }
  return channel
}

async function withControlChannel(command, payload) {
  if (!controlChannel || controlChannel.broken) {
    controlChannelStarting ??= startControlChannel().then(channel => { controlChannel = channel; return channel }).finally(() => { controlChannelStarting = null })
    await controlChannelStarting
  }
  const channel = controlChannel
  const id = String(channel.nextId++)
  return await new Promise((resolvePromise, rejectPromise) => {
    const entry = {
      sent: false,
      timer: setTimeout(() => {
        channel.pending.delete(id)
        const error = new Error('The operation was not confirmed before its deadline. Check its result before trying again.')
        error.code = entry.sent ? 'operation_outcome_unknown' : 'operation_timeout'
        rejectPromise(error)
      }, AUTH_COMMAND_TIMEOUT_MS),
      resolve: resolvePromise,
      reject: rejectPromise,
    }
    entry.timer.unref?.()
    channel.pending.set(id, entry)
    channel.send({ id, command, payload: payload ?? {} }).catch(error => {
      channel.pending.delete(id)
      clearTimeout(entry.timer)
      rejectPromise(error)
    })
  })
}

export async function runAuthCommand(command, payload) {
  if (controlChannelMode() === 'off') return spawnAuthCommand(command, payload)
  try {
    return await withControlChannel(command, payload)
  } catch (error) {
    if (error?.controlUnavailable === true) {
      // Fall back only before transmission. Lost responses must never replay
      // an email send, catalog publication, or other ambiguous mutation.
      controlChannel = null
      return spawnAuthCommand(command, payload)
    }
    throw error
  }
}

export async function closeAuthControlChannel() {
  const channel = controlChannel ?? await controlChannelStarting?.catch(() => null)
  controlChannel = null
  channel?.close()
}

function withPayload(frame, payload) {
  return frame?.payload !== undefined ? { ...frame, payload } : payload
}

async function sessionBelongsToUser(store, sessionId, userId) {
  const owner = await store.sessionOwner(String(sessionId))
  if (!owner || owner.userId !== userId) return false
  const workspace = await store.workspaceOwner(owner.workspaceId)
  return Boolean(workspace && workspace.userId === userId)
}

async function filterFrame(frame, store, userId, rememberPendingResponse, applicationSessionId) {
  const payload = frame?.payload ?? frame
  return (async () => {
    if (payload?.sessionId) {
      if (!(await sessionBelongsToUser(store, payload.sessionId, userId))) return undefined
      if (rememberPendingResponse && (payload.type === 'approval/requested' || payload.type === 'question/requested')) {
        rememberPendingResponse(frame?.rpcId, payload.sessionId, applicationSessionId)
      }
      return frame
    }
    if (payload?.type === 'host/workspace-changed' && payload.workspace?.workspaceId) {
      const owner = await store.workspaceOwner(String(payload.workspace.workspaceId))
      if (owner?.userId !== userId) return undefined
      const ownSessions = await store.userSessionIds(userId)
      return withPayload(frame, {
        ...payload,
        workspace: {
          ...payload.workspace,
          sessionIds: (payload.workspace.sessionIds ?? []).filter(id => ownSessions.has(String(id))),
        },
      })
    }
    if (payload?.type === 'host/workspace-removed' && payload.workspaceId) {
      return (await store.userWorkspaceIds(userId)).has(String(payload.workspaceId)) ? frame : undefined
    }
    if (payload?.type === 'host/workspace-order-changed' && Array.isArray(payload.workspaceIds)) {
      const allowed = await store.userWorkspaceIds(userId)
      return withPayload(frame, {
        ...payload,
        workspaceIds: payload.workspaceIds.filter(id => allowed.has(String(id))),
      })
    }
    if (payload?.type === 'host/archived-sessions-changed' && Array.isArray(payload.archivedSessionIds)) {
      const allowed = await store.userSessionIds(userId)
      return withPayload(frame, {
        ...payload,
        archivedSessionIds: payload.archivedSessionIds.filter(id => allowed.has(String(id))),
      })
    }
    // Remote events are an unprojected host-level escape hatch. They are not
    // safe to forward through a multi-user stream because their arguments may
    // contain workspace/session identifiers or other user data.
    if (payload?.type === 'stream/error') {
      return withPayload(frame, {
        type: 'stream/error',
        error: { code: 'internal', message: 'event stream unavailable', details: {} },
      })
    }
    return undefined
  })()
}

async function* filteredFrames(frames, store, userId, applicationSessionId, rememberPendingResponse) {
  for await (const frame of frames) {
    if (applicationSessionId && typeof store.session === 'function') {
      const application = await store.session(applicationSessionId)
      if (!application || application.userId !== userId) return
    }
    const filtered = await filterFrame(frame, store, userId, rememberPendingResponse, applicationSessionId)
    if (filtered !== undefined) yield filtered
  }
}

export function createScopedApiProxy(api, auth) {
  const domains = new Set([
    'sessions',
    'subagents',
    'workspace',
    'folders',
    'events',
    'downloads',
    'skills',
    'agentPresets',
    'goals',
  ])
  const domainCache = new Map()
  const originalRespond = api.respond

  const current = () => auth.currentSession()
  const deny = (request, kind) => notFound(request, kind)
  const ownsWorkspace = async (id, userId) => (await auth.store.workspaceOwner(String(id)))?.userId === userId
  const ownsSession = async (id, userId) => sessionBelongsToUser(auth.store, id, userId)
  const ownsFolder = async (id, userId) => (await auth.store.folderOwner(String(id))) === userId

  async function normalizeWorkspaceCreateRequest(request, session) {
    const payload = requestPayload(request)
    if (!Object.hasOwn(payload, 'path')) return { request }
    const rawPath = payload.path
    if (typeof rawPath !== 'string') {
      return {
        response: responseError(request, 'workspace-invalid-path', 'workspace name must be a non-empty single directory name', {
          path: '',
        }),
      }
    }
    const name = rawPath.trim()
    if (isAbsolute(name) || name === '' || name === '.' || name === '..' || /[/\\\0]/u.test(name)) {
      return {
        response: responseError(request, 'workspace-invalid-path', 'workspace path must be a non-empty single directory name', {
          path: '',
        }),
      }
    }
    const path = name.toLowerCase() === 'general'
      ? generalWorkspacePath(session.userId)
      : join(userWorkspaceRoot(session.userId), name)
    try {
      await mkdir(path, { recursive: true })
      const [rootPath, canonicalPath] = await Promise.all([
        realpath(userWorkspaceRoot(session.userId)),
        realpath(path),
      ])
      if (!isWithinPath(rootPath, canonicalPath) || canonicalPath === rootPath) {
        return {
          response: responseError(request, 'workspace-invalid-path', 'workspace path must remain within the private workspace root', {
            path: '',
          }),
        }
      }
      return { request: { ...request, payload: { ...payload, path: canonicalPath } } }
    } catch {
      return {
        response: responseError(request, 'workspace-invalid-path', 'workspace path could not be prepared', {
          path: '',
        }),
      }
    }
  }

  async function authorize(domain, method, request) {
    const session = current()
    if (!session) return deny(request, domain === 'workspace' ? 'workspace' : 'session')
    const payload = requestPayload(request)
    if (domain === 'workspace') {
      if (auth.registry !== undefined) await auth.ensureGeneral?.(session.userId)
      if (method === 'create') {
        if (!payload.path) return undefined
        const existing = await auth.store.workspaceOwnerByPath(workspacePath(payload.path))
        return existing && existing.userId !== session.userId ? deny(request, 'workspace') : undefined
      }
      if (payload.workspaceId) {
        const owner = await auth.store.workspaceOwner(String(payload.workspaceId))
        if (owner?.userId !== session.userId) return deny(request, 'workspace')
        if ((method === 'rename' || method === 'delete') && isGeneralWorkspacePath(owner.path, session.userId)) {
          return responseError(request, 'workspace-protected', 'General is protected and cannot be renamed or deleted', {
            workspaceId: String(payload.workspaceId),
          })
        }
      }
      if (method === 'insertBefore' && payload.beforeWorkspaceId && !(await ownsWorkspace(payload.beforeWorkspaceId, session.userId))) return deny(request, 'workspace')
      if (method === 'insertSessionBefore') {
        if (!(await ownsWorkspace(payload.workspaceId, session.userId))) return deny(request, 'workspace')
        if (!(await ownsSession(payload.sessionId, session.userId))) return deny(request, 'session')
        if (payload.beforeSessionId && !(await ownsSession(payload.beforeSessionId, session.userId))) return deny(request, 'session')
      }
      if (method === 'archiveSession' && !(await ownsSession(payload.sessionId, session.userId))) return deny(request, 'session')
      return undefined
    }
    if (domain === 'sessions') {
      if (method === 'create') {
        if (!payload.workspaceId || !(await ownsWorkspace(payload.workspaceId, session.userId))) return deny(request, 'workspace')
        if (payload.sessionId) {
          const existing = await auth.store.sessionOwner(payload.sessionId)
          if (existing && existing.userId !== session.userId) return deny(request, 'session')
          if (existing && existing.workspaceId !== String(payload.workspaceId)) return deny(request, 'session')
        }
        if (payload.folderId && !(await ownsFolder(payload.folderId, session.userId))) return deny(request, 'folder')
        return undefined
      }
      if (method === 'list' || method === 'search') return undefined
      if (!(await ownsSession(payload.sessionId, session.userId))) return deny(request, 'session')
      return undefined
    }
    if (domain === 'subagents') {
      if (!(await ownsSession(payload.parentSessionId, session.userId))) return deny(request, 'session')
      if (payload.childSessionId && !(await ownsSession(payload.childSessionId, session.userId))) return deny(request, 'session')
      return undefined
    }
    if (domain === 'folders') {
      if (method === 'list' || method === 'create') return undefined
      if (payload.folderId && !(await ownsFolder(payload.folderId, session.userId))) return deny(request, 'folder')
      if (payload.sessionId && !(await ownsSession(payload.sessionId, session.userId))) return deny(request, 'session')
      return undefined
    }
    if (domain === 'downloads') {
      return (await ownsSession(payload.sessionId, session.userId)) ? undefined : deny(request, 'session')
    }
    if (domain === 'skills' && method === 'list') {
      return (await ownsSession(payload.sessionId, session.userId)) ? undefined : deny(request, 'session')
    }
    if (domain === 'agentPresets' && method === 'select') {
      return (await ownsSession(payload.sessionId, session.userId)) ? undefined : deny(request, 'session')
    }
    if (domain === 'goals') {
      return (await ownsSession(payload.sessionId, session.userId)) ? undefined : deny(request, 'session')
    }
    return undefined
  }

  async function postprocess(domain, method, request, response, target) {
    const session = current()
    if (!session || !okResult(response)) return response
    const value = valueOf(response)
    if (domain === 'workspace') {
      if (method === 'list') {
        const allowed = await auth.store.userWorkspaceIds(session.userId)
        const ownSessions = await auth.store.userSessionIds(session.userId)
        return { ...response, result: { ...response.result, value: {
          ...value,
          items: (value?.items ?? []).filter(item => allowed.has(String(item.workspaceId))).map(item => ({
            ...item,
            sessionIds: (item.sessionIds ?? []).filter(id => ownSessions.has(String(id))),
          })),
          archivedSessionIds: (value?.archivedSessionIds ?? []).filter(id => ownSessions.has(String(id))),
        } } }
      }
      if (method === 'create') {
        const workspace = value?.workspace
        if (!workspace || !(await auth.store.claimWorkspace(String(workspace.workspaceId), session.userId, workspace.path))) {
          return deny(request, 'workspace')
        }
      }
      if (method === 'delete') await auth.store.deleteWorkspace(request.payload.workspaceId)
      return response
    }
    if (domain === 'sessions') {
      if (method === 'list') {
        const allowed = await auth.store.userSessionIds(session.userId)
        const folders = await auth.store.userFolderIds(session.userId)
        return { ...response, result: { ...response.result, value: { ...value, items: (value?.items ?? [])
          .filter(item => allowed.has(String(item.sessionId)))
          .map(item => item.folderId && !folders.has(String(item.folderId)) ? { ...item, folderId: undefined } : item) } } }
      }
      if (method === 'search') {
        const allowed = await auth.store.userSessionIds(session.userId)
        return { ...response, result: { ...response.result, value: {
          ...value,
          items: (value?.items ?? []).filter(item => allowed.has(String(item.sessionId))),
          hasMore: false,
        } } }
      }
      if (method === 'create' || method === 'fork') {
        const childId = String(value?.sessionId ?? '')
        const workspaceId = method === 'create'
          ? String(request.payload.workspaceId ?? '')
          : (await auth.store.sessionOwner(request.payload.sessionId))?.workspaceId
        if (!childId || !workspaceId || !(await auth.store.claimSession(childId, session.userId, workspaceId))) {
          return deny(request, 'session')
        }
        auth.bindAgentSession(childId)
      }
      if (method === 'prompt') auth.bindAgentSession(request.payload.sessionId)
      if (method === 'delete') {
        await auth.store.deleteSessionOwner(request.payload.sessionId)
        auth.unbindAgentSession(request.payload.sessionId)
      }
      return response
    }
    if (domain === 'subagents' && method === 'list') {
      const entries = []
      for (const entry of value?.entries ?? []) {
        if (await ownsSession(entry.id, session.userId)) entries.push(entry)
      }
      return { ...response, result: { ...response.result, value: { ...value, entries } } }
    }
    if (domain === 'folders') {
      const ownSessions = await auth.store.userSessionIds(session.userId)
      const filterFolder = folder => folder && {
        ...folder,
        sessionIds: (folder.sessionIds ?? []).filter(id => ownSessions.has(String(id))),
      }
      if (method === 'list') {
        const allowed = await auth.store.userFolderIds(session.userId)
        return { ...response, result: { ...response.result, value: { ...value, items: (value?.items ?? [])
          .filter(item => allowed.has(String(item.folderId)))
          .map(item => filterFolder(item)) } } }
      }
      if (method === 'get' || method === 'rename' || method === 'moveSessionToFolder') {
        return { ...response, result: { ...response.result, value: {
          ...value,
          folder: filterFolder(value?.folder),
        } } }
      }
      if (method === 'listSessionsByFolder') {
        const allowed = await auth.store.userSessionIds(session.userId)
        return { ...response, result: { ...response.result, value: {
          ...value,
          items: (value?.items ?? []).filter(item => allowed.has(String(item.sessionId))),
        } } }
      }
      if (method === 'create') {
        const folder = value?.folder
        if (!folder || !(await auth.store.claimFolder(String(folder.folderId), session.userId))) return deny(request, 'folder')
      }
      if (method === 'delete') await auth.store.deleteFolder(request.payload.folderId)
      return response
    }
    return response
  }

  function wrapDomain(domain, target) {
    if (domainCache.has(domain)) return domainCache.get(domain)
    const wrapped = new Proxy(target, {
      get(object, property, receiver) {
        const method = Reflect.get(object, property, receiver)
        if (typeof method !== 'function') return method
        if (domain === 'events') {
          return (...args) => {
            const session = current()
            if (!session) return (async function* () {})()
            return (async function* () {
              let scopedArgs = args
              const applicationSignal = auth.applicationSessionSignal?.(session.id)
              if (applicationSignal) {
                const callerSignal = args[1]
                const signal = callerSignal && typeof callerSignal.addEventListener === 'function'
                  ? AbortSignal.any([callerSignal, applicationSignal])
                  : applicationSignal
                scopedArgs = [args[0], signal, ...args.slice(2)]
              }
              const request = args[0]
              const rawSince = request?.payload?.since
              if (String(property) === 'mux' && rawSince && typeof rawSince === 'object' && !Array.isArray(rawSince)) {
                const allowed = await auth.store.userSessionIds(session.userId)
                const since = Object.fromEntries(Object.entries(rawSince).filter(([id]) => allowed.has(String(id))))
                scopedArgs = [{ ...request, payload: { ...request.payload, since } }, ...scopedArgs.slice(1)]
              }
              yield* filteredFrames(
                Reflect.apply(method, object, scopedArgs),
                auth.store,
                session.userId,
                session.id,
                (rpcId, sessionId, applicationSessionId) => auth.rememberPendingResponse?.(rpcId, sessionId, applicationSessionId),
              )
            })()
          }
        }
        return async (...args) => {
          let scopedArgs = args
          let request = args[0]
          if (domain === 'workspace' && String(property) === 'create' && current()) {
            const normalized = await normalizeWorkspaceCreateRequest(request, current())
            if (normalized.response) return normalized.response
            if (normalized.request !== request) {
              scopedArgs = [normalized.request, ...args.slice(1)]
              request = normalized.request
            }
          }
          const refused = await authorize(domain, String(property), request)
          if (refused) {
            if (domain === 'downloads') return new Response('session not found', { status: 404 })
            return refused
          }
          const bindSession = (domain === 'sessions' && String(property) === 'prompt')
            || (domain === 'subagents' && String(property) === 'prompt')
          const boundSessionId = bindSession ? request?.payload?.sessionId ?? request?.payload?.childSessionId : undefined
          if (boundSessionId) auth.bindAgentSession(boundSessionId)
          let response
          try {
            response = await Reflect.apply(method, object, scopedArgs)
          } catch (error) {
            if (boundSessionId) auth.unbindAgentSession(boundSessionId)
            throw error
          }
          if (boundSessionId && !okResult(response)) auth.unbindAgentSession(boundSessionId)
          return await postprocess(domain, String(property), request, response, object)
        }
      },
    })
    domainCache.set(domain, wrapped)
    return wrapped
  }

  return new Proxy(api, {
    get(object, property, receiver) {
      if (property === 'respond') {
        return async message => {
          const session = current()
          if (!session) return { ok: false, error: { code: 'authentication-required', message: 'authentication required' } }
          if (message?.result?.ok && message.result.value?.sessionId
            && !(await ownsSession(message.result.value.sessionId, session.userId))) {
            return { accepted: false, reason: 'not-pending' }
          }
          if (!message?.result?.ok) {
            const targetSessionId = auth.pendingResponseSession?.(message?.rpcId)
            if (!targetSessionId || !(await ownsSession(targetSessionId, session.userId))) {
              return { accepted: false, reason: 'not-pending' }
            }
          }
          const result = await originalRespond.call(object, message)
          if (result?.accepted === true || result?.reason === 'not-pending') {
            auth.forgetPendingResponse?.(message?.rpcId)
          }
          return result
        }
      }
      if (domains.has(String(property))) return wrapDomain(String(property), Reflect.get(object, property, receiver))
      return Reflect.get(object, property, receiver)
    },
  })
}

export class SocAuthService {
  constructor(ctx, store = new SocStateStore(), options = {}) {
    this.ctx = ctx
    this.store = store
    this.storage = new AsyncLocalStorage()
    this.adminStorage = new AsyncLocalStorage()
    const configuredAdmin = options.adminCredentials ?? resolveAdminCredentials(
      options.env ?? process.env,
      options.serverRoot,
    )
    this.adminEmail = String(configuredAdmin.email ?? '').trim().toLowerCase()
    this.adminPassword = String(configuredAdmin.password ?? '')
    if (!this.adminEmail || !this.adminPassword.trim()) {
      throw new Error(`${ADMIN_EMAIL_ENV} and ${ADMIN_PASSWORD_ENV} are required`)
    }
    this.adminSessions = new Map()
    this.agentSessions = new Map()
    this.agentInvestigations = new Map()
    this.pendingResponses = new Map()
    this.applicationSessionSignals = new Map()
    this.revokedApplicationSessions = new Map()
    this.proxyCache = new WeakMap()
    this.registry = undefined
    this.persistence = undefined
    this.ready = this.store.ensureSchema()
  }

  attachWorkspaceServices(ctx) {
    this.registry = ctx.get('workspaceRegistry')
    this.persistence = ctx.get('sessionPersistence')
    this.ready = this.ready.then(() => this.store.clearLegacyWorkspaceState(this.registry, this.persistence))
  }

  currentSession() {
    const session = this.storage.getStore()
    return session && !this.isApplicationSessionRevoked(session.id) ? session : undefined
  }

  isApplicationSessionRevoked(sessionId) {
    const value = String(sessionId ?? '')
    const expiresAt = this.revokedApplicationSessions.get(value)
    if (expiresAt === undefined) return false
    if (expiresAt <= Date.now()) {
      this.revokedApplicationSessions.delete(value)
      this.applicationSessionSignals.delete(value)
      return false
    }
    return true
  }

  applicationSessionSignal(sessionId) {
    const value = String(sessionId ?? '')
    if (!value) return undefined
    const revoked = this.isApplicationSessionRevoked(value)
    let controller = this.applicationSessionSignals.get(value)
    if (!controller) {
      controller = new AbortController()
      this.applicationSessionSignals.set(value, controller)
    }
    if (revoked && !controller.signal.aborted) {
      controller.abort(new Error('application session revoked'))
    }
    return controller.signal
  }

  revokeApplicationSession(sessionId) {
    const value = String(sessionId ?? '')
    if (!value) return
    this.revokedApplicationSessions.set(value, Date.now() + SESSION_TTL_SECONDS * 1000)
    const controller = this.applicationSessionSignals.get(value)
    if (controller && !controller.signal.aborted) controller.abort(new Error('application session revoked'))
    this.pendingResponses.delete(value)
  }

  currentAdmin() {
    const admin = this.adminStorage.getStore()
    if (!admin || admin.expiresAt.getTime() <= Date.now()) return undefined
    return admin
  }

  isAdmin() {
    return this.currentAdmin() !== undefined
  }

  requireAdmin() {
    const admin = this.currentAdmin()
    if (!admin) throw new Error('admin authentication required')
    return admin
  }

  requireSession() {
    const session = this.currentSession()
    if (!session) throw new Error('authentication required')
    return session
  }

  /** Called by the Connection transport after it has checked the request fence. */
  authorizePrivilegedRequest() {
    return this.currentAdmin() !== undefined
  }

  adminSessionToken() {
    return randomBytes(32).toString('base64url')
  }

  adminSessionKey(token) {
    return createHash('sha256').update(String(token)).digest('base64url')
  }

  async requestAdmin(request) {
    await this.ready
    const token = requestCookieValue(request, ADMIN_SESSION_COOKIE)
    if (!token) return undefined
    const key = this.adminSessionKey(token)
    const session = this.adminSessions.get(key)
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      this.adminSessions.delete(key)
      return undefined
    }
    return session
  }

  withAdmin(admin, callback) {
    return this.adminStorage.run(admin, callback)
  }

  requestPath(request, fallback = '') {
    try {
      return new URL(request?.url ?? fallback ?? '/', 'http://dsh.internal').pathname
    } catch {
      return String(fallback ?? '')
    }
  }

  async principalForRequest(request, registeredPath = '') {
    const path = this.requestPath(request, registeredPath)
    const adminOnly = path === '/_dsh/memory/settings' || isPrivilegedApiPath(path)
    const mixed = path.startsWith('/soc-agent-') || isMixedApiPath(path)
    if (adminOnly) {
      const admin = await this.requestAdmin(request)
      if (admin) return { kind: 'admin', value: admin }
      const session = await this.requestSession(request)
      return session ? { kind: 'forbidden' } : { kind: 'unauthenticated' }
    }
    if (mixed) {
      const admin = await this.requestAdmin(request)
      if (admin) return { kind: 'admin', value: admin }
    }
    const session = await this.requestSession(request)
    return session
      ? { kind: 'session', value: session }
      : mixed
        ? { kind: 'unauthenticated' }
        : { kind: 'unauthenticated' }
  }

  rejectNodePrincipal(response, kind) {
    const status = kind === 'forbidden' ? 403 : 401
    response.writeHead(status, { 'cache-control': 'no-store' })
    response.end(kind === 'forbidden' ? 'forbidden' : 'authentication required')
  }

  async requestSession(request) {
    await this.ready
    return await this.store.session(cookieValue(request))
  }

  async withRequest(request, callback) {
    const principal = await this.principalForRequest(request)
    if (principal.kind === 'admin') return await this.withAdmin(principal.value, callback)
    if (principal.kind === 'session') return await this.storage.run(principal.value, callback)
    return new Response(principal.kind === 'forbidden' ? 'forbidden' : 'authentication required', {
      status: principal.kind === 'forbidden' ? 403 : 401,
      headers: { 'cache-control': 'no-store' },
    })
  }

  async upgradeSession(request) {
    return await this.requestSession(request)
  }

  withSession(session, callback) {
    return this.storage.run(session, callback)
  }

  async withNodeRequest(request, response, callback, registeredPath = '') {
    const principal = await this.principalForRequest(request, registeredPath)
    if (principal.kind === 'admin') return await this.withAdmin(principal.value, callback)
    if (principal.kind === 'session') return await this.withSession(principal.value, callback)
    this.rejectNodePrincipal(response, principal.kind)
  }

  async withNodeUpgrade(request, socket, callback) {
    const session = await this.upgradeSession(request)
    if (!session) {
      socket.destroy()
      return
    }
    return await this.withSession(session, callback)
  }

  installTransport(webServer, apiProxy) {
    const scoped = this.scopedApi(apiProxy)
    const originalApi = new Map()
    const installedApi = new Map()
    for (const key of [
      'sessions',
      'subagents',
      'workspace',
      'folders',
      'events',
      'downloads',
      'skills',
      'agentPresets',
      'goals',
      'respond',
    ]) {
      const original = apiProxy[key]
      if (original === undefined) continue
      const replacement = scoped[key]
      originalApi.set(key, original)
      installedApi.set(key, replacement)
      apiProxy[key] = replacement
    }

    const rawRegister = webServer.register.bind(webServer)
    const rawRegisterUpgrade = webServer.registerUpgrade.bind(webServer)
    const register = route => {
      if (!isPrivateHttpRoute(route?.path)) return rawRegister(route)
      return rawRegister({
        ...route,
        handler: (request, response) => this.withNodeRequest(
          request,
          response,
          () => route.handler(request, response),
          route.path,
        ),
      })
    }
    const registerUpgrade = route => {
      if (!isPrivateUpgradeRoute(route?.path)) return rawRegisterUpgrade(route)
      return rawRegisterUpgrade({
        ...route,
        handler: (request, socket, head) => this.withNodeUpgrade(
          request,
          socket,
          () => route.handler(request, socket, head),
        ),
      })
    }
    webServer.register = register
    webServer.registerUpgrade = registerUpgrade

    const dispose = () => {
      if (webServer.register === register) webServer.register = rawRegister
      if (webServer.registerUpgrade === registerUpgrade) webServer.registerUpgrade = rawRegisterUpgrade
      for (const [key, original] of originalApi) {
        if (apiProxy[key] === installedApi.get(key)) apiProxy[key] = original
      }
    }
    return dispose
  }

  rememberPendingResponse(rpcId, sessionId, applicationSessionId) {
    const current = this.currentSession()
    const responseId = String(rpcId ?? '')
    const targetSessionId = String(sessionId ?? '')
    const ownerSessionId = String(applicationSessionId ?? current?.id ?? '')
    if (!ownerSessionId || !responseId || !targetSessionId || this.isApplicationSessionRevoked(ownerSessionId)) return
    let pending = this.pendingResponses.get(ownerSessionId)
    if (!pending) {
      pending = new Map()
      this.pendingResponses.set(ownerSessionId, pending)
    }
    pending.set(responseId, targetSessionId)
  }

  pendingResponseSession(rpcId) {
    const current = this.currentSession()
    return current ? this.pendingResponses.get(current.id)?.get(String(rpcId ?? '')) : undefined
  }

  forgetPendingResponse(rpcId) {
    const current = this.currentSession()
    const pending = current ? this.pendingResponses.get(current.id) : undefined
    if (!pending) return
    pending.delete(String(rpcId ?? ''))
    if (pending.size === 0) this.pendingResponses.delete(current.id)
  }

  mcpRequestMeta(exec) {
    const ambient = this.storage.getStore()
    const current = this.currentSession()
    const sessionId = ambient && this.isApplicationSessionRevoked(ambient.id)
      ? ambient.id
      : current?.id ?? this.agentSessions.get(sessionIdOf(exec?.agent))
    return sessionId ? { soc_session_id: sessionId, ...this.agentInvestigations.get(sessionIdOf(exec?.agent)) } : undefined
  }

  async sessionForAgent(agent) {
    const current = this.currentSession()
    const sessionId = current?.id ?? this.agentSessions.get(sessionIdOf(agent))
    if (!sessionId || typeof this.store.session !== 'function') return undefined
    return await this.store.session(sessionId)
  }

  bindAgentSession(sessionId, applicationSessionId, investigation) {
    const current = this.currentSession()
    const agentId = String(sessionId ?? '')
    const ownerSessionId = applicationSessionId ?? current?.id
    if (ownerSessionId && agentId && !this.isApplicationSessionRevoked(ownerSessionId)) {
      this.agentSessions.set(agentId, String(ownerSessionId))
      if (investigation) this.agentInvestigations.set(agentId, Object.freeze({ ...investigation }))
    }
  }

  unbindAgentSession(sessionId) {
    this.agentSessions.delete(String(sessionId ?? ''))
    this.agentInvestigations.delete(String(sessionId ?? ''))
  }

  unbindApplicationSession(sessionId) {
    const value = String(sessionId ?? '')
    this.revokeApplicationSession(value)
    for (const [agentId, boundSessionId] of this.agentSessions) {
      if (boundSessionId === value) this.unbindAgentSession(agentId)
    }
  }

  async stopUserChatSessions(userId, replacedApplicationSessionIds = []) {
    const ownerUserId = String(userId ?? '')
    if (!ownerUserId) return 0
    let agentsService
    try { agentsService = this.ctx?.agents ?? this.ctx?.get?.('agents') } catch { agentsService = undefined }
    const agents = typeof agentsService?.list === 'function' ? agentsService.list() : []
    const byId = new Map(agents.map(agent => [sessionIdOf(agent), agent]))
    const toStop = new Map()
    const replaced = new Set(replacedApplicationSessionIds.map(id => String(id ?? '')).filter(Boolean))
    for (const [agentId, applicationSessionId] of this.agentSessions) {
      if (replaced.has(applicationSessionId) && byId.has(agentId)) toStop.set(agentId, byId.get(agentId))
    }
    const ownedSessionIds = new Set(await this.store.userSessionIds(ownerUserId))
    for (const agentId of toStop.keys()) ownedSessionIds.add(agentId)
    let grew = true
    while (grew) {
      grew = false
      for (const [agentId, agent] of byId) {
        const parentSessionId = String(agent?.session?.header?.parentSession ?? '')
        if (!ownedSessionIds.has(agentId) && parentSessionId && ownedSessionIds.has(parentSessionId)) {
          ownedSessionIds.add(agentId)
          grew = true
        }
      }
    }
    for (const [agentId, agent] of byId) {
      if (ownedSessionIds.has(agentId)) toStop.set(agentId, agent)
    }
    const stopped = []
    for (const [agentId, agent] of toStop) {
      try {
        agent.cancel({ kind: 'user' }, { keepInbox: false })
        stopped.push(agent)
      } catch (error) {
        try { this.ctx?.logger?.warn?.(`soc auth: could not stop chat session "${agentId}": ${String(error)}`) } catch {}
      }
    }
    let sessionStore
    try { sessionStore = this.ctx?.sessions ?? this.ctx?.get?.('sessions') } catch { sessionStore = undefined }
    void Promise.allSettled(stopped.map(async agent => {
      const agentId = sessionIdOf(agent)
      try {
        await agent.whenIdle?.()
        await sessionStore?.flush?.(agent.session)
      } catch (error) {
        try { this.ctx?.logger?.warn?.(`soc auth: chat session "${agentId}" stopped but could not be flushed: ${String(error)}`) } catch {}
      } finally {
        this.unbindAgentSession(agentId)
      }
    }))
    return stopped.length
  }

  scopedApi(api) {
    if (!this.proxyCache.has(api)) this.proxyCache.set(api, createScopedApiProxy(api, this))
    return this.proxyCache.get(api)
  }

  async ensureGeneral(userId) {
    await this.ready
    if (!this.registry) throw new Error('workspace registry unavailable')
    const path = generalWorkspacePath(userId)
    await mkdir(path, { recursive: true })
    const existing = await this.registry.resolveByPath(path)
    const workspace = existing ?? await this.registry.create(path, 'General')
    const claimed = await this.store.claimWorkspace(String(workspace.id), userId, workspace.path)
    if (!claimed) throw new Error('workspace ownership conflict')
    if (workspace.title !== 'General') await workspace.setTitle('General')
    return { workspaceId: String(workspace.id), title: 'General' }
  }

  adminPasswordMatches(password) {
    const expected = Buffer.from(this.adminPassword)
    const supplied = Buffer.from(String(password ?? ''))
    return expected.length === supplied.length && timingSafeEqual(expected, supplied)
  }

  async handleAdminAuthRoute(kind, request, response) {
    if (!sameSiteRequest(request)) {
      sendJson(response, 403, { error: 'forbidden' })
      return
    }
    await this.ready
    if (kind === 'me') {
      if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'method not allowed' }, { allow: 'GET' })
        return
      }
      const admin = await this.requestAdmin(request)
      if (!admin) {
        sendJson(response, 401, { authenticated: false })
        return
      }
      sendJson(response, 200, {
        authenticated: true,
        admin: { email: admin.email },
        expires_at: admin.expiresAt.toISOString(),
      })
      return
    }
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'method not allowed' }, { allow: 'POST' })
      return
    }
    if (kind === 'logout') {
      const token = requestCookieValue(request, ADMIN_SESSION_COOKIE)
      if (token) this.adminSessions.delete(this.adminSessionKey(token))
      sendJson(response, 200, { authenticated: false }, {
        'set-cookie': adminCookieHeader('', request, 0),
      })
      return
    }
    if (request.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      sendJson(response, 415, { error: 'content type must be application/json' })
      return
    }
    let payload
    try { payload = await readJson(request) } catch { sendJson(response, 400, { error: 'invalid request' }); return }
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const password = typeof payload.password === 'string' ? payload.password : ''
    try {
      if (email !== this.adminEmail || !this.adminPasswordMatches(password)) {
        sendJson(response, 401, { error: 'invalid admin credentials' })
        return
      }
      const token = this.adminSessionToken()
      const session = {
        email: this.adminEmail,
        expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000),
      }
      this.adminSessions.set(this.adminSessionKey(token), session)
      sendJson(response, 200, {
        authenticated: true,
        admin: { email: session.email },
        expires_at: session.expiresAt.toISOString(),
      }, { 'set-cookie': adminCookieHeader(token, request) })
    } finally {
      payload.password = ''
    }
  }

  async handleAuthRoute(kind, request, response) {
    if (!sameSiteRequest(request)) {
      sendJson(response, 403, { error: 'forbidden' })
      return
    }
    await this.ready
    if (kind === 'me') {
      if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'method not allowed' }, { allow: 'GET' })
        return
      }
      const session = await this.requestSession(request)
      if (!session) {
        const revocation = typeof this.store.consumeSessionRevocation === 'function'
          ? await this.store.consumeSessionRevocation(cookieValue(request))
          : undefined
        sendJson(response, 401, revocation === SESSION_REPLACED_REASON
          ? {
            authenticated: false,
            reason: SESSION_REPLACED_REASON,
            message: SESSION_REPLACED_MESSAGE,
          }
          : { authenticated: false }, {
            'set-cookie': cookieHeader('', request, 0),
          })
        return
      }
      sendJson(response, 200, { authenticated: true, user: { zimbra_email: session.email }, expires_at: session.expiresAt.toISOString() })
      return
    }
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'method not allowed' }, { allow: 'POST' })
      return
    }
    if (kind === 'logout') {
      const sessionId = cookieValue(request)
      await this.store.deleteSession(sessionId)
      this.unbindApplicationSession(sessionId)
      sendJson(response, 200, { authenticated: false }, { 'set-cookie': cookieHeader('', request, 0) })
      return
    }
    if (request.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      sendJson(response, 415, { error: 'content type must be application/json' })
      return
    }
    let payload
    try { payload = await readJson(request) } catch { sendJson(response, 400, { error: 'invalid request' }); return }
    const email = typeof payload.email === 'string' ? payload.email : ''
    const password = typeof payload.password === 'string' ? payload.password : ''
    if (!email || !password) {
      sendJson(response, 400, { error: 'email and password are required' })
      return
    }
    let result
    try {
      result = await runAuthCommand('login', { email, password })
    } catch {
      sendJson(response, 401, { error: 'invalid email or password' })
      return
    } finally {
      payload.password = ''
    }
    const session = result?.session
    const user = session?.user
    if (!session?.session_id || !user?.id || !user?.zimbra_email) {
      if (session?.session_id) await this.store.deleteSession(String(session.session_id))
      sendJson(response, 401, { error: 'invalid email or password' })
      return
    }
    const replacedSessionIds = Array.isArray(result?.replaced_session_ids)
      ? result.replaced_session_ids.map(id => String(id ?? '')).filter(Boolean)
      : []
    for (const replacedSessionId of replacedSessionIds) this.revokeApplicationSession(replacedSessionId)
    try {
      await this.stopUserChatSessions(String(user.id), replacedSessionIds)
    } catch (error) {
      try { this.ctx?.logger?.warn?.(`soc auth: could not stop the replaced user's chat sessions: ${String(error)}`) } catch {}
      await this.store.deleteSession(String(session.session_id))
      this.unbindApplicationSession(String(session.session_id))
      sendJson(response, 503, { error: 'authentication service unavailable' })
      return
    }
    let workspace
    try {
      workspace = await this.ensureGeneral(String(user.id))
    } catch {
      await this.store.deleteSession(String(session.session_id))
      this.unbindApplicationSession(String(session.session_id))
      sendJson(response, 503, { error: 'authentication service unavailable' })
      return
    }
    sendJson(response, 200, {
      authenticated: true,
      user: { zimbra_email: String(user.zimbra_email) },
      workspace,
    }, { 'set-cookie': cookieHeader(String(session.session_id), request) })
  }

  registerRoutes(webServer) {
    const register = (path, kind) => webServer.register({
      kind: 'exact',
      path,
      handler: (request, response) => this.handleAuthRoute(kind, request, response),
    })
    return [
      register('/auth/login', 'login'),
      register('/auth/logout', 'logout'),
      register('/auth/me', 'me'),
      webServer.register({
        kind: 'exact',
        path: '/admin/auth/login',
        handler: (request, response) => this.handleAdminAuthRoute('login', request, response),
      }),
      webServer.register({
        kind: 'exact',
        path: '/admin/auth/logout',
        handler: (request, response) => this.handleAdminAuthRoute('logout', request, response),
      }),
      webServer.register({
        kind: 'exact',
        path: '/admin/auth/me',
        handler: (request, response) => this.handleAdminAuthRoute('me', request, response),
      }),
    ]
  }
}

export {
  ADMIN_EMAIL_ENV,
  ADMIN_PASSWORD_ENV,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_REPLACED_MESSAGE,
  SESSION_REPLACED_REASON,
  SESSION_TTL_SECONDS,
}
