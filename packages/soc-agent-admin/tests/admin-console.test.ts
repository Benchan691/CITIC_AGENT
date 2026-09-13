import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'
import test from 'node:test'
import { act, createElement } from 'react'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')

test('admin forms retain drafts, show request failures, retry loading, and submit their settings revision', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://soc.example/admin#agent-context' })
  const originalFetch = globalThis.fetch
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  globalThis.fetch = async () => new Response(JSON.stringify({ authenticated: true, email: 'admin@example.com' }))
  const cssHook = registerHooks({
    load(url, context, nextLoad) {
      return url.endsWith('.css')
        ? { format: 'module', shortCircuit: true, source: 'export default new Proxy({}, {get: (_, name) => name})' }
        : nextLoad(url, context)
    },
  })
  const { createRoot } = require('react-dom/client')
  const { AdminConsole } = await import('../src/client/AdminConsole.tsx')
  const root = createRoot(document.getElementById('root'))
  const namespace = (ns: string, value: unknown) => ({ ns, revision: 7, value })
  const namespaces = [
    namespace('soc-background', { enabled: true, repeatEveryUserPrompts: 5 }),
    namespace('time-context', { enabled: true, refreshIntervalMs: 0 }),
    namespace('soc-action-approval', { mode: 'soc', actionStates: {} }),
    namespace('llm-pi-ai', { providers: {} }),
  ]
  const success = (value: unknown) => ({ result: { ok: true, value } })
  const mutations: Array<{ ns: string; expectedRevision: number; ops: any[] }> = []
  let failDescribe = false
  let mutationResult = (request: typeof mutations[number]): Promise<unknown> => Promise.resolve(success(namespace(request.ns, {})))
  const connection = {
    api: {
      settings: {
        describe: async () => failDescribe
          ? { result: { ok: false, error: { message: 'Settings temporarily unavailable' } } }
          : success({ namespaces, writable: true }),
        mutate: async (request: typeof mutations[number]) => { mutations.push(request); return mutationResult(request) },
      },
      llm: { providers: async () => success({ providers: [] }) },
      credentials: { describe: async () => success({ credentials: {} }) },
    },
    rpc: { call: async () => ({ ok: true, value: { tools: [
      { name: 'read', label: 'Read events', group: 'Splunk', kind: 'read' },
      { name: 'send', label: 'Deliver email', group: 'Mail', kind: 'ui-confirmed' },
    ] } }) },
  }
  const socClient = {
    surface: 'admin' as const,
    rpc: async (name: string, payload?: Record<string, unknown>) => {
      const result = await connection.rpc.call('/soc-agent-config', name, payload ?? {})
      return result.value
    },
  }
  const section = (id: string) => document.querySelector(`[aria-labelledby="${id}-title"]`) as HTMLElement
  const button = (container: HTMLElement, label: string) => {
    const found = [...container.querySelectorAll('button')].find((item) => item.textContent === label)
    assert.ok(found, `Button is rendered: ${label}`)
    return found
  }
  const navigate = async (page: string) => act(async () => {
    dom.window.history.replaceState(null, '', `#${page}`)
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'))
  })
  const input = async (field: HTMLInputElement, value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
  try {
    await act(async () => root.render(createElement(AdminConsole, { connection, socClient })))
    const context = section('agent-context')
    const frequency = context.querySelector('input[type="number"]') as HTMLInputElement
    await input(frequency, '12')
    failDescribe = true
    await navigate('access-approvals')
    const access = section('access-approvals')
    assert.match(access.querySelector('[role="alert"]')!.textContent!, /Settings temporarily unavailable/)
    failDescribe = false
    await act(async () => button(access, 'Retry').click())
    assert.ok(access.querySelector('form'))
    assert.equal(access.querySelector('[role="alert"]'), null)
    assert.match(access.textContent!, /Explicit confirmation/)
    assert.equal(access.querySelector('input[name="action-state-send"]'), null)
    await navigate('agent-context')
    assert.equal(section('agent-context'), context, 'Visited forms stay mounted')
    assert.equal(frequency.value, '12', 'Unfinished fields survive page changes')
    await act(async () => button(context, 'Save agent context').click())
    assert.deepEqual(mutations.map(({ ns, expectedRevision }) => ({ ns, expectedRevision })), [
      { ns: 'soc-background', expectedRevision: 7 },
      { ns: 'time-context', expectedRevision: 7 },
    ])
    assert.equal(mutations[0]!.ops[1].value, 12)
    assert.match(context.querySelector('[role="status"]')!.textContent!, /settings saved/)

    await navigate('access-approvals')
    let finishMutation!: (response: unknown) => void
    mutationResult = () => new Promise((resolve) => { finishMutation = resolve })
    await act(async () => button(access, 'Save access settings').click())
    assert.equal(button(access, 'Saving…').disabled, true)
    assert.equal(mutations.at(-1)!.expectedRevision, 7)
    await act(async () => finishMutation({ result: { ok: false, error: { message: 'Settings revision conflict' } } }))
    assert.match(access.querySelector('[role="alert"]')!.textContent!, /Settings revision conflict/)
    assert.equal(button(access, 'Save access settings').disabled, false)
    assert.equal(access.querySelector('[role="status"]'), null)

    await navigate('providers')
    const providers = section('provider-settings')
    const route = providers.querySelector('input[placeholder="my-provider"]') as HTMLInputElement
    await input(route, 'bad route')
    assert.match(providers.textContent!, /Use lowercase letters, numbers, and hyphens/)
    assert.equal(button(providers, 'Add provider').disabled, true)
    await input(route, 'my-provider')
    await input(providers.querySelector('input[type="url"]')!, 'https://models.example/v1')
    await input(providers.querySelector('input[placeholder="model-name"]')!, 'model-a')
    assert.equal(button(providers, 'Add provider').disabled, false)
    await navigate('agent-context')
    await navigate('providers')
    assert.equal(route.value, 'my-provider')
    assert.equal(button(providers, 'Add provider').disabled, false)
  } finally {
    await act(async () => root.unmount())
    cssHook.deregister()
    globalThis.fetch = originalFetch
    dom.window.close()
    Reflect.deleteProperty(globalThis, 'window')
    Reflect.deleteProperty(globalThis, 'document')
    Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  }
})
