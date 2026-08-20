import assert from 'node:assert/strict'
import test from 'node:test'
import { createScheduledTaskClient, SCHEDULED_TASK_CHANNEL } from '../client.js'

test('browser client uses only the scheduler loopback RPC channel', async () => {
  const calls = []
  const client = createScheduledTaskClient({
    rpc: { call: async (...args) => { calls.push(args); return { ok: true, value: { accepted: true } } } },
  })
  await client.pause('task-1')
  await client.updateSettings({ maxConcurrentRuns: 1, runTimeoutMs: 900000 })
  assert.deepEqual(calls, [
    [SCHEDULED_TASK_CHANNEL, 'pause', { id: 'task-1' }],
    [SCHEDULED_TASK_CHANNEL, 'settings', { maxConcurrentRuns: 1, runTimeoutMs: 900000 }],
  ])
})
