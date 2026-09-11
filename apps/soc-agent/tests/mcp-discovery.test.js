import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { Context } from '../../../vendor/deepseek-harness/vendor/cordis/lib/index.js'
import Loader from '../../../vendor/deepseek-harness/vendor/loader/lib/index.js'
import Include from '../../../vendor/deepseek-harness/vendor/include/lib/index.js'
import SystemPrompt from '../../../vendor/deepseek-harness/packages/core/system-prompt/lib/index.js'
import ToolRuntime from '../../../vendor/deepseek-harness/packages/core/tools/lib/index.js'
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

test('Loader exposes both MCP namespaces and retains explicit empty-list filtering', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'soc-mcp-discovery-'))
  const ctx = new Context()
  const fixture = fileURLToPath(new URL('../../../vendor/deepseek-harness/packages/mcp/mcp-client/tests/fixture-server.ts', import.meta.url))
  try {
    const rows = [
      { name: 'system-prompt' },
      { name: 'tools', config: { mode: 'native' } },
      ...[
        { serverName: 'soc_agent' },
        { serverName: 'splunk_official', allowedToolNames: ['add'] },
        { serverName: 'empty', allowedToolNames: [] },
      ].map(config => ({ name: 'mcp', config: {
        transport: 'stdio', command: process.execPath, args: [fixture],
        failOnStartupError: true, ...config,
      } })),
    ]
    const configPath = join(directory, 'cordis.yml')
    await writeFile(configPath, JSON.stringify(rows))
    ctx.baseUrl = pathToFileURL(directory).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    ctx.loader.internal = { version: 'v2', async import(name) {
      return { 'system-prompt': SystemPrompt, tools: ToolRuntime, mcp: McpClient }[name]
    } }
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await ctx.loader.await()
    const names = ctx.tools.schemas().map(tool => tool.name)
    assert.ok(names.includes('mcp__soc_agent__add'))
    assert.ok(names.includes('mcp__soc_agent__greet'))
    assert.deepEqual(names.filter(name => name.startsWith('mcp__splunk_official__')), ['mcp__splunk_official__add'])
    assert.equal(names.some(name => name.startsWith('mcp__empty__')), false)
  } finally {
    await ctx.fiber.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
