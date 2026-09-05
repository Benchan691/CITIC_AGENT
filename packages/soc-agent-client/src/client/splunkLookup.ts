import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import { parseEnvelopeText } from './splunkDetection.ts'

export const SPLUNK_GET_LOOKUP_TOOL_NAME = 'mcp__soc_agent__splunk_get_lookup'
export const SPLUNK_WRITE_LOOKUP_TOOL_NAME = 'mcp__soc_agent__splunk_write_lookup'
export const SPLUNK_UPDATE_LOOKUP_TOOL_NAME = 'mcp__soc_agent__splunk_update_lookup'
export const SPLUNK_DELETE_LOOKUP_TOOL_NAME = 'mcp__soc_agent__splunk_delete_lookup'

export type LookupOperation = 'write' | 'update' | 'delete'

export interface LookupFormFields {
  name: string
  content: string
}

export interface LookupDraftEnvelope {
  draft: Record<string, unknown>
  operation?: LookupOperation
  target_id?: string
  expected_fingerprint?: string | null
  current_fingerprint?: string | null
  review_only_metadata?: Record<string, unknown>
  error?: unknown
  [key: string]: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

export function formFromLookupDraft(draft: Record<string, unknown>): LookupFormFields {
  return {
    name: text(draft.name),
    content: text(draft.content),
  }
}

export const formFromDraft = formFromLookupDraft

export function lookupFromForm(fields: LookupFormFields): LookupFormFields {
  return {
    name: fields.name.trim(),
    content: fields.content,
  }
}

function resultText(block: ToolCallBlock): string {
  if (!('kind' in block)) return ''
  return block.content
    .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
    .map(item => item.text)
    .join('')
}

export function parseLookupEnvelope(block: ToolCallBlock): LookupDraftEnvelope | null {
  const raw = resultText(block)
  if (!raw) return null
  const parsed = parseEnvelopeText(raw)
  if (!parsed) return null
  const data = isRecord(parsed.data) ? parsed.data : parsed
  if (isRecord(data.draft)) return data as LookupDraftEnvelope
  return { draft: {}, error: parsed.error ?? data.error }
}

export function lookupErrorMessage(envelope: LookupDraftEnvelope | null): string | null {
  const error = envelope?.error
  if (isRecord(error) && typeof error.message === 'string' && error.message) return error.message
  return typeof error === 'string' && error ? error : null
}
