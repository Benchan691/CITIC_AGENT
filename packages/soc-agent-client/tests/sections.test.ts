import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { SETTINGS_SECTIONS } from '../src/client/sections.ts'

test('registers focused connection and scheduled-task settings sections', () => {
  assert.deepEqual(SETTINGS_SECTIONS, [
    { id: 'soc-agent-connections', order: 30, label: 'Connections' },
    { id: 'soc-agent-schedules', order: 40, label: 'Scheduled Tasks' },
  ])
})

test('exports independent SOC settings components', () => {
  for (const [file, symbol] of [
    ['SplunkSettings.ts', 'SplunkSettings'],
    ['SubscriptionServerSettings.ts', 'SubscriptionServerSettings'],
    ['ZimbraSettings.ts', 'ZimbraSettings'],
    ['ScheduledTasksForm.ts', 'SchedulerSettings'],
  ]) {
    const source = readFileSync(new URL(`../src/client/${file}`, import.meta.url), 'utf8')
    assert.match(source, new RegExp(`export function ${symbol}`))
  }
})

test('subscription server connection test stays environment-configured and read-only', () => {
  const source = readFileSync(new URL('../src/client/SubscriptionServerSettings.ts', import.meta.url), 'utf8')
  assert.match(source, /test-subscription-server/)
  assert.match(source, /Test subscription server/)
  assert.match(source, /server \.env file/)
  assert.doesNotMatch(source, /SUBSCRIPTION_SERVER_PASSWORD/)
})

test('does not expose stored Zimbra-account controls in settings', () => {
  const source = readFileSync(new URL('../src/client/ZimbraSettings.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /list-accounts/)
  assert.match(source, /signed-in user/)
  assert.doesNotMatch(source, /password/i)
  assert.doesNotMatch(source, /Save settings/)
})
