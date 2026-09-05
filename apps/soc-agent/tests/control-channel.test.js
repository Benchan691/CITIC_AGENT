import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

async function fixture(mode, script) {
  const directory = await mkdtemp(join(tmpdir(), 'soc-control-test-'))
  const log = join(directory, 'calls.jsonl')
  try {
    await writeFile(join(directory, 'uv'), `#!/usr/bin/env node
const fs = require('node:fs')
const readline = require('node:readline')
fs.appendFileSync(process.env.CONTROL_TEST_LOG, JSON.stringify({started: process.argv.slice(2)}) + '\\n')
if (!process.argv.includes('unified_mcp_server.control_server')) process.exit(9)
process.stdout.write('{"ready":true}\\n')
readline.createInterface({input:process.stdin}).on('line', line => {
  const request = JSON.parse(line)
  fs.appendFileSync(process.env.CONTROL_TEST_LOG, JSON.stringify({received: request.id}) + '\\n')
  if (process.env.CONTROL_TEST_MODE === 'lost') process.exit(1)
  setTimeout(() => process.stdout.write(JSON.stringify({id:request.id,ok:true,result:{confirmed:true}}) + '\\n'), 5)
})
`, { mode: 0o755 })
    const moduleUrl = new URL('../ownership.js', import.meta.url).href
    const { stdout } = await exec(process.execPath, ['--input-type=module', '-e', `
      import { runAuthCommand, closeAuthControlChannel } from ${JSON.stringify(moduleUrl)}
      try { ${script} } finally { await closeAuthControlChannel() }
    `], {
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, CONTROL_TEST_LOG: log, CONTROL_TEST_MODE: mode, SOC_CONTROL_CHANNEL: 'auto' },
      timeout: 10_000,
    })
    return { result: JSON.parse(stdout), calls: (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse) }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('concurrent control requests share a single startup', async () => {
  const { result, calls } = await fixture('ok', `console.log(JSON.stringify(await Promise.all([runAuthCommand('fixture-read', {}), runAuthCommand('fixture-read', {})])))`)
  assert.equal(result.length, 2)
  assert.ok(result.every(value => value.confirmed))
  assert.equal(calls.filter(value => value.started).length, 1)
  assert.equal(calls.filter(value => value.received).length, 2)
})

test('a lost response after transmission never invokes CLI fallback', async () => {
  const { result, calls } = await fixture('lost', `try { await runAuthCommand('fixture-write', {}) } catch (error) { console.log(JSON.stringify({code:error.code})) }`)
  assert.equal(result.code, 'operation_outcome_unknown')
  assert.equal(calls.filter(value => value.started).length, 1)
  assert.equal(calls.filter(value => value.received).length, 1)
})
