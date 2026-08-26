import assert from 'node:assert/strict'
import test from 'node:test'
import { CallToolResultSchema } from '../../../vendor/deepseek-harness/packages/mcp/mcp-client/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js'
import { Client as HarnessMcpClient } from '../../../vendor/deepseek-harness/packages/mcp/mcp-client/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js'
import { apply as applyAuthHost } from '../auth-host.js'
import { createScopedApiProxy, SocAuthService } from '../ownership.js'

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
  return { auth, store }
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
  const auth = new SocAuthService({}, store)
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
  const auth = new SocAuthService({}, store)
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
    provide(name, value) {
      if (name === 'socAuth') providedAuth = value
    },
    inject() {},
    on(name, listener) {
      if (name === 'tools/execute') executeListener = listener
    },
    effect(factory) {
      const disposer = factory()
      if (typeof disposer === 'function') effects.push(disposer)
      return disposer
    },
  }
  applyAuthHost(ctx)
  providedAuth.bindAgentSession('agent-a', 'app-session-a')
  const client = new HarnessMcpClient({ name: 'test', version: '1' })
  let sent
  client._transport = {
    send(message) {
      sent = message
      return Promise.reject(new Error('stop test request'))
    },
  }
  await assert.rejects(
    executeListener({ agent: { id: 'agent-a' } }, () => client.request(
      { method: 'tools/call', params: { name: 'mail_search', arguments: {} } },
      CallToolResultSchema,
    )),
    /stop test request/,
  )
  assert.equal(sent.params._meta.soc_session_id, 'app-session-a')
  assert.equal(JSON.stringify(sent).includes('zimbra'), false)
  for (const dispose of effects.reverse()) dispose()
})
