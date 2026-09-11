import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('does not expose scheduled-task management in settings', () => {
  const clientSource = readFileSync(new URL('../src/client/index.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(clientSource, /ScheduledTasksForm|settings\.section|soc-agent-schedules/)
})





test('admin console uses provider selection and write-only credentials', () => {
  const source = readFileSync(new URL('../src/client/AdminConsole.tsx', import.meta.url), 'utf8')
  assert.match(source, /role="listbox"/)
  assert.match(source, /Custom provider/)
  assert.match(source, /credentials\.set/)
  assert.match(source, /credentials\.unset/)
  assert.match(source, /connection\.api\.settings\.describe/)
  assert.match(source, /connection\.api\.credentials\.describe/)
  assert.match(source, /Manage the credential for this provider/)
  assert.match(source, /isCustomProvider \? \(/)
  assert.doesNotMatch(source, /rpc\(connection,\s*['"]settings\.describe/)
  assert.doesNotMatch(source, /SplunkSettings|SubscriptionServerSettings/)
  assert.doesNotMatch(source, /update-settings|delete-setting/)
})



test('admin console exposes the deployment access and approval controls', () => {
  const source = readFileSync(new URL('../src/client/AdminConsole.tsx', import.meta.url), 'utf8')
  assert.match(source, /ACTION_APPROVAL_SETTINGS_NAMESPACE/)
  assert.match(source, /get-admin-action-catalog/)
  assert.match(source, /Access &amp; approvals/)
  assert.match(source, /actionStates/)
  assert.match(source, /Full access/)
  assert.match(source, /SOC mode/)
  assert.doesNotMatch(source, /autoApproveActions/)
  assert.match(source, /actionApproval\.revision/)
  assert.match(source, /Email delivery still requires the explicit Send confirmation/)
  assert.match(source, /Explicit confirmation/)
  assert.match(source, /type="button" onClick=\{\(\) => void load\(\)\}/)
})



test('configuration controls are mounted only by the standalone admin console', () => {
  const source = readFileSync(new URL('../src/client/index.ts', import.meta.url), 'utf8')
  assert.match(source, /window\.location\.pathname/)
  assert.match(source, /AdminConsole/)
  assert.match(source, /return$/m)
  assert.doesNotMatch(source, /soc-agent-connections/)
})
