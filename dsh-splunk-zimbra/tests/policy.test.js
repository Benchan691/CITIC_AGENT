import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { apply, APPROVAL_TOOLS, DOMAIN_TOOLS } from '../host.js'
import { ACTION_TOOLS, READ_ONLY_TOOLS } from '../policy.js'
import { READ_ONLY_DOMAIN_TOOLS } from '../scheduler.js'

test('interactive analyst policy exposes the exact product tool set', () => {
  assert.equal(DOMAIN_TOOLS.size, 26)
  assert.deepEqual([...APPROVAL_TOOLS].sort(), [
    'mcp__splunk_zimbra__splunk_create_detection_draft',
    'mcp__splunk_zimbra__splunk_disable_detection',
    'mcp__splunk_zimbra__splunk_enable_detection',
    'mcp__splunk_zimbra__splunk_update_detection_draft',
    'mcp__splunk_zimbra__zimbra_send_email',
    'scheduled_task_create',
    'scheduled_task_delete',
    'scheduled_task_pause',
    'scheduled_task_resume',
    'scheduled_task_run_now',
  ])
  for (const name of APPROVAL_TOOLS) assert.equal(DOMAIN_TOOLS.has(name), true)
})

test('SOC policy has disjoint read-only and action categories', () => {
  assert.equal(READ_ONLY_TOOLS.length, 16)
  assert.equal(ACTION_TOOLS.length, 10)
  for (const name of READ_ONLY_TOOLS) assert.equal(ACTION_TOOLS.includes(name), false)
  for (const name of ACTION_TOOLS) assert.equal(DOMAIN_TOOLS.has(name), true)
  assert.equal(READ_ONLY_TOOLS.includes('scheduled_task_list'), true)
})

test('scheduled workers have an exact read-only allowlist', () => {
  assert.equal(READ_ONLY_DOMAIN_TOOLS.length, 15)
  for (const name of READ_ONLY_DOMAIN_TOOLS) {
    assert.equal(DOMAIN_TOOLS.has(name), true)
    assert.equal(APPROVAL_TOOLS.has(name), false)
    assert.equal(name.startsWith('scheduled_task_'), false)
  }
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__splunk_zimbra__zimbra_send_email'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.some(name => name.includes('create_detection')), false)
})

test('host policy delegates reads, asks for mutations, and denies generic tools', async () => {
  const handlers = new Map()
  apply({
    on(event, handler) { handlers.set(event, handler) },
    agents: { roots: () => [] },
    connection: { rpc: { handle() {} } },
  })
  const preExecute = handlers.get('tools/pre-execute')
  assert.deepEqual(await preExecute({ name: 'mcp__splunk_zimbra__splunk_search' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.equal((await preExecute({ name: 'mcp__splunk_zimbra__zimbra_send_email' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'bash' }, () => ({ kind: 'delegate' }))).kind, 'deny')
})

test('assembled Web profile matches the focused enabled-plugin snapshot', () => {
  const productRoot = fileURLToPath(new URL('..', import.meta.url))
  const harnessRoot = fileURLToPath(new URL('../../deepseek-harness/', import.meta.url))
  const isolatedHome = mkdtempSync(join(tmpdir(), 'dsh-splunk-zimbra-test-'))
  const env = { ...process.env, DSH_HOME: isolatedHome }
  try {
    const install = spawnSync('pnpm', [
      'dsh', 'plugin', '--profile', 'web', 'add',
      productRoot,
      join(productRoot, '..', 'dsh-splunk-zimbra-client'),
    ], { cwd: harnessRoot, env, encoding: 'utf8' })
    assert.equal(install.status, 0, install.stderr)

    const result = spawnSync('pnpm', ['dsh', 'web', '--dump-config'], {
      cwd: harnessRoot,
      env,
      encoding: 'utf8',
    })
    assert.equal(result.status, 0, result.stderr)
    const blocks = [...result.stdout.matchAll(/^- id: ([^\n]+)\n([\s\S]*?)(?=^- id: |^- insert:|$(?![\s\S]))/gm)]
    const enabled = blocks.filter(match => !/^  disabled: true$/m.test(match[2])).map(match => match[1])
    const expected = JSON.parse(readFileSync(`${productRoot}/tests/enabled-plugins.snapshot.json`, 'utf8'))
    assert.deepEqual(enabled, expected)
    for (const removed of ['tool-bash', 'tool-pwsh', 'tool-fs', 'tool-fs-search', 'tool-workflow', 'tool-todo', 'tool-goal', 'tool-subagent']) {
      assert.equal(enabled.includes(removed), false)
    }
  } finally {
    rmSync(isolatedHome, { recursive: true, force: true })
  }
})
