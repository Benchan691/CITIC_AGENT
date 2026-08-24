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

test('keeps Zimbra server configuration in .env and exposes accounts only', () => {
  const source = readFileSync(new URL('../src/client/ZimbraSettings.ts', import.meta.url), 'utf8')
  assert.match(source, /list-accounts/)
  assert.match(source, /server \.env file/)
  assert.doesNotMatch(source, /label: 'Host'/)
  assert.doesNotMatch(source, /label: 'Allow send'/)
  assert.doesNotMatch(source, /Save settings/)
})
