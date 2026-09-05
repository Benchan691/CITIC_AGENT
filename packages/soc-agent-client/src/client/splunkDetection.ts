import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'

export const SPLUNK_WRITE_DETECTION_TOOL_NAME = 'mcp__soc_agent__splunk_write_detection'
export const SPLUNK_UPDATE_DETECTION_TOOL_NAME = 'mcp__soc_agent__splunk_update_detection'

export type DetectionOperation = 'write' | 'update'
export type DetectionFormFields = Record<string, string>

export interface DetectionActionField {
  key: string
  value: string
}

export interface DetectionDraftEnvelope {
  draft: Record<string, unknown>
  operation?: DetectionOperation
  target_id?: string
  expected_fingerprint?: string | null
  current_fingerprint?: string | null
  review_only_metadata?: Record<string, unknown>
  error?: unknown
  [key: string]: unknown
}

export const DETECTION_STANDARD_FIELDS = [
  'is_scheduled',
  'cron_schedule',
  'dispatch.earliest_time',
  'dispatch.latest_time',
  'dispatch.rt_backfill',
  'dispatch.indexedRealtime',
  'dispatch.indexedRealtimeOffset',
  'dispatch.indexedRealtimeMinSpan',
  'dispatch.rt_maximum_span',
  'alert_type',
  'alert_comparator',
  'alert_threshold',
  'alert_condition',
  'alert.digest_mode',
  'alert.suppress',
  'alert.suppress.period',
  'alert.suppress.fields',
  'alert.suppress.group_name',
  'alert.expires',
  'alert.track',
  'actions',
] as const

const MANAGED_ACTION_PREFIX = 'action.logevent'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function valueFrom(draft: Record<string, unknown>, key: string, fallback = ''): string {
  return text(draft[key], fallback)
}

export function isManagedActionField(key: string): boolean {
  return key === MANAGED_ACTION_PREFIX || key.startsWith(`${MANAGED_ACTION_PREFIX}.`)
}

export function formFromDraft(draft: Record<string, unknown>): DetectionFormFields {
  const fields: DetectionFormFields = {
    name: valueFrom(draft, 'name'),
    description: valueFrom(draft, 'description'),
    spl: valueFrom(draft, 'spl', valueFrom(draft, 'search')),
    is_scheduled: valueFrom(draft, 'is_scheduled', '0'),
    cron_schedule: valueFrom(draft, 'cron_schedule'),
    'dispatch.earliest_time': valueFrom(draft, 'dispatch.earliest_time', valueFrom(draft, 'earliest_time', '-10m')),
    'dispatch.latest_time': valueFrom(draft, 'dispatch.latest_time', valueFrom(draft, 'latest_time', 'now')),
    'dispatch.rt_backfill': valueFrom(draft, 'dispatch.rt_backfill'),
    'dispatch.indexedRealtime': valueFrom(draft, 'dispatch.indexedRealtime'),
    'dispatch.indexedRealtimeOffset': valueFrom(draft, 'dispatch.indexedRealtimeOffset'),
    'dispatch.indexedRealtimeMinSpan': valueFrom(draft, 'dispatch.indexedRealtimeMinSpan'),
    'dispatch.rt_maximum_span': valueFrom(draft, 'dispatch.rt_maximum_span'),
    alert_type: valueFrom(draft, 'alert_type'),
    alert_comparator: valueFrom(draft, 'alert_comparator'),
    alert_threshold: valueFrom(draft, 'alert_threshold'),
    alert_condition: valueFrom(draft, 'alert_condition'),
    'alert.digest_mode': valueFrom(draft, 'alert.digest_mode'),
    'alert.suppress': valueFrom(draft, 'alert.suppress'),
    'alert.suppress.period': valueFrom(draft, 'alert.suppress.period'),
    'alert.suppress.fields': valueFrom(draft, 'alert.suppress.fields'),
    'alert.suppress.group_name': valueFrom(draft, 'alert.suppress.group_name'),
    'alert.expires': valueFrom(draft, 'alert.expires'),
    'alert.track': valueFrom(draft, 'alert.track', 'auto'),
    actions: valueFrom(draft, 'actions'),
  }
  return fields
}

export function actionFieldsFromDraft(draft: Record<string, unknown>): DetectionActionField[] {
  return Object.keys(draft)
    .filter(key => key.startsWith('action.') && !isManagedActionField(key))
    .sort()
    .map(key => ({ key, value: text(draft[key]) }))
}

export function detectionFromForm(
  fields: DetectionFormFields,
  actionFields: readonly DetectionActionField[],
  reviewOnlyMetadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const detection: Record<string, unknown> = {}
  for (const key of ['name', 'description', 'spl', ...DETECTION_STANDARD_FIELDS]) {
    detection[key] = fields[key] ?? ''
  }
  detection.enabled = false
  for (const key of ['severity', 'mitre_attack', 'risk_score', 'risk_objects', 'suppression_window']) {
    if (reviewOnlyMetadata[key] !== undefined) detection[key] = reviewOnlyMetadata[key]
  }
  for (const field of actionFields) {
    const key = field.key.trim()
    if (key) detection[key] = field.value
  }
  return detection
}

function resultText(block: ToolCallBlock): string {
  if (!('kind' in block)) return ''
  return block.content
    .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
    .map(item => item.text)
    .join('')
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

export function parseDetectionEnvelope(block: ToolCallBlock): DetectionDraftEnvelope | null {
  const raw = resultText(block)
  if (!raw) return null
  const parsed = parseEnvelopeText(raw)
  if (!parsed) return null
  const data = isRecord(parsed.data) ? parsed.data : parsed
  if (isRecord(data.draft)) return data as DetectionDraftEnvelope
  return { draft: {}, error: parsed.error ?? data.error }
}

export function detectionErrorMessage(envelope: DetectionDraftEnvelope | null): string | null {
  const error = envelope?.error
  if (isRecord(error) && typeof error.message === 'string' && error.message) return error.message
  return typeof error === 'string' && error ? error : null
}
