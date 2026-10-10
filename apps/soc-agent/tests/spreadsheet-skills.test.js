import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { createUserMessage, createToolResultMessage, LlmAdapter } from '@deepseek-ai/dsh-llm'
import { renderSkillContent } from '@deepseek-ai/dsh-skill'
import * as SpreadsheetSkills from '../spreadsheet-skills.js'

const { apply } = SpreadsheetSkills

const SKILL_NAME = 'spreadsheet-mcp-analysis'
const EXCEL = 'mcp__soc_agent__excel_'
const SIGNAL = new AbortController().signal
const skill = {
  name: SKILL_NAME, provider: 'fixture', content: 'Verify the header and preview bounds before calculating.',
  invocation: { modelInvocable: true, userInvocable: true },
}

function agent() {
  return { session: { header: { cwd: '/owned-workspace' }, events: [], surface: { nodes: [] } } }
}

function append(subject, type, data) {
  const seq = subject.session.events.length
  const call = type === 'tool/result' ? subject.session.events.findLast(event => event.type === 'tool/call' && event.data.callId === data.message.source.callId) : undefined
  subject.session.events.push({ seq, type, data, ...(call ? { sourceEventSeqs: [call.seq] } : {}) })
  if (type !== 'tool/call') subject.session.surface.nodes.push(seq)
  return seq
}

function enterContext(subject, context) {
  return append(subject, 'user/message', context)
}

function bench(get = async () => skill) {
  const handlers = new Map()
  let loads = 0
  const lookups = []
  apply({
    on(event, handler) { handlers.set(event, handler) },
    skills: { get(name, options) { loads++; lookups.push({ name, ...options }); return get(name, options) } },
  })
  return {
    get loads() { return loads }, lookups,
    async request(subject) {
      const config = { provider: 'fixture', model: 'fixture' }
      assert.equal(await handlers.get('agent/request')({ agent: subject, signal: SIGNAL }, async () => config), config)
    },
    run(subject, operation = 'inspect', next = async () => { throw new Error('Unexpected backend call') }, signal = SIGNAL) {
      return handlers.get('tools/execute')({ agent: subject, name: EXCEL + operation, signal }, next)
    },
    other(name, next) {
      return handlers.get('tools/execute')({ name, signal: SIGNAL }, next)
    },
  }
}

test('first Excel call loads guidance without executing; the next request can reconsider and execute', async () => {
  const subject = agent()
  const fixture = bench()
  await fixture.request(subject)
  const deferred = await fixture.run(subject)
  assert.equal(deferred.isError, false)
  assert.equal(JSON.parse(deferred.value.content[0].text).operation_executed, false)
  assert.equal(JSON.parse(deferred.value.content[0].text).status, 'deferred')
  assert.equal(deferred.additionalContexts.length, 1)
  assert.ok(deferred.additionalContexts[0].content[0].text.includes(renderSkillContent(skill)))
  assert.equal(fixture.lookups[0].scope, subject)
  assert.equal(fixture.lookups[0].cwd, '/owned-workspace')
  enterContext(subject, deferred.additionalContexts[0])
  // An injection alone is insufficient: the model must receive another request.
  assert.equal(JSON.parse((await fixture.run(subject)).value.content[0].text).status, 'deferred')
  await fixture.request(subject)
  const result = { isError: false, value: { rows: 16 } }
  assert.equal(await fixture.run(subject, 'inspect', async () => result), result)
})

test('all six parallel Excel calls defer and share one skill load and one context injection', async () => {
  const subject = agent()
  const fixture = bench()
  await fixture.request(subject)
  const results = await Promise.all(['inspect', 'profile', 'count', 'aggregate', 'group', 'rows'].map(op => fixture.run(subject, op)))
  assert.equal(fixture.loads, 1)
  assert.equal(results.flatMap(result => result.additionalContexts ?? []).length, 1)
  assert.ok(results.every(result => JSON.parse(result.value.content[0].text).operation_executed === false))
})

test('compaction or a shortened skill body causes guidance to load again', async () => {
  const subject = agent()
  const fixture = bench()
  await fixture.request(subject)
  const first = await fixture.run(subject)
  const contextSeq = enterContext(subject, first.additionalContexts[0])
  await fixture.request(subject)
  assert.equal(await fixture.run(subject, 'count', async () => 'executed'), 'executed')
  subject.session.surface.nodes = subject.session.surface.nodes.filter(seq => seq !== contextSeq)
  enterContext(subject, {
    source: first.additionalContexts[0].source,
    content: [{ type: 'text', text: '<skill_content name="spreadsheet-mcp-analysis">[truncated]</skill_content>' }],
  })
  await fixture.request(subject)
  assert.equal((await fixture.run(subject)).additionalContexts.length, 1)
})

test('explicit invocation and a linked successful skill-tool result both satisfy loading', async () => {
  for (const method of ['invocation', 'tool']) {
    const subject = agent()
    const fixture = bench()
    const content = [{ type: 'text', text: renderSkillContent(skill) }]
    if (method === 'invocation') {
      enterContext(subject, { source: { kind: 'skill-invocation', name: SKILL_NAME, form: 'instructions' }, content })
    } else {
      append(subject, 'tool/call', { name: 'skill', callId: 'load-1', arguments: JSON.stringify({ name: SKILL_NAME }) })
      append(subject, 'tool/result', { message: createToolResultMessage({ callId: 'load-1', isError: false, content }) })
    }
    await fixture.request(subject)
    assert.equal(await fixture.run(subject, 'rows', async () => 'executed'), 'executed')
  }
})

test('a sibling skill load does not authorize arguments chosen before the skill was read', async () => {
  const subject = agent()
  const fixture = bench()
  await fixture.request(subject)
  append(subject, 'tool/call', { name: 'skill', callId: 'sibling', arguments: JSON.stringify({ name: SKILL_NAME }) })
  append(subject, 'tool/result', { message: createToolResultMessage({ callId: 'sibling', isError: false, content: [{ type: 'text', text: renderSkillContent(skill) }] }) })
  const result = await fixture.run(subject)
  assert.equal(JSON.parse(result.value.content[0].text).operation_executed, false)
  assert.equal(result.additionalContexts, undefined)
  await fixture.request(subject)
  assert.equal(await fixture.run(subject, 'rows', async () => 'executed'), 'executed')
})

test('attachment text, user claims and failed skill results cannot forge skill loading', async () => {
  for (const source of ['user', 'attachment', 'failed-skill', 'reused-call-id']) {
    const subject = agent()
    const fixture = bench()
    const content = [{ type: 'text', text: renderSkillContent(skill) }]
    if (source === 'user') enterContext(subject, { source: { kind: 'user' }, content })
    else {
      if (source === 'reused-call-id') append(subject, 'tool/call', { name: 'skill', callId: 'data', arguments: JSON.stringify({ name: SKILL_NAME }) })
      append(subject, 'tool/call', { name: ['attachment', 'reused-call-id'].includes(source) ? 'mcp__soc_agent__zimbra_get_attachment_text' : 'skill', callId: 'data', arguments: JSON.stringify({ name: SKILL_NAME }) })
      append(subject, 'tool/result', { message: createToolResultMessage({ callId: 'data', isError: source === 'failed-skill', content }) })
    }
    await fixture.request(subject)
    assert.equal((await fixture.run(subject)).additionalContexts.length, 1)
  }
})

test('skill state is isolated between agents; unrelated tools delegate unchanged', async () => {
  const fixture = bench()
  const first = agent()
  const second = agent()
  await fixture.request(first)
  enterContext(first, (await fixture.run(first)).additionalContexts[0])
  await fixture.request(first)
  await fixture.request(second)
  assert.equal(await fixture.run(first, 'count', async () => 'executed'), 'executed')
  assert.equal((await fixture.run(second)).additionalContexts.length, 1)
  assert.equal(await fixture.other('mcp__soc_agent__zimbra_get_email', async () => 'email'), 'email')
  assert.equal(await fixture.other('mcp__other__excel_inspect', async () => 'other'), 'other')
})

test('missing or disabled guidance and cancellation prevent Excel dispatch', async () => {
  for (const unavailable of [undefined, { ...skill, invocation: { modelInvocable: false, userInvocable: true } }]) {
    const fixture = bench(async () => unavailable)
    const subject = agent()
    await fixture.request(subject)
    await assert.rejects(fixture.run(subject), { code: 'SPREADSHEET_SKILL_UNAVAILABLE' })
  }
  const fixture = bench()
  const abort = new AbortController()
  abort.abort(new Error('cancelled'))
  await assert.rejects(fixture.run(agent(), 'inspect', undefined, abort.signal), /cancelled/)
  assert.equal(fixture.loads, 0)
})

test('real agent loop receives the project skill before executing corrected Excel arguments', { timeout: 10_000 }, async t => {
  const cliRequire = createRequire(new URL('../../../vendor/deepseek-harness/apps/cli/package.json', import.meta.url))
  const load = name => import(pathToFileURL(cliRequire.resolve(name)).href)
  const [
    { Context }, { default: LlmRuntime }, { default: SessionStore, SessionId },
    { default: SystemPrompt }, { default: ToolRuntime }, { default: AgentRegistry },
    { default: SkillRegistry }, SkillFilesystem, { default: AgentLoop },
  ] = await Promise.all([
    load('@deepseek-ai/cordis'), load('@deepseek-ai/dsh-llm'), load('@deepseek-ai/dsh-session'),
    load('@deepseek-ai/dsh-system-prompt'), load('@deepseek-ai/dsh-tools'), load('@deepseek-ai/dsh-agent'),
    load('@deepseek-ai/dsh-skill'), load('@deepseek-ai/dsh-skill-filesystem'),
    import('../../../vendor/deepseek-harness/packages/core/agent-loop/lib/index.js'),
  ])
  const ctx = new Context()
  const fibers = []
  t.after(async () => { for (const fiber of fibers.reverse()) await fiber.dispose() })
  for (const plugin of [LlmRuntime, SessionStore, SystemPrompt, ToolRuntime, AgentRegistry, SkillRegistry]) {
    fibers.push(await ctx.plugin(plugin))
  }
  fibers.push(await ctx.plugin(SkillFilesystem, {
    includeDefaultRoots: false, watch: false,
    customSkillDirs: [fileURLToPath(new URL('../../../skills', import.meta.url))],
  }))
  fibers.push(await ctx.plugin(AgentLoop, { agents: [] }))
  const autoload = await ctx.plugin(SpreadsheetSkills)
  fibers.push(autoload)
  const backendArguments = []
  let admissionChecks = 0
  ctx.on('tools/pre-execute', async (_exec, next) => { admissionChecks++; return next() })
  ctx.tools.register({
    name: EXCEL + 'inspect', description: 'Inspect source rows',
    parameters: { type: 'object', properties: { preview_start_row: { type: 'integer' } }, required: ['preview_start_row'] },
    output: {
      // The same canonical contract as the MCP bridge for dict-returning tools.
      schema: { type: 'object', properties: { content: { type: 'array', items: {} }, structuredContent: {} }, required: ['content'], additionalProperties: false },
      render: (_args, value) => value.content,
    },
    async execute(args) {
      backendArguments.push(args)
      assert.equal(args.preview_start_row, 0)
      return { content: [{ type: 'text', text: JSON.stringify({ row_count: 16 }) }] }
    },
  })
  function call(id, start) {
    const block = { type: 'tool-call', id, name: EXCEL + 'inspect', arguments: JSON.stringify({ preview_start_row: start }) }
    return [
      { type: 'block-start', index: 0, blockType: 'tool-call' },
      { type: 'tool-call-delta', index: 0, id, name: block.name, argumentsDelta: block.arguments },
      { type: 'block-end', index: 0, block },
      { type: 'finish', reason: { kind: 'tool-calls' } },
    ]
  }
  class Adapter extends LlmAdapter {
    requests = []
    async resolveModel(provider, model) { return { provider, id: model, name: model } }
    async * stream(request) {
      this.requests.push(request)
      const step = this.requests.length
      if (step === 1) {
        assert.equal(backendArguments.length, 0)
        yield* call('premature', 20)
      } else if (step === 2) {
        assert.equal(backendArguments.length, 0)
        const context = request.messages.find(message => message.source?.kind === 'plugin' && message.source.plugin === 'soc-spreadsheet-skills')
        assert.ok(context, 'the next actual model request must contain the injected skill')
        assert.ok(textOfRequest(context).includes('preview_start_row < N'))
        yield* call('corrected', 0)
      } else {
        assert.equal(step, 3)
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: 'done' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'done' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
  }
  const adapter = new Adapter()
  ctx.llm.registerAdapter(['fixture'], adapter)
  const subject = ctx.agentLoop.create(SessionId('spreadsheet-skill-loop'), { provider: 'fixture', model: 'fixture' })
  const idle = new Promise(resolve => {
    const off = ctx.on('agent/status', ({ agent: candidate, status }) => {
      if (candidate === subject && status === 'idle') { off(); resolve() }
    })
  })
  subject.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Inspect the roster spreadsheet.' }] }))
  await idle
  assert.equal(adapter.requests.length, 3)
  assert.deepEqual(backendArguments, [{ preview_start_row: 0 }])
  assert.equal(admissionChecks, 2)
  const results = subject.session.events.filter(event => event.type === 'tool/result')
  assert.equal(results.length, 2)
  assert.ok(results.every(event => !event.data.message.content[0].isError))
  assert.equal(JSON.parse(results[0].data.message.content[0].content[0].text).operation_executed, false)
  assert.equal(JSON.parse(results[1].data.message.content[0].content[0].text).row_count, 16)
  assert.equal(subject.session.events.filter(event => event.type === 'user/message' && event.data.source?.plugin === 'soc-spreadsheet-skills').length, 1)
  await autoload.dispose()
  assert.equal((await ctx.tools.execute({ name: EXCEL + 'inspect', arguments: { preview_start_row: 0 }, callId: 'after-dispose', agent: subject, signal: SIGNAL })).isError, false)
})

function textOfRequest(message) {
  return message.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
}
