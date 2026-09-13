import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/client/AdminConsole.tsx', import.meta.url), 'utf8')
const entrySource = readFileSync(new URL('../src/client/index.ts', import.meta.url), 'utf8')

test('admin console uses provider selection and write-only credentials', () => {
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
})

test('administration content is mounted only through the core-owned child slot', () => {
  assert.match(entrySource, /ctx\.slots\.inject\('soc\.admin\.content'/)
  assert.match(entrySource, /AdminConsole/)
  assert.match(entrySource, /surface !== 'admin'/)
  assert.doesNotMatch(entrySource, /window\.location\.pathname/)
  assert.doesNotMatch(entrySource, /soc-agent-connections/)
})
