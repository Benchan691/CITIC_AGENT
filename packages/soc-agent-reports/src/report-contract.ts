export const REPORT_CHANNEL = '/soc-agent-reports'
export const REPORT_TOOL_NAME = 'mcp__soc_agent__generate_customer_report'
export const REPORT_DOWNLOAD_PREFIX = `${REPORT_CHANNEL}/download/`
export const PDF_MIME = 'application/pdf'
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const ARTIFACT_ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/iu
export const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/u

export interface CustomerReportProfile {
  customer_id: string
  display_name: string
  report_id: string
  company_name: string
  email: { account: string; scope_type: 'folder' | 'label'; scope: string; include_subfolders: boolean }
  customer_senders: string[]
  report: { template: { owner: string; app: string; view: string }; output_stem: string; executive_summary_html?: string; security_analysis_html?: string }
  news: { scope_type: 'folder' | 'label'; scope: string; source_labels: string[]; source_terms: string[]; scan_limit: number }
  extensions: Record<string, unknown>
}

export interface CustomerReportSettings { account: string; customers: CustomerReportProfile[] }
export interface ReportArtifact { id: string; filename: string; mime_type: string; size_bytes: number; download_url: string }
export type ReportPanelResult = { kind: 'working' } | { kind: 'error'; message: string } | { kind: 'success'; artifacts: ReportArtifact[] }

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function nonempty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }

export function emptyCustomerProfile(account: string): CustomerReportProfile {
  return {
    customer_id: '', display_name: '', report_id: '', company_name: '',
    email: { account, scope_type: 'folder', scope: '', include_subfolders: false }, customer_senders: [],
    report: { template: { owner: '', app: '', view: '' }, output_stem: '' },
    news: { scope_type: 'folder', scope: '', source_labels: ['Source collection', '来源集合'], source_terms: ['hkcert'], scan_limit: 500 },
    extensions: {},
  }
}

/** Browser validation is explanatory; the backend remains authoritative. */
export function validateCustomerProfiles(customers: readonly CustomerReportProfile[], account: string): string | null {
  if (!nonempty(account)) return 'Sign in to configure customer reports.'
  const ids = new Set<string>()
  for (const [index, customer] of customers.entries()) {
    const label = customer.display_name || `Customer ${index + 1}`
    if (![customer.customer_id, customer.display_name, customer.report_id, customer.company_name].every(nonempty)) return `${label}: enter the customer ID, display name, report ID, and company name.`
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(customer.customer_id)) return `${label}: use letters, numbers, underscores, or hyphens in the customer ID.`
    if (ids.has(customer.customer_id)) return `${label}: each customer ID must be unique.`
    ids.add(customer.customer_id)
    if (customer.email.account.trim().toLowerCase() !== account.trim().toLowerCase()) return `${label}: the email account must match your signed-in account.`
    if (!nonempty(customer.email.scope)) return `${label}: enter the report email folder or label.`
    if (!['folder', 'label'].includes(customer.email.scope_type)) return `${label}: choose a folder or label.`
    if (![customer.report.template.owner, customer.report.template.app, customer.report.template.view].every(nonempty)) return `${label}: enter the Splunk dashboard owner, app, and view.`
    if (!nonempty(customer.news.scope)) return `${label}: enter the security news folder or label.`
    if (!['folder', 'label'].includes(customer.news.scope_type)) return `${label}: choose a news folder or label.`
    if (!Number.isInteger(customer.news.scan_limit) || customer.news.scan_limit < 1 || customer.news.scan_limit > 2000) return `${label}: the news scan limit must be between 1 and 2,000.`
    if (!record(customer.extensions)) return `${label}: additional settings must be a JSON object.`
  }
  return null
}

export function validArtifactType(filename: unknown, mime: unknown): boolean {
  if (typeof filename !== 'string' || !filename || filename.length > 255 || /[\u0000-\u001f\u007f/\\]/u.test(filename)) return false
  return (mime === PDF_MIME && /\.pdf$/iu.test(filename)) || (mime === XLSX_MIME && /\.xlsx$/iu.test(filename))
}

/** Admit only authenticated local report URLs, never URLs supplied by email. */
export function validReportArtifact(value: unknown): value is ReportArtifact {
  if (!record(value) || typeof value.id !== 'string' || !ARTIFACT_ID.test(value.id) || !validArtifactType(value.filename, value.mime_type)) return false
  if (!Number.isSafeInteger(value.size_bytes) || (value.size_bytes as number) <= 0) return false
  if (typeof value.download_url !== 'string' || !value.download_url.startsWith(`${REPORT_DOWNLOAD_PREFIX}${value.id}?`)) return false
  try {
    const url = new URL(value.download_url, 'http://dsh.internal')
    const session = url.searchParams.get('session_id')
    return url.origin === 'http://dsh.internal' && url.pathname === `${REPORT_DOWNLOAD_PREFIX}${value.id}` && !url.hash
      && session !== null && SESSION_ID.test(session) && [...url.searchParams.keys()].length === 1
  } catch { return false }
}

/** MCP text is an envelope; artifacts must form one complete PDF/Excel pair. */
export function reportPanelResult(block: unknown): ReportPanelResult {
  if (!record(block) || !('kind' in block) || !Array.isArray(block.content)) return { kind: 'working' }
  const text = block.content.filter(record).filter(item => item.type === 'text' && typeof item.text === 'string').map(item => item.text).join('')
  try {
    const start = text.indexOf('{')
    const envelope: unknown = JSON.parse(start < 0 ? text : text.slice(start))
    if (!record(envelope)) return { kind: 'error', message: 'The report tool returned an invalid result.' }
    if (envelope.ok === false) {
      const error = envelope.error
      return { kind: 'error', message: record(error) && nonempty(error.message) ? error.message : 'Report generation failed.' }
    }
    const data = envelope.data
    const artifacts = record(data) ? data.artifacts : undefined
    if (block.isError === true || envelope.ok !== true || !Array.isArray(artifacts) || artifacts.length !== 2 || !artifacts.every(validReportArtifact)
      || new Set(artifacts.map(item => item.mime_type)).size !== 2 || new Set(artifacts.map(item => item.id)).size !== 2) {
      return { kind: 'error', message: 'The report tool did not return a valid Excel and PDF pair.' }
    }
    return { kind: 'success', artifacts }
  } catch { return { kind: 'error', message: 'The report tool returned an unreadable result. Check the generation error.' } }
}
