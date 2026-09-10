// Keep the model's search preview small and valid JSON. Full fetched evidence
// remains in the backend snapshot; editor and write-result envelopes pass through.
export function projectInvestigationResult(name, content, maximumBytes = 7500) {
  if (name !== 'mcp__soc_agent__splunk_search' || content?.length !== 1 || content[0]?.type !== 'text') return undefined
  let envelope
  try { envelope = JSON.parse(content[0].text) } catch { return undefined }
  const data = envelope?.ok === true ? envelope.data : undefined
  if (!data?.evidence?.id || !Array.isArray(data?.result?.rows) || !data.search) return undefined
  const rows = data.result.rows
  const fetchedPreviewCount = rows.length
  const limit = data.result.type === 'events' ? 8 : rows.length
  data.result.rows = rows.slice(0, limit)
  const mark = () => {
    data.result.preview_only = true
    data.search.returned_count = data.result.rows.length
    data.search.mcp_context_truncated = true
    data.truncated = true
    data.evidence.read_tool = 'soc_evidence_read'
    data.evidence.preview_omitted_count = fetchedPreviewCount - data.result.rows.length
  }
  if (data.result.rows.length < fetchedPreviewCount) mark()
  let text = JSON.stringify(envelope)
  while (Buffer.byteLength(text) > maximumBytes && data.result.rows.length > 0) {
    data.result.rows.pop()
    mark()
    text = JSON.stringify(envelope)
  }
  // Never break metadata or editor JSON to force a preview into a tiny budget.
  if (Buffer.byteLength(text) > maximumBytes) return undefined
  return [{ type: 'text', text }]
}

const OFFICIAL_SPLUNK_PREFIX = 'mcp__splunk_official__splunk_'
const CARD = /\b(\d{4})[-\s]?(\d{4})[-\s]?(\d{4})[-\s]?(\d{3,6})\b/g
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g

function sanitizeSplunkText(text) {
  if (/^(0|false|no|off)$/i.test(process.env.SPLUNK_SANITIZE_OUTPUT ?? '')) return text
  return text
    .replace(CARD, (_match, _a, _b, _c, last) => `****-****-****-${last}`)
    .replace(SSN, '***-**-****')
}

function utf8Prefix(text, maximumBytes) {
  let used = 0
  let output = ''
  for (const character of text) {
    const bytes = Buffer.byteLength(character)
    if (used + bytes > maximumBytes) break
    output += character
    used += bytes
  }
  return output
}

// Official Splunk results bypass application query admission, but still cross
// the existing output boundary before entering model context.
export function projectOfficialSplunkResult(name, content, maximumBytes = 50_000) {
  if (!name.startsWith(OFFICIAL_SPLUNK_PREFIX) || !Array.isArray(content)) return undefined
  const text = sanitizeSplunkText(
    content
      .filter(block => block?.type === 'text' && typeof block.text === 'string')
      .map(block => block.text)
      .join('\n'),
  )
  if (!text) return undefined
  if (Buffer.byteLength(text) <= maximumBytes) return [{ type: 'text', text }]
  const marker = '\n[official Splunk MCP output truncated by the SOC response limit]'
  return [{
    type: 'text',
    text: `${utf8Prefix(text, Math.max(0, maximumBytes - Buffer.byteLength(marker)))}${marker}`,
  }]
}

export function installInvestigationProjection(ctx) {
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    if (result.isError || decision.kind !== 'accept' || 'value' in decision || 'content' in decision) return decision
    const content = projectInvestigationResult(exec.name, result.content)
      ?? projectOfficialSplunkResult(exec.name, result.content)
    return content ? { ...decision, content } : decision
  }, { global: true })
}
