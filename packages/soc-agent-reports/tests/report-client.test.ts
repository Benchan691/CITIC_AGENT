import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'
import test from 'node:test'
import { createElement } from 'react'
import { PDF_MIME, XLSX_MIME, REPORT_TOOL_NAME } from '../src/report-contract.ts'

test('workspace plugin exposes customer settings directly and registers the report panel', async () => {
  const cssHook = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export default {}' } : next(url, context) } })
  try {
    const { apply } = await import('../src/client/index.ts')
    const entries: { name: string; id?: string; key?: string; label?: () => string }[] = []
    const context = {
      get: (service: string) => service === 'socClient' ? { surface: 'workspace' } : {},
      slots: {
        inject: (_name: string, callback: () => unknown) => callback(),
        register: (options: { name: string; id?: string; key?: string }, _component: unknown) => { entries.push(options) },
      },
    }
    apply(context as never)
    const settings = entries.find(entry => entry.name === 'settings.section')
    assert.equal(settings?.id, 'customer-reports')
    assert.equal(settings?.label?.(), 'Customer reports')
    assert.equal(entries.find(entry => entry.name === 'tool.call.toolview')?.key, REPORT_TOOL_NAME)
    assert.equal(entries.some(entry => entry.name === 'settings.plugin.item'), false)
    entries.length = 0
    apply({ ...context, get: () => ({ surface: 'admin' }) } as never)
    assert.equal(entries.length, 0)
  } finally { cssHook.deregister() }
})

test('report panel renders direct downloadable PDF/Excel anchors and readable failures', async () => {
  const cssHook = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export default {}' } : next(url, context) } })
  try {
    const require = createRequire(import.meta.url)
    const { renderToStaticMarkup } = require('../../../vendor/deepseek-harness/packages/client/web/node_modules/react-dom/server')
    const { ReportArtifacts } = await import('../src/client/ReportArtifacts.tsx')
    const artifacts = [
      { id: 'aabbccddeeff00112233445566778899', filename: 'Report.pdf', mime_type: PDF_MIME, size_bytes: 100, download_url: '/soc-agent-reports/download/aabbccddeeff00112233445566778899?session_id=chat-1' },
      { id: '00112233445566778899aabbccddeeff', filename: 'Report.xlsx', mime_type: XLSX_MIME, size_bytes: 200, download_url: '/soc-agent-reports/download/00112233445566778899aabbccddeeff?session_id=chat-1' },
    ]
    const success = { kind: 'tool-result', content: [{ type: 'text', text: JSON.stringify({ ok: true, data: { artifacts } }) }] }
    const markup = renderToStaticMarkup(createElement(ReportArtifacts, { block: success } as never))
    assert.match(markup, /Download PDF/u)
    assert.match(markup, /Download Excel/u)
    assert.match(markup, /download="Report\.pdf"/u)
    assert.match(markup, /download="Report\.xlsx"/u)
    assert.match(markup, /href="\/soc-agent-reports\/download\/aabbcc/u)
    const failure = { kind: 'tool-result', content: [{ type: 'text', text: JSON.stringify({ ok: false, error: { message: 'Configure the email folder first.' } }) }] }
    const errorMarkup = renderToStaticMarkup(createElement(ReportArtifacts, { block: failure } as never))
    assert.match(errorMarkup, /role="alert"/u)
    assert.match(errorMarkup, /Configure the email folder first\./u)
    assert.doesNotMatch(errorMarkup, /download=/u)
    const working = renderToStaticMarkup(createElement(ReportArtifacts, { block: {} } as never))
    assert.match(working, /Preparing the Excel and PDF report/u)
  } finally { cssHook.deregister() }
})
