import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACTION_CATALOG, apply, APPROVAL_TOOLS, CONTROL_TOOLS, DOMAIN_TOOLS, MANAGED_TOOL_NAMES, OFFICIAL_SPLUNK_READ_TOOLS, TOOL_CATALOG } from '../host.js'
import { ACTION_TOOLS, READ_ONLY_TOOLS, ZIMBRA_READ_TOOLS } from '../policy.js'

test('interactive analyst policy exposes the exact product tool set', () => {
  assert.equal(DOMAIN_TOOLS.size, 57)
  assert.deepEqual([...APPROVAL_TOOLS].sort(), [
    'mcp__soc_agent__create_subscription',
    'mcp__soc_agent__delete_subscription',
    'mcp__soc_agent__update_subscription',
    'mcp__soc_agent__zimbra_create_email_filter',
    'mcp__soc_agent__zimbra_create_folder',
    'mcp__soc_agent__zimbra_create_signature',
    'mcp__soc_agent__zimbra_delete_email_filter',
    'mcp__soc_agent__zimbra_delete_signature',
    'mcp__soc_agent__zimbra_move_email',
    'mcp__soc_agent__zimbra_reorder_email_filter',
    'mcp__soc_agent__zimbra_set_email_filter_enabled',
    'mcp__soc_agent__zimbra_update_email_filter',
  ])
  for (const name of APPROVAL_TOOLS) assert.equal(DOMAIN_TOOLS.has(name), true)
  assert.equal([...DOMAIN_TOOLS].some(name => name.startsWith('mcp__soc_agent__catalog_')), false)
  assert.equal([...DOMAIN_TOOLS].some(name => name.startsWith('scheduled_task_')), false)
})

test('SOC policy has disjoint read-only and action categories', () => {
  assert.equal(READ_ONLY_TOOLS.length, 45)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__zimbra_list_accounts'), false)
  assert.equal(ACTION_TOOLS.length, 12)
  for (const name of READ_ONLY_TOOLS) assert.equal(ACTION_TOOLS.includes(name), false)
  for (const name of ACTION_TOOLS) assert.equal(DOMAIN_TOOLS.has(name), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__soc_evidence_read'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_plan_search'), true)
  assert.equal(READ_ONLY_TOOLS.includes('skill'), true)
  assert.equal(ACTION_TOOLS.includes('skill'), false)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_list_indexes'), false)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_list_data_sources'), false)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_find_lookup'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_list_lookups'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_get_lookup'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_list_security_findings'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_get_security_finding'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_compile_citic_detection'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__splunk_list_security_findings'), false)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__splunk_compile_citic_detection'), false)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__splunk_find_lookup'), false)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__splunk_list_lookups'), false)
  assert.equal(OFFICIAL_SPLUNK_READ_TOOLS.length, 13)
  for (const name of OFFICIAL_SPLUNK_READ_TOOLS) {
    assert.equal(READ_ONLY_TOOLS.includes(name), true)
    assert.equal(ACTION_TOOLS.includes(name), false)
  }
  assert.equal(READ_ONLY_TOOLS.some(name => name.startsWith('scheduled_task_')), false)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__list_subscriptions'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__get_subscription_schema'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__preview_subscription'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__zimbra_send_email'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__zimbra_list_signatures'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__zimbra_use_signature_on_email'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__zimbra_create_signature'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__zimbra_delete_signature'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__create_subscription'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__update_subscription'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__delete_subscription'), true)
  assert.equal(DOMAIN_TOOLS.has('exit_plan_mode'), false)
  assert.equal(CONTROL_TOOLS.has('exit_plan_mode'), true)
  assert.equal(DOMAIN_TOOLS.has('ask_user_question'), false)
  assert.equal(CONTROL_TOOLS.has('ask_user_question'), true)
})

test('admin inventory covers every Zimbra capability and the confirmed Send control', () => {
  const names = new Set(TOOL_CATALOG.map(tool => tool.name))
  const zimbraTools = [...DOMAIN_TOOLS].filter(name => name.startsWith('mcp__soc_agent__zimbra_')).sort()
  assert.deepEqual(zimbraTools, [
    'mcp__soc_agent__zimbra_create_email_filter',
    'mcp__soc_agent__zimbra_create_folder',
    'mcp__soc_agent__zimbra_create_signature',
    'mcp__soc_agent__zimbra_delete_email_filter',
    'mcp__soc_agent__zimbra_delete_signature',
    'mcp__soc_agent__zimbra_get_attachment_text',
    'mcp__soc_agent__zimbra_get_email',
    'mcp__soc_agent__zimbra_get_email_filter',
    'mcp__soc_agent__zimbra_get_email_headers',
    'mcp__soc_agent__zimbra_list_email_filters',
    'mcp__soc_agent__zimbra_list_folders',
    'mcp__soc_agent__zimbra_list_signatures',
    'mcp__soc_agent__zimbra_move_email',
    'mcp__soc_agent__zimbra_preview_email_filter_update',
    'mcp__soc_agent__zimbra_reorder_email_filter',
    'mcp__soc_agent__zimbra_search_emails',
    'mcp__soc_agent__zimbra_send_email',
    'mcp__soc_agent__zimbra_set_email_filter_enabled',
    'mcp__soc_agent__zimbra_update_email_filter',
    'mcp__soc_agent__zimbra_use_signature_on_email',
    'mcp__soc_agent__zimbra_validate_email_filter',
  ])
  assert.equal(zimbraTools.length, 21)
  for (const name of ZIMBRA_READ_TOOLS) assert.equal(names.has(name), true)
  for (const name of ACTION_TOOLS.filter(name => name.includes('__zimbra_'))) assert.equal(names.has(name), true)
  assert.equal(names.has('ui__soc_agent__send_email'), true)
  assert.equal(TOOL_CATALOG.find(tool => tool.name === 'ui__soc_agent__send_email').kind, 'ui-confirmed')
  assert.equal(MANAGED_TOOL_NAMES.includes('ui__soc_agent__send_email'), false)
})

test('host policy delegates reads, asks for mutations, and denies generic tools', async () => {
  const handlers = new Map()
  const restrictions = []
  const agent = { ctx: { tools: { restrict: value => restrictions.push(value) } } }
  const roots = [agent]
  apply({
    on(event, handler) { handlers.set(event, handler) },
    agents: { roots: () => roots },
    connection: { rpc: { handle() {} } },
  })
  handlers.get('agent/created')({ agent })
  assert.equal(restrictions[0].allow.includes('ask_user_question'), true)
  const lateAgent = { ctx: { tools: { restrict: () => { throw new Error('tool registration still pending') } } } }
  roots.push(lateAgent)
  assert.doesNotThrow(() => handlers.get('agent/created')({ agent: lateAgent }))
  const preExecute = handlers.get('tools/pre-execute')
  assert.deepEqual(await preExecute({ name: 'skill' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'exit_plan_mode' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'ask_user_question' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__splunk_search' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__splunk_official__splunk_run_query' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.equal((await preExecute({ name: 'mcp__soc_agent__splunk_write_detection' }, () => ({ kind: 'delegate' }))).kind, 'deny')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__splunk_write_lookup' }, () => ({ kind: 'delegate' }))).kind, 'deny')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__splunk_list_indexes' }, () => ({ kind: 'delegate' }))).kind, 'deny')
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__splunk_find_lookup' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__splunk_list_lookups' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__zimbra_list_email_filters' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__zimbra_preview_email_filter_update' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__zimbra_send_email' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__zimbra_list_signatures' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__zimbra_use_signature_on_email' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.equal((await preExecute({ name: 'mcp__soc_agent__zimbra_create_folder' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__zimbra_update_email_filter' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__zimbra_delete_email_filter' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__zimbra_move_email' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__zimbra_create_signature' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__zimbra_delete_signature' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__list_subscriptions' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__get_subscription_schema' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__preview_subscription' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.equal((await preExecute({ name: 'mcp__soc_agent__create_subscription' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__update_subscription' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__delete_subscription' }, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await preExecute({ name: 'bash', agent: lateAgent }, () => ({ kind: 'delegate' }))).kind, 'deny')
})

test('SOC mode applies deployment action states without an action-policy session', async () => {
  const handlers = new Map()
  const agent = { id: 'agent-1', ctx: { tools: { restrict() {} } } }
  let saved = { mode: 'soc', actionStates: {} }
  let rpcHandler
  apply({
    get(name) {
      if (name === 'settings') return { get: () => saved }
      if (name === 'socAuth') return {
        requireSession: () => ({ id: 'auth-session' }),
        requireAdmin: () => ({ email: 'admin@example.test' }),
      }
      return undefined
    },
    on(event, handler) { handlers.set(event, handler) },
    agents: { roots: () => [agent] },
    connection: { rpc: { handle(_channel, handler) { rpcHandler = handler } } },
  })
  const preExecute = handlers.get('tools/pre-execute')
  const action = { name: ACTION_TOOLS[0], agent }
  assert.equal((await preExecute(action, () => ({ kind: 'delegate' }))).kind, 'ask')

  const catalog = await rpcHandler('get-action-catalog', {})
  assert.deepEqual(catalog.value.actions.map(item => item.name), ACTION_TOOLS)
  assert.deepEqual(catalog.value.actions, ACTION_CATALOG)
  const adminCatalog = await rpcHandler('get-admin-action-catalog', {})
  assert.deepEqual(adminCatalog.value.actions, ACTION_CATALOG)
  assert.deepEqual(adminCatalog.value.tools, TOOL_CATALOG)
  const defaultPolicy = (await rpcHandler('get-action-policy', {})).value
  assert.deepEqual(defaultPolicy.actions, ACTION_CATALOG)
  assert.deepEqual(defaultPolicy.tools, TOOL_CATALOG)
  assert.equal(defaultPolicy.mode, 'soc')
  assert.equal(defaultPolicy.source, 'deployment')
  assert.equal(defaultPolicy.actionStates[ACTION_TOOLS[0]], 'ask')
  assert.equal(defaultPolicy.actionStates['mcp__soc_agent__zimbra_search_emails'], 'auto')

  saved = { mode: 'soc', actionStates: { [action.name]: 'auto' } }
  assert.deepEqual(await preExecute(action, () => ({ kind: 'delegate' })), { kind: 'delegate' })

  saved = { mode: 'soc', actionStates: { [action.name]: 'ask' } }
  assert.equal((await preExecute(action, () => ({ kind: 'delegate' }))).kind, 'ask')

  saved = { mode: 'soc', actionStates: { [action.name]: 'disabled' } }
  assert.equal((await preExecute(action, () => ({ kind: 'delegate' }))).kind, 'deny')

  saved = { mode: 'full', actionStates: {} }
  assert.deepEqual(await preExecute({ name: ACTION_TOOLS[1], agent }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute(action, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.equal((await rpcHandler('set-session-action-policy', {})).error.code, 'bad-request')
  assert.equal((await rpcHandler('reset-session-action-policy', {})).error.code, 'bad-request')
})

test('full access bypasses SOC action states for permitted tools', async () => {
  const handlers = new Map()
  const agent = { id: 'agent-disabled', ctx: { tools: { restrict() {} } } }
  const disabled = ACTION_TOOLS[0]
  apply({
    get(name) {
      if (name === 'settings') return { get: () => ({ mode: 'full', actionStates: { [disabled]: 'disabled' } }) }
      return undefined
    },
    on(event, handler) { handlers.set(event, handler) },
    agents: { roots: () => [agent] },
    connection: { rpc: { handle() {} } },
  })
  const preExecute = handlers.get('tools/pre-execute')
  assert.deepEqual(await preExecute({ name: disabled, agent }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
})

test('host RPC failures use the shared result error contract', async () => {
  let rpcHandler
  apply({
    get() {},
    on() {},
    agents: { roots: () => [] },
    connection: { rpc: { handle(_channel, handler) { rpcHandler = handler } } },
  })

  assert.deepEqual(await rpcHandler('missing-endpoint', {}), {
    ok: false,
    error: { code: 'bad-request', message: 'Unknown endpoint: missing-endpoint', details: { issues: [] } },
  })
  for (const endpoint of [
    'catalog-list',
    'catalog-get',
    'catalog-history',
    'catalog-publications',
    'catalog-preview-publish',
    'save-catalog-record',
    'archive-catalog-record',
  ]) {
    const removed = await rpcHandler(endpoint, {})
    assert.equal(removed.error.code, 'bad-request')
    assert.equal(removed.error.message, `Unknown endpoint: ${endpoint}`)
  }

  const previousServer = process.env.DSH_SOC_AGENT_SERVER
  process.env.DSH_SOC_AGENT_SERVER = '/path/that/does/not/exist'
  try {
    const result = await rpcHandler('get-settings', {})
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'admin-authentication-required')
    assert.deepEqual(result.error.details, {})
    assert.equal(result.error.message, 'administrator authentication required')
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
