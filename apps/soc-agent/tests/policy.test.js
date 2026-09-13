import assert from 'node:assert/strict'
import test from 'node:test'
import { ACTION_CATALOG, apply, APPROVAL_TOOLS, DOMAIN_TOOLS, READ_ONLY_TOOLS, TOOL_CATALOG } from '../host.js'
import { ACTION_TOOLS } from '../policy.js'

test('interactive analyst policy exposes the exact product tool set', () => {
  assert.equal(READ_ONLY_TOOLS.length, 30)
  assert.equal(DOMAIN_TOOLS.size, 42)
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
  assert.equal([...DOMAIN_TOOLS].some(name => name.startsWith('mcp__soc_agent__splunk_')), false)
  assert.equal(DOMAIN_TOOLS.has('mcp__soc_agent__system_get_status'), false)
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
  assert.deepEqual(await preExecute({ name: 'mcp__splunk_mcp__splunk_run_query' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.equal((await preExecute({ name: 'mcp__soc_agent__splunk_search' }, () => ({ kind: 'delegate' }))).kind, 'deny')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__system_get_status' }, () => ({ kind: 'delegate' }))).kind, 'deny')
  assert.equal((await preExecute({ name: 'mcp__splunk_official__splunk_run_query' }, () => ({ kind: 'delegate' }))).kind, 'deny')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__splunk_write_detection' }, () => ({ kind: 'delegate' }))).kind, 'deny')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__splunk_write_lookup' }, () => ({ kind: 'delegate' }))).kind, 'deny')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__splunk_list_indexes' }, () => ({ kind: 'delegate' }))).kind, 'deny')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__splunk_find_lookup' }, () => ({ kind: 'delegate' }))).kind, 'deny')
  assert.equal((await preExecute({ name: 'mcp__soc_agent__splunk_list_lookups' }, () => ({ kind: 'delegate' }))).kind, 'deny')
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__zimbra_list_email_filters' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__zimbra_preview_email_filter_update' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__zimbra_send_email' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
  assert.deepEqual(await preExecute({ name: 'mcp__soc_agent__zimbra_forward_email' }, () => ({ kind: 'delegate' })), { kind: 'delegate' })
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
        requireUser: () => ({ kind: 'user', applicationSessionId: 'auth-session', userId: 'user-1', zimbraEmail: 'analyst@example.test' }),
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
