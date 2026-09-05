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

export function installInvestigationProjection(ctx) {
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    if (result.isError || decision.kind !== 'accept' || 'value' in decision || 'content' in decision) return decision
    const content = projectInvestigationResult(exec.name, result.content)
    return content ? { ...decision, content } : decision
  }, { global: true })
}
