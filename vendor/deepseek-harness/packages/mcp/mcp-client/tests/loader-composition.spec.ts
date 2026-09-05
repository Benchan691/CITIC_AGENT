import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { CallId } from '@deepseek-ai/dsh-llm'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'

it('Loader composition carries host metadata over real stdio and disposes its hooks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'soc-mcp-composition-'))
  const ctx = new Context()
  const require = createRequire(import.meta.url)
  const sdk = (path: string) => pathToFileURL(require.resolve(`@modelcontextprotocol/sdk/${path}`)).href
  try {
    const fixture = join(directory, 'provider.mjs')
    await writeFile(fixture, `
      import { Server } from ${JSON.stringify(sdk('server/index.js'))}
      import { StdioServerTransport } from ${JSON.stringify(sdk('server/stdio.js'))}
      import { ListToolsRequestSchema, CallToolRequestSchema } from ${JSON.stringify(sdk('types.js'))}
      const server = new Server({name:'offline-provider',version:'1'}, {capabilities:{tools:{}}})
      server.setRequestHandler(ListToolsRequestSchema, async () => ({tools:[{
        name:'echo', description:'Echo the authenticated transport metadata.', inputSchema:{type:'object',properties:{}}, annotations:{readOnlyHint:true}
      }]}))
      server.setRequestHandler(CallToolRequestSchema, async request => ({content:[{type:'text',text:JSON.stringify(request.params._meta)}]}))
      await server.connect(new StdioServerTransport())
    `)
    const configPath = join(directory, 'cordis.yml')
    await writeFile(configPath, [
      '- name: system-prompt', '- name: tools', '- name: host-metadata',
      '- name: mcp', '  config:', '    transport: stdio', '    serverName: fixture',
      `    command: ${JSON.stringify(process.execPath)}`, `    args: [${JSON.stringify(fixture)}]`,
      '    failOnStartupError: true', '    toolCallTimeoutMs: 5000',
    ].join('\n'))
    let calls = 0
    ctx.baseUrl = pathToFileURL(directory).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (specifier === 'system-prompt') return SystemPrompt
        if (specifier === 'tools') return ToolRuntime
        if (specifier === 'mcp') return McpClient
        if (specifier === 'host-metadata') return {
          name: 'host-metadata',
          apply(context: Context) {
            context.on('mcp/request-meta', async (_exec, server, next) => {
              calls++
              expect(server).toBe('fixture')
              return { ...await next(), soc_session_id: 'opaque-authenticated-session', soc_investigation_id: 'case-1' }
            }, { global: true })
          },
        }
        throw new Error(`Unexpected import: ${specifier}`)
      },
    } as unknown as NonNullable<typeof ctx.loader.internal>
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await ctx.loader.await()
    const result = await ctx.tools.execute({ callId: CallId('call-1'), name: 'mcp__fixture__echo', arguments: {}, signal: new AbortController().signal })
    expect(result.isError).toBe(false)
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({ soc_session_id: 'opaque-authenticated-session', soc_investigation_id: 'case-1' })
    expect(calls).toBe(1)
    await ctx.fiber.dispose()
    expect(await ctx.waterfall('mcp/request-meta', {} as never, 'fixture', async () => ({}))).toEqual({})
    expect(calls).toBe(1)
  } finally {
    await ctx.fiber.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 20_000)
