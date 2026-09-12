import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'
import test from 'node:test'
import { act, createElement } from 'react'
import {
  draftFromForm,
  parseRecipientText,
  type EmailDraftFormFields,
} from '../src/client/emailDraft.ts'

const form: EmailDraftFormFields = {
  to: 'to@example.com, second@example.com\nto@example.com',
  cc: 'cc@example.com; ',
  bcc: '',
  subject: '  An exact subject  ',
  body: 'The exact body.',
}

test('normalizes editable recipient fields without duplicating addresses', () => {
  assert.deepEqual(parseRecipientText(' a@example.com, b@example.com\na@example.com; '), [
    'a@example.com',
    'b@example.com',
  ])
  assert.deepEqual(draftFromForm(form), {
    to: ['to@example.com', 'second@example.com'],
    cc: ['cc@example.com'],
    bcc: [],
    subject: 'An exact subject',
    body: 'The exact body.',
  })
})

test('preserves the original message ID when editing a forward without copying its preview into the body', () => {
  assert.deepEqual(draftFromForm({ ...form, subject: 'Fwd: update', body: 'Please review.' }, '42'), {
    ...draftFromForm(form),
    subject: 'Fwd: update',
    body: 'Please review.',
    forward_message_id: '42',
  })
})

test('forward editor requires confirmation, retains its source after edits, and requires Zimbra success', async () => {
  const require = createRequire(import.meta.url)
  const { JSDOM } = require('../../../vendor/deepseek-harness/node_modules/jsdom')
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://soc.example/' })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const cssHook = registerHooks({
    load(url, context, nextLoad) {
      return url.endsWith('.css')
        ? { format: 'module', shortCircuit: true, source: 'export default new Proxy({}, {get: (_, name) => name})' }
        : nextLoad(url, context)
    },
  })
  const { createRoot } = require('../../../vendor/deepseek-harness/packages/client/web/node_modules/react-dom/client')
  const { EmailDraftToolview } = await import('../src/client/EmailDraftToolview.tsx')
  const root = createRoot(document.getElementById('root'))
  const calls: unknown[][] = []
  let confirmed = false
  let sent = false
  dom.window.confirm = (message: string) => {
    assert.match(message, /original message and all its attachments/)
    return confirmed
  }
  const connection = { rpc: { call: async (...args: unknown[]) => {
    calls.push(args)
    return { ok: true, value: { sent } }
  } } }
  const block = { kind: 'tool-result', content: [{ type: 'text', text: JSON.stringify({ data: { draft: {
    ...draftFromForm(form, '42'),
    forwarded_message: {
      subject: 'Original subject', from: 'sender@example.com', body: '<img src=x onerror="alert(1)">',
      body_truncated: true, attachments: [{ filename: 'report.pdf', part: '2' }],
    },
  } } }) }] }
  const click = (label: string) => act(async () => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent === label)
    assert.ok(button, `Button is rendered: ${label}`)
    button.click()
  })
  try {
    await act(async () => root.render(createElement(EmailDraftToolview,
      { block, connection } as unknown as Parameters<typeof EmailDraftToolview>[0])))
    assert.match(document.body.textContent!, /report\.pdf/)
    assert.match(document.body.textContent!, /full original message will be forwarded/)
    assert.equal(document.querySelector('img'), null, 'Original HTML is shown as text')
    const body = document.querySelector('textarea[aria-label="Body"]') as HTMLTextAreaElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!.call(body, 'Edited note')
      body.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
    await click('Send')
    assert.equal(calls.length, 0, 'Canceling confirmation never calls the send endpoint')
    confirmed = true
    await click('Send')
    assert.deepEqual(calls[0], ['/soc-agent-config', 'send-email', {
      ...draftFromForm({ ...form, body: 'Edited note' }, '42'), body_format: 'text',
    }])
    assert.match(document.querySelector('[role="alert"]')!.textContent!, /did not confirm/)
    assert.equal(body.value, 'Edited note')
    sent = true
    await click('Retry')
    assert.equal(calls.length, 2)
    assert.match(document.body.textContent!, /Email sent successfully/)
  } finally {
    await act(async () => root.unmount())
    cssHook.deregister()
    dom.window.close()
    for (const key of ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT']) Reflect.deleteProperty(globalThis, key)
  }
})
