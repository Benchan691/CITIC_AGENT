import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACTION_TOOLS, APPROVAL_TOOLS, DOMAIN_TOOLS, READ_ONLY_TOOLS } from './policy.js'

export const name = 'soc-agent-host'
export const inject = ['agents', 'connection', 'tools']

const CHANNEL = '/soc-agent-config'
const CONTROL_TOOLS = new Set(['exit_plan_mode', 'ask_user_question'])

export { ACTION_TOOLS, APPROVAL_TOOLS, CONTROL_TOOLS, DOMAIN_TOOLS, READ_ONLY_TOOLS }

function bundleRoot() {
  return dirname(fileURLToPath(import.meta.url))
}

function serverRoot() {
  return process.env.DSH_SOC_AGENT_SERVER || join(bundleRoot(), 'server')
}

function workspaceRoot() {
  return process.env.MCP_SERVER_ROOT || process.env.MCP_SEVER_ROOT || dirname(dirname(bundleRoot()))
}

function ok(value) {
  return { ok: true, value }
}

function badRequest(message) {
  return { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } }
}

function internalError(message) {
  return { ok: false, error: { code: 'internal', message, details: {} } }
}

function adminFailureMessage(command, stderr, exitCode) {
  const lines = String(stderr).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const exception = [...lines].reverse().find(line => /^[\w.$]+(?:Error|Exception):\s*/.test(line))
  const detail = (exception ?? lines.at(-1) ?? `process exited with code ${String(exitCode)}`)
    .replace(/^[\w.$]+(?:Error|Exception):\s*/, '')
  const label = command === 'test-splunk' ? 'Splunk connection test failed' : `Admin operation "${command}" failed`
  return `${label}: ${detail}`
}

function runAdmin(command, arg, payload) {
  return new Promise((resolvePromise, rejectPromise) => {
    const args = ['run', 'python', '-m', 'unified_mcp_server.admin_cli', command]
    if (arg !== undefined && arg !== '') args.push(arg)
    const child = spawn('uv', args, {
      cwd: serverRoot(),
      env: { ...process.env, MCP_SERVER_ROOT: workspaceRoot() },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', error => rejectPromise(new Error(adminFailureMessage(command, error.message, -1))))
    child.on('close', code => {
      if (code !== 0) {
        rejectPromise(new Error(adminFailureMessage(command, stderr, code)))
        return
      }
      try {
        resolvePromise(stdout.trim() ? JSON.parse(stdout) : {})
      } catch (error) {
        rejectPromise(error)
      }
    })
    if (payload !== undefined) child.stdin.end(JSON.stringify(payload))
    else child.stdin.end()
  })
}

async function handleEndpoint(endpoint, payload) {
  switch (endpoint) {
    case 'get-settings': return ok(await runAdmin('get-settings'))
    case 'update-settings': return ok(await runAdmin('update-settings', undefined, payload))
    case 'delete-setting': return ok(await runAdmin('delete-setting', payload?.key ?? ''))
    case 'list-accounts': return ok(await runAdmin('list-accounts'))
    case 'add-account': return ok(await runAdmin('add-account', undefined, payload))
    case 'update-account': return ok(await runAdmin('update-account', payload?.id ?? '', payload))
    case 'delete-account': return ok(await runAdmin('delete-account', payload?.id ?? ''))
    case 'test-account': return ok(await runAdmin('test-account', payload?.id ?? ''))
    case 'send-email': return ok(await runAdmin('send-email', undefined, payload))
    case 'test-splunk': return ok(await runAdmin('test-splunk'))
    case 'test-subscription-server': return ok(await runAdmin('test-subscription-server'))
    case 'migrate': return ok(await runAdmin('migrate'))
    default: return badRequest(`Unknown endpoint: ${endpoint}`)
  }
}

export function apply(ctx) {
  ctx.on('agent/created', ({ agent }) => {
    if (!ctx.agents.roots().includes(agent)) return
    try { agent.ctx.tools.restrict({ allow: [...DOMAIN_TOOLS, ...CONTROL_TOOLS] }) } catch { /* scheduler tools register asynchronously; pre-execute enforces */ }
  })
  ctx.on('tools/pre-execute', (exec, next) => {
    if (!DOMAIN_TOOLS.has(exec.name) && !CONTROL_TOOLS.has(exec.name)) {
      return Promise.resolve({ kind: 'deny', reason: 'This harness exposes only Splunk, Zimbra, subscription, and scheduled-investigation tools.' })
    }
    if (APPROVAL_TOOLS.has(exec.name)) {
      return Promise.resolve({ kind: 'ask', reason: 'This action changes a SOC system, sends email, or changes a persistent schedule.' })
    }
    return next()
  }, { global: true })
  ctx.connection.rpc.handle(
    CHANNEL,
    async (endpoint, payload) => {
      try {
        return await handleEndpoint(endpoint, payload ?? {})
      } catch (error) {
        return internalError(error instanceof Error ? error.message : String(error))
      }
    },
    { authority: 'loopback' },
  )
}
