import assert from 'node:assert/strict'
import test from 'node:test'
import { MarkItDownDocumentController } from '../src/client/markitdownAttachments.ts'

test('two attachment workers preserve order and reuse successful conversions after a failure', async () => {
  const calls: string[] = []
  let active = 0, peak = 0, fail = true
  const connection = { rpc: { async call(_channel: string, _method: string, payload: { filename: string; investigation_id: string }) {
    assert.equal(payload.investigation_id, 'session-1')
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

test('spreadsheet references and document excerpts reach the composer without bulk rows', async () => {
  const calls: { filename: string; data: string; investigation_id: string }[] = []
  const fileId = 'a'.repeat(64)
  const connection = { rpc: { async call(_channel: string, _method: string, payload: { filename: string; data: string; investigation_id: string }) {
    calls.push(payload)
    return { ok: true, value: {
      filename: payload.filename,
      text: payload.filename.endsWith('.csv')
        ? JSON.stringify({ file_id: fileId, preferred_tool: 'excel_inspect', guidance: 'Use full-sheet aggregates' })
        : 'Document excerpt',
    } }
  } } }
  const controller = new MarkItDownDocumentController(connection as never, { getSnapshot: () => ({ value: {} }) } as never)
  const session = 'session-2' as never
  const csv = 'ID,Value\n00123,2\n00124,4\n'
  const files = [new File([csv], 'events.csv', { type: 'text/csv' }), new File(['notes'], 'notes.txt')]
  const drafts = controller.create(session, files)
  const result = await controller.convert(session, drafts.map(item => item.id), new AbortController().signal)
  assert.equal(result[0]!.markdown.includes(fileId), true)
  assert.equal(result[0]!.markdown.includes('00123'), false)
  assert.equal(result[1]!.markdown, 'Document excerpt')
  assert.equal(atob(calls.find(item => item.filename === 'events.csv')!.data), csv)
  assert.ok(calls.every(item => item.investigation_id === session))
  controller.dispose()
})
