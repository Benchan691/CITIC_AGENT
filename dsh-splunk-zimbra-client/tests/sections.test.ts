import assert from 'node:assert/strict'
import test from 'node:test'
import { SETTINGS_SECTIONS } from '../src/client/sections.ts'

test('registers focused connection and scheduled-task settings sections', () => {
  assert.deepEqual(SETTINGS_SECTIONS, [
    { id: 'splunk-zimbra-connections', order: 30, label: 'Connections' },
    { id: 'splunk-zimbra-schedules', order: 40, label: 'Scheduled Tasks' },
  ])
})
