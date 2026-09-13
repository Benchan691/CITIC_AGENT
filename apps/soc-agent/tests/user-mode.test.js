import assert from 'node:assert/strict'
import test from 'node:test'
import { SocAuthService } from '../ownership.js'
import { apply } from '../host.js'

test('user modes are authenticated, isolated, enforced, and revoked on logout', async () => {
  const auth = new SocAuthService({}, { ensureSchema: async () => {} }, {
    adminCredentials: { email: 'admin@example.test', password: 'test-only' },
  })
  const handlers = new Map()
  let rpc
  apply({
    get(name) {
      if (name === 'socAuth') return auth
      if (name === 'settings') return { get: () => ({ mode: 'soc', actionStates: {} }) }
    },
    on(name, handler) { handlers.set(name, handler) },
    agents: { roots: () => [] },
    connection: { rpc: { handle(_channel, handler) { rpc = handler } } },
  })
  const a = { id: 'login-a' }, b = { id: 'login-b' }
  const agent = { id: 'chat-a' }
  const execute = () => handlers.get('tools/pre-execute')({ name: 'mcp__soc_agent__zimbra_move_email', agent }, () => ({ kind: 'delegate' }))
  assert.deepEqual((await rpc('set-action-mode', { mode: 'full' })).error, {
    code: 'authentication-required',
    message: 'authentication required',
    details: {},
  })
  assert.deepEqual((await rpc('get-admin-action-catalog', {})).error, {
    code: 'admin-authentication-required',
    message: 'administrator authentication required',
    details: {},
  })
  await auth.storage.run(a, async () => {
    auth.bindAgentSession('chat-a')
    assert.equal((await execute()).kind, 'ask')
    assert.equal(auth.rememberToolApproval(
      auth.requireUser(),
      'chat-a',
      'mcp__soc_agent__zimbra_move_email',
    ), true)
    assert.equal((await execute()).kind, 'delegate')
    auth.clearSessionToolApprovals('chat-a')
    assert.equal((await execute()).kind, 'ask')
    assert.equal((await rpc('set-action-mode', { mode: 'full', sessionId: 'login-b' })).ok, false)
    assert.equal((await rpc('set-action-mode', { mode: 'invalid' })).ok, false)
    assert.equal((await rpc('set-action-mode', { mode: 'full' })).value.mode, 'full')
    assert.equal((await execute()).kind, 'delegate')
  })
  assert.equal((await execute()).kind, 'delegate')
  await auth.storage.run(b, async () => {
    assert.equal((await rpc('get-action-policy', {})).value.mode, 'soc')
    assert.equal((await execute()).kind, 'ask')
  })
  await auth.storage.run(a, async () => {
    assert.equal((await rpc('set-action-mode', { mode: 'soc' })).value.mode, 'soc')
    assert.equal((await execute()).kind, 'ask')
    await rpc('set-action-mode', { mode: 'full' })
  })
  auth.revokeApplicationSession(a.id)
  assert.equal(auth.actionMode({ agent }), undefined)
  assert.equal(auth.actionModes.size, 0)
})
