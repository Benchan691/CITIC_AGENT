import assert from 'node:assert/strict'
import test from 'node:test'
import { MarkItDownDocumentController } from '../src/client/markitdownAttachments.ts'

test('two attachment workers preserve order and reuse successful conversions after a failure', async () => {
  const calls: string[] = []
  let active = 0, peak = 0, fail = true
  const connection = { rpc: { async call(_channel: string, _method: string, payload: { filename: string }) {
    calls.push(payload.filename)
    peak = Math.max(peak, ++active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active--
    if (payload.filename === 'b.txt' && fail) {
      fail = false
      return { ok: false, error: { message: 'fixture failure' } }
    }
    return { ok: true, value: { filename: payload.filename, text: payload.filename, text_truncated: payload.filename === 'a.txt' } }
  } } }
  const settings = { getSnapshot: () => ({ value: {} }) }
  const controller = new MarkItDownDocumentController(connection as never, settings as never)
  const session = 'session-1' as never
  const drafts = controller.create(session, ['a.txt', 'b.txt', 'c.txt'].map(name => new File(['content'], name)))
  const ids = drafts.map(draft => draft.id)
  await assert.rejects(controller.convert(session, ids, new AbortController().signal), /fixture failure/)
  const result = await controller.convert(session, ids, new AbortController().signal)
  assert.equal(peak, 2)
  assert.equal(calls.filter(name => name === 'a.txt').length, 1)
  assert.equal(calls.filter(name => name === 'b.txt').length, 2)
  assert.deepEqual(result.map(item => item.filename), ['a.txt', 'b.txt', 'c.txt'])
  assert.match(result[0]!.markdown, /text was truncated/)
  for (const id of ids) controller.release(session, id)
  assert.equal(controller.list(session, ids).length, 0)
})
