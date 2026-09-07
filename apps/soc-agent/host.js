import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACTION_CATALOG, ACTION_TOOLS, APPROVAL_TOOLS, ALWAYS_ASK_ACTION_TOOLS, CATALOG_ACTION_TOOLS, DETECTION_ACTION_TOOLS, DOMAIN_TOOLS, READ_ONLY_TOOLS, SPLUNK_LOOKUP_ACTION_TOOLS } from './policy.js'
import { runAuthCommand } from './ownership.js'
import { installInvestigationProjection } from './investigation.js'

export const name = 'soc-agent-host'
export const inject = ['agents', 'connection', 'tools', 'socAuth', 'sessions', 'settings', 'webServer']

const CHANNEL = '/soc-agent-config'
const ACTION_POLICY_NAMESPACE = 'soc-action-approval'
const CONTROL_TOOLS = new Set(['exit_plan_mode', 'ask_user_question'])
const CATALOG_ENDPOINTS = new Set([
  'catalog-list',
  'catalog-get',
  'catalog-history',
  'catalog-publications',
  'catalog-preview-publish',
  'save-catalog-record',
  'archive-catalog-record',
  'publish-catalog',
  'rollback-publication',
])
const HARD_ATTACHMENT_BYTES = 100_000_000
const HARD_MARKDOWN_CHARS = 2_000_000
const HARD_LOOKUP_BYTES = 50_000_000

export { ACTION_CATALOG, ACTION_TOOLS, APPROVAL_TOOLS, ALWAYS_ASK_ACTION_TOOLS, CATALOG_ACTION_TOOLS, CONTROL_TOOLS, DETECTION_ACTION_TOOLS, DOMAIN_TOOLS, READ_ONLY_TOOLS, SPLUNK_LOOKUP_ACTION_TOOLS }

const ACTION_NAMES = new Set(ACTION_TOOLS)
const nodeRequire = createRequire(import.meta.url)

function requireAdmin(ctx) {
  const auth = ctx.get?.('socAuth')
  if (!auth || typeof auth.requireAdmin !== 'function') throw new Error('admin authentication required')
  return auth.requireAdmin()
}

function requireUser(ctx) {
  const auth = ctx.get?.('socAuth')
  if (!auth || typeof auth.requireSession !== 'function') throw new Error('authentication required')
  return auth.requireSession()
}

async function serveAdminPage(request, response, webServer) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' })
    response.end()
    return
  }
  let indexPath
  try {
    // The product package is loaded from a sibling workspace and does not
    // necessarily have the web frontend in its own dependency directory.
    // Resolve it through the maintained web-app package, just like the web
    // bundle does, then fall back to the checked-out workspace path.
    indexPath = nodeRequire.resolve(
      '@deepseek-ai/dsh-web-frontend/dist/index.html',
      { paths: [join(workspaceRoot(), 'vendor/deepseek-harness/packages/bundle/web-app')] },
    )
  } catch {
    indexPath = join(workspaceRoot(), 'vendor/deepseek-harness/apps/web/dist/index.html')
  }
  if (!indexPath) {
    response.writeHead(503, { 'cache-control': 'no-store' })
    response.end('admin interface unavailable')
    return
  }
  try {
    const html = await readFile(indexPath, 'utf8')
    const rendered = typeof webServer?.renderIndex === 'function'
      ? webServer.renderIndex(html)
      : html
    const data = Buffer.from(await rendered)
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': data.length,
    })
    if (request.method === 'HEAD') response.end()
    else response.end(data)
  } catch {
    response.writeHead(500, { 'cache-control': 'no-store' })
    response.end('admin interface unavailable')
  }
}

const ALERT_EMAIL_SETTINGS_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SOC alert email settings</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { max-width: 980px; margin: 2rem auto; padding: 0 1rem; }
    section { border: 1px solid #8885; border-radius: .6rem; padding: 1rem; margin: 1rem 0; }
    label { display: block; margin: .55rem 0; }
    input, select, button { font: inherit; padding: .35rem; }
    input[type=text], select { width: min(100%, 34rem); }
    textarea { width: min(100%, 34rem); min-height: 4rem; font: inherit; }
    .severity { display: inline-block; margin-right: 1rem; }
    .muted { opacity: .75; }
    #message { min-height: 1.4rem; }
  </style>
</head>
<body>
  <h1>Alert email settings</h1>
  <p class="muted">Mailbox credentials remain in the server environment. This page controls customer recipients and severity rules.</p>
  <p id="message" role="status"></p>
  <section>
    <h2>Delivery status</h2>
    <pre id="status">Loading…</pre>
  </section>
  <section>
    <h2>Customer recipients</h2>
    <form id="customer-form">
      <label>Customer <select id="customer-id" required></select></label>
      <label>Recipients (one address per line)<br><textarea id="recipients" required></textarea></label>
      <label>CC (one address per line)<br><textarea id="cc"></textarea></label>
      <label>BCC (one address per line)<br><textarea id="bcc"></textarea></label>
      <label>Language <select id="language"><option>EN</option><option>CN</option><option>ZH</option></select></label>
      <label>Brand <select id="brand"><option>CPC</option><option>CEC</option></select></label>
      <button type="submit">Save customer recipients</button>
    </form>
  </section>
  <section>
    <h2>Severity rule</h2>
    <form id="rule-form">
      <label>Name <input id="rule-name" type="text" maxlength="160" required></label>
      <label>Customer (blank for all customers) <select id="rule-customer"><option value="">All customers</option></select></label>
      <label>Ruleset ID (blank for all rulesets) <input id="rule-ruleset" type="text"></label>
      <label>Source types <select id="route-sources" multiple></select></label>
      <label>IPs, subnets or ranges (comma separated)<input id="route-ips" type="text"></label>
      <label>Hostnames (comma separated; * wildcard)<input id="route-hostnames" type="text"></label>
      <label>Recipient override (blank uses customer defaults)<textarea id="route-recipients"></textarea></label>
      <label>Override CC<textarea id="route-cc"></textarea></label><label>Override BCC<textarea id="route-bcc"></textarea></label>
      <p>Filter categories must all match. Within a category, any value may match.</p>
      <div>Severities:</div>
      <label class="severity"><input type="checkbox" name="severity" value="info"> info</label>
      <label class="severity"><input type="checkbox" name="severity" value="low"> low</label>
      <label class="severity"><input type="checkbox" name="severity" value="medium"> medium</label>
      <label class="severity"><input type="checkbox" name="severity" value="high" checked> high</label>
      <label class="severity"><input type="checkbox" name="severity" value="critical" checked> critical</label>
      <label><input id="rule-enabled" type="checkbox"> Enabled</label>
      <button type="submit">Save severity rule</button>
    </form>
    <h3>Existing rules</h3>
    <pre id="rules">Loading…</pre>
  </section>
  <section><h2>Email preview</h2><label>Event ID <input id="preview-event" type="text"></label>
    <button id="preview-button">Preview for selected customer</button><pre id="preview-info"></pre>
    <iframe id="preview-frame" sandbox title="Email preview" style="width:100%;height:450px"></iframe></section>
  <section><h2>Import legacy routing</h2><p>Select the customer above. Paste CSV with exact source_type, severity, ip1, ip2, hostname, recipients, cc, bcc headers. Rules are saved disabled.</p>
    <textarea id="csv-input"></textarea><button id="csv-preview">Preview import</button><div id="csv-result"></div></section>
  <section><h2>Delivery history</h2><p>Accepted means SMTP relay acceptance; mailbox delivery is unconfirmed.</p><div id="history"></div></section>
  <script>
    const message = document.getElementById('message')
    const customers = document.getElementById('customer-id')
    let state
    const addresses = value => String(value || '').split(/[\\n,]/u).map(item => item.trim()).filter(Boolean)
    const setMessage = value => { message.textContent = value || '' }
    const request = async (path, options) => {
      const response = await fetch(path, { credentials: 'same-origin', ...options })
      const value = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(value.error || value.message || 'Request failed')
      return value
    }
    const render = value => {
      state = value
      document.getElementById('route-sources').replaceChildren(...(value.source_types || []).map(s => new Option(s.name, s.id)))
      document.getElementById('history').replaceChildren(...(value.history || []).map(row => {
        const p = document.createElement('p'); p.textContent = [row.created, row.customer, row.event_id, row.status, 'Accepted: ' + row.accepted.join(', '), 'Rejected: ' + JSON.stringify(row.rejected), row.error || ''].join(' | '); return p
      }))
      customers.replaceChildren(...value.customers.map(customer => {
        const option = document.createElement('option')
        option.value = customer.id
        option.textContent = (customer.gid || customer.id) + ' — ' + (customer.name || '')
        return option
      }))
      const ruleCustomer = document.getElementById('rule-customer')
      ruleCustomer.replaceChildren(new Option('All customers', ''), ...value.customers.map(customer => new Option(
        (customer.gid || customer.id) + ' — ' + (customer.name || ''),
        customer.id,
      )))
      document.getElementById('rules').textContent = JSON.stringify(value.rules, null, 2)
      document.getElementById('status').textContent = JSON.stringify({ runtime: value.runtime, delivery: value.delivery }, null, 2)
      const selected = value.customers[0]
      if (selected) {
        const config = selected.email_config || {}
        document.getElementById('language').value = config.language || 'EN'
        document.getElementById('brand').value = config.brand || 'CPC'
        document.getElementById('recipients').value = (config.recipients || []).join('\\n')
        document.getElementById('cc').value = (config.cc || []).join('\\n')
        document.getElementById('bcc').value = (config.bcc || []).join('\\n')
      }
    }
    customers.addEventListener('change', () => {
      const selected = (state?.customers || []).find(item => item.id === customers.value)
      const config = selected?.email_config || {}
      document.getElementById('language').value = config.language || 'EN'
      document.getElementById('brand').value = config.brand || 'CPC'
      document.getElementById('recipients').value = (config.recipients || []).join('\\n')
      document.getElementById('cc').value = (config.cc || []).join('\\n')
      document.getElementById('bcc').value = (config.bcc || []).join('\\n')
    })
    document.getElementById('customer-form').addEventListener('submit', async event => {
      event.preventDefault(); setMessage('Saving…')
      try {
        await request('/admin/alert-email/customer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
          customer_id: customers.value,
          email_config: {
            language: document.getElementById('language').value, brand: document.getElementById('brand').value,
            recipients: addresses(document.getElementById('recipients').value),
            cc: addresses(document.getElementById('cc').value),
            bcc: addresses(document.getElementById('bcc').value),
          },
        }) })
        setMessage('Customer recipients saved.'); await load()
      } catch (error) { setMessage(error.message) }
    })
    document.getElementById('rule-form').addEventListener('submit', async event => {
      event.preventDefault(); setMessage('Saving…')
      try {
        const severities = [...document.querySelectorAll('input[name=severity]:checked')].map(item => item.value)
        await request('/admin/alert-email/rule', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
          name: document.getElementById('rule-name').value,
          customer_id: document.getElementById('rule-customer').value || null,
          ruleset_id: document.getElementById('rule-ruleset').value || null,
          severities,
          routing: {
            source_type_ids: [...document.getElementById('route-sources').selectedOptions].map(o => o.value),
            ips: addresses(document.getElementById('route-ips').value),
            hostnames: addresses(document.getElementById('route-hostnames').value),
            ...(document.getElementById('route-recipients').value.trim() ? { recipients: { recipients: addresses(document.getElementById('route-recipients').value), cc: addresses(document.getElementById('route-cc').value), bcc: addresses(document.getElementById('route-bcc').value) } } : {}),
          },
          enabled: document.getElementById('rule-enabled').checked,
        }) })
        setMessage('Severity rule saved.'); await load()
      } catch (error) { setMessage(error.message) }
    })
    const postPreview = payload => request('/admin/alert-email/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    document.getElementById('preview-button').onclick = async () => {
      try { const value = await postPreview({ customer_id: customers.value, event_id: document.getElementById('preview-event').value });
        document.getElementById('preview-info').textContent = JSON.stringify({ subject: value.subject, recipients: value.recipients, rules: value.matched_rules }, null, 2)
        document.getElementById('preview-frame').srcdoc = value.html
      } catch (e) { setMessage(e.message) }
    }
    document.getElementById('csv-preview').onclick = async () => {
      try { const value = await postPreview({ customer_id: customers.value, csv: document.getElementById('csv-input').value });
        document.getElementById('csv-result').replaceChildren(...value.rows.map(row => {
          const p = document.createElement('p'); p.textContent = JSON.stringify(row)
          if (row.status === 'ready') { const button = document.createElement('button'); button.textContent = 'Save disabled routes'; button.onclick = async () => {
            try { for (const rule of row.rules) await request('/admin/alert-email/rule', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rule) }); button.disabled = true; setMessage('Routes saved disabled.') } catch (e) { setMessage(e.message) }
          }; p.append(button) }; return p
        }))
      } catch (e) { setMessage(e.message) }
    }
    async function load() { render(await request('/admin/alert-email/settings')) }
    load().catch(error => setMessage(error.message))
  </script>
</body>
</html>`

function sendJson(response, status, value) {
  const data = Buffer.from(JSON.stringify(value))
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': data.length,
  })
  response.end(data)
}

function sendHtml(response, status, html) {
  const data = Buffer.from(html)
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': data.length,
  })
  response.end(data)
}

async function readJsonRequest(request, limit = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw new Error('request too large')
    chunks.push(chunk)
  }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('request must be an object')
  return value
}

async function requireHttpAdmin(ctx, request, response) {
  const auth = ctx.get?.('socAuth')
  const admin = await auth?.requestAdmin?.(request)
  if (admin) return admin
  response.writeHead(401, { 'cache-control': 'no-store' })
  response.end('administrator authentication required')
  return undefined
}

async function serveAlertEmailPage(request, response, ctx) {
  if (!(await requireHttpAdmin(ctx, request, response))) return
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' }); response.end(); return
  }
  if (request.method === 'HEAD') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); response.end(); return
  }
  sendHtml(response, 200, ALERT_EMAIL_SETTINGS_PAGE)
}

async function serveAlertEmailSettings(request, response, ctx) {
  if (!(await requireHttpAdmin(ctx, request, response))) return
  if (request.method !== 'GET') { response.writeHead(405, { allow: 'GET' }); response.end(); return }
  try { sendJson(response, 200, await runAdmin('get-alert-email-settings')) }
  catch { sendJson(response, 500, { error: 'alert email settings unavailable' }) }
}

async function saveAlertEmailAdminResource(request, response, ctx, command, validator) {
  if (!(await requireHttpAdmin(ctx, request, response))) return
  if (request.method !== 'POST') { response.writeHead(405, { allow: 'POST' }); response.end(); return }
  try {
    const payload = validator(await readJsonRequest(request))
    sendJson(response, 200, await runAdmin(command, undefined, payload, request.signal))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'request failed'
    sendJson(response, message.startsWith('The ') ? 400 : 500, { error: message.slice(0, 400) })
  }
}

class ActionPolicyError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ActionPolicyError'
    this.code = code
  }
}

function sessionIdOf(agent) {
  const id = agent?.session?.id ?? agent?.id
  return id === undefined || id === null ? undefined : String(id)
}

function rootsOf(ctx) {
  try {
    return typeof ctx.agents?.roots === 'function' ? ctx.agents.roots() : []
  } catch {
    return []
  }
}

function sessionStoreOf(ctx) {
  try {
    return ctx.sessions ?? ctx.get?.('sessions')
  } catch {
    return undefined
  }
}

function settingsOf(ctx) {
  try {
    return ctx.get?.('settings') ?? ctx.settings
  } catch {
    return undefined
  }
}

function actionSet(value, { strict = false } = {}) {
  if (!Array.isArray(value) || value.length > ACTION_TOOLS.length) {
    throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC action approval list is invalid.')
  }
  const result = new Set()
  for (const name of value) {
    if (typeof name !== 'string' || name.length === 0 || name.length > 200) {
      throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC action approval list is invalid.')
    }
    if (result.has(name)) {
      throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC action approval list contains duplicate actions.')
    }
    if (!ACTION_NAMES.has(name)) {
      if (strict) throw new ActionPolicyError('soc-action-policy-invalid', 'The SOC action approval list contains an unknown action.')
      continue
    }
    result.add(name)
  }
  return result
}

function savedAutoApproveActions(ctx) {
  try {
    const value = settingsOf(ctx)?.get?.(ACTION_POLICY_NAMESPACE)
    return actionSet(value?.autoApproveActions ?? [])
  } catch {
    // A malformed or unavailable saved setting must never grant an action.
    return new Set()
  }
}

function resolveOwnedSession(ctx, sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 200) {
    throw new ActionPolicyError('soc-action-policy-invalid', 'A valid session is required.')
  }
  const roots = rootsOf(ctx)
  const root = roots.find(agent => sessionIdOf(agent) === sessionId)
  if (root?.session !== undefined) return { agent: root, session: root.session }
  const sessions = sessionStoreOf(ctx)
  const session = sessions?.get?.(sessionId)
  if (session === undefined) throw new ActionPolicyError('soc-action-session-not-found', 'The session is no longer available.')
  const agent = ctx.agents?.get?.(sessionId)
  if (agent !== undefined && !roots.includes(agent)) {
    throw new ActionPolicyError('soc-action-session-not-owned', 'The session is not owned by the interactive SOC agent.')
  }
  return { agent, session }
}

function policyValue(ctx, sessionPolicies, sessionId) {
  const session = sessionPolicies.get(sessionId)
  const actions = session ?? savedAutoApproveActions(ctx)
  return {
    actions: ACTION_CATALOG,
    // Draft families always require the harness approval flow; never
    // advertise a session-wide bypass for them to the UI.
    autoApproveActions: [...actions].filter(name => !ALWAYS_ASK_ACTION_TOOLS.includes(name)),
    source: session === undefined ? 'defaults' : 'session',
  }
}

function detectionApprovalReason(exec) {
  return 'This Splunk detection draft requires approval before it can run.'
}

function catalogApprovalReason(exec) {
  return 'This catalog change requires approval before it can run.'
}

function policyError(error, sessionId) {
  if (error instanceof ActionPolicyError) {
    if (error.code === 'soc-action-session-not-found') {
      return {
        ok: false,
        error: {
          code: 'session-not-found',
          message: error.message,
          details: { sessionId: String(sessionId ?? '') },
        },
      }
    }
    return {
      ok: false,
      error: {
        code: 'bad-request',
        message: error.message,
        details: { issues: [] },
      },
    }
  }
  return internalError('The SOC action policy is unavailable.')
}

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

function parseAdminFailure(stderr) {
  const lines = String(stderr || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  for (const line of lines.reverse()) {
    const candidates = [line]
    const start = line.indexOf('{')
    const end = line.lastIndexOf('}')
    if (start >= 0 && end > start && (start > 0 || end < line.length - 1)) candidates.push(line.slice(start, end + 1))
    for (const candidate of candidates) {
      try {
        const value = JSON.parse(candidate)
        if (value && typeof value === 'object' && typeof value.message === 'string' && typeof value.code === 'string') return value
      } catch { /* ignore traceback and launcher noise */ }
    }
  }
  return undefined
}

function adminFailureMessage(command, stderr = '') {
  const label = command === 'test-splunk'
    ? 'Splunk connection test failed'
    : command === 'test-subscription-server'
      ? 'Subscription server connection test failed'
      : `Admin operation "${command}" failed`
  const failure = parseAdminFailure(stderr)
  if (!failure) {
    return command === 'test-splunk' || command === 'test-subscription-server'
      ? `${label}: The test process did not return a diagnostic. Check the server .env configuration and server logs.`
      : `${label}: The requested operation failed.`
  }
  const message = failure.message.replace(/\s+/g, ' ').trim().slice(0, 400)
  if (!message) {
    return command === 'test-splunk' || command === 'test-subscription-server'
      ? `${label}: The test process returned an empty diagnostic. Check the server logs.`
      : `${label}: The requested operation failed.`
  }
  const details = failure.details && typeof failure.details === 'object' ? failure.details : {}
  const extra = []
  if (Number.isInteger(details.status_code)) extra.push(`HTTP status ${details.status_code}`)
  if (Array.isArray(details.missing_environment_variables)) {
    const missing = details.missing_environment_variables.filter(value => typeof value === 'string').slice(0, 20)
    if (missing.length) extra.push(`missing configuration: ${missing.join(', ')}`)
  }
  return `${label}: ${message}${extra.length ? ` (${extra.join('; ')})` : ''}`
}

// Admin helper subprocesses share the authenticated-command bound: a hung
// Python process must never hold the admin RPC open indefinitely.
const ADMIN_COMMAND_TIMEOUT_MS = Number(process.env.SOC_AUTH_COMMAND_TIMEOUT_MS ?? 185_000)

function runAdmin(command, arg, payload, signal) {
  return new Promise((resolvePromise, rejectPromise) => {
    const args = ['run', 'python', '-m', 'unified_mcp_server.admin_cli', command]
    if (arg !== undefined && arg !== '') args.push(arg)
    const child = spawn('uv', args, {
      cwd: serverRoot(),
      env: (() => {
        const environment = { ...process.env, MCP_SERVER_ROOT: workspaceRoot() }
        delete environment.SOC_ADMIN_EMAIL
        delete environment.SOC_ADMIN_PASSWORD
        return environment
      })(),
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timeoutTimer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      rejectPromise(new Error(`admin_operation_timeout: The "${command}" operation exceeded ${Math.round(ADMIN_COMMAND_TIMEOUT_MS / 1000)} seconds.`))
    }, ADMIN_COMMAND_TIMEOUT_MS)
    timeoutTimer.unref?.()
    const abort = () => {
      if (settled) return
      settled = true
      clearTimeout(timeoutTimer)
      child.kill('SIGTERM')
      rejectPromise(new Error('attachment_conversion_cancelled'))
    }
    if (signal?.aborted) {
      abort()
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', error => {
      if (settled) return
      settled = true
      clearTimeout(timeoutTimer)
      rejectPromise(new Error(adminFailureMessage(command)))
    })
    child.on('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timeoutTimer)
      signal?.removeEventListener('abort', abort)
      if (code !== 0) {
        if (command === 'convert-attachment') {
          try {
            const failure = JSON.parse(stderr.trim())
            if (failure?.code && failure?.message) {
              rejectPromise(new Error(`${failure.code}: ${failure.message}`))
              return
            }
          } catch { /* map malformed converter failures below */ }
          rejectPromise(new Error('attachment_conversion_failed: The attachment conversion failed.'))
          return
        }
        rejectPromise(new Error(adminFailureMessage(command, stderr)))
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

function validateAttachmentPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('attachment_invalid_request')
  const filename = typeof payload.filename === 'string' ? payload.filename : ''
  const contentType = typeof payload.content_type === 'string' ? payload.content_type : ''
  const data = typeof payload.data === 'string' ? payload.data : ''
  if (!filename || filename.length > 255 || filename.includes('\0') || filename !== filename.split(/[\\/]/u).at(-1)) {
    throw new Error('attachment_invalid_filename')
  }
  if (contentType.length > 255) throw new Error('attachment_invalid_mime')
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(data) || data.length % 4 !== 0) throw new Error('attachment_invalid_request')
  const bytes = Buffer.from(data, 'base64')
  if (bytes.length > HARD_ATTACHMENT_BYTES) throw new Error('attachment_too_large')
  const limits = payload.limits && typeof payload.limits === 'object' ? payload.limits : {}
  const maxBytes = Number(limits.max_bytes ?? 10_000_000)
  const maxChars = Number(limits.max_chars ?? 200_000)
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > HARD_ATTACHMENT_BYTES) throw new Error('attachment_invalid_limits')
  if (!Number.isSafeInteger(maxChars) || maxChars < 1 || maxChars > HARD_MARKDOWN_CHARS) throw new Error('attachment_invalid_limits')
  return { filename, content_type: contentType, data, limits: { max_bytes: maxBytes, max_chars: maxChars } }
}

function validateDetectionSavePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The detection save request is invalid.')
  }
  const operation = payload.operation
  if (operation !== 'write' && operation !== 'update') {
    throw new Error('The detection save operation is invalid.')
  }
  if (!payload.detection || typeof payload.detection !== 'object' || Array.isArray(payload.detection)) {
    throw new Error('The detection draft is invalid.')
  }
  if (payload.name !== undefined && (typeof payload.name !== 'string' || payload.name.trim() === '')) {
    throw new Error('The detection name is invalid.')
  }
  if (payload.expected_fingerprint !== undefined && payload.expected_fingerprint !== null && typeof payload.expected_fingerprint !== 'string') {
    throw new Error('The detection fingerprint is invalid.')
  }
  return {
    operation,
    detection: payload.detection,
    ...(payload.name === undefined ? {} : { name: payload.name }),
    ...(payload.expected_fingerprint === undefined ? {} : { expected_fingerprint: payload.expected_fingerprint }),
  }
}

const CATALOG_NAMES = new Set(['customer', 'rule', 'fix_source_type'])

function validateCatalogSavePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The catalog save request is invalid.')
  }
  const operation = payload.operation
  if (operation !== 'write' && operation !== 'update') {
    throw new Error('The catalog save operation is invalid.')
  }
  const catalog = payload.catalog
  if (typeof catalog !== 'string' || !CATALOG_NAMES.has(catalog)) {
    throw new Error('The catalog name is invalid.')
  }
  if (!payload.record || typeof payload.record !== 'object' || Array.isArray(payload.record)) {
    throw new Error('The catalog record draft is invalid.')
  }
  if (operation === 'update' && (typeof payload.record_id !== 'string' || payload.record_id.trim() === '')) {
    throw new Error('The catalog record ID is invalid.')
  }
  if (payload.record_id !== undefined && payload.record_id !== null && typeof payload.record_id !== 'string') {
    throw new Error('The catalog record ID is invalid.')
  }
  if (operation === 'update' && (!Number.isInteger(payload.expected_revision) || payload.expected_revision < 1)) {
    throw new Error('The catalog record revision is invalid.')
  }
  if (payload.reason !== undefined && typeof payload.reason !== 'string') {
    throw new Error('The change reason is invalid.')
  }
  return {
    catalog,
    operation,
    record: payload.record,
    ...(payload.record_id === undefined || payload.record_id === null ? {} : { record_id: payload.record_id }),
    ...(operation === 'update' ? { expected_revision: payload.expected_revision } : {}),
    ...(payload.reason ? { reason: payload.reason.slice(0, 500) } : {}),
  }
}

function validateCatalogArchivePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The catalog archive request is invalid.')
  }
  const catalog = payload.catalog
  if (typeof catalog !== 'string' || !CATALOG_NAMES.has(catalog)) {
    throw new Error('The catalog name is invalid.')
  }
  if (typeof payload.record_id !== 'string' || payload.record_id.trim() === '') {
    throw new Error('The catalog record ID is invalid.')
  }
  if (!Number.isInteger(payload.expected_revision) || payload.expected_revision < 1) {
    throw new Error('The catalog record revision is invalid.')
  }
  return {
    catalog,
    record_id: payload.record_id,
    expected_revision: payload.expected_revision,
    restore: payload.restore === true,
    ...(typeof payload.reason === 'string' && payload.reason ? { reason: payload.reason.slice(0, 500) } : {}),
  }
}

function validateCatalogNamePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The catalog request is invalid.')
  }
  const catalog = payload.catalog
  if (typeof catalog !== 'string' || !CATALOG_NAMES.has(catalog)) {
    throw new Error('The catalog name is invalid.')
  }
  return {
    catalog,
    ...(typeof payload.search === 'string' ? { search: payload.search } : {}),
    ...(Number.isInteger(payload.limit) ? { limit: payload.limit } : {}),
    ...(Number.isInteger(payload.offset) ? { offset: payload.offset } : {}),
    ...(payload.include_archived === undefined ? {} : { include_archived: payload.include_archived === true }),
  }
}

function validateLookupSavePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The lookup CSV save request is invalid.')
  }
  const operation = payload.operation
  if (!['write', 'update', 'delete'].includes(operation)) {
    throw new Error('The lookup CSV save operation is invalid.')
  }
  if (typeof payload.name !== 'string' || payload.name.trim() === '' || payload.name.length > 255) {
    throw new Error('The lookup CSV name is invalid.')
  }
  if (operation !== 'delete') {
    if (typeof payload.content !== 'string') throw new Error('The lookup CSV content is invalid.')
    if (Buffer.byteLength(payload.content, 'utf8') > HARD_LOOKUP_BYTES) {
      throw new Error('The lookup CSV content is too large.')
    }
  }
  if (operation !== 'write' && (typeof payload.expected_fingerprint !== 'string' || payload.expected_fingerprint.trim() === '')) {
    throw new Error('The lookup CSV fingerprint is invalid.')
  }
  if (payload.expected_fingerprint !== undefined && payload.expected_fingerprint !== null && typeof payload.expected_fingerprint !== 'string') {
    throw new Error('The lookup CSV fingerprint is invalid.')
  }
  return {
    operation,
    name: payload.name,
    ...(operation === 'delete' ? {} : { content: payload.content }),
    ...(payload.expected_fingerprint === undefined ? {} : { expected_fingerprint: payload.expected_fingerprint }),
  }
}

function validateAlertEmailRulePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The alert email rule is invalid.')
  }
  if (payload.id !== undefined && (typeof payload.id !== 'string' || payload.id.trim() === '')) {
    throw new Error('The alert email rule ID is invalid.')
  }
  if (typeof payload.name !== 'string' || payload.name.trim() === '' || payload.name.length > 160) {
    throw new Error('The alert email rule name is invalid.')
  }
  for (const key of ['customer_id', 'ruleset_id']) {
    if (payload[key] !== undefined && payload[key] !== null && (typeof payload[key] !== 'string' || payload[key].trim() === '')) {
      throw new Error(`The alert email ${key} is invalid.`)
    }
  }
  if (payload.severities !== undefined && (!Array.isArray(payload.severities) || payload.severities.length === 0 || payload.severities.length > 5 || payload.severities.some(value => !['info', 'low', 'medium', 'high', 'critical'].includes(String(value).toLowerCase())))) {
    throw new Error('The alert email severities are invalid.')
  }
  if (payload.enabled !== undefined && typeof payload.enabled !== 'boolean') {
    throw new Error('The alert email enabled flag is invalid.')
  }
  return {
    ...(payload.id === undefined ? {} : { id: payload.id.trim() }),
    name: payload.name.trim(),
    ...(payload.customer_id === undefined ? {} : { customer_id: payload.customer_id }),
    ...(payload.ruleset_id === undefined ? {} : { ruleset_id: payload.ruleset_id }),
    ...(payload.severities === undefined ? {} : { severities: payload.severities.map(value => String(value).toLowerCase()) }),
    ...(payload.enabled === undefined ? {} : { enabled: payload.enabled }),
    ...(payload.routing === undefined ? {} : { routing: payload.routing }),
  }
}

function validateCustomerEmailConfigPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The customer email configuration is invalid.')
  }
  if (typeof payload.customer_id !== 'string' || payload.customer_id.trim() === '') {
    throw new Error('The customer ID is invalid.')
  }
  const config = payload.email_config
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('The customer email configuration is invalid.')
  }
  const lists = {}
  for (const key of ['recipients', 'cc', 'bcc']) {
    const value = config[key] ?? []
    if (!Array.isArray(value) || value.length > 50 || value.some(item => typeof item !== 'string' || item.length > 320 || !/^[^\s@]+@[^\s@]+$/u.test(item))) {
      throw new Error(`The customer ${key} list is invalid.`)
    }
    lists[key] = [...new Set(value.map(item => item.trim()))]
  }
  if (lists.recipients.length === 0) throw new Error('The customer recipients list must not be empty.')
  return { customer_id: payload.customer_id.trim(), email_config: { ...lists, language: config.language || 'EN', brand: config.brand || 'CPC' } }
}

async function handleEndpoint(endpoint, payload, signal, ctx, sessionPolicies) {
  switch (endpoint) {
    case 'get-action-catalog': requireUser(ctx); return ok({ actions: ACTION_CATALOG })
    case 'get-action-policy': {
      requireUser(ctx)
      const sessionId = payload?.session_id ?? payload?.sessionId
      resolveOwnedSession(ctx, sessionId)
      return ok(policyValue(ctx, sessionPolicies, String(sessionId)))
    }
    case 'set-session-action-policy': {
      requireUser(ctx)
      const sessionId = payload?.session_id ?? payload?.sessionId
      resolveOwnedSession(ctx, sessionId)
      const actions = actionSet(payload?.auto_approve_actions ?? payload?.autoApproveActions, { strict: true })
      sessionPolicies.set(String(sessionId), actions)
      return ok(policyValue(ctx, sessionPolicies, String(sessionId)))
    }
    case 'reset-session-action-policy': {
      requireUser(ctx)
      const sessionId = payload?.session_id ?? payload?.sessionId
      resolveOwnedSession(ctx, sessionId)
      sessionPolicies.delete(String(sessionId))
      return ok(policyValue(ctx, sessionPolicies, String(sessionId)))
    }
    case 'get-settings': requireAdmin(ctx); return ok(await runAdmin('get-settings'))
    case 'get-alert-email-settings': requireAdmin(ctx); return ok(await runAdmin('get-alert-email-settings'))
    case 'update-settings': requireAdmin(ctx); return badRequest('Service configuration is managed by the server environment.')
    case 'delete-setting': requireAdmin(ctx); return badRequest('Service configuration is managed by the server environment.')
    case 'save-alert-email-rule': {
      requireAdmin(ctx)
      let request
      try {
        request = validateAlertEmailRulePayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The alert email rule is invalid.')
      }
      return ok(await runAdmin('save-alert-email-rule', undefined, request, signal))
    }
    case 'save-customer-email-config': {
      requireAdmin(ctx)
      let request
      try {
        request = validateCustomerEmailConfigPayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The customer email configuration is invalid.')
      }
      return ok(await runAdmin('save-customer-email-config', undefined, request, signal))
    }
    case 'list-accounts': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'add-account': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'update-account': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'delete-account': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'test-account': throw new Error('Stored Zimbra accounts are no longer supported; log in with Zimbra.')
    case 'send-email': {
      const session = requireUser(ctx)
      return ok(await runAuthCommand('send-email', { ...payload, session_id: session.id }))
    }
    case 'save-detection': {
      const session = requireUser(ctx)
      let request
      try {
        request = validateDetectionSavePayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The detection save request is invalid.')
      }
      return ok(await runAuthCommand('save-detection', { ...request, session_id: session.id }))
    }
    case 'catalog-list': {
      const session = requireUser(ctx)
      return ok(await runAuthCommand('catalog-list', { ...validateCatalogNamePayload(payload), session_id: session.id }))
    }
    case 'catalog-get':
    case 'catalog-history': {
      const session = requireUser(ctx)
      if (typeof payload?.record_id !== 'string' || payload.record_id.trim() === '') {
        return badRequest('The catalog record ID is invalid.')
      }
      const command = endpoint === 'catalog-get' ? 'catalog-get' : 'catalog-history'
      return ok(await runAuthCommand(command, {
        catalog: validateCatalogNamePayload(payload).catalog,
        record_id: payload.record_id,
        session_id: session.id,
      }))
    }
    case 'catalog-publications': {
      const session = requireUser(ctx)
      return ok(await runAuthCommand('catalog-publications', { ...validateCatalogNamePayload(payload), session_id: session.id }))
    }
    case 'catalog-preview-publish': {
      const session = requireUser(ctx)
      return ok(await runAuthCommand('catalog-preview-publish', { ...validateCatalogNamePayload(payload), session_id: session.id }))
    }
    case 'save-catalog-record': {
      const session = requireUser(ctx)
      let request
      try {
        request = validateCatalogSavePayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The catalog save request is invalid.')
      }
      return ok(await runAuthCommand('save-catalog-record', { ...request, session_id: session.id }))
    }
    case 'archive-catalog-record': {
      const session = requireUser(ctx)
      let request
      try {
        request = validateCatalogArchivePayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The catalog archive request is invalid.')
      }
      return ok(await runAuthCommand('archive-catalog-record', { ...request, session_id: session.id }))
    }
    case 'publish-catalog': {
      const session = requireAdmin(ctx)
      return ok(await runAuthCommand('publish-catalog', {
        ...validateCatalogNamePayload(payload),
        session_id: session.id,
      }))
    }
    case 'rollback-publication': {
      const session = requireAdmin(ctx)
      if (typeof payload?.publication_id !== 'string' || payload.publication_id.trim() === '') {
        return badRequest('The publication ID is invalid.')
      }
      return ok(await runAuthCommand('rollback-publication', {
        publication_id: payload.publication_id,
        session_id: session.id,
      }))
    }
    case 'save-lookup': {
      const session = requireUser(ctx)
      let request
      try {
        request = validateLookupSavePayload(payload)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'The lookup CSV save request is invalid.')
      }
      return ok(await runAuthCommand('save-lookup', { ...request, session_id: session.id }))
    }
    case 'list-signatures': {
      const session = requireUser(ctx)
      return ok(await runAuthCommand('list-signatures', { session_id: session.id }))
    }
    case 'test-splunk': requireAdmin(ctx); return ok(await runAdmin('test-splunk'))
    case 'test-subscription-server': requireAdmin(ctx); return ok(await runAdmin('test-subscription-server'))
    case 'convert-attachment': {
      requireAdmin(ctx)
      const request = validateAttachmentPayload(payload)
      return ok(await runAdmin('convert-attachment', undefined, request, signal))
    }
    case 'migrate': requireAdmin(ctx); return ok(await runAdmin('migrate'))
    default: return badRequest(`Unknown endpoint: ${endpoint}`)
  }
}

export function apply(ctx) {
  const sessionPolicies = new Map()
  if (typeof ctx.effect === 'function' && typeof ctx.webServer?.register === 'function') {
    ctx.effect(() => {
      const admin = ctx.webServer.register({
        kind: 'exact',
        path: '/admin',
        handler: (request, response) => serveAdminPage(request, response, ctx.webServer),
      })
      const adminTrailing = ctx.webServer.register({
        kind: 'exact',
        path: '/admin/',
        handler: (request, response) => serveAdminPage(request, response, ctx.webServer),
      })
      // The catalog management page reuses the admin shell; the RPC channel
      // enforces authentication and (for publishing) admin rights per call.
      const catalogs = ctx.webServer.register({
        kind: 'exact',
        path: '/catalogs',
        handler: (request, response) => serveAdminPage(request, response, ctx.webServer),
      })
      const catalogsTrailing = ctx.webServer.register({
        kind: 'exact',
        path: '/catalogs/',
        handler: (request, response) => serveAdminPage(request, response, ctx.webServer),
      })
      const alertEmailPage = ctx.webServer.register({
        kind: 'exact',
        path: '/admin/alert-email',
        handler: (request, response) => serveAlertEmailPage(request, response, ctx),
      })
      const alertEmailPageTrailing = ctx.webServer.register({
        kind: 'exact',
        path: '/admin/alert-email/',
        handler: (request, response) => serveAlertEmailPage(request, response, ctx),
      })
      const alertEmailSettings = ctx.webServer.register({
        kind: 'exact',
        path: '/admin/alert-email/settings',
        handler: (request, response) => serveAlertEmailSettings(request, response, ctx),
      })
      const alertEmailPreview = ctx.webServer.register({
        kind: 'exact', path: '/admin/alert-email/preview',
        handler: (request,response) => saveAlertEmailAdminResource(request,response,ctx,'preview-alert-email',value => value),
      })
      const alertEmailRule = ctx.webServer.register({
        kind: 'exact',
        path: '/admin/alert-email/rule',
        handler: (request, response) => saveAlertEmailAdminResource(
          request,
          response,
          ctx,
          'save-alert-email-rule',
          validateAlertEmailRulePayload,
        ),
      })
      const alertEmailCustomer = ctx.webServer.register({
        kind: 'exact',
        path: '/admin/alert-email/customer',
        handler: (request, response) => saveAlertEmailAdminResource(
          request,
          response,
          ctx,
          'save-customer-email-config',
          validateCustomerEmailConfigPayload,
        ),
      })
      return () => {
        admin?.()
        adminTrailing?.()
        catalogs?.()
        catalogsTrailing?.()
        alertEmailPage?.()
        alertEmailPageTrailing?.()
        alertEmailSettings?.()
        alertEmailPreview?.()
        alertEmailRule?.()
        alertEmailCustomer?.()
      }
    }, 'soc-agent-host: admin web surface')
  }
  installInvestigationProjection(ctx)
  ctx.on('agent/created', ({ agent }) => {
    if (!ctx.agents.roots().includes(agent)) return
    try { agent.ctx.tools.restrict({ allow: [...DOMAIN_TOOLS, ...CONTROL_TOOLS] }) } catch { /* scheduler tools register asynchronously; pre-execute enforces */ }
  })
  ctx.on('tools/pre-execute', (exec, next) => {
    if (!DOMAIN_TOOLS.has(exec.name) && !CONTROL_TOOLS.has(exec.name)) {
      return Promise.resolve({ kind: 'deny', reason: 'This harness exposes only approved Splunk, Zimbra, subscription, scheduling, and catalog tools.' })
    }
    if (APPROVAL_TOOLS.has(exec.name)) {
      const alwaysAsk = ALWAYS_ASK_ACTION_TOOLS.includes(exec.name)
      const agent = exec?.agent
      const sessionId = sessionIdOf(agent)
      const interactive = agent !== undefined && rootsOf(ctx).includes(agent)
      if (!alwaysAsk && interactive && sessionId !== undefined) {
        const autoApproved = sessionPolicies.get(sessionId) ?? savedAutoApproveActions(ctx)
        if (autoApproved.has(exec.name)) return next()
      }
      return Promise.resolve({
        kind: 'ask',
        reason: alwaysAsk
          ? DETECTION_ACTION_TOOLS.includes(exec.name)
            ? detectionApprovalReason(exec)
            : SPLUNK_LOOKUP_ACTION_TOOLS.includes(exec.name)
              ? 'This Splunk lookup CSV change requires approval before it can run.'
              : catalogApprovalReason(exec)
          : 'This action changes a SOC system, sends email, or changes a persistent schedule.',
      })
    }
    return next()
  }, { global: true })
  ctx.on('session/disposed', (session) => sessionPolicies.delete(String(session.id)))
  ctx.connection.rpc.handle(
    CHANNEL,
    async (endpoint, payload, signal) => {
      try {
        return await handleEndpoint(endpoint, payload ?? {}, signal, ctx, sessionPolicies)
      } catch (error) {
        if (error instanceof Error && error.message === 'admin authentication required') {
          return {
            ok: false,
            error: {
              code: 'admin-authentication-required',
              message: 'administrator authentication required',
              details: {},
            },
          }
        }
        if (error instanceof Error && error.message === 'authentication required') {
          return {
            ok: false,
            error: {
              code: 'authentication-required',
              message: 'authentication required',
              details: {},
            },
          }
        }
        if (endpoint === 'convert-attachment') {
          const message = error instanceof Error ? error.message : 'attachment_conversion_failed'
          const [code] = message.split(': ')
          const stableCodes = new Set(['attachment_invalid_request', 'attachment_invalid_filename', 'attachment_invalid_mime', 'attachment_too_large', 'attachment_invalid_limits', 'attachment_conversion_cancelled', 'attachment_unsupported', 'attachment_converter_unavailable', 'attachment_malformed', 'attachment_encrypted', 'attachment_too_complex', 'attachment_conversion_failed'])
          const reason = stableCodes.has(code) ? code : 'attachment_conversion_failed'
          return {
            ok: false,
            error: {
              code: 'attachment-error',
              message: 'The attachment conversion failed.',
              details: { reason },
            },
          }
        }
        if (endpoint === 'test-splunk' || endpoint === 'test-subscription-server') {
          const command = endpoint
          const prefix = command === 'test-splunk'
            ? 'Splunk connection test failed:'
            : 'Subscription server connection test failed:'
          const message = error instanceof Error ? error.message.trim() : ''
          if (message.startsWith(prefix)) return internalError(message)
          return internalError(`${prefix} ${message || 'The test process did not return a diagnostic. Check the server .env configuration and server logs.'}`)
        }
        if (endpoint === 'save-detection') {
          const code = typeof error?.code === 'string' ? error.code : 'internal'
          const message = code === 'internal'
            ? 'The detection could not be saved.'
            : error instanceof Error ? error.message : 'The detection could not be saved.'
          const details = error?.details && typeof error.details === 'object' ? error.details : {}
          return { ok: false, error: { code, message, details } }
        }
        if (endpoint === 'save-lookup') {
          const code = typeof error?.code === 'string' ? error.code : 'internal'
          const message = code === 'internal'
            ? 'The lookup CSV could not be saved.'
            : error instanceof Error ? error.message : 'The lookup CSV could not be saved.'
          const details = error?.details && typeof error.details === 'object' ? error.details : {}
          return { ok: false, error: { code, message, details } }
        }
        if (CATALOG_ENDPOINTS.has(endpoint)) {
          const code = typeof error?.code === 'string' ? error.code : 'internal'
          const message = code === 'internal'
            ? 'The catalog operation failed.'
            : error instanceof Error ? error.message : 'The catalog operation failed.'
          const details = error?.details && typeof error.details === 'object' ? error.details : {}
          return { ok: false, error: { code, message, details } }
        }
        if (endpoint === 'get-action-policy' || endpoint === 'set-session-action-policy' || endpoint === 'reset-session-action-policy') {
          const sessionId = payload?.session_id ?? payload?.sessionId
          return policyError(error, sessionId)
        }
        return internalError('The requested operation failed.')
      }
    },
    { authority: 'trusted-host' },
  )
}
