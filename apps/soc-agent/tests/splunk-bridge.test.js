import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { OFFICIAL_SPLUNK_TOOL_NAMES, resolveOfficialSplunkConfig } from '../splunk-bridge.js'

test('official bridge reads deployment config, forwards bearer auth, and allowlists reads', () => {
  const directory = mkdtempSync(join(tmpdir(), 'soc-splunk-bridge-'))
  try {
    writeFileSync(join(directory, '.env'), [
      'SPLUNK_MCP_ENDPOINT=https://splunk.example.test/services/mcp',
      'SPLUNK_TOKEN=file-token',
      'SPLUNK_VERIFY_SSL=false',
    ].join('\n'))
    const config = resolveOfficialSplunkConfig({}, directory)

    assert.equal(config.url, 'https://splunk.example.test/services/mcp')
    assert.equal(config.headers.Authorization, 'Bearer file-token')
    assert.equal(config.verifyTls, false)
    assert.deepEqual(config.allowedToolNames, [...OFFICIAL_SPLUNK_TOOL_NAMES])
    assert.ok(config.allowedToolNames.every(name => name.startsWith('splunk_')))
    assert.ok(config.allowedToolNames.every(name => !/(create|update|delete|write)/.test(name)))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('official bridge stays disabled unless endpoint and token are both present', () => {
  assert.equal(resolveOfficialSplunkConfig({}, '/path/that/does/not/exist'), undefined)
  assert.equal(resolveOfficialSplunkConfig({ SPLUNK_MCP_ENDPOINT: 'https://splunk.example.test/mcp' }, '/missing'), undefined)
  assert.equal(resolveOfficialSplunkConfig({ SPLUNK_TOKEN: 'token' }, '/missing'), undefined)
})

test('official bridge verifies TLS by default', () => {
  const config = resolveOfficialSplunkConfig({
    SPLUNK_MCP_ENDPOINT: 'https://splunk.example.test/mcp',
    SPLUNK_TOKEN: 'token',
  }, '/missing')
  assert.equal(config.verifyTls, true)
})
