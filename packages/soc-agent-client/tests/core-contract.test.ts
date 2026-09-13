import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createSocClientRuntime, socSurface } from '../src/client/contract.ts'

const clientSource = readFileSync(new URL('../src/client/index.ts', import.meta.url), 'utf8')
const nodeSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8')
const contractSource = readFileSync(new URL('../src/client/contract.ts', import.meta.url), 'utf8')

test('the core owns authentication, the runtime service, and the safe admin fallback', () => {
  assert.match(clientSource, /ctx\.provide\('socClient'/)
  assert.match(clientSource, /AuthGate/)
  assert.match(clientSource, /AdminUnavailable/)
  assert.match(clientSource, /soc\.admin\.content/)
  assert.match(contractSource, /interface SocClientRuntime/)
  assert.match(contractSource, /surface: 'workspace' \| 'admin'/)
  assert.match(contractSource, /rpc<T = unknown>/)
})

test('action-policy schema remains mandatory in the node half', () => {
  assert.match(nodeSource, /SOC_ACTION_APPROVAL_NAMESPACE/)
  assert.match(nodeSource, /SocActionApprovalSettingsSchema/)
  assert.doesNotMatch(nodeSource, /MARKITDOWN|attachment|ZimbraSettings|AdminConsole/)
})

test('optional feature implementations are not imported by the core browser entry', () => {
  assert.doesNotMatch(clientSource, /CiticBrand|AdminConsole|MarkItDown|EmailDraft|SocActionPolicy/)
  assert.doesNotMatch(clientSource, /ui-settings|ui-commands|ui-tool|ui-conversation/)
})

test('scheduled-task management stays outside the core settings surface', () => {
  assert.doesNotMatch(clientSource, /ScheduledTasksForm|settings\.section|soc-agent-schedules/)
})

test('the runtime contract selects a surface and forwards only the named SOC RPC', async () => {
  assert.equal(socSurface('/'), 'workspace')
  assert.equal(socSurface('/admin'), 'admin')
  assert.equal(socSurface('/admin/providers'), 'admin')
  assert.equal(socSurface('/administrator'), 'workspace')

  const calls: unknown[][] = []
  const connection = {
    rpc: {
      call: async (...args: unknown[]) => {
        calls.push(args)
        return { ok: true, value: { mode: 'soc' } }
      },
    },
  }
  const runtime = createSocClientRuntime(connection as never, 'workspace')
  assert.deepEqual(await runtime.rpc('get-action-policy', { session: 'current' }), { mode: 'soc' })
  assert.deepEqual(calls, [['/soc-agent-config', 'get-action-policy', { session: 'current' }]])

  const failed = createSocClientRuntime({
    rpc: { call: async () => ({ ok: false, error: { message: 'denied' } }) },
  } as never, 'admin')
  await assert.rejects(failed.rpc('mutate'), /denied/)
})
