// The SOC boundary supplies bytes, never a model-selected filesystem path.
// Keep the actual dsh-document converters in a killable, one-request process.
import { createRequire } from 'node:module'
import { accessSync } from 'node:fs'
import { dirname, join } from 'node:path'

const MAX_INPUT = 140_000_000
const MAX_TEXT = 2_000_000
const require = createRequire(import.meta.url)

async function main() {
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) {
    raw += chunk.toString('utf8')
    if (raw.length > MAX_INPUT) throw Object.assign(new Error(), { code: 'resourceLimit' })
  }
  const request = JSON.parse(raw)
  let api, version
  try {
    api = await import('@jiaoqsh/dsh-document')
    version = require('@jiaoqsh/dsh-document/package.json').version
    const entry = require.resolve('@jiaoqsh/dsh-document')
    accessSync(join(dirname(entry), 'pdf-worker.js'))
    accessSync(createRequire(entry).resolve('@firecrawl/pdf-inspector-wasm/pdf_inspector_wasm_bg.wasm'))
  } catch {
    throw Object.assign(new Error(), { code: 'unavailable' })
  }
  const { anydocConverter, pdfInspectorConverter, routeConverters, formatOf } = api
  if (request.check === true) return { available: true, name: 'dsh-document', version }
  const format = formatOf(request.filename)
  if (!format) throw Object.assign(new Error(), { code: 'unsupported' })
  const bytes = Buffer.from(request.data, 'base64')
  if (bytes.length > 100_000_000) throw Object.assign(new Error(), { code: 'resourceLimit' })
  const converter = routeConverters([pdfInspectorConverter({ profile: 'fidelity' }), anydocConverter()])(format)
  const result = await converter.convert({ bytes, format, signal: new AbortController().signal,
    ...(request.pages ? { pages: request.pages } : {}) })
  if (result.markdown.length > MAX_TEXT) throw Object.assign(new Error(), { code: 'resourceLimit' })
  const { pdf, markdown } = result
  return { markdown, format, converter: { name: 'dsh-document', version }, ...(pdf ? { pdf: {
    page_count: pdf.pageCount, kind: pdf.kind, pages: pdf.pages,
    pages_without_text: pdf.pagesNeedingOcr.filter(page => !pdf.pages || pdf.pages.includes(page)),
  } } : {}) }
}

try {
  process.stdout.write(JSON.stringify({ ok: true, value: await main() }))
} catch (error) {
  // Parser diagnostics may contain document contents or host paths.
  const known = new Set(['unavailable', 'unsupported', 'malformed', 'encrypted', 'resourceLimit', 'missingPart', 'empty', 'scanned', 'pageRange', 'aborted'])
  const code = error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'MODULE_NOT_FOUND'
    ? 'unavailable' : known.has(error?.code) ? error.code : 'malformed'
  process.stdout.write(JSON.stringify({ ok: false, error: { code } }))
  process.exitCode = 1
}
