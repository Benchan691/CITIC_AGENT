import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const bundleRoot = dirname(fileURLToPath(import.meta.url))

export function pythonEnvironment() {
  const environment = {
    ...process.env,
    MCP_SERVER_ROOT: process.env.MCP_SERVER_ROOT || process.env.MCP_SEVER_ROOT || dirname(dirname(bundleRoot)),
  }
  delete environment.SOC_ADMIN_EMAIL
  delete environment.SOC_ADMIN_PASSWORD
  return environment
}

// One-shot helpers only. Persistent delivery and retry decisions stay in ownership.js.
export function runPythonCommand({ module, command, arg, payload, timeoutMs, signal, mapError }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(mapError('abort')); return }
    const args = ['run', 'python', '-m', module, command]
    if (arg !== undefined && arg !== '') args.push(arg)
    const child = spawn('uv', args, {
      cwd: process.env.DSH_SOC_AGENT_SERVER || join(bundleRoot, 'server'),
      env: pythonEnvironment(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (error, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      if (error) { child.kill('SIGTERM'); reject(error) }
      else resolve(value)
    }
    const abort = () => finish(mapError('abort'))
    const timer = setTimeout(() => finish(mapError('timeout')), timeoutMs)
    timer.unref?.()
    signal?.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', () => finish(mapError('process')))
    child.stdin.on('error', () => finish(mapError('process')))
    child.on('close', code => {
      if (settled) return
      if (code !== 0) { finish(mapError('exit', stderr)); return }
      try { finish(null, stdout.trim() ? JSON.parse(stdout) : {}) }
      catch (error) { finish(mapError('parse', '', error)) }
    })
    child.stdin.end(payload === undefined ? undefined : JSON.stringify(payload))
  })
}
