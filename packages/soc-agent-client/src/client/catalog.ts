import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'

export const CATALOG_WRITE_RULE_TOOL_NAME = 'mcp__soc_agent__catalog_write_rule'
export const CATALOG_UPDATE_RULE_TOOL_NAME = 'mcp__soc_agent__catalog_update_rule'
export const CATALOG_WRITE_CUSTOMER_TOOL_NAME = 'mcp__soc_agent__catalog_write_customer'
export const CATALOG_UPDATE_CUSTOMER_TOOL_NAME = 'mcp__soc_agent__catalog_update_customer'
export const CATALOG_WRITE_FIX_SOURCE_TYPE_TOOL_NAME = 'mcp__soc_agent__catalog_write_fix_source_type'
export const CATALOG_UPDATE_FIX_SOURCE_TYPE_TOOL_NAME = 'mcp__soc_agent__catalog_update_fix_source_type'
export const CATALOG_ARCHIVE_RECORD_TOOL_NAME = 'mcp__soc_agent__catalog_archive_record'

export const CATALOG_DRAFT_TOOL_NAMES = [
  CATALOG_WRITE_RULE_TOOL_NAME,
  CATALOG_UPDATE_RULE_TOOL_NAME,
  CATALOG_WRITE_CUSTOMER_TOOL_NAME,
  CATALOG_UPDATE_CUSTOMER_TOOL_NAME,
  CATALOG_WRITE_FIX_SOURCE_TYPE_TOOL_NAME,
  CATALOG_UPDATE_FIX_SOURCE_TYPE_TOOL_NAME,
] as const

export type CatalogName = 'customer' | 'rule' | 'fix_source_type'
export type CatalogOperation = 'write' | 'update'
export type CatalogFormFields = Record<string, string>

export interface CatalogDraftEnvelope {
  status?: string
  catalog: CatalogName
  record: Record<string, unknown>
  operation?: CatalogOperation
  target_id?: string | null
  expected_revision?: number | null
  current_revision?: number | null
  save_requires_explicit_action?: boolean
  error?: unknown
  [key: string]: unknown
}

export const RULE_FIELDS = [
  'rule_number',
  'rule_name_en',
  'rule_name_cn',
  'rule_name_zh',
  'description_en',
  'description_cn',
  'description_zh',
  'remediation_en',
  'remediation_cn',
  'remediation_zh',
  'severity',
  'status',
  'customer_id',
  'gid',
] as const

export const CUSTOMER_FIELDS = [
  'customer_code',
  'display_name',
  'tenant_number',
  'gid',
  'lifecycle_status',
  'notes',
] as const

export const FIX_SOURCE_TYPE_FIELDS = [
  'customer_id',
  'system_name',
  'fix_source_type_value',
  'default_fix_index',
  'description',
] as const

export const CATALOG_FIELDS: Record<CatalogName, readonly string[]> = {
  customer: CUSTOMER_FIELDS,
  rule: RULE_FIELDS,
  fix_source_type: FIX_SOURCE_TYPE_FIELDS,
}

export const CATALOG_LABELS: Record<CatalogName, string> = {
  customer: 'Customer Information',
  rule: 'Ruleset',
  fix_source_type: 'Fix Source type',
}

export const SEVERITY_OPTIONS = [
  { value: 'info', label: 'Info' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const

export const RULE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'retired', label: 'Retired' },
] as const

export const LIFECYCLE_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'provisioning', label: 'Provisioning' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'retired', label: 'Retired' },
] as const

export const SELECT_FIELDS: Record<string, readonly { value: string; label: string }[]> = {
  severity: SEVERITY_OPTIONS,
  status: RULE_STATUS_OPTIONS,
  lifecycle_status: LIFECYCLE_OPTIONS,
}

const REQUIRED_FIELDS: Record<CatalogName, readonly string[]> = {
  customer: ['customer_code', 'display_name'],
  rule: ['rule_number', 'rule_name_en'],
  fix_source_type: ['customer_id', 'system_name', 'fix_source_type_value'],
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function requireCatalogRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || typeof value.record_id !== 'string' || !Number.isInteger(value.revision)) {
    throw new Error('The catalog did not return a record with an ID and revision. Reload the record.')
  }
  return value
}

export function catalogSavePayload(catalog: CatalogName, fields: CatalogFormFields, selected: Record<string, unknown> | null) {
  const record = recordFromForm(catalog, fields)
  if (selected === null) return { catalog, operation: 'write' as const, record }
  const current = requireCatalogRecord(selected)
  return { catalog, operation: 'update' as const, record, record_id: current.record_id, expected_revision: current.revision }
}

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

export function formFromRecord(record: Record<string, unknown>): CatalogFormFields {
  const catalog = text(record.catalog, 'rule') as CatalogName
  const fields: CatalogFormFields = {}
  for (const key of CATALOG_FIELDS[catalog] ?? RULE_FIELDS) {
    fields[key] = text(record[key])
  }
  return fields
}

export function recordFromForm(
  catalog: CatalogName,
  fields: CatalogFormFields,
): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  for (const key of CATALOG_FIELDS[catalog]) {
    record[key] = fields[key] ?? ''
  }
  return record
}

/** Quick client-side validation; the server remains authoritative. */
export function validateCatalogForm(
  catalog: CatalogName,
  fields: CatalogFormFields,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const key of REQUIRED_FIELDS[catalog]) {
    if (!(fields[key] ?? '').trim()) {
      errors[key] = `${key.replace(/_/g, ' ')} is required.`
    }
  }
  if (catalog === 'rule' && fields.rule_number && !/^[0-9]{1,4}$/.test(fields.rule_number.trim())) {
    errors.rule_number = 'Use 1-4 digits; leading zeros are preserved.'
  }
  return errors
}

/**
 * Tool failures arrive as MCP error text: `Error executing tool <name>: {json}`.
 * Parse the envelope payload regardless of the transport prefix.
 */
export function parseEnvelopeText(raw: string): Record<string, unknown> | null {
  const attempt = (text: string): Record<string, unknown> | null => {
    try {
      const parsed: unknown = JSON.parse(text)
      return isRecord(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  const direct = attempt(raw)
  if (direct) return direct
  const start = raw.indexOf('{')
  if (start > 0) return attempt(raw.slice(start))
  return null
}

export function parseCatalogEnvelope(block: ToolCallBlock): CatalogDraftEnvelope | null {
  if (!('kind' in block)) return null
  const raw = block.content
    .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
    .map(item => item.text)
    .join('')
  if (!raw) return null
  const parsed = parseEnvelopeText(raw)
  if (!parsed) return null
  const data = isRecord(parsed.data) ? parsed.data : parsed
  const catalog = text(data.catalog, 'rule') as CatalogName
  if (isRecord(data.record)) return data as CatalogDraftEnvelope
  return { catalog, record: {}, error: parsed.error ?? data.error }
}

export function catalogErrorMessage(envelope: CatalogDraftEnvelope | null): string | null {
  const error = envelope?.error
  if (isRecord(error) && typeof error.message === 'string' && error.message) return error.message
  return typeof error === 'string' && error ? error : null
}

/** Extract per-field server validation messages from a failure envelope. */
export function catalogFieldErrors(error: unknown): Record<string, string> {
  if (!isRecord(error) || !isRecord(error.details)) return {}
  const fields = error.details.fields
  if (!isRecord(fields)) return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') result[key] = value
  }
  return result
}

export function catalogTitle(record: Record<string, unknown>, catalog: CatalogName): string {
  if (catalog === 'customer') return text(record.display_name) || text(record.customer_code)
  if (catalog === 'rule') return text(record.rule_name_en) || text(record.rule_number)
  return text(record.system_name) || text(record.fix_source_type_value)
}

export function catalogSubtitle(record: Record<string, unknown>, catalog: CatalogName): string {
  if (catalog === 'customer') return text(record.customer_code)
  if (catalog === 'rule') return `Rule ${text(record.rule_number)}`
  return text(record.fix_source_type_value)
}
