import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { apply, APPROVAL_TOOLS, CONTROL_TOOLS, DOMAIN_TOOLS } from '../host.js'
import { ACTION_TOOLS, READ_ONLY_TOOLS } from '../policy.js'
import { READ_ONLY_DOMAIN_TOOLS } from '../scheduler.js'

test('interactive analyst policy exposes the exact product tool set', () => {
  assert.equal(DOMAIN_TOOLS.size, 45)
  assert.deepEqual([...APPROVAL_TOOLS].sort(), [
    'mcp__soc_agent__create_subscription',
    'mcp__soc_agent__delete_subscription',
    'mcp__soc_agent__splunk_create_detection_draft',
    'mcp__soc_agent__splunk_disable_detection',
    'mcp__soc_agent__splunk_enable_detection',
    'mcp__soc_agent__splunk_update_detection_draft',
    'mcp__soc_agent__update_subscription',
    'mcp__soc_agent__zimbra_create_email_filter',
    'mcp__soc_agent__zimbra_create_folder',
    'mcp__soc_agent__zimbra_move_email',
    'mcp__soc_agent__zimbra_reorder_email_filter',
    'mcp__soc_agent__zimbra_send_email',
    'mcp__soc_agent__zimbra_set_email_filter_enabled',
    'mcp__soc_agent__zimbra_update_email_filter',
    'scheduled_task_create',
    'scheduled_task_delete',
    'scheduled_task_pause',
    'scheduled_task_resume',
    'scheduled_task_run_now',
  ])
  for (const name of APPROVAL_TOOLS) assert.equal(DOMAIN_TOOLS.has(name), true)
})

test('SOC policy has disjoint read-only and action categories', () => {
  assert.equal(READ_ONLY_TOOLS.length, 26)
  assert.equal(ACTION_TOOLS.length, 19)
  for (const name of READ_ONLY_TOOLS) assert.equal(ACTION_TOOLS.includes(name), false)
  for (const name of ACTION_TOOLS) assert.equal(DOMAIN_TOOLS.has(name), true)
  assert.equal(READ_ONLY_TOOLS.includes('skill'), true)
  assert.equal(ACTION_TOOLS.includes('skill'), false)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_list_indexes'), false)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_list_data_sources'), false)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_find_lookup'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_list_lookups'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__splunk_find_lookup'), false)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__splunk_list_lookups'), false)
  assert.equal(READ_ONLY_TOOLS.includes('scheduled_task_list'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__list_subscriptions'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__get_subscription_schema'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__preview_subscription'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__zimbra_create_email_draft'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__create_subscription'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__update_subscription'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__delete_subscription'), true)
  assert.equal(DOMAIN_TOOLS.has('exit_plan_mode'), false)
  assert.equal(CONTROL_TOOLS.has('exit_plan_mode'), true)
  assert.equal(DOMAIN_TOOLS.has('ask_user_question'), false)
  assert.equal(CONTROL_TOOLS.has('ask_user_question'), true)
})

test('scheduled workers have an exact read-only allowlist', () => {
  assert.equal(READ_ONLY_DOMAIN_TOOLS.length, 21)
  for (const name of READ_ONLY_DOMAIN_TOOLS) {
    assert.equal(DOMAIN_TOOLS.has(name), true)
    assert.equal(APPROVAL_TOOLS.has(name), false)
    assert.equal(name.startsWith('scheduled_task_'), false)
  }
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__zimbra_send_email'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__zimbra_move_email'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__splunk_list_indexes'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__splunk_list_data_sources'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.some(name => name.includes('create_detection')), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__zimbra_create_email_draft'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__list_subscriptions'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__get_subscription_schema'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__preview_subscription'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('ask_user_question'), false)
})

test('host policy delegates reads, asks for mutations, and denies generic tools', async () => {
  const handlers = new Map()
  const restrictions = []
  const agent = { ctx: { tools: { restrict: value => restrictions.push(value) } } }
  apply({
    on(event, handler) { handlers.set(event, handler) },
    agents: { roots: () => [agent] },
    connection: { rpc: { handle() {} } },
  })
  handlers.get('agent/created')({ agent })
  assert.equal(restrictions[0].allow.includes('ask_user_question'), true)
  const preExecute = handlers.get('tools/pre-execute')
  assert.deepEqual(await preExecute({ name: 'skill' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'exit_plan_mode' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'ask_user_question' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__splunk_search' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.equal((await preExecute({ name: 'mcp__soc_agent__splunk_list_indexes' }, () => ({ kind: 'delegate' }))).kind, 'deny')
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__splunk_find_lookup' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__splunk_list_lookups' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__zimbra_list_email_filters' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__zimbra_preview_email_filter_update' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__zimbra_create_email_draft' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.equal((await preExecute({ name: 'mcp__soc_agent__zimbra_create_folder' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__zimbra_update_email_filter' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__zimbra_send_email' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__zimbra_move_email' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__list_subscriptions' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__get_subscription_schema' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__preview_subscription' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.equal((await preExecute({ name: 'mcp__soc_agent__create_subscription' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__update_subscription' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__delete_subscription' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'bash' }, () => ({ kind: 'delegate' }))).kind, 'deny')
})

test('host RPC failures use the shared result error contract', async () => {
  let rpcHandler
  apply({
    on() {},
    agents: { roots: () => [] },
    connection: { rpc: { handle(_channel, handler) { rpcHandler = handler } } },
  })

  assert.deepEqual(await rpcHandler('missing-endpoint', {}), {
    ok: false,
    error: { code: 'bad-request', message: 'Unknown endpoint: missing-endpoint', details: { issues: [] } },
  })

  const previousServer = process.env.DSH_SOC_AGENT_SERVER
  process.env.DSH_SOC_AGENT_SERVER = '/path/that/does/not/exist'
  try {
    const result = await rpcHandler('get-settings', {})
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'internal')
    assert.deepEqual(result.error.details, {})
    assert.match(result.error.message, /^Admin operation "get-settings" failed: /)
    assert.equal(result.error.message.includes('Traceback'), false)
  } finally {
    if (previousServer === undefined) delete process.env.DSH_SOC_AGENT_SERVER
    else process.env.DSH_SOC_AGENT_SERVER = previousServer
  }
})

test('assembled Web profile matches the focused enabled-plugin snapshot', () => {
  const productRoot = fileURLToPath(new URL('..', import.meta.url))
  const harnessRoot = fileURLToPath(new URL('../../../vendor/deepseek-harness/', import.meta.url))
  const isolatedHome = mkdtempSync(join(tmpdir(), 'dsh-soc-agent-test-'))
  const env = { ...process.env, DSH_HOME: isolatedHome }
  try {
    const install = spawnSync('pnpm', [
      'dsh', 'plugin', '--profile', 'web', 'add',
      productRoot,
      join(productRoot, '..', '..', 'packages', 'soc-agent-client'),
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
    for (const removed of [
      'tool-bash', 'tool-pwsh', 'tool-fs', 'tool-fs-search', 'tool-str-replace-editor',
      'tool-workflow', 'tool-todo', 'tool-goal', 'tool-subagent', 'tool-subagent-fork',
      'tool-subagent-control', 'tool-subagent-list-agents', 'tool-subagent-report',
      'tool-ralph', 'skill-badge',
    ]) {
      assert.equal(enabled.includes(removed), false)
    }
  } finally {
    rmSync(isolatedHome, { recursive: true, force: true })
  }
})
