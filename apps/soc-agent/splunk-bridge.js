import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { OFFICIAL_SPLUNK_TOOL_NAMES } from './tool-inventory.js'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'

export const name = 'soc-agent-splunk-official-bridge'
export const inject = ['tools']

export { OFFICIAL_SPLUNK_TOOL_NAMES } from './tool-inventory.js'

function deploymentValues(serverRoot) {
  try {
    return parseEnv(readFileSync(join(serverRoot, '.env'), 'utf8'))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    return {}
  }
}

export function resolveOfficialSplunkConfig(env = process.env, serverRoot) {
  const bundleRoot = dirname(fileURLToPath(import.meta.url))
  const fileValues = deploymentValues(
    serverRoot || env.DSH_SOC_AGENT_SERVER || join(bundleRoot, 'server'),
  )
  const read = name => String(env[name] || fileValues[name] || '').trim()
  const endpoint = read('SPLUNK_MCP_ENDPOINT')
  const token = read('SPLUNK_TOKEN')
  if (!endpoint || !token) return undefined
  let url
  try { url = new URL(endpoint) } catch { throw new Error('SPLUNK_MCP_ENDPOINT must be an HTTP(S) URL.') }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('SPLUNK_MCP_ENDPOINT must be an HTTP(S) URL without embedded credentials, query parameters, or fragments.')
  }
  if (url.protocol === 'http:' && !/^(1|true|yes|on)$/i.test(read('SPLUNK_ALLOW_INSECURE_HTTP'))) {
    throw new Error('SPLUNK_ALLOW_INSECURE_HTTP must be true to use an HTTP Splunk MCP endpoint.')
  }
  const verifyTls = !/^(0|false|no|off)$/i.test(read('SPLUNK_VERIFY_SSL'))
  return {
    serverName: 'splunk_mcp',
    transport: 'streamable-http',
    url: endpoint,
    headers: { Authorization: `Bearer ${token}` },
    verifyTls,
    allowedToolNames: [...OFFICIAL_SPLUNK_TOOL_NAMES],
    toolCallTimeoutMs: 185_000,
    failOnStartupError: true,
  }
}

export async function apply(ctx) {
  const config = resolveOfficialSplunkConfig()
  if (!config) {
    ctx.logger.info('official Splunk MCP bridge disabled: endpoint and token are not both configured')
    return
  }
  await McpClient.apply(ctx, config)
}

// Use the live bridge so the admin probes the agent's transport, TLS and tool policy.
export async function testOfficialSplunkConnection(ctx, signal) {
  const config = resolveOfficialSplunkConfig()
  if (!config) throw new Error('Configure SPLUNK_MCP_ENDPOINT and SPLUNK_TOKEN in the server environment.')
  const name = 'mcp__splunk_mcp__splunk_get_info'
  if (!ctx.tools.get(name)) throw new Error('The official Splunk MCP bridge is unavailable. Check its startup and connection logs.')
  const deadline = AbortSignal.timeout(config.toolCallTimeoutMs)
  const cancellation = signal ? AbortSignal.any([signal, deadline]) : deadline
  try {
    const result = await ctx.tools.execute({ name, arguments: {}, callId: randomUUID(), signal: cancellation })
    if (result.isError) throw new Error(result.error?.message || result.content?.filter(block => block.type === 'text').map(block => block.text).join(' ') || 'The official MCP connection check failed.')
    return { status: 'connected', transport: config.transport }
  } catch (error) {
    const message = cancellation.aborted
      ? (signal?.aborted ? 'The connection check was cancelled.' : 'The connection check exceeded 185 seconds.')
      : String(error?.message || 'The official MCP connection check failed.').replaceAll(config.headers.Authorization.slice(7), '[redacted]').replace(/\s+/g, ' ').trim().slice(0, 400)
    throw new Error(`Splunk connection test failed: ${message}`)
  }
}
