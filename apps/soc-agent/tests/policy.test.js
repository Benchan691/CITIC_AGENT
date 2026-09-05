import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACTION_CATALOG, apply, APPROVAL_TOOLS, CATALOG_ACTION_TOOLS, CONTROL_TOOLS, DETECTION_ACTION_TOOLS, DOMAIN_TOOLS, SPLUNK_LOOKUP_ACTION_TOOLS } from '../host.js'
import { ACTION_TOOLS, READ_ONLY_TOOLS } from '../policy.js'
import { READ_ONLY_DOMAIN_TOOLS } from '../scheduler.js'

const policyAuth = {
  requireSession: () => ({ id: 'policy-user' }),
  requireAdmin: () => ({ email: 'admin@example.com' }),
}

test('interactive analyst policy exposes the exact product tool set', () => {
  assert.equal(DOMAIN_TOOLS.size, 70)
  assert.deepEqual([...APPROVAL_TOOLS].sort(), [
    'mcp__soc_agent__catalog_archive_record',
    'mcp__soc_agent__catalog_update_customer',
    'mcp__soc_agent__catalog_update_fix_source_type',
    'mcp__soc_agent__catalog_update_rule',
    'mcp__soc_agent__catalog_write_customer',
    'mcp__soc_agent__catalog_write_fix_source_type',
    'mcp__soc_agent__catalog_write_rule',
    'mcp__soc_agent__create_subscription',
    'mcp__soc_agent__delete_subscription',
    'mcp__soc_agent__splunk_delete_lookup',
    'mcp__soc_agent__splunk_update_detection',
    'mcp__soc_agent__splunk_update_lookup',
    'mcp__soc_agent__splunk_write_detection',
    'mcp__soc_agent__splunk_write_lookup',
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
    'scheduled_task_create',
    'scheduled_task_delete',
    'scheduled_task_pause',
    'scheduled_task_resume',
    'scheduled_task_run_now',
  ])
  for (const name of APPROVAL_TOOLS) assert.equal(DOMAIN_TOOLS.has(name), true)
})

test('SOC policy has disjoint read-only and action categories', () => {
  assert.equal(READ_ONLY_TOOLS.length, 41)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__zimbra_list_accounts'), false)
  assert.equal(ACTION_TOOLS.length, 29)
  for (const name of READ_ONLY_TOOLS) assert.equal(ACTION_TOOLS.includes(name), false)
  for (const name of ACTION_TOOLS) assert.equal(DOMAIN_TOOLS.has(name), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__catalog_list_rules'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__catalog_preview_publication'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__soc_evidence_read'), true)
  assert.equal(READ_ONLY_TOOLS.includes('mcp__soc_agent__splunk_plan_search'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__catalog_write_rule'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__catalog_archive_record'), true)
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
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__splunk_write_lookup'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__splunk_update_lookup'), true)
  assert.equal(ACTION_TOOLS.includes('mcp__soc_agent__splunk_delete_lookup'), true)
  assert.equal(READ_ONLY_TOOLS.includes('scheduled_task_list'), true)
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

test('scheduled workers have an exact read-only allowlist', () => {
  assert.equal(READ_ONLY_DOMAIN_TOOLS.length, 35)
  for (const name of READ_ONLY_DOMAIN_TOOLS) {
    assert.equal(DOMAIN_TOOLS.has(name), true)
    assert.equal(APPROVAL_TOOLS.has(name), false)
    assert.equal(name.startsWith('scheduled_task_'), false)
  }
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__zimbra_move_email'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__splunk_list_indexes'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__splunk_list_data_sources'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.some(name => DETECTION_ACTION_TOOLS.includes(name)), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__zimbra_send_email'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__zimbra_use_signature_on_email'), false)
  assert.equal(READ_ONLY_DOMAIN_TOOLS.includes('mcp__soc_agent__zimbra_list_signatures'), true)
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
  assert.equal((await preExecute({ name: 'bash' }, () => ({ kind: 'delegate' }))).kind, 'deny')
})

test('SOC action approval defaults fail closed and session overrides are live', async () => {
  const handlers = new Map()
  const session = { id: 'soc-session-1' }
  const agent = { id: session.id, session, ctx: { tools: { restrict() {} } } }
  let saved = { autoApproveActions: [] }
  let rpcHandler
  apply({
    get(name) {
      if (name === 'settings') return { get: () => saved }
      if (name === 'socAuth') return policyAuth
      return undefined
    },
    on(event, handler) { handlers.set(event, handler) },
    agents: { roots: () => [agent], get: id => id === agent.id ? agent : undefined },
    sessions: { get: id => id === session.id ? session : undefined },
    connection: { rpc: { handle(_channel, handler) { rpcHandler = handler } } },
  })
  const preExecute = handlers.get('tools/pre-execute')
  const action = { name: ACTION_TOOLS[0], agent }
  assert.equal((await preExecute(action, () => ({ kind: 'delegate' }))).kind, 'ask')

  const catalog = await rpcHandler('get-action-catalog', {})
  assert.deepEqual(catalog.value.actions.map(item => item.name), ACTION_TOOLS)
  assert.deepEqual(catalog.value.actions, ACTION_CATALOG)
  assert.deepEqual((await rpcHandler('get-action-policy', { session_id: session.id })).value, {
    actions: ACTION_CATALOG,
    autoApproveActions: [],
    source: 'defaults',
  })

  saved = { autoApproveActions: [action.name] }
  assert.deepEqual(await preExecute(action, () => ({ kind: 'delegate' })), { kind: 'delegate' })

  const sessionPolicy = await rpcHandler('set-session-action-policy', {
    session_id: session.id,
    auto_approve_actions: [],
  })
  assert.equal(sessionPolicy.value.source, 'session')
  assert.deepEqual(sessionPolicy.value.autoApproveActions, [])
  assert.equal((await preExecute(action, () => ({ kind: 'delegate' }))).kind, 'ask')

  saved = { autoApproveActions: [action.name] }
  assert.equal((await preExecute(action, () => ({ kind: 'delegate' }))).kind, 'ask')
  assert.equal((await rpcHandler('reset-session-action-policy', { session_id: session.id })).value.source, 'defaults')
  assert.deepEqual((await preExecute(action, () => ({ kind: 'delegate' }))), { kind: 'delegate' })

  assert.equal((await rpcHandler('set-session-action-policy', {
    session_id: session.id,
    auto_approve_actions: [action.name, action.name],
  })).error.code, 'bad-request')
  assert.equal((await rpcHandler('set-session-action-policy', {
    session_id: session.id,
    auto_approve_actions: ['not-a-soc-action'],
  })).error.code, 'bad-request')
  const missingPolicy = await rpcHandler('get-action-policy', { session_id: 'missing-session' })
  assert.equal(missingPolicy.error.code, 'session-not-found')
  assert.deepEqual(missingPolicy.error.details, { sessionId: 'missing-session' })
  handlers.get('session/disposed')(session)
  assert.equal((await rpcHandler('get-action-policy', { session_id: session.id })).value.source, 'defaults')
})

test('detection changes cannot be auto-approved by action name', async () => {
  const handlers = new Map()
  const session = { id: 'soc-detection-policy-1' }
  const agent = { id: session.id, session, ctx: { tools: { restrict() {} } } }
  let saved = { autoApproveActions: [...DETECTION_ACTION_TOOLS] }
  let rpcHandler
  apply({
    get(name) {
      if (name === 'settings') return { get: () => saved }
      if (name === 'socAuth') return policyAuth
      return undefined
    },
    on(event, handler) { handlers.set(event, handler) },
    agents: { roots: () => [agent] },
    sessions: { get: id => id === session.id ? session : undefined },
    connection: { rpc: { handle(_channel, handler) { rpcHandler = handler } } },
  })
  const preExecute = handlers.get('tools/pre-execute')
  for (const name of DETECTION_ACTION_TOOLS) {
    const decision = await preExecute({ name, agent, arguments: {} }, () => ({ kind: 'delegate' }))
    assert.equal(decision.kind, 'ask')
    assert.match(decision.reason, /detection draft requires approval/)
  }
  const policy = await rpcHandler('get-action-policy', { session_id: session.id })
  assert.equal(policy.value.autoApproveActions.some(name => DETECTION_ACTION_TOOLS.includes(name)), false)
  saved = { autoApproveActions: [] }
})

test('lookup CSV changes cannot be auto-approved by action name', async () => {
  const handlers = new Map()
  const session = { id: 'soc-lookup-policy-1' }
  const agent = { id: session.id, session, ctx: { tools: { restrict() {} } } }
  let saved = { autoApproveActions: [...SPLUNK_LOOKUP_ACTION_TOOLS] }
  let rpcHandler
  apply({
    get(name) {
      if (name === 'settings') return { get: () => saved }
      if (name === 'socAuth') return policyAuth
      return undefined
    },
    on(event, handler) { handlers.set(event, handler) },
    agents: { roots: () => [agent] },
    sessions: { get: id => id === session.id ? session : undefined },
    connection: { rpc: { handle(_channel, handler) { rpcHandler = handler } } },
  })
  const preExecute = handlers.get('tools/pre-execute')
  for (const name of SPLUNK_LOOKUP_ACTION_TOOLS) {
    const decision = await preExecute({ name, agent, arguments: {} }, () => ({ kind: 'delegate' }))
    assert.equal(decision.kind, 'ask')
    assert.match(decision.reason, /lookup CSV change requires approval/)
  }
  const policy = await rpcHandler('get-action-policy', { session_id: session.id })
  assert.equal(policy.value.autoApproveActions.some(name => SPLUNK_LOOKUP_ACTION_TOOLS.includes(name)), false)
  saved = { autoApproveActions: [] }
})

test('catalog changes cannot be auto-approved by action name', async () => {
  const handlers = new Map()
  const session = { id: 'soc-catalog-policy-1' }
  const agent = { id: session.id, session, ctx: { tools: { restrict() {} } } }
  let saved = { autoApproveActions: [...CATALOG_ACTION_TOOLS] }
  let rpcHandler
  apply({
    get(name) {
      if (name === 'settings') return { get: () => saved }
      if (name === 'socAuth') return policyAuth
      return undefined
    },
    on(event, handler) { handlers.set(event, handler) },
    agents: { roots: () => [agent] },
    sessions: { get: id => id === session.id ? session : undefined },
    connection: { rpc: { handle(_channel, handler) { rpcHandler = handler } } },
  })
  const preExecute = handlers.get('tools/pre-execute')
  for (const name of CATALOG_ACTION_TOOLS) {
    const decision = await preExecute({ name, agent, arguments: {} }, () => ({ kind: 'delegate' }))
    assert.equal(decision.kind, 'ask')
    assert.match(decision.reason, /catalog change requires approval/)
  }
  const policy = await rpcHandler('get-action-policy', { session_id: session.id })
  assert.equal(policy.value.autoApproveActions.some(name => CATALOG_ACTION_TOOLS.includes(name)), false)
  saved = { autoApproveActions: [] }
})

test('save-catalog-record is an authenticated editor RPC with strict request validation', async () => {
  let rpcHandler
  apply({
    get(name) {
      return name === 'socAuth' ? policyAuth : undefined
    },
    on() {},
    agents: { roots: () => [] },
    connection: { rpc: { handle(_channel, handler) { rpcHandler = handler } } },
  })

  const invalid = await rpcHandler('save-catalog-record', { operation: 'write', catalog: 'rule' })
  assert.deepEqual(invalid, {
    ok: false,
    error: { code: 'bad-request', message: 'The catalog record draft is invalid.', details: { issues: [] } },
  })

  const invalidCatalog = await rpcHandler('save-catalog-record', {
    operation: 'write',
    catalog: 'unknown',
    record: {},
  })
  assert.equal(invalidCatalog.error.code, 'bad-request')

  apply({
    on() {},
    agents: { roots: () => [] },
    connection: { rpc: { handle(_channel, handler) { rpcHandler = handler } } },
  })
  const unauthenticated = await rpcHandler('save-catalog-record', {
    operation: 'write',
    catalog: 'rule',
    record: { rule_number: '0001', rule_name_en: 'Threat Detection' },
  })
  assert.deepEqual(unauthenticated, {
    ok: false,
    error: { code: 'authentication-required', message: 'authentication required', details: {} },
  })
})

test('save-detection is an authenticated editor RPC with strict request validation', async () => {
  let rpcHandler
  apply({
    get(name) {
      return name === 'socAuth' ? policyAuth : undefined
    },
    on() {},
    agents: { roots: () => [] },
    connection: { rpc: { handle(_channel, handler) { rpcHandler = handler } } },
  })

  const invalid = await rpcHandler('save-detection', { operation: 'write' })
  assert.deepEqual(invalid, {
    ok: false,
    error: { code: 'bad-request', message: 'The detection draft is invalid.', details: { issues: [] } },
  })

  apply({
    on() {},
    agents: { roots: () => [] },
    connection: { rpc: { handle(_channel, handler) { rpcHandler = handler } } },
  })
  const unauthenticated = await rpcHandler('save-detection', {
    operation: 'write',
    detection: { name: 'Rule', spl: 'index=main error' },
  })
  assert.deepEqual(unauthenticated, {
    ok: false,
    error: { code: 'authentication-required', message: 'authentication required', details: {} },
  })
})

test('save-lookup is an authenticated editor RPC with strict request validation', async () => {
  let rpcHandler
  apply({
    get(name) {
      return name === 'socAuth' ? policyAuth : undefined
    },
    on() {},
    agents: { roots: () => [] },
    connection: { rpc: { handle(_channel, handler) { rpcHandler = handler } } },
  })

  const invalid = await rpcHandler('save-lookup', { operation: 'write', name: 'rules.csv' })
  assert.deepEqual(invalid, {
    ok: false,
    error: { code: 'bad-request', message: 'The lookup CSV content is invalid.', details: { issues: [] } },
  })

  apply({
    on() {},
    agents: { roots: () => [] },
    connection: { rpc: { handle(_channel, handler) { rpcHandler = handler } } },
  })
  const unauthenticated = await rpcHandler('save-lookup', {
    operation: 'write',
    name: 'rules.csv',
    content: 'id\n1\n',
  })
  assert.deepEqual(unauthenticated, {
    ok: false,
    error: { code: 'authentication-required', message: 'authentication required', details: {} },
  })
})

test('host RPC failures use the shared result error contract', async () => {
  let rpcHandler
  apply({
    get(name) {
      return name === 'socAuth' ? policyAuth : undefined
    },
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
    assert.equal(result.error.message, 'The requested operation failed.')
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
