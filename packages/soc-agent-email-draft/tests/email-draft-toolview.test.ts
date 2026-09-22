import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'
import test from 'node:test'
import { act, createElement } from 'react'
import {
  EMAIL_ATTACHMENT_LIMITS,
  draftFromForm,
  fileToEmailAttachment,
  parseRecipientText,
  validateEmailAttachmentSelection,
  type EmailDraftFormFields,
} from '../src/client/emailDraft.ts'
import { renderEmailPreviewDocument, sanitizeEmailHtml } from '../src/client/htmlEmail.ts'

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
  assert.equal(draftFromForm(form, { action: 'send', body_format: 'html' }).body_format, 'html')
})

test('sanitizes live HTML preview content while retaining safe layout', async () => {
  const require = createRequire(import.meta.url)
  const { JSDOM } = require('../../../vendor/deepseek-harness/node_modules/jsdom')
  const dom = new JSDOM('', { url: 'https://soc.example/' })
  Object.assign(globalThis, { DOMParser: dom.window.DOMParser })
  try {
    const unsafe = '<div style="color: red; position: fixed; background: url(https://evil.test/x)"><script>alert(1)</script><img src="https://evil.test/x" onerror="alert(2)"><iframe src="https://evil.test/frame"></iframe><a href="javascript:alert(3)" onclick="alert(4)">Safe link</a></div>'
    const sanitized = sanitizeEmailHtml(unsafe)
    assert.match(sanitized, /Safe link/)
    assert.match(sanitized, /color: red/)
    assert.doesNotMatch(sanitized, /script|iframe|img|onerror|onclick|javascript:|position: fixed|url\(/iu)
    assert.doesNotMatch(renderEmailPreviewDocument(unsafe), /<script|<iframe|<img|javascript:/iu)
  } finally {
    Reflect.deleteProperty(globalThis, 'DOMParser')
    dom.window.close()
  }
})

test('validates selected email files and creates standard base64 payloads', async () => {
  const file = (name: string, size: number, type = 'application/octet-stream'): File => ({
    name, size, type, arrayBuffer: async () => new ArrayBuffer(size),
  }) as File
  assert.equal(validateEmailAttachmentSelection([file('one.txt', 3, 'text/plain')]), null)
  assert.match(validateEmailAttachmentSelection(
    Array.from({ length: EMAIL_ATTACHMENT_LIMITS.maxFiles + 1 }, (_, index) => file(`${index}.txt`, 1)),
  )!, /no more than 5/i)
  assert.match(validateEmailAttachmentSelection([file('large.bin', EMAIL_ATTACHMENT_LIMITS.maxBytesPerFile + 1)])!, /10 MB/i)
  const fiveFiles = Array.from({ length: 5 }, (_, index) => file(`${index}.bin`, 10_000_000))
  assert.equal(validateEmailAttachmentSelection(fiveFiles), null)
  assert.match(validateEmailAttachmentSelection([file('extra.bin', 1)], fiveFiles)!, /no more than 5/i)

  const payload = await fileToEmailAttachment({
    name: 'note.txt', type: 'text/plain', size: 5,
    arrayBuffer: async () => new TextEncoder().encode('hello').buffer,
  } as File)
  assert.deepEqual(payload, { filename: 'note.txt', content_type: 'text/plain', data: 'aGVsbG8=' })
})

test('preserves action metadata when editing a forward without copying its preview into the body', () => {
  assert.deepEqual(draftFromForm({ ...form, subject: 'Fwd: update', body: 'Please review.' }, {
    action: 'forward', source_message_id: '42',
  }), {
    ...draftFromForm(form),
    subject: 'Fwd: update',
    body: 'Please review.',
    action: 'forward',
    source_message_id: '42',
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
  const connection = { rpc: { call: async () => {
    return { ok: true, value: { sent } }
  } } }
  const socClient = {
    surface: 'workspace' as const,
    rpc: async (name: string, payload?: Record<string, unknown>) => {
      calls.push([name, payload ?? {}])
      const result = await connection.rpc.call('/soc-agent-config', name, payload ?? {})
      return result.value
    },
  }
  const block = { kind: 'tool-result', content: [{ type: 'text', text: JSON.stringify({ data: { draft: {
    ...draftFromForm(form, { action: 'forward', source_message_id: '42' }),
    source_message: {
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
      { block, socClient } as unknown as Parameters<typeof EmailDraftToolview>[0])))
    assert.match(document.body.textContent!, /report\.pdf/)
    assert.match(document.body.textContent!, /full original message will be included/)
    assert.equal(document.querySelector('img'), null, 'Original HTML is shown as text')
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    assert.deepEqual(tabs.map(tab => tab.textContent), ['Preview', 'HTML source'])
    const previewTab = tabs[0]!
    const sourceTab = tabs[1]!
    assert.equal(previewTab.getAttribute('aria-selected'), 'true')
    assert.equal(sourceTab.getAttribute('aria-selected'), 'false')
    assert.equal(previewTab.tabIndex, 0)
    assert.equal(sourceTab.tabIndex, -1)
    const previewPanel = document.getElementById(previewTab.getAttribute('aria-controls')!)
    const sourcePanel = document.getElementById(sourceTab.getAttribute('aria-controls')!)
    assert.ok(previewPanel)
    assert.ok(sourcePanel)
    assert.equal(previewPanel!.getAttribute('role'), 'tabpanel')
    assert.equal(sourcePanel!.getAttribute('role'), 'tabpanel')
    assert.equal(previewPanel!.getAttribute('aria-labelledby'), previewTab.id)
    assert.equal(sourcePanel!.getAttribute('aria-labelledby'), sourceTab.id)
    assert.equal(previewPanel!.hasAttribute('hidden'), false)
    assert.equal(sourcePanel!.hasAttribute('hidden'), true)
    assert.equal(previewPanel!.querySelector('iframe')!.hasAttribute('sandbox'), true)

    await click('HTML source')
    const body = document.querySelector('textarea[aria-label="HTML body source"]') as HTMLTextAreaElement
    assert.equal(sourceTab.getAttribute('aria-selected'), 'true')
    assert.equal(previewPanel!.hasAttribute('hidden'), true)
    assert.equal(sourcePanel!.hasAttribute('hidden'), false)
    assert.equal(body.value, form.body)
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!.call(body, 'Edited note')
      body.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
    await click('Preview')
    assert.equal(previewTab.getAttribute('aria-selected'), 'true')
    assert.equal(previewPanel!.hasAttribute('hidden'), false)
    assert.equal(sourcePanel!.hasAttribute('hidden'), true)
    await click('HTML source')
    assert.equal(body.value, 'Edited note')

    await act(async () => {
      sourceTab.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    })
    assert.equal(previewTab.getAttribute('aria-selected'), 'true')
    await act(async () => {
      previewTab.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    assert.equal(sourceTab.getAttribute('aria-selected'), 'true')
    await act(async () => {
      sourceTab.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    })
    assert.equal(previewTab.getAttribute('aria-selected'), 'true')
    await act(async () => {
      previewTab.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    })
    assert.equal(sourceTab.getAttribute('aria-selected'), 'true')

    const selectedFile = new dom.window.File(['selected'], 'selected.txt', { type: 'text/plain' })
    const attachmentInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(attachmentInput, 'files', { configurable: true, value: [selectedFile] })
    await act(async () => attachmentInput.dispatchEvent(new dom.window.Event('change', { bubbles: true })))
    assert.match(document.body.textContent!, /selected\.txt/)
    const removeAttachment = document.querySelector('button[aria-label="Remove selected.txt"]') as HTMLButtonElement
    await act(async () => removeAttachment.click())
    assert.doesNotMatch(document.body.textContent!, /selected\.txt/)
    Object.defineProperty(attachmentInput, 'files', { configurable: true, value: [selectedFile] })
    await act(async () => attachmentInput.dispatchEvent(new dom.window.Event('change', { bubbles: true })))
    await click('Send')
    assert.equal(calls.length, 0, 'Canceling confirmation never calls the send endpoint')
    confirmed = true
    await click('Send')
    assert.deepEqual(calls[0], ['send-email', {
      ...draftFromForm({ ...form, body: 'Edited note' }, { action: 'forward', source_message_id: '42' }),
      body_format: 'html',
      attachments: [{ filename: 'selected.txt', content_type: 'text/plain', data: 'c2VsZWN0ZWQ=' }],
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

test('reply editor permits derived recipients and preserves reply metadata', async () => {
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
  dom.window.confirm = (message: string) => {
    assert.equal(message, 'Reply to this email now?')
    return true
  }
  const socClient = {
    surface: 'workspace' as const,
    rpc: async (name: string, payload?: Record<string, unknown>) => {
      calls.push([name, payload ?? {}])
      return { sent: true }
    },
  }
  const block = { kind: 'tool-result', content: [{ type: 'text', text: JSON.stringify({ data: { draft: {
    ...draftFromForm({ ...form, to: '' }, {
      action: 'reply', source_message_id: '42', reply_all: true,
    }),
    source_message: {
      subject: 'Original subject', from: 'sender@example.com', body: 'Original body',
      body_truncated: false, attachments: [{ filename: 'report.pdf', part: '2' }],
    },
  } } }) }] }
  const click = (label: string) => act(async () => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent === label)
    assert.ok(button, `Button is rendered: ${label}`)
    button.click()
  })
  try {
    await act(async () => root.render(createElement(EmailDraftToolview,
      { block, socClient } as unknown as Parameters<typeof EmailDraftToolview>[0])))
    assert.match(document.body.textContent!, /Reply to email/)
    assert.match(document.body.textContent!, /attachments will not be reattached/)
    const selectedFile = new dom.window.File(['reply'], 'reply.txt', { type: 'text/plain' })
    const attachmentInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(attachmentInput, 'files', { configurable: true, value: [selectedFile] })
    await act(async () => attachmentInput.dispatchEvent(new dom.window.Event('change', { bubbles: true })))
    await click('Send')
    assert.deepEqual(calls[0], ['send-email', {
      ...draftFromForm({ ...form, to: '' }, {
        action: 'reply', source_message_id: '42', reply_all: true,
      }),
      body_format: 'html',
      attachments: [{ filename: 'reply.txt', content_type: 'text/plain', data: 'cmVwbHk=' }],
    }])
  } finally {
    await act(async () => root.unmount())
    cssHook.deregister()
    dom.window.close()
    for (const key of ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT']) Reflect.deleteProperty(globalThis, key)
  }
})
