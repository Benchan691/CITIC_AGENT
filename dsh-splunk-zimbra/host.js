import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACTION_TOOLS, APPROVAL_TOOLS, DOMAIN_TOOLS, READ_ONLY_TOOLS } from './policy.js'

export const name = 'splunk-zimbra-host'
export const inject = ['agents', 'connection', 'tools']

const CHANNEL = '/splunk-zimbra-config'

export { ACTION_TOOLS, APPROVAL_TOOLS, DOMAIN_TOOLS, READ_ONLY_TOOLS }

function bundleRoot() {
  return dirname(fileURLToPath(import.meta.url))
}

function serverRoot() {
  return process.env.DSH_SPLUNK_ZIMBRA_SERVER || join(bundleRoot(), 'server')
}

function workspaceRoot() {
  return process.env.MCP_SEVER_ROOT || dirname(bundleRoot())
}

function ok(value) {
  return { ok: true, value }
}

function err(code, message) {
  return { ok: false, error: { code, message } }
}

function runAdmin(command, arg, payload) {
  return new Promise((resolvePromise, rejectPromise) => {
    const args = ['run', 'python', '-m', 'unified_mcp_server.admin_cli', command]
    if (arg !== undefined && arg !== '') args.push(arg)
    const child = spawn('uv', args, {
      cwd: serverRoot(),
      env: { ...process.env, MCP_SEVER_ROOT: workspaceRoot() },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', rejectPromise)
    child.on('close', code => {
      if (code !== 0) {
        rejectPromise(new Error(stderr.trim() || `admin cli exited with code ${String(code)}`))
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
    case 'test-splunk': return ok(await runAdmin('test-splunk'))
    case 'migrate': return ok(await runAdmin('migrate'))
    default: return err('unknown_endpoint', `Unknown endpoint: ${endpoint}`)
  }
}

export function apply(ctx) {
  ctx.on('agent/created', ({ agent }) => {
    if (!ctx.agents.roots().includes(agent)) return
    try { agent.ctx.tools.restrict({ allow: [...DOMAIN_TOOLS] }) } catch { /* scheduler tools register asynchronously; pre-execute enforces */ }
  })
  ctx.on('tools/pre-execute', (exec, next) => {
    if (!DOMAIN_TOOLS.has(exec.name)) {
      return Promise.resolve({ kind: 'deny', reason: 'This harness exposes only Splunk, Zimbra, and scheduled-investigation tools.' })
    }
    if (APPROVAL_TOOLS.has(exec.name)) {
      return Promise.resolve({ kind: 'ask', reason: 'This action changes Splunk, sends email, or changes persistent scheduled tasks.' })
    }
    return next()
  }, { global: true })
  ctx.connection.rpc.handle(
    CHANNEL,
    async (endpoint, payload) => {
      try {
        return await handleEndpoint(endpoint, payload ?? {})
      } catch (error) {
        return err('admin_failed', error instanceof Error ? error.message : String(error))
      }
    },
    { authority: 'loopback' },
  )
}
