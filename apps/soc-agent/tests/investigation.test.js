import assert from 'node:assert/strict'
import test from 'node:test'
import { projectInvestigationResult } from '../investigation.js'

test('search projection preserves counts and evidence while reducing complete event previews', () => {
  const original = { ok: true, data: {
    search: { result_count: 1200, fetched_count: 50, returned_count: 50, splunk_result_truncated: true },
    result: { type: 'events', rows: Array.from({ length: 50 }, (_, id) => ({ id, text: '界'.repeat(200) })) },
    evidence: { id: 'snapshot-1', checksum: 'checksum', result_count: 50 },
  } }
  const content = [{ type: 'text', text: JSON.stringify(original) }]
  const projected = projectInvestigationResult('mcp__soc_agent__splunk_search', content)
  assert.ok(Buffer.byteLength(projected[0].text) <= 7500)
  const result = JSON.parse(projected[0].text).data
  assert.ok(result.result.rows.length < 50)
  assert.equal(result.search.result_count, 1200)
  assert.equal(result.search.fetched_count, 50)
  assert.equal(result.search.returned_count, result.result.rows.length)
  assert.equal(result.search.mcp_context_truncated, true)
  assert.equal(result.evidence.id, 'snapshot-1')
  assert.equal(result.evidence.read_tool, 'soc_evidence_read')
  assert.equal(JSON.parse(content[0].text).data.result.rows.length, 50)
})
