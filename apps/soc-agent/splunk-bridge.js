import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'

export const name = 'soc-agent-splunk-official-bridge'
export const inject = ['tools']

export const OFFICIAL_SPLUNK_TOOL_NAMES = Object.freeze([
  'splunk_run_query',
  'splunk_get_info',
  'splunk_get_indexes',
  'splunk_get_index_info',
  'splunk_get_metadata',
  'splunk_get_knowledge_objects',
  'splunk_run_saved_search',
  'splunk_list_alerts',
  'splunk_get_alert_details',
  'splunk_list_fired_alerts',
  'splunk_get_fired_alert_details',
  'splunk_get_alert_throttle',
  'splunk_list_active_throttles',
])

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
  const verifyTls = !/^(0|false|no|off)$/i.test(read('SPLUNK_VERIFY_SSL'))
  return {
    serverName: 'splunk_official',
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
