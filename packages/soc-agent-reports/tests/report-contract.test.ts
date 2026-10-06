import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyCustomerProfile, PDF_MIME, XLSX_MIME, reportPanelResult, validReportArtifact, validateCustomerProfiles, type ReportArtifact } from '../src/report-contract.ts'

const pdf: ReportArtifact = {
  id: 'aabbccddeeff00112233445566778899', filename: 'Customer report.pdf', mime_type: PDF_MIME, size_bytes: 100,
  download_url: '/soc-agent-reports/download/aabbccddeeff00112233445566778899?session_id=chat-1',
}
const xlsx: ReportArtifact = {
  id: '00112233-4455-6677-8899-aabbccddeeff', filename: 'Customer report.xlsx', mime_type: XLSX_MIME, size_bytes: 200,
  download_url: '/soc-agent-reports/download/00112233-4455-6677-8899-aabbccddeeff?session_id=chat-1',
}
const block = (value: unknown, isError = false) => ({ kind: 'tool-result', isError, content: [{ type: 'text', text: JSON.stringify(value) }] })

test('report panel shows progress then only a complete successful report pair', () => {
  assert.deepEqual(reportPanelResult({ name: 'generate_customer_report' }), { kind: 'working' })
  assert.deepEqual(reportPanelResult(block({ ok: true, data: { artifacts: [pdf, xlsx] } })), { kind: 'success', artifacts: [pdf, xlsx] })
  assert.equal(reportPanelResult(block({ ok: true, data: { artifacts: [pdf] } })).kind, 'error')
  assert.equal(reportPanelResult(block({ ok: true, data: { artifacts: [pdf, pdf] } })).kind, 'error')
  assert.equal(reportPanelResult(block({ ok: true, data: { artifacts: [pdf, xlsx] } }, true)).kind, 'error')
})

test('report panel preserves actionable MCP failures and refuses malformed output', () => {
  assert.deepEqual(reportPanelResult(block({ ok: false, error: { code: 'report_no_emails', message: 'No report emails matched September.' } })), { kind: 'error', message: 'No report emails matched September.' })
  assert.equal(reportPanelResult({ kind: 'tool-result', content: [{ type: 'text', text: 'not JSON' }] }).kind, 'error')
})

test('download contracts reject foreign URLs, path injection, wrong type, and missing session', () => {
  assert.ok(validReportArtifact(pdf))
  assert.ok(validReportArtifact(xlsx))
  for (const changes of [
    { download_url: `https://evil.example${pdf.download_url}` },
    { download_url: `//evil.example${pdf.download_url}` },
    { download_url: pdf.download_url + '&path=/secret' },
    { download_url: pdf.download_url.replace('chat-1', '../other') },
    { download_url: pdf.download_url + '#fragment' },
    { download_url: pdf.download_url.split('?')[0] },
    { filename: '../report.pdf' }, { filename: 'report.xlsx' }, { mime_type: 'text/html' }, { size_bytes: 0 },
  ]) assert.equal(validReportArtifact({ ...pdf, ...changes }), false, JSON.stringify(changes))
})

test('configuration starts without hardcoded customer/account/folders and explains incomplete profiles', () => {
  const profile = emptyCustomerProfile('analyst@example.com')
  assert.equal(profile.customer_id, '')
  assert.equal(profile.email.scope, '')
  assert.equal(profile.news.scope, '')
  assert.match(validateCustomerProfiles([profile], 'analyst@example.com')!, /customer ID/i)
  Object.assign(profile, { customer_id: 'c1', display_name: 'Customer', report_id: 'R1', company_name: 'Company' })
  profile.email.scope = '/Customer alerts'
  profile.report.template = { owner: 'owner', app: 'soc', view: 'dashboard' }
  profile.news.scope = '/News'
  assert.equal(validateCustomerProfiles([profile], 'analyst@example.com'), null)
  profile.email.account = 'another@example.com'
  assert.match(validateCustomerProfiles([profile], 'analyst@example.com')!, /signed-in account/i)
})
