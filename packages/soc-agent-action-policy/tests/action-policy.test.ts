import assert from 'node:assert/strict'
import test from 'node:test'
import type { SocClientRuntime } from 'dsh-soc-agent-client/client'
import { readActionMode } from '../src/client/actionPolicy.ts'

test('regular SOC clients read deployment mode through the authorized product endpoint', async () => {
  for (const mode of ['soc', 'full']) {
    const client: SocClientRuntime = {
      surface: 'workspace',
      async rpc(name, payload) {
        assert.equal(name, 'get-action-policy')
        assert.deepEqual(payload, {})
        return { mode, source: 'deployment' }
      },
    }
    assert.equal(await readActionMode(client), mode)
  }
})

test('failed and malformed policy reads report errors instead of inventing SOC mode', async () => {
  for (const response of [{ ok: false, error: { message: 'authentication required' } }, { ok: true, value: {} }]) {
    const client: SocClientRuntime = {
      surface: 'workspace',
      async rpc() {
        if (!response.ok) throw new Error(response.error.message)
        return response.value
      },
    }
    await assert.rejects(readActionMode(client), /authentication required|invalid access mode/)
  }
})

test('mode selection sends only the chosen mode and uses the confirmed server value', async () => {
  const client: SocClientRuntime = {
    surface: 'workspace',
    async rpc(name, payload) {
      assert.equal(name, 'set-action-mode')
      assert.deepEqual(payload, { mode: 'full' })
      return { mode: 'full', source: 'session' }
    },
  }
  assert.equal(await readActionMode(client, 'full'), 'full')
})
