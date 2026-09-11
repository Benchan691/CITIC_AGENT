import assert from 'node:assert/strict'
import test from 'node:test'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'

test('MCP config preserves omitted, empty, and explicit tool allowlists for both transports', () => {
  for (const transport of [
    { transport: 'stdio', command: 'node' },
    { transport: 'streamable-http', url: 'http://127.0.0.1:1/mcp' },
  ]) {
    const config = { ...transport, serverName: 'fixture' }
    assert.equal(McpClient.Config(config).allowedToolNames, undefined)
    assert.deepEqual(McpClient.Config({ ...config, allowedToolNames: [] }).allowedToolNames, [])
    assert.deepEqual(McpClient.Config({ ...config, allowedToolNames: ['add'] }).allowedToolNames, ['add'])
  }
})
