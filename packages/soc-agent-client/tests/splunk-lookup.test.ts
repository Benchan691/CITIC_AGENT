import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formFromLookupDraft,
  lookupFromForm,
  lookupErrorMessage,
  parseLookupEnvelope,
  SPLUNK_DELETE_LOOKUP_TOOL_NAME,
  SPLUNK_GET_LOOKUP_TOOL_NAME,
  SPLUNK_UPDATE_LOOKUP_TOOL_NAME,
  SPLUNK_WRITE_LOOKUP_TOOL_NAME,
} from '../src/client/splunkLookup.ts'

test('uses host-qualified Splunk lookup tool names', () => {
  assert.equal(SPLUNK_GET_LOOKUP_TOOL_NAME, 'mcp__soc_agent__splunk_get_lookup')
  assert.equal(SPLUNK_WRITE_LOOKUP_TOOL_NAME, 'mcp__soc_agent__splunk_write_lookup')
  assert.equal(SPLUNK_UPDATE_LOOKUP_TOOL_NAME, 'mcp__soc_agent__splunk_update_lookup')
  assert.equal(SPLUNK_DELETE_LOOKUP_TOOL_NAME, 'mcp__soc_agent__splunk_delete_lookup')
})

test('normalizes editable lookup draft fields without losing CSV text', () => {
  const fields = formFromLookupDraft({
    name: 'rules.csv',
    content: 'id,name\n1,alice\n',
    app: 'search',
    owner: 'nobody',
  })
  assert.deepEqual(fields, { name: 'rules.csv', content: 'id,name\n1,alice\n' })
  assert.deepEqual(lookupFromForm({ name: '  new.csv ', content: 'id\n2\n' }), {
    name: 'new.csv',
    content: 'id\n2\n',
  })
})

test('parses lookup draft envelopes and surfaces failures', () => {
  const parsed = parseLookupEnvelope({
    kind: 'tool-result',
    content: [{ type: 'text', text: JSON.stringify({ ok: true, data: {
      status: 'draft',
      operation: 'update',
      expected_fingerprint: 'abc',
      draft: { name: 'rules.csv', content: 'id\n1\n' },
    } }) }],
    isError: false,
  } as never)
  assert.equal(parsed?.operation, 'update')
  assert.equal(parsed?.expected_fingerprint, 'abc')
  assert.equal(parsed?.draft.content, 'id\n1\n')

  const error = parseLookupEnvelope({
    kind: 'tool-result',
    content: [{ type: 'text', text: JSON.stringify({ ok: false, error: { message: 'lookup changed' } }) }],
    isError: true,
  } as never)
  assert.equal(lookupErrorMessage(error), 'lookup changed')
})

test('surfaces lookup failures carried through the MCP error channel', () => {
  const envelope = parseLookupEnvelope({
    kind: 'tool-result',
    content: [{
      type: 'text',
      text: 'Error executing tool splunk_update_lookup: ' + JSON.stringify({
        ok: false,
        error: { code: 'lookup_changed', message: 'Refresh the changed lookup before saving.' },
      }),
    }],
    isError: true,
  } as never)
  assert.equal(lookupErrorMessage(envelope), 'Refresh the changed lookup before saving.')
})
