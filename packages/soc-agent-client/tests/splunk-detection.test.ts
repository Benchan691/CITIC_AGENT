import assert from 'node:assert/strict'
import test from 'node:test'
import {
  actionFieldsFromDraft,
  detectionFromForm,
  formFromDraft,
  parseDetectionEnvelope,
  SPLUNK_UPDATE_DETECTION_TOOL_NAME,
  SPLUNK_WRITE_DETECTION_TOOL_NAME,
} from '../src/client/splunkDetection.ts'

test('uses host-qualified Splunk detection tool names', () => {
  assert.equal(SPLUNK_WRITE_DETECTION_TOOL_NAME, 'mcp__soc_agent__splunk_write_detection')
  assert.equal(SPLUNK_UPDATE_DETECTION_TOOL_NAME, 'mcp__soc_agent__splunk_update_detection')
})

test('normalizes a complete alert draft for the editor', () => {
  const form = formFromDraft({
    name: 'Rule',
    spl: 'index=main error',
    is_scheduled: true,
    'dispatch.earliest_time': '-15m',
    'dispatch.latest_time': 'now',
    'alert.digest_mode': false,
    'alert.track': '1',
    actions: 'email,logevent',
    'action.email': '1',
    'action.email.to': 'soc@example.invalid',
    'action.logevent': '1',
  })
  assert.equal(form.name, 'Rule')
  assert.equal(form.is_scheduled, '1')
  assert.equal(form['dispatch.earliest_time'], '-15m')
  assert.equal(form['alert.digest_mode'], '0')
  assert.deepEqual(actionFieldsFromDraft({
    'action.email': '1',
    'action.email.to': 'soc@example.invalid',
    'action.logevent': '1',
    'action.logevent.param.index': 'ticket_summary',
  }), [
    { key: 'action.email', value: '1' },
    { key: 'action.email.to', value: 'soc@example.invalid' },
  ])
})

test('builds a disabled save payload and retains review metadata', () => {
  const fields = formFromDraft({ name: 'Rule', spl: 'index=main error' })
  const payload = detectionFromForm(fields, [{ key: 'action.email', value: '1' }], {
    severity: 'high',
    mitre_attack: ['T1059.001'],
    risk_score: 80,
  })
  assert.equal(payload.enabled, false)
  assert.equal(payload['action.email'], '1')
  assert.equal(payload.severity, 'high')
  assert.deepEqual(payload.mitre_attack, ['T1059.001'])
})

test('parses the MCP success envelope and surfaces errors', () => {
  const resultBlock = {
    kind: 'tool-result',
    content: [{ type: 'text', text: JSON.stringify({ ok: true, data: {
      status: 'draft',
      operation: 'write',
      draft: { name: 'Rule', spl: 'index=main error' },
    } }) }],
    isError: false,
  }
  const parsed = parseDetectionEnvelope(resultBlock as never)
  assert.equal(parsed?.operation, 'write')
  assert.equal(parsed?.draft.name, 'Rule')

  const error = parseDetectionEnvelope({
    kind: 'tool-result',
    content: [{ type: 'text', text: JSON.stringify({ ok: false, error: { message: 'stale detection' } }) }],
    isError: true,
  } as never)
  assert.equal(error?.error && typeof error.error === 'object' ? (error.error as { message: string }).message : '', 'stale detection')
})
