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
  let repeatEveryUserPrompts = initialFrequency
  let namespace
  apply({
    settings: {
      register(ns) {
        namespace = ns
        return { get: () => ({ repeatEveryUserPrompts }) }
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
