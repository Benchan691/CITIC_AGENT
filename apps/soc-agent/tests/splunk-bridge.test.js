import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { OFFICIAL_SPLUNK_TOOL_NAMES, resolveOfficialSplunkConfig } from '../splunk-bridge.js'
import { apply } from '../host.js'
import { OFFICIAL_SPLUNK_READ_TOOLS } from '../policy.js'

test('official bridge reads deployment config, forwards bearer auth, and allowlists reads', () => {
  const directory = mkdtempSync(join(tmpdir(), 'soc-splunk-bridge-'))
  try {
    writeFileSync(join(directory, '.env'), [
      'SPLUNK_MCP_ENDPOINT=https://splunk.example.test/services/mcp',
      'SPLUNK_TOKEN=file-token',
      'SPLUNK_VERIFY_SSL=false',
    ].join('\n'))
    const config = resolveOfficialSplunkConfig({}, directory)

    assert.equal(config.serverName, 'splunk_mcp')
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



test('official bridge verifies TLS by default', () => {
  const config = resolveOfficialSplunkConfig({
    SPLUNK_MCP_ENDPOINT: 'https://splunk.example.test/mcp',
    SPLUNK_TOKEN: 'token',
  }, '/missing')
  assert.equal(config.verifyTls, true)
})

test('official configuration requires MCP credentials and explicit plain HTTP opt-in', () => {
  assert.equal(resolveOfficialSplunkConfig({ SPLUNK_URL: 'https://legacy.test', SPLUNK_TOKEN: 'token' }, '/missing'), undefined)
  const env = { SPLUNK_MCP_ENDPOINT: 'http://splunk.example.test/mcp', SPLUNK_TOKEN: 'token' }
  assert.throws(() => resolveOfficialSplunkConfig(env, '/missing'), /SPLUNK_ALLOW_INSECURE_HTTP/)
  assert.equal(resolveOfficialSplunkConfig({ ...env, SPLUNK_ALLOW_INSECURE_HTTP: 'true' }, '/missing').verifyTls, true)
  for (const endpoint of ['bad-url', 'file:///tmp/mcp', 'https://user:password@splunk.test/mcp']) {
    assert.throws(() => resolveOfficialSplunkConfig({ ...env, SPLUNK_MCP_ENDPOINT: endpoint }, '/missing'), /HTTP\(S\) URL/)
  }
  assert.equal(OFFICIAL_SPLUNK_TOOL_NAMES.length, 13)
  assert.deepEqual(OFFICIAL_SPLUNK_READ_TOOLS, OFFICIAL_SPLUNK_TOOL_NAMES.map(name => `mcp__splunk_mcp__${name}`))
})

test('admin connection check uses the live allowed tool and preserves authorization, errors, and cancellation', async () => {
  const previous = process.env
  process.env = { ...previous, DSH_SOC_AGENT_SERVER: '/missing', SPLUNK_MCP_ENDPOINT: 'https://splunk.example.test/mcp', SPLUNK_TOKEN: 'private-token' }
  try {
    let authorized = false
    let handler
    let failure = false
    const calls = []
    apply({
      on() {},
      agents: { roots: () => [] },
      get(name) { if (name === 'socAuth') return { requireAdmin() { if (!authorized) throw new Error('admin authentication required') } } },
      connection: { rpc: { handle(_channel, callback) { handler = callback } } },
      tools: {
        get(name) { assert.equal(name, 'mcp__splunk_mcp__splunk_get_info'); return {} },
        async execute(exec) {
          calls.push(exec)
          if (exec.signal.aborted) throw exec.signal.reason
          return failure ? { isError: true, error: { message: 'HTTP 401 private-token rejected' } } : { isError: false, value: {} }
        },
      },
    })
    assert.equal((await handler('test-splunk', {})).error.code, 'admin-authentication-required')
    assert.equal(calls.length, 0)
    authorized = true
    assert.deepEqual(await handler('test-splunk', {}), { ok: true, value: { status: 'connected', transport: 'streamable-http' } })
    assert.equal(calls[0].name, 'mcp__splunk_mcp__splunk_get_info')
    assert.deepEqual(calls[0].arguments, {})
    assert.ok(calls[0].signal instanceof AbortSignal)
    failure = true
    const failed = await handler('test-splunk', {})
    assert.equal(failed.ok, false)
    assert.match(failed.error.message, /HTTP 401 \[redacted\] rejected/)
    assert.doesNotMatch(JSON.stringify(failed), /private-token/)
    assert.match((await handler('test-splunk', {}, AbortSignal.abort())).error.message, /cancelled/)
  } finally {
    process.env = previous
  }
})
