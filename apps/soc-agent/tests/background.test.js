import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { apply } from '../host.js'

const SIGNAL = new AbortController().signal

function user(text) {
  return { content: [{ type: 'text', text }], source: { kind: 'user' } }
}

function backgroundBaseline() {
  return {
    content: [{ type: 'text', text: 'startup context' }],
    source: {
      kind: 'agent-instructions',
      changes: [{ action: 'set', path: 'BACKGROUND.md' }],
    },
  }
}

function fixture(initialFrequency = 5) {
  const handlers = new Map()
  let enabled = true
  let repeatEveryUserPrompts = initialFrequency
  let namespace
  apply({
    settings: {
      register(ns) {
        namespace = ns
        return { get: () => ({ enabled, repeatEveryUserPrompts }) }
      },
    },
    logger: { warn() {} },
    on(event, handler) { handlers.set(event, handler) },
    agents: { roots: () => [] },
    connection: { rpc: { handle() {} } },
  })
  assert.equal(namespace, 'soc-background')
  return {
    preStep: handlers.get('agent/pre-step'),
    setEnabled(value) { enabled = value },
    setFrequency(value) { repeatEveryUserPrompts = value },
  }
}

async function enter(preStep, session, messages) {
  const decision = await preStep(
    { agent: { session }, signal: SIGNAL },
    () => Promise.resolve({ kind: 'enter', messages }),
  )
  for (const message of decision.messages) {
    session.events.push({ type: 'user/message', data: message })
  }
  return decision
}

function refreshes(decision) {
  return decision.messages.filter(message => message.source?.kind === 'plugin' && message.source.plugin === 'soc-background')
}

test('BACKGROUND refresh counts durable user prompts and applies live cadence changes', async () => {
  const bench = fixture()
  const session = { events: [{ type: 'user/message', data: backgroundBaseline() }] }

  for (let prompt = 1; prompt < 5; prompt += 1) {
    assert.equal(refreshes(await enter(bench.preStep, session, [user(`prompt ${prompt}`)])).length, 0)
  }
  assert.equal(refreshes(await enter(bench.preStep, session, [{ source: { kind: 'plugin', plugin: 'scheduler' }, content: [] }])).length, 0)

  const fifth = await enter(bench.preStep, session, [user('prompt 5')])
  const [refresh] = refreshes(fifth)
  assert.ok(refresh)
  assert.equal(fifth.messages.indexOf(refresh), fifth.messages.findIndex(message => message.source?.kind === 'user') + 1)
  assert.match(refresh.content[0].text, /Instructions from: BACKGROUND\.md/)

  await enter(bench.preStep, session, [user('after refresh')])
  bench.setFrequency(2)
  assert.equal(refreshes(await enter(bench.preStep, session, [user('live threshold')])).length, 1)

  bench.setFrequency(0)
  assert.equal(refreshes(await enter(bench.preStep, session, [user('startup only')])).length, 0)
})

test('a same-step instruction refresh prevents duplicate BACKGROUND injection', async () => {
  const bench = fixture(1)
  const session = { events: [{ type: 'user/message', data: backgroundBaseline() }] }
  const refreshedBaseline = backgroundBaseline()
  refreshedBaseline.source.changes[0].action = 'replace'

  const decision = await enter(bench.preStep, session, [user('edit landed'), refreshedBaseline])

  assert.equal(refreshes(decision).length, 0)
})

test('a failed BACKGROUND read does not reset the durable prompt cadence', async () => {
  const root = mkdtempSync(join(tmpdir(), 'soc-background-'))
  const previousRoot = process.env.MCP_SERVER_ROOT
  process.env.MCP_SERVER_ROOT = root
  try {
    const bench = fixture(1)
    const session = { events: [{ type: 'user/message', data: backgroundBaseline() }] }
    assert.equal(refreshes(await enter(bench.preStep, session, [user('missing file')])).length, 0)

    writeFileSync(join(root, 'BACKGROUND.md'), 'restored background')
    assert.equal(refreshes(await enter(bench.preStep, session, [user('retry')])).length, 1)
  } finally {
    if (previousRoot === undefined) delete process.env.MCP_SERVER_ROOT
    else process.env.MCP_SERVER_ROOT = previousRoot
    rmSync(root, { recursive: true, force: true })
  }
})

test('BACKGROUND can be disabled for startup and re-enabled without losing the next injection', async () => {
  const root = mkdtempSync(join(tmpdir(), 'soc-background-toggle-'))
  const previousRoot = process.env.MCP_SERVER_ROOT
  process.env.MCP_SERVER_ROOT = root
  try {
    writeFileSync(join(root, 'BACKGROUND.md'), 'toggle background')
    const bench = fixture(5)
    bench.setEnabled(false)
    const session = { events: [] }
    const disabled = await enter(bench.preStep, session, [user('disabled startup'), backgroundBaseline()])
    assert.equal(refreshes(disabled).length, 0)
    assert.equal(disabled.messages.some(message => message.content?.some(block => block.text === 'toggle background')), false)

    bench.setEnabled(true)
    const enabled = await enter(bench.preStep, session, [user('enabled again')])
    assert.equal(refreshes(enabled).length, 1)
    assert.match(enabled.messages.at(-1).content[0].text, /toggle background/)
  } finally {
    if (previousRoot === undefined) delete process.env.MCP_SERVER_ROOT
    else process.env.MCP_SERVER_ROOT = previousRoot
    rmSync(root, { recursive: true, force: true })
  }
})

test('disabling BACKGROUND preserves other startup instructions in a combined baseline', async () => {
  const bench = fixture()
  bench.setEnabled(false)
  const baseline = backgroundBaseline()
  baseline.content[0].text = '<system-reminder>\nThe following workspace instructions may be relevant.\n\nInstructions from: AGENTS.md\n\nagent policy\n\nInstructions from: BACKGROUND.md\n\nbackground policy\n</system-reminder>'
  baseline.source.changes.unshift({ action: 'set', path: 'AGENTS.md' })
  const session = { events: [] }
  const decision = await enter(bench.preStep, session, [user('combined baseline'), baseline])
  const text = decision.messages.flatMap(message => message.content ?? []).map(block => block.text ?? '').join('\n')
  assert.match(text, /Instructions from: AGENTS\.md/)
  assert.match(text, /agent policy/)
  assert.doesNotMatch(text, /Instructions from: BACKGROUND\.md/)
  assert.doesNotMatch(text, /background policy/)
})
