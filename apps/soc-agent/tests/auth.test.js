import assert from 'node:assert/strict'
import { mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CallToolResultSchema } from '../../../vendor/deepseek-harness/packages/mcp/mcp-client/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js'
import { Client as HarnessMcpClient } from '../../../vendor/deepseek-harness/packages/mcp/mcp-client/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js'
import { apply as applyAuthHost } from '../auth-host.js'
import {
  ADMIN_SESSION_COOKIE,
  createScopedApiProxy,
  resolveAdminCredentials,
  resolveApplicationStorageUri,
  SocAuthService,
  SocStateStore,
  SESSION_REPLACED_MESSAGE,
  SESSION_REPLACED_REASON,
} from '../ownership.js'

function response(request, value) {
  return { rpcId: request?.rpcId, result: { ok: true, value } }
}

function authFixture() {
  const workspaces = new Map([
    ['workspace-a', { userId: 'user-a', path: '/workspace/a' }],
    ['workspace-b', { userId: 'user-b', path: '/workspace/b' }],
  ])
  const sessions = new Map([
    ['session-a', { userId: 'user-a', workspaceId: 'workspace-a' }],
    ['session-b', { userId: 'user-b', workspaceId: 'workspace-b' }],
  ])
  const folders = new Map([
    ['folder-a', 'user-a'],
    ['folder-b', 'user-b'],
  ])
  const pendingResponses = new Map()
  const store = {
    async workspaceOwner(id) { const value = workspaces.get(id); return value && { ...value } },
    async workspaceOwnerByPath() { return undefined },
    async userWorkspaceIds(userId) { return new Set([...workspaces].filter(([, value]) => value.userId === userId).map(([id]) => id)) },
    async claimWorkspace() { return true },
    async deleteWorkspace() {},
    async sessionOwner(id) { const value = sessions.get(id); return value && { ...value } },
    async userSessionIds(userId) { return new Set([...sessions].filter(([, value]) => value.userId === userId).map(([id]) => id)) },
    async claimSession() { return true },
    async deleteSessionOwner() {},
    async folderOwner(id) { return folders.get(id) },
    async userFolderIds(userId) { return new Set([...folders].filter(([, owner]) => owner === userId).map(([id]) => id)) },
    async claimFolder() { return true },
    async deleteFolder() {},
  }
  const auth = {
    store,
    currentSession: () => ({ id: 'app-session-a', userId: 'user-a', email: 'a@example.com' }),
    bindAgentSession() {},
    unbindAgentSession() {},
    rememberPendingResponse(rpcId, sessionId) { pendingResponses.set(String(rpcId), String(sessionId)) },
    pendingResponseSession(rpcId) { return pendingResponses.get(String(rpcId)) },
    forgetPendingResponse(rpcId) { pendingResponses.delete(String(rpcId)) },
  }
  return { auth, store, workspaces }
}

function nodeResponse() {
  return {
    headersSent: false,
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.statusCode = status
      this.headers = headers
      this.headersSent = true
    },
    end(body = '') { this.body = String(body) },
  }
}

function nodeRequest({ method = 'GET', url = '/', headers = {}, body = '', socket = {} } = {}) {
  return {
    method,
    url,
    headers,
    socket,
    async *[Symbol.asyncIterator]() {
      if (body) yield Buffer.from(body)
    },
  }
}

function jsonBody(response) {
  return JSON.parse(response.body)
}

function adminCookie(response) {
  return response.headers['set-cookie'].split(';', 1)[0]
}

function adminStore() {
  return {
    async ensureSchema() {},
    async session() { return undefined },
  }
}

test('SOC auth store reads only its PostgreSQL URI from the server environment file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'soc-auth-env-'))
  try {
    await writeFile(join(directory, '.env'), [
      'APP_POSTGRES_URI=postgresql://example.test/soc',
      'ZIMBRA_PASSWORD=must-not-be-loaded-by-the-host',
    ].join('\n'))
    assert.equal(resolveApplicationStorageUri({}, directory), 'postgresql://example.test/soc')
    assert.equal(process.env.ZIMBRA_PASSWORD, undefined)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('SOC admin credentials are required at startup and are never included in the failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'soc-admin-env-'))
  try {
    await writeFile(join(directory, '.env'), 'SOC_ADMIN_EMAIL=\nSOC_ADMIN_PASSWORD=\n')
    assert.throws(
      () => resolveAdminCredentials({}, directory),
      error => error instanceof Error
        && error.message === 'SOC_ADMIN_EMAIL and SOC_ADMIN_PASSWORD are required'
        && !error.message.includes('admin-secret'),
    )
    assert.throws(
      () => new SocAuthService({}, adminStore(), {
        env: { SOC_ADMIN_EMAIL: 'admin@example.com', SOC_ADMIN_PASSWORD: ' ' },
        serverRoot: directory,
      }),
      /SOC_ADMIN_EMAIL and SOC_ADMIN_PASSWORD are required/,
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('SOC admin login, expiry, logout, and restart invalidation use an opaque cookie session', async () => {
  const auth = new SocAuthService({}, adminStore(), {
    adminCredentials: { email: 'Admin@Example.com', password: 'admin-secret' },
  })
  const routes = new Map()
  const webServer = {
    register(route) {
      routes.set(route.path, route.handler)
      return () => routes.delete(route.path)
    },
  }
  const disposers = auth.registerRoutes(webServer)
  const loginRequest = nodeRequest({
    method: 'POST',
    url: '/admin/auth/login',
    headers: { host: '127.0.0.1', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'ADMIN@example.com', password: 'admin-secret' }),
  })
  const loginResponse = nodeResponse()
  await routes.get('/admin/auth/login')(loginRequest, loginResponse)
  assert.equal(loginResponse.statusCode, 200)
  assert.match(loginResponse.headers['set-cookie'], new RegExp(`${ADMIN_SESSION_COOKIE}=`))
  assert.match(loginResponse.headers['set-cookie'], /HttpOnly/)
  assert.match(loginResponse.headers['set-cookie'], /SameSite=Lax/)
  assert.equal(loginRequest.body, undefined)
  assert.equal(JSON.stringify(loginResponse).includes('admin-secret'), false)

  const cookie = adminCookie(loginResponse)
  const meResponse = nodeResponse()
  await routes.get('/admin/auth/me')(nodeRequest({ url: '/admin/auth/me', headers: { host: '127.0.0.1', cookie } }), meResponse)
  assert.equal(meResponse.statusCode, 200)
  assert.deepEqual(jsonBody(meResponse), { authenticated: true, admin: { email: 'admin@example.com' }, expires_at: jsonBody(meResponse).expires_at })

  const token = cookie.slice(`${ADMIN_SESSION_COOKIE}=`.length)
  const key = auth.adminSessionKey(token)
  auth.adminSessions.get(key).expiresAt = new Date(Date.now() - 1)
  const expired = nodeResponse()
  await routes.get('/admin/auth/me')(nodeRequest({ url: '/admin/auth/me', headers: { host: '127.0.0.1', cookie } }), expired)
  assert.equal(expired.statusCode, 401)
  assert.equal(auth.adminSessions.has(key), false)

  const secondLogin = nodeResponse()
  await routes.get('/admin/auth/login')(nodeRequest({
    method: 'POST',
    url: '/admin/auth/login',
    headers: { host: '127.0.0.1', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin-secret' }),
  }), secondLogin)
  const secondCookie = adminCookie(secondLogin)
  const logout = nodeResponse()
  await routes.get('/admin/auth/logout')(nodeRequest({ method: 'POST', url: '/admin/auth/logout', headers: { host: '127.0.0.1', cookie: secondCookie } }), logout)
  assert.equal(logout.statusCode, 200)
  assert.match(logout.headers['set-cookie'], /Max-Age=0/)
  const afterLogout = nodeResponse()
  await routes.get('/admin/auth/me')(nodeRequest({ url: '/admin/auth/me', headers: { host: '127.0.0.1', cookie: secondCookie } }), afterLogout)
  assert.equal(afterLogout.statusCode, 401)
  for (const dispose of disposers) dispose()
})

test('an invalidated regular session reports that a new device signed it out', async () => {
  const store = {
    async ensureSchema() {},
    async session() { return undefined },
    async consumeSessionRevocation(id) {
      return id === 'old-app-session' ? SESSION_REPLACED_REASON : undefined
    },
  }
  const auth = new SocAuthService({}, store, {
    adminCredentials: { email: 'admin@example.com', password: 'admin-secret' },
  })
  const routes = new Map()
  const webServer = {
    register(route) {
      routes.set(route.path, route.handler)
      return () => routes.delete(route.path)
    },
  }
  const disposers = auth.registerRoutes(webServer)
  const output = nodeResponse()
  await routes.get('/auth/me')(nodeRequest({
    url: '/auth/me',
    headers: { host: '127.0.0.1', cookie: 'soc_session=old-app-session' },
  }), output)
  assert.equal(output.statusCode, 401)
  assert.deepEqual(jsonBody(output), {
    authenticated: false,
    reason: SESSION_REPLACED_REASON,
    message: SESSION_REPLACED_MESSAGE,
  })
  for (const dispose of disposers) dispose()
})

test('replacing a login cancels all of that user\'s live chat agents and flushes history', async () => {
  const cancelled = []
  const flushed = []
  const agents = ['chat-a', 'chat-b', 'chat-other'].map(id => ({
    id,
    session: { id },
    cancel(cause, options) { cancelled.push({ id, cause, options }) },
    async whenIdle() {},
  }))
  const store = {
    async ensureSchema() {},
    async userSessionIds(userId) {
      assert.equal(userId, 'user-a')
      return new Set(['chat-a', 'chat-b'])
    },
  }
  const auth = new SocAuthService({
    agents: { list: () => agents },
    sessions: { async flush(session) { flushed.push(session.id) } },
  }, store, { adminCredentials: { email: 'admin@example.com', password: 'admin-secret' } })
  assert.equal(await auth.stopUserChatSessions('user-a', ['old-app-session']), 2)
  assert.deepEqual(cancelled, [
    { id: 'chat-a', cause: { kind: 'user' }, options: { keepInbox: false } },
    { id: 'chat-b', cause: { kind: 'user' }, options: { keepInbox: false } },
  ])
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(flushed.sort(), ['chat-a', 'chat-b'])
})

test('revoking an application session aborts its event stream and fences MCP work', async () => {
  const auth = new SocAuthService({}, {
    async ensureSchema() {},
    async userSessionIds() { return new Set(['session-a']) },
  }, {
    adminCredentials: { email: 'admin@example.com', password: 'admin-secret' },
  })
  const api = {
    events: {
      mux(_request, signal) {
        return (async function* () {
          await new Promise(resolve => {
            if (signal.aborted) resolve()
            else signal.addEventListener('abort', resolve, { once: true })
          })
        })()
      },
    },
  }
  const scoped = createScopedApiProxy(api, auth)
  const session = { id: 'old-app-session', userId: 'user-a', email: 'a@example.com' }
  const pending = auth.withSession(session, () => scoped.events.mux({
    rpcId: 'mux',
    payload: { since: { 'session-a': 4, 'foreign-session': 9 } },
  }, new AbortController().signal).next())
  auth.revokeApplicationSession(session.id)
  assert.equal(auth.applicationSessionSignal(session.id).aborted, true)
  assert.deepEqual(auth.withSession(session, () => auth.mcpRequestMeta({ agent: { id: 'chat-a' } })), {
    soc_session_id: 'old-app-session',
  })
  assert.deepEqual(await pending, { done: true, value: undefined })
})

test('admin cookies cannot authorize chat APIs, while regular users cannot authorize settings APIs', async () => {
  const store = adminStore()
  store.session = async id => id === 'user-session' ? {
    id,
    userId: 'user-a',
    email: 'user@example.com',
    expiresAt: new Date(Date.now() + 60_000),
  } : undefined
  const auth = new SocAuthService({}, store, {
    adminCredentials: { email: 'admin@example.com', password: 'admin-secret' },
  })
  const adminToken = auth.adminSessionToken()
  auth.adminSessions.set(auth.adminSessionKey(adminToken), {
    email: 'admin@example.com',
    expiresAt: new Date(Date.now() + 60_000),
  })
  const routes = new Map()
  const webServer = {
    register(route) {
      routes.set(`${route.kind}:${route.path}`, route)
      return () => routes.delete(`${route.kind}:${route.path}`)
    },
    registerUpgrade() { return () => {} },
  }
  const dispose = auth.installTransport(webServer, {})
  let called = 0
  webServer.register({
    kind: 'prefix',
    path: '/api',
    handler: (_request, response) => { called += 1; response.writeHead(200); response.end('ok') },
  })
  const route = routes.get('prefix:/api')
  const adminChat = nodeResponse()
  await route.handler(nodeRequest({ url: '/api/session.list', headers: { host: '127.0.0.1', cookie: `${ADMIN_SESSION_COOKIE}=${adminToken}` }, socket: { remoteAddress: '127.0.0.1' } }), adminChat)
  assert.equal(adminChat.statusCode, 401)
  const regularSettings = nodeResponse()
  await route.handler(nodeRequest({ url: '/api/settings.describe', headers: { host: '127.0.0.1', cookie: 'soc_session=user-session' }, socket: { remoteAddress: '127.0.0.1' } }), regularSettings)
  assert.equal(regularSettings.statusCode, 403)
  const adminSettings = nodeResponse()
  await route.handler(nodeRequest({ url: '/api/settings.describe', headers: { host: '127.0.0.1', cookie: `${ADMIN_SESSION_COOKIE}=${adminToken}` }, socket: { remoteAddress: '127.0.0.1' } }), adminSettings)
  assert.equal(adminSettings.statusCode, 200)
  const regularDescribe = nodeResponse()
  await route.handler(nodeRequest({ url: '/api/host.describe', headers: { host: '127.0.0.1', cookie: 'soc_session=user-session' }, socket: { remoteAddress: '127.0.0.1' } }), regularDescribe)
  assert.equal(regularDescribe.statusCode, 200)
  for (const method of ['host.listDirectory', 'host.createDirectory']) {
    const regular = nodeResponse()
    await route.handler(nodeRequest({ url: `/api/${method}`, headers: { host: '127.0.0.1', cookie: 'soc_session=user-session' }, socket: { remoteAddress: '127.0.0.1' } }), regular)
    assert.equal(regular.statusCode, 403)
    const admin = nodeResponse()
    await route.handler(nodeRequest({ url: `/api/${method}`, headers: { host: '127.0.0.1', cookie: `${ADMIN_SESSION_COOKIE}=${adminToken}` }, socket: { remoteAddress: '127.0.0.1' } }), admin)
    assert.equal(admin.statusCode, 200)
  }
  assert.equal(called, 4)
  dispose()
})

test('scoped API prevents cross-user workspace/session IDOR and filters queries', async () => {
  const { auth } = authFixture()
  const calls = []
  const api = {
    workspace: {
      list: async request => response(request, {
        items: [
          { workspaceId: 'workspace-a', sessionIds: ['session-a', 'session-b'] },
          { workspaceId: 'workspace-b', sessionIds: ['session-b'] },
        ],
        archivedSessionIds: ['session-a', 'session-b'],
      }),
      rename: async request => { calls.push('workspace.rename'); return response(request, { workspace: request.payload }) },
      delete: async request => { calls.push('workspace.delete'); return response(request, { deleted: true }) },
    },
    sessions: {
      list: async request => response(request, { items: [
        { sessionId: 'session-a', folderId: 'folder-a' },
        { sessionId: 'session-b', folderId: 'folder-b' },
      ] }),
      search: async request => response(request, { items: [
        { sessionId: 'session-a', snippet: 'A' },
        { sessionId: 'session-b', snippet: 'B' },
      ], hasMore: true }),
      history: async request => { calls.push('sessions.history'); return response(request, { events: [] }) },
      rename: async request => { calls.push('sessions.rename'); return response(request, { title: 'renamed', seq: 1 }) },
      delete: async request => { calls.push('sessions.delete'); return response(request, { deleted: true }) },
      fork: async request => { calls.push('sessions.fork'); return response(request, { sessionId: 'forked' }) },
      prompt: async request => { calls.push('sessions.prompt'); return response(request, { accepted: true }) },
      create: async request => { calls.push('sessions.create'); return response(request, { sessionId: 'created' }) },
    },
    skills: {
      list: async request => { calls.push('skills.list'); return response(request, { items: [] }) },
    },
    agentPresets: {
      select: async request => { calls.push('agentPresets.select'); return response(request, { selected: true }) },
    },
    goals: {
      create: async request => { calls.push('goals.create'); return response(request, { created: true }) },
    },
  }
  const scoped = createScopedApiProxy(api, auth)

  const workspaceList = await scoped.workspace.list({ rpcId: 'workspace-list', payload: {} })
  assert.deepEqual(workspaceList.result.value.items.map(item => item.workspaceId), ['workspace-a'])
  assert.deepEqual(workspaceList.result.value.items[0].sessionIds, ['session-a'])
  assert.deepEqual(workspaceList.result.value.archivedSessionIds, ['session-a'])

  const sessionList = await scoped.sessions.list({ rpcId: 'session-list', payload: {} })
  assert.deepEqual(sessionList.result.value.items.map(item => item.sessionId), ['session-a'])
  assert.equal(sessionList.result.value.items[0].folderId, 'folder-a')
  const search = await scoped.sessions.search({ rpcId: 'search', payload: { query: 'B' } })
  assert.deepEqual(search.result.value.items.map(item => item.sessionId), ['session-a'])
  assert.equal(search.result.value.hasMore, false)

  for (const operation of [
    () => scoped.workspace.rename({ rpcId: 'workspace-rename', payload: { workspaceId: 'workspace-b', title: 'changed' } }),
    () => scoped.workspace.delete({ rpcId: 'workspace-delete', payload: { workspaceId: 'workspace-b' } }),
    () => scoped.sessions.history({ rpcId: 'history', payload: { sessionId: 'session-b' } }),
    () => scoped.sessions.rename({ rpcId: 'rename', payload: { sessionId: 'session-b', title: 'changed' } }),
    () => scoped.sessions.delete({ rpcId: 'delete', payload: { sessionId: 'session-b' } }),
    () => scoped.sessions.fork({ rpcId: 'fork', payload: { sessionId: 'session-b' } }),
    () => scoped.sessions.prompt({ rpcId: 'prompt', payload: { sessionId: 'session-b', content: [] } }),
    () => scoped.sessions.create({ rpcId: 'create', payload: { workspaceId: 'workspace-b' } }),
    () => scoped.skills.list({ rpcId: 'skills', payload: { sessionId: 'session-b' } }),
    () => scoped.agentPresets.select({ rpcId: 'preset', payload: { sessionId: 'session-b' } }),
    () => scoped.goals.create({ rpcId: 'goal', payload: { sessionId: 'session-b' } }),
  ]) {
    const denied = await operation()
    assert.equal(denied.result.ok, false)
  }
  assert.deepEqual(calls, [])
})

test('SOC relative workspace names create private directories and reject traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soc-workspace-root-'))
  const previousRoot = process.env.MCP_SERVER_ROOT
  process.env.MCP_SERVER_ROOT = root
  try {
    const { auth } = authFixture()
    const requests = []
    const api = {
      workspace: {
        create: async request => {
          requests.push(request)
          return response(request, {
            workspace: { workspaceId: 'workspace-new', path: request.payload.path, title: 'Test' },
            created: true,
          })
        },
      },
    }
    const scoped = createScopedApiProxy(api, auth)
    const created = await scoped.workspace.create({ rpcId: 'workspace-create', payload: { path: 'Test' } })
    const expected = await realpath(join(root, '.data', 'soc-workspaces', 'user-a', 'Test'))
    assert.equal(created.result.ok, true)
    assert.equal(requests[0].payload.path, expected)
    assert.equal((await stat(expected)).isDirectory(), true)

    for (const name of ['', '.', '..', '../escape', 'nested/name', 'nested\\name']) {
      const rejected = await scoped.workspace.create({ rpcId: `invalid-${name}`, payload: { path: name } })
      assert.equal(rejected.result.ok, false)
      assert.equal(rejected.result.error.code, 'workspace-invalid-path')
    }
    const absolute = await scoped.workspace.create({ rpcId: 'invalid-absolute', payload: { path: join(root, 'outside') } })
    assert.equal(absolute.result.ok, false)
    assert.equal(absolute.result.error.code, 'workspace-invalid-path')
    assert.equal(requests.length, 1)
  } finally {
    if (previousRoot === undefined) delete process.env.MCP_SERVER_ROOT
    else process.env.MCP_SERVER_ROOT = previousRoot
    await rm(root, { recursive: true, force: true })
  }
})

test('General workspace paths are protected from direct rename and delete RPCs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soc-general-root-'))
  const previousRoot = process.env.MCP_SERVER_ROOT
  process.env.MCP_SERVER_ROOT = root
  try {
    const { auth } = authFixture()
    const generalPath = join(root, '.data', 'soc-workspaces', 'user-a', 'general')
    auth.store.workspaceOwner = async id => id === 'general'
      ? { userId: 'user-a', path: generalPath }
      : undefined
    const calls = []
    const api = {
      workspace: {
        rename: async request => { calls.push('rename'); return response(request, {}) },
        delete: async request => { calls.push('delete'); return response(request, {}) },
      },
    }
    const scoped = createScopedApiProxy(api, auth)
    for (const [method, rpcId] of [['rename', 'general-rename'], ['delete', 'general-delete']]) {
      const result = await scoped.workspace[method]({ rpcId, payload: { workspaceId: 'general', ...(method === 'rename' ? { title: 'changed' } : {}) } })
      assert.deepEqual(result.result, {
        ok: false,
        error: {
          code: 'workspace-protected',
          message: 'General is protected and cannot be renamed or deleted',
          details: { workspaceId: 'general' },
        },
      })
    }
    assert.deepEqual(calls, [])
  } finally {
    if (previousRoot === undefined) delete process.env.MCP_SERVER_ROOT
    else process.env.MCP_SERVER_ROOT = previousRoot
    await rm(root, { recursive: true, force: true })
  }
})

test('ensureGeneral repairs a missing legacy General workspace on reload', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soc-general-repair-'))
  const previousRoot = process.env.MCP_SERVER_ROOT
  process.env.MCP_SERVER_ROOT = root
  try {
    const records = []
    const store = {
      async ensureSchema() {},
      async claimWorkspace() { return true },
    }
    const auth = new SocAuthService({}, store, { adminCredentials: { email: 'admin@example.com', password: 'admin-secret' } })
    auth.registry = {
      async resolveByPath(path) { return records.find(workspace => workspace.path === path) },
      async create(path, title) {
        const workspace = {
          id: `general-${records.length + 1}`,
          path,
          title,
          async setTitle(next) { workspace.title = next },
        }
        records.push(workspace)
        return workspace
      },
    }

    const first = await auth.ensureGeneral('user-a')
    const expectedPath = join(root, '.data', 'soc-workspaces', 'user-a', 'general')
    assert.deepEqual(first, { workspaceId: 'general-1', title: 'General' })
    assert.equal(records[0].path, expectedPath)
    assert.equal((await stat(expectedPath)).isDirectory(), true)

    // A legacy delete leaves the physical directory behind. The next load
    // must register a fresh protected General over that same path.
    records.splice(0, 1)
    const repaired = await auth.ensureGeneral('user-a')
    assert.deepEqual(repaired, { workspaceId: 'general-1', title: 'General' })
    assert.equal(records.length, 1)
    assert.equal(records[0].path, expectedPath)
  } finally {
    if (previousRoot === undefined) delete process.env.MCP_SERVER_ROOT
    else process.env.MCP_SERVER_ROOT = previousRoot
    await rm(root, { recursive: true, force: true })
  }
})

test('scoped session-log downloads enforce ownership on their direct request shape', async () => {
  const { auth } = authFixture()
  const calls = []
  const api = {
    downloads: {
      sessionLog: async request => {
        calls.push(request.sessionId)
        return new Response('session log')
      },
    },
  }
  const scoped = createScopedApiProxy(api, auth)
  const signal = new AbortController().signal

  const denied = await scoped.downloads.sessionLog({ sessionId: 'session-b' }, signal)
  assert.equal(denied.status, 404)
  assert.deepEqual(calls, [])

  const allowed = await scoped.downloads.sessionLog({ sessionId: 'session-a' }, signal)
  assert.equal(allowed.status, 200)
  assert.deepEqual(calls, ['session-a'])
})

test('scoped streams redact foreign snapshot IDs and unprojected remote events', async () => {
  const { auth } = authFixture()
  const api = {
    events: {
      host: async function* () {
        yield { rpcId: '1', payload: { type: 'host/workspace-order-changed', workspaceIds: ['workspace-a', 'workspace-b'] } }
        yield { rpcId: '2', payload: { type: 'host/archived-sessions-changed', archivedSessionIds: ['session-a', 'session-b'] } }
        yield { rpcId: '3', payload: { type: 'host/remote-event', event: 'opaque', args: ['session-b'] } }
      },
    },
  }
  const frames = []
  for await (const frame of createScopedApiProxy(api, auth).events.host({ rpcId: 'host', payload: {} })) frames.push(frame)
  assert.deepEqual(frames.map(frame => frame.payload.type), [
    'host/workspace-order-changed',
    'host/archived-sessions-changed',
  ])
  assert.deepEqual(frames[0].payload.workspaceIds, ['workspace-a'])
  assert.deepEqual(frames[1].payload.archivedSessionIds, ['session-a'])
})

test('scoped mux streams do not subscribe to foreign session checkpoints', async () => {
  const { auth } = authFixture()
  let requestSeen
  const api = {
    events: {
      mux: async function* (request) {
        requestSeen = request
        yield { rpcId: 'own', payload: { type: 'session/subscribed', sessionId: 'session-a', lastSeq: 3 } }
      },
    },
  }
  const frames = []
  for await (const frame of createScopedApiProxy(api, auth).events.mux({
    rpcId: 'mux',
    payload: { since: { 'session-a': 2, 'session-b': 8 } },
  })) frames.push(frame)
  assert.deepEqual(requestSeen.payload.since, { 'session-a': 2 })
  assert.deepEqual(frames.map(frame => frame.payload.sessionId), ['session-a'])
})

test('scoped response handling cannot cancel another user\'s pending request by rpc id', async () => {
  const { auth } = authFixture()
  const responses = []
  const api = {
    events: {
      host: async function* () {
        yield { rpcId: 'own-request', payload: { type: 'approval/requested', sessionId: 'session-a' } }
        yield { rpcId: 'foreign-request', payload: { type: 'approval/requested', sessionId: 'session-b' } }
      },
    },
    respond: async message => { responses.push(message); return { accepted: true } },
  }
  const scoped = createScopedApiProxy(api, auth)
  const frames = []
  for await (const frame of scoped.events.host({ rpcId: 'host', payload: {} })) frames.push(frame)
  assert.deepEqual(frames.map(frame => frame.rpcId), ['own-request'])

  const accepted = await scoped.respond({ rpcId: 'own-request', result: { ok: false, error: { code: 'cancelled' } } })
  assert.deepEqual(accepted, { accepted: true })
  const denied = await scoped.respond({ rpcId: 'foreign-request', result: { ok: false, error: { code: 'cancelled' } } })
  assert.deepEqual(denied, { accepted: false, reason: 'not-pending' })
  assert.equal(responses.length, 1)
})

test('MCP metadata carries only an opaque app session reference', async () => {
  const store = { async ensureSchema() {} }
  const auth = new SocAuthService({}, store, { adminCredentials: { email: 'admin@example.com', password: 'admin-secret' } })
  const session = {
    id: 'app-session-a',
    userId: 'user-a',
    email: 'a@example.com',
    zimbraToken: 'must-not-leave-server',
  }
  let metadata
  await auth.withSession(session, async () => { metadata = auth.mcpRequestMeta({ agent: { id: 'agent-a' } }) })
  assert.deepEqual(metadata, { soc_session_id: 'app-session-a' })
  assert.equal(JSON.stringify(metadata).includes('must-not-leave-server'), false)
  auth.bindAgentSession('scheduled-agent', session.id, { soc_workload: 'scheduled' })
  assert.equal(auth.agentInvestigations.size, 1)
  auth.unbindApplicationSession(session.id)
  assert.equal(auth.agentSessions.size, 0)
  assert.equal(auth.agentInvestigations.size, 0)
})

test('SOC auth plugin gates Harness transport and scopes the shared API proxy', async () => {
  const { store } = authFixture()
  const applicationSession = {
    id: 'app-session-a',
    userId: 'user-a',
    email: 'a@example.com',
    expiresAt: new Date(Date.now() + 60_000),
  }
  store.ensureSchema = async () => {}
  store.session = async id => id === applicationSession.id ? applicationSession : undefined
  const auth = new SocAuthService({}, store, { adminCredentials: { email: 'admin@example.com', password: 'admin-secret' } })
  const routes = new Map()
  const webServer = {
    register(route) {
      routes.set(`${route.kind}:${route.path}`, route)
      return () => routes.delete(`${route.kind}:${route.path}`)
    },
    registerUpgrade() { return () => {} },
  }
  const api = {
    workspace: {
      list: async request => response(request, {
        items: [
          { workspaceId: 'workspace-a', sessionIds: ['session-a', 'session-b'] },
          { workspaceId: 'workspace-b', sessionIds: ['session-b'] },
        ],
        archivedSessionIds: ['session-a', 'session-b'],
      }),
    },
    respond: async () => ({ accepted: true }),
  }
  const originalWorkspace = api.workspace
  const originalRespond = api.respond
  const dispose = auth.installTransport(webServer, api)
  let seenSession
  webServer.register({
    kind: 'prefix',
    path: '/api',
    handler: (_request, res) => {
      seenSession = auth.currentSession()
      res.writeHead(200)
      res.end('ok')
    },
  })
  const privateRoute = routes.get('prefix:/api')
  const denied = nodeResponse()
  await privateRoute.handler({ headers: {}, socket: {} }, denied)
  assert.equal(denied.statusCode, 401)
  assert.equal(seenSession, undefined)

  const accepted = nodeResponse()
  await privateRoute.handler({ headers: { cookie: 'soc_session=app-session-a' }, socket: {} }, accepted)
  assert.equal(accepted.statusCode, 200)
  assert.equal(seenSession.id, applicationSession.id)

  let memoryHandlerCalled = false
  webServer.register({
    kind: 'exact',
    path: '/_dsh/memory/settings',
    handler: (_request, res) => {
      memoryHandlerCalled = true
      res.writeHead(200)
      res.end('memory')
    },
  })
  const memoryRoute = routes.get('exact:/_dsh/memory/settings')
  for (const method of ['GET', 'POST']) {
    const memoryDenied = nodeResponse()
    await memoryRoute.handler({ method, headers: { cookie: 'soc_session=invalid' }, socket: {} }, memoryDenied)
    assert.equal(memoryDenied.statusCode, 401)
  }
  assert.equal(memoryHandlerCalled, false)

  const memoryAccepted = nodeResponse()
  await memoryRoute.handler({ method: 'GET', headers: { cookie: 'soc_session=app-session-a' }, socket: {} }, memoryAccepted)
  assert.equal(memoryAccepted.statusCode, 403)
  assert.equal(memoryHandlerCalled, false)

  const adminToken = auth.adminSessionToken()
  auth.adminSessions.set(auth.adminSessionKey(adminToken), {
    email: 'admin@example.com',
    expiresAt: new Date(Date.now() + 60_000),
  })
  const memoryAdmin = nodeResponse()
  await memoryRoute.handler({ method: 'GET', headers: { cookie: `soc_admin_session=${adminToken}` }, socket: {} }, memoryAdmin)
  assert.equal(memoryAdmin.statusCode, 200)
  assert.equal(memoryHandlerCalled, true)

  const scoped = await auth.withSession(applicationSession, () => api.workspace.list({ payload: {} }))
  assert.deepEqual(scoped.result.value.items.map(item => item.workspaceId), ['workspace-a'])
  assert.deepEqual(scoped.result.value.items[0].sessionIds, ['session-a'])
  await auth.withSession(applicationSession, async () => {
    auth.rememberPendingResponse('rpc-1', 'session-a')
    assert.deepEqual(await api.respond({ rpcId: 'rpc-1', result: { ok: false } }), { accepted: true })
  })
  dispose()
  assert.equal(api.workspace, originalWorkspace)
  assert.equal(api.respond, originalRespond)
})

test('SOC auth plugin attaches session metadata to the Harness MCP client without exposing tokens', async () => {
  const effects = []
  const routes = new Map()
  let providedAuth
  let executeListener
  const ctx = {
    webServer: {
      register(route) {
        routes.set(`${route.kind}:${route.path}`, route)
        return () => routes.delete(`${route.kind}:${route.path}`)
      },
      registerUpgrade() { return () => {} },
    },
    apiProxy: {},
    get(name) {
      return name === 'socAdminCredentials'
        ? { email: 'admin@example.com', password: 'admin-secret' }
        : undefined
    },
    provide(name, value) {
      if (name === 'socAuth') providedAuth = value
    },
    inject() {},
    on(name, listener) {
      if (name === 'mcp/request-meta') executeListener = listener
    },
    effect(factory) {
      const disposer = factory()
      if (typeof disposer === 'function') effects.push(disposer)
      return disposer
    },
  }
  applyAuthHost(ctx)
  providedAuth.bindAgentSession('agent-a', 'app-session-a')
  const metadata = await executeListener({ agent: { id: 'agent-a' } }, 'soc_agent', async () => ({ trace: 'test' }))
  assert.equal(metadata.soc_session_id, 'app-session-a')
  assert.equal(metadata.soc_investigation_id, 'agent-a')
  assert.equal(metadata.trace, 'test')
  assert.equal(typeof metadata.soc_correlation_id, 'string')
  assert.ok(metadata.soc_deadline_ms > Date.now())
  assert.equal(JSON.stringify(metadata).includes('zimbra'), false)
  assert.deepEqual(await executeListener({ agent: { id: 'agent-a' } }, 'other', async () => ({})), {})
  for (const dispose of effects.reverse()) dispose()
})
