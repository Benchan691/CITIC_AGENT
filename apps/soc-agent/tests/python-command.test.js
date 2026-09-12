import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { runPythonCommand } from '../python-command.js'

test('one-shot Python helpers preserve payloads, strip admin secrets, and settle failures and cancellation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'soc-python-command-'))
  const previous = process.env
  process.env = { ...previous, PATH: `${directory}:${previous.PATH}`, DSH_SOC_AGENT_SERVER: directory, SOC_ADMIN_EMAIL: 'admin@example.test', SOC_ADMIN_PASSWORD: 'secret' }
  try {
    await writeFile(join(directory, 'uv'), `#!/usr/bin/env node
let input = ''
process.stdin.on('data', chunk => input += chunk)
process.stdin.on('end', () => {
  const command = process.argv[6]
  if (command === 'hang') { setInterval(() => {}, 1000); return }
  if (command === 'fail') { process.stderr.write('diagnostic'); process.exitCode = 1; return }
  if (command === 'bad-json') { process.stdout.write('invalid'); return }
  process.stdout.write(JSON.stringify({ args: process.argv.slice(2), payload: JSON.parse(input), admin: process.env.SOC_ADMIN_EMAIL ?? null, password: process.env.SOC_ADMIN_PASSWORD ?? null }))
})
`, { mode: 0o755 })
    const run = (command, overrides = {}) => runPythonCommand({
      module: 'unified_mcp_server.fixture', command, timeoutMs: 5000,
      payload: { value: 'literal `value` $(unchanged)\nnext line' },
      mapError: (kind, stderr) => Object.assign(new Error(kind), { code: kind, diagnostic: stderr }),
      ...overrides,
    })
    const result = await run('ok', { arg: 'one argument' })
    assert.deepEqual(result.args, ['run', 'python', '-m', 'unified_mcp_server.fixture', 'ok', 'one argument'])
    assert.equal(result.payload.value, 'literal `value` $(unchanged)\nnext line')
    assert.equal(result.admin, null)
    assert.equal(result.password, null)
    await assert.rejects(run('fail'), error => error.code === 'exit' && error.diagnostic === 'diagnostic')
    await assert.rejects(run('bad-json'), { code: 'parse' })
    await assert.rejects(run('hang', { timeoutMs: 100 }), { code: 'timeout' })
    const controller = new AbortController()
    const pending = run('hang', { signal: controller.signal })
    controller.abort()
    await assert.rejects(pending, { code: 'abort' })
    await assert.rejects(run('ok', { signal: AbortSignal.abort() }), { code: 'abort' })
  } finally {
    process.env = previous
    await rm(directory, { recursive: true, force: true })
  }
})
