import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('does not expose scheduled-task management in settings', () => {
  const clientSource = readFileSync(new URL('../src/client/index.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(clientSource, /ScheduledTasksForm|settings\.section|soc-agent-schedules/)
})

test('exports independent SOC settings components', () => {
  for (const [file, symbol] of [
    ['SplunkSettings.ts', 'SplunkSettings'],
    ['SubscriptionServerSettings.ts', 'SubscriptionServerSettings'],
    ['ZimbraSettings.ts', 'ZimbraSettings'],
  ]) {
    const source = readFileSync(new URL(`../src/client/${file}`, import.meta.url), 'utf8')
    assert.match(source, new RegExp(`export function ${symbol}`))
  }
})

test('subscription server connection test stays environment-configured and read-only', () => {
  const source = readFileSync(new URL('../src/client/SubscriptionServerSettings.ts', import.meta.url), 'utf8')
  assert.match(source, /test-subscription-server/)
  assert.match(source, /Check connection/)
  assert.match(source, /Unavailable/)
  assert.match(source, /Configuration is managed by the server environment/)
  assert.doesNotMatch(source, /update-settings|delete-setting|allow_insecure_http/)
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

test('admin console exposes revision-safe BACKGROUND and time context controls', () => {
  const source = readFileSync(new URL('../src/client/AdminConsole.tsx', import.meta.url), 'utf8')
  assert.match(source, /Agent context/)
  assert.match(source, /soc-background/)
  assert.match(source, /time-context/)
  assert.match(source, /repeatEveryUserPrompts/)
  assert.match(source, /backgroundEnabled/)
  assert.match(source, /Inject BACKGROUND\.md/)
  assert.match(source, /path: \['enabled'\]/)
  assert.match(source, /refreshIntervalMs/)
  assert.match(source, /seconds \* 1000/)
  assert.match(source, /expectedRevision: data\.background\.revision/)
  assert.match(source, /expectedRevision: data\.time\.revision/)
  assert.match(source, /aria-invalid=\{validation\.background \? 'true'/)
  assert.match(source, /aria-invalid=\{validation\.time \? 'true'/)
  assert.match(source, /fieldError/)
  assert.match(source, /Use 0 for startup only/)
  assert.match(source, /Use 0 to inject on every eligible model step/)
})

test('admin console exposes the deployment access and approval controls', () => {
  const source = readFileSync(new URL('../src/client/AdminConsole.tsx', import.meta.url), 'utf8')
  assert.match(source, /ACTION_APPROVAL_SETTINGS_NAMESPACE/)
  assert.match(source, /get-admin-action-catalog/)
  assert.match(source, /Access &amp; approvals/)
  assert.match(source, /actionStates/)
  assert.match(source, /Full access/)
  assert.match(source, /SOC mode/)
  assert.match(source, /autoApproveActions/)
  assert.match(source, /actionApproval\.revision/)
  assert.match(source, /Catalog and detection changes retain their approval/)
  assert.match(source, /Explicit confirmation/)
  assert.match(source, /type="button" onClick=\{\(\) => void load\(\)\}/)
})

test('failed service checks replace configured status with an unavailable state', () => {
  const source = readFileSync(new URL('../src/client/AdminConsole.tsx', import.meta.url), 'utf8')
  assert.match(source, /state\?\.kind === 'error'/)
  assert.match(source, /Unavailable/)
  assert.match(source, /state\.text/)
})

test('configuration controls are mounted only by the standalone admin console', () => {
  const source = readFileSync(new URL('../src/client/index.ts', import.meta.url), 'utf8')
  assert.match(source, /window\.location\.pathname/)
  assert.match(source, /AdminConsole/)
  assert.match(source, /return$/m)
  assert.doesNotMatch(source, /soc-agent-connections/)
})

test('does not expose stored Zimbra-account controls in settings', () => {
  const source = readFileSync(new URL('../src/client/ZimbraSettings.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /list-accounts/)
  assert.match(source, /signed-in user/)
  assert.doesNotMatch(source, /password/i)
  assert.doesNotMatch(source, /Save settings/)
})
