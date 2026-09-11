import assert from 'node:assert/strict'
import test from 'node:test'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { readActionMode } from '../src/client/actionPolicy.ts'

test('regular SOC clients read deployment mode through the authorized product endpoint', async () => {
  for (const mode of ['soc', 'full']) {
    const connection = { rpc: { async call(...args: unknown[]) {
      assert.deepEqual(args, ['/soc-agent-config', 'get-action-policy', {}])
      return { ok: true, value: { mode, source: 'deployment' } }
    } } } as unknown as ConnectionHandle
    assert.equal(await readActionMode(connection), mode)
  }
})

test('failed and malformed policy reads report errors instead of inventing SOC mode', async () => {
  for (const response of [{ ok: false, error: { message: 'authentication required' } }, { ok: true, value: {} }]) {
    const connection = { rpc: { call: async () => response } } as unknown as ConnectionHandle
    await assert.rejects(readActionMode(connection), /authentication required|invalid access mode/)
  }
})

test('mode selection sends only the chosen mode and uses the confirmed server value', async () => {
  const connection = { rpc: { async call(...args: unknown[]) {
    assert.deepEqual(args, ['/soc-agent-config', 'set-action-mode', { mode: 'full' }])
    return { ok: true, value: { mode: 'full', source: 'session' } }
  } } } as unknown as ConnectionHandle
  assert.equal(await readActionMode(connection, 'full'), 'full')
})
