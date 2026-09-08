import assert from 'node:assert/strict'
import test from 'node:test'
import { apply } from './bench_policy.mjs'

function policy(syntheticDrafts = []) {
  const handlers = {}
  apply({ on: (name, fn) => { handlers[name] = fn } }, {
    allowedTools: ['splunk_search', 'splunk_write_detection'], syntheticDrafts,
  })
  return handlers
}
test('synthetic operator consumes one exact draft approval', async () => {
  const h = policy(['splunk_write_detection'])
  const call = { name: 'mcp__soc_agent__splunk_write_detection', callId: 'call-1' }
  assert.equal((await h['tools/pre-execute'](call, () => 'next')).kind, 'ask')
  const request = { toolName: call.name, callId: call.callId }
  assert.equal(await h['approval/request'](request, () => 'next'), 'allowed-once')
  assert.equal(await h['approval/request'](request, () => 'next'), 'next')
})
test('lab approval is never supplied by the synthetic answerer', async () => {
  const h = policy()
  const call = { name: 'mcp__soc_agent__splunk_write_detection', callId: 'call-1' }
  assert.equal((await h['tools/pre-execute'](call, () => 'next')).kind, 'ask')
  assert.equal(await h['approval/request']({ toolName: call.name, callId: call.callId }, () => 'unavailable'), 'unavailable')
})
test('out of scope tools denied and ordinary read tools proceed', async () => {
  const h = policy()
  for (const name of ['bash', 'web_search', 'mcp__soc_agent__zimbra_move_email']) {
    assert.equal((await h['tools/pre-execute']({ name }, () => 'next')).kind, 'deny')
  }
  assert.equal(await h['tools/pre-execute']({ name: 'mcp__soc_agent__splunk_search' }, () => 'next'), 'next')
})
