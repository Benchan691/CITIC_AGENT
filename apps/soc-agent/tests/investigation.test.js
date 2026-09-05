import assert from 'node:assert/strict'
import test from 'node:test'
import { projectInvestigationResult } from '../investigation.js'
import { installInvestigationProjection } from '../investigation.js'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '../../../vendor/deepseek-harness/vendor/cordis/lib/index.js'
import Loader from '../../../vendor/deepseek-harness/vendor/loader/lib/index.js'
import Include from '../../../vendor/deepseek-harness/vendor/include/lib/index.js'
import SystemPrompt from '../../../vendor/deepseek-harness/packages/core/system-prompt/lib/index.js'
import ToolRuntime from '../../../vendor/deepseek-harness/packages/core/tools/lib/index.js'

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
  assert.equal(projectInvestigationResult('mcp__soc_agent__splunk_write_detection', content), undefined)
})

test('small aggregate tables and explicit zero counts remain intact', () => {
  const rows = Array.from({ length: 20 }, (_, n) => ({ key: n, count: 0 }))
  const content = [{ type: 'text', text: JSON.stringify({ ok: true, data: { search: { result_count: 20 }, result: { type: 'table', rows }, evidence: { id: 'a' } } }) }]
  const projected = projectInvestigationResult('mcp__soc_agent__splunk_search', content)
  assert.deepEqual(JSON.parse(projected[0].text).data.result.rows, rows)
  assert.equal(projectInvestigationResult('mcp__soc_agent__splunk_search', content, 1), undefined)
})

test('Loader tool execution projects model output while retaining the canonical value and disposes cleanly', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'soc-projection-composition-'))
  const ctx = new Context()
  let projectionContext
  try {
    const original = { ok: true, data: { search: { result_count: 50, fetched_count: 50 }, result: { type: 'events', rows: Array.from({ length: 50 }, (_, id) => ({ id })) }, evidence: { id: 'retained-fixture' } } }
    const configPath = join(directory, 'cordis.yml')
    await writeFile(configPath, '- name: system-prompt\n- name: tools\n- name: projection\n- name: fixture\n')
    ctx.baseUrl = pathToFileURL(directory).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier) {
        if (specifier === 'system-prompt') return SystemPrompt
        if (specifier === 'tools') return ToolRuntime
        if (specifier === 'projection') return { name: 'projection', apply(context) { projectionContext = context; installInvestigationProjection(context) } }
        if (specifier === 'fixture') return {
          name: 'fixture', inject: ['tools'], apply(context) {
            context.tools.register({
              name: 'mcp__soc_agent__splunk_search', description: 'Offline search fixture.', parameters: { type: 'object', properties: {} },
              output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
              execute: async () => original,
            })
          },
        }
        throw new Error(`Unexpected plugin: ${specifier}`)
      },
    }
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await ctx.loader.await()
    const execute = callId => ctx.tools.execute({ name: 'mcp__soc_agent__splunk_search', callId, arguments: {}, signal: new AbortController().signal })
    const projected = await execute('first')
    assert.equal(projected.isError, false)
    assert.equal(projected.value.data.result.rows.length, 50)
    assert.equal(JSON.parse(projected.content[0].text).data.result.rows.length, 8)
    await projectionContext.fiber.dispose()
    const restored = await execute('second')
    assert.equal(JSON.parse(restored.content[0].text).data.result.rows.length, 50)
  } finally {
    await ctx.fiber.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
