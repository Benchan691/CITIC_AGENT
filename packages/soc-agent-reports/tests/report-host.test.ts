import assert from 'node:assert/strict'
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { downloadReportArtifact, reportSettingsEndpoint, type ReportAuth, type ReportCommand } from '../src/host.ts'
import { PDF_MIME } from '../src/report-contract.ts'

const id = 'aabbccddeeff00112233445566778899'
const auth: ReportAuth = { requireSession: () => ({ id: 'trusted-app-session', userId: 'trusted-user' }) }
const anonymous: ReportAuth = { requireSession: () => { throw new Error('authentication required') } }

test('settings use authenticated identity and never forward browser session credentials', async () => {
  const calls: unknown[] = []
  const command: ReportCommand = async (name, payload) => { calls.push({ name, payload }); return { customers: [], account: 'analyst@example.com' } }
  assert.equal((await reportSettingsEndpoint(auth, command, 'save-customer-settings', { session_id: 'spoof', user_id: 'other', customers: [] })).ok, true)
  assert.deepEqual(calls, [{ name: 'report-settings-save', payload: { session_id: 'trusted-app-session', customers: [] } }])
  assert.equal((await reportSettingsEndpoint(anonymous, command, 'get-customer-settings', {})).ok, false)
  assert.equal(calls.length, 1)
  assert.equal((await reportSettingsEndpoint(auth, command, 'save-customer-settings', {})).ok, false)
})

async function serve(authValue: ReportAuth, command: ReportCommand, callback: (origin: string) => Promise<void>) {
  const server = createServer((request, response) => { void downloadReportArtifact(request, response, authValue, command) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  try { await callback(`http://127.0.0.1:${address.port}`) }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}

test('authenticated download authorizes exact user/session lookup and streams safe headers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'soc-report-'))
  const filename = '客户 report.pdf'
  const path = join(directory, filename)
  await writeFile(path, '%PDF-1.7\nfixture')
  const calls: unknown[] = []
  const command: ReportCommand = async (name, payload) => {
    calls.push({ name, payload })
    return { id, path, filename, mime_type: PDF_MIME, size_bytes: 16, session_id: 'chat-1' }
  }
  try {
    await serve(auth, command, async origin => {
      const response = await fetch(`${origin}/soc-agent-reports/download/${id}?session_id=chat-1`)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), PDF_MIME)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
      assert.match(response.headers.get('content-disposition')!, /^attachment;/u)
      assert.match(response.headers.get('content-disposition')!, /filename\*=UTF-8''/u)
      assert.equal(await response.text(), '%PDF-1.7\nfixture')
      assert.deepEqual(calls[0], { name: 'report-artifact-get', payload: { session_id: 'trusted-app-session', artifact_id: id, investigation_id: 'chat-1' } })
      const head = await fetch(`${origin}/soc-agent-reports/download/${id}?session_id=chat-1`, { method: 'HEAD' })
      assert.equal(head.status, 200)
      assert.equal(await head.text(), '')
    })
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('download refuses anonymous access, arbitrary paths, unsupported type, stale metadata, and symlinks', async () => {
  let calls = 0
  await serve(anonymous, async () => { calls += 1 }, async origin => {
    assert.equal((await fetch(`${origin}/soc-agent-reports/download/${id}?session_id=chat-1`)).status, 401)
    assert.equal(calls, 0)
  })
  await serve(auth, async () => { calls += 1; throw new Error('artifact not owned') }, async origin => {
    for (const suffix of ['../secret?session_id=chat-1', `${id}?session_id=chat-1&path=/secret`, `${id}`]) {
      assert.equal((await fetch(`${origin}/soc-agent-reports/download/${suffix}`)).status, 404)
    }
    assert.equal(calls, 0)
    assert.equal((await fetch(`${origin}/soc-agent-reports/download/${id}?session_id=chat-1`)).status, 404)
  })
  const directory = await mkdtemp(join(tmpdir(), 'soc-report-'))
  try {
    const filename = 'report.pdf'
    const path = join(directory, filename)
    const real = join(directory, 'real.pdf')
    await writeFile(real, '%PDF')
    await symlink(real, path)
    const artifact = { id, path, filename, mime_type: PDF_MIME, size_bytes: 4, session_id: 'chat-1' }
    for (const changes of [{}, { session_id: 'chat-other' }, { mime_type: 'text/html' }, { size_bytes: 10 }]) {
      await serve(auth, async () => ({ ...artifact, ...changes }), async origin => {
        assert.equal((await fetch(`${origin}/soc-agent-reports/download/${id}?session_id=chat-1`)).status, 404)
      })
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})
