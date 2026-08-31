import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('removes scheduled-task management from settings while keeping prompt-driven creation', () => {
  const clientSource = readFileSync(new URL('../src/client/index.ts', import.meta.url), 'utf8')
  const schedulerSource = readFileSync(new URL('../../soc-agent-scheduler/index.js', import.meta.url), 'utf8')
  assert.doesNotMatch(clientSource, /ScheduledTasksForm|settings\.section|soc-agent-schedules/)
  assert.match(schedulerSource, /tool\('scheduled_task_create'/)
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
