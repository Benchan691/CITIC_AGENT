import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import React, { useEffect, useMemo, useState } from 'react'
import css from './SplunkLookupToolview.module.css'
import { rpc } from './settings-common.ts'
import {
  formFromLookupDraft,
  lookupErrorMessage,
  lookupFromForm,
  parseLookupEnvelope,
  SPLUNK_DELETE_LOOKUP_TOOL_NAME,
  SPLUNK_UPDATE_LOOKUP_TOOL_NAME,
  SPLUNK_WRITE_LOOKUP_TOOL_NAME,
  type LookupDraftEnvelope,
  type LookupFormFields,
  type LookupOperation,
} from './splunkLookup.ts'

export {
  formFromLookupDraft,
  lookupErrorMessage,
  lookupFromForm,
  parseLookupEnvelope,
  SPLUNK_DELETE_LOOKUP_TOOL_NAME,
  SPLUNK_GET_LOOKUP_TOOL_NAME,
  SPLUNK_UPDATE_LOOKUP_TOOL_NAME,
  SPLUNK_WRITE_LOOKUP_TOOL_NAME,
} from './splunkLookup.ts'
export type { LookupDraftEnvelope, LookupFormFields, LookupOperation } from './splunkLookup.ts'

type LookupEditorProps = ToolCallViewProps & { connection: ConnectionHandle }
type EditorStatus = 'editing' | 'saving' | 'saved' | 'failed' | 'discarded'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function valueText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function Field({
  label,
  value,
  onChange,
  readOnly = false,
  multiline = false,
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  multiline?: boolean
}) {
  const control = multiline
    ? <textarea className={css.textarea} aria-label={label} value={value} readOnly={readOnly} onChange={event => onChange?.(event.target.value)} />
    : <input className={css.input} aria-label={label} value={value} readOnly={readOnly} onChange={event => onChange?.(event.target.value)} />
  return <label className={css.field}><span className={css.label}>{label}</span>{control}</label>
}

function summaryText(value: unknown): string {
  if (!isRecord(value)) return ''
  const rows = valueText(value.row_count)
  const columns = valueText(value.column_count)
  const bytes = valueText(value.byte_count)
  return [rows ? `${rows} data row${rows === '1' ? '' : 's'}` : '', columns ? `${columns} column${columns === '1' ? '' : 's'}` : '', bytes ? `${bytes} bytes` : '']
    .filter(Boolean)
    .join(' · ')
}

function scopeText(draft: Record<string, unknown>): string {
  const app = valueText(draft.app) || 'search'
  const owner = valueText(draft.owner) || 'nobody'
  return `${app} / ${owner}`
}

function persistedText(value: unknown): string {
  if (!isRecord(value)) return ''
  const summary = summaryText(value.summary)
  return summary || 'The persisted lookup is available in Splunk.'
}

export function SplunkLookupToolview({ block, connection, toolName }: LookupEditorProps) {
  const envelope = useMemo(() => parseLookupEnvelope(block), [block])
  const sourceKey = useMemo(() => JSON.stringify(envelope?.draft ?? null), [envelope])
  const operation: LookupOperation = envelope?.operation ?? (
    toolName === SPLUNK_UPDATE_LOOKUP_TOOL_NAME
      ? 'update'
      : toolName === SPLUNK_DELETE_LOOKUP_TOOL_NAME ? 'delete' : 'write'
  )
  const [fields, setFields] = useState<LookupFormFields>(() => formFromLookupDraft(envelope?.draft ?? {}))
  const [status, setStatus] = useState<EditorStatus>('editing')
  const [error, setError] = useState<string | null>(null)
  const [persisted, setPersisted] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (!envelope?.draft) return
    setFields(formFromLookupDraft(envelope.draft))
    setStatus('editing')
    setError(null)
    setPersisted(null)
  }, [sourceKey])

  if (!('kind' in block)) {
    return <div className={css.card} data-dshcf-preserve="true"><div className={css.message}>Preparing Splunk lookup editor…</div></div>
  }

  const upstreamError = lookupErrorMessage(envelope)
  if (upstreamError || block.isError || !envelope?.draft || Object.keys(envelope.draft).length === 0) {
    return <div className={css.card} data-dshcf-preserve="true"><div className={`${css.message} ${css.error}`}>{upstreamError || 'Unable to prepare the Splunk lookup editor.'}</div></div>
  }

  const setField = (key: keyof LookupFormFields, value: string) => setFields(current => ({ ...current, [key]: value }))
  const resetDraft = () => {
    setFields(formFromLookupDraft(envelope.draft))
    setStatus('editing')
    setError(null)
    setPersisted(null)
  }

  const save = async () => {
    const draft = lookupFromForm(fields)
    if (!draft.name) {
      setError('Lookup filename cannot be empty.')
      return
    }
    if (!/\.csv$/iu.test(draft.name)) {
      setError('Lookup filename must end with .csv.')
      return
    }
    if (operation !== 'delete' && !draft.content.trim()) {
      setError('CSV content cannot be empty; include a header row.')
      return
    }
    const expectedFingerprint = envelope.expected_fingerprint ?? envelope.current_fingerprint
    if (operation !== 'write' && !expectedFingerprint) {
      setError('This lookup draft has no concurrency fingerprint. Reopen it from Splunk.')
      return
    }
    setStatus('saving')
    setError(null)
    try {
      const result = await rpc(connection, 'save-lookup', {
        operation,
        name: operation === 'write' ? draft.name : envelope.target_id || draft.name,
        ...(operation === 'delete' ? {} : { content: draft.content }),
        ...(operation !== 'write' ? { expected_fingerprint: expectedFingerprint } : {}),
      })
      if (!isRecord(result) || result.saved !== true || (operation === 'delete' ? result.deleted !== true : !result[operation === 'write' ? 'created' : 'updated'])) {
        throw new Error('Splunk did not confirm the lookup CSV change.')
      }
      setPersisted(result)
      setStatus('saved')
    } catch (cause) {
      setStatus('failed')
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  if (status === 'discarded') {
    return (
      <div className={css.card} data-dshcf-preserve="true">
        <div className={css.header}><div><div className={css.title}>Lookup CSV draft discarded</div><div className={css.subtitle}>No Splunk change was made.</div></div></div>
        <div className={css.actions}><button className={`${css.button} ${css.secondary}`} type="button" onClick={resetDraft}>Reopen</button></div>
      </div>
    )
  }

  if (status === 'saved') {
    if (operation === 'delete') {
      return (
        <div className={css.card} data-dshcf-preserve="true">
          <div className={css.header}><div><div className={css.title}>Lookup CSV deleted successfully</div><div className={css.subtitle}>{valueText(envelope.draft.name)}</div></div></div>
          <div className={css.content}><div className={`${css.message} ${css.success}`}>The persistent lookup file was deleted from Splunk.</div></div>
        </div>
      )
    }
    return (
      <div className={css.card} data-dshcf-preserve="true">
        <div className={css.header}><div><div className={css.title}>Lookup CSV saved successfully</div><div className={css.subtitle}>{valueText(persisted?.name) || fields.name}</div></div></div>
        <div className={css.content}>
          <div className={`${css.message} ${css.success}`}>Splunk confirmed the persisted lookup contents.</div>
          <div className={css.savedSummary}>{persistedText(persisted)}</div>
          <pre className={css.savedContent}>{valueText(persisted?.content) || fields.content}</pre>
        </div>
      </div>
    )
  }

  const readOnlyName = operation !== 'write'
  return (
    <section className={css.card} data-dshcf-preserve="true" aria-label="Editable Splunk lookup CSV draft">
      <div className={css.header}>
        <div>
          <div className={css.title}>{operation === 'delete' ? 'Delete Lookup CSV' : operation === 'update' ? 'Edit Lookup CSV' : 'New Lookup CSV'}</div>
          <div className={css.subtitle}>Review the CSV, then {operation === 'delete' ? 'Delete' : 'Save'} to apply the approved change in Splunk.</div>
        </div>
      </div>
      <div className={css.content}>
        <div className={css.notice}>{operation === 'delete' ? 'Delete removes this persistent lookup file. Cancel makes no Splunk change.' : 'Save is the only commit action. App and owner are fixed by the server write scope.'}</div>
        <div className={css.grid}>
          <Field label="Lookup filename" value={fields.name} readOnly={readOnlyName} onChange={value => setField('name', value)} />
          <Field label="Splunk scope (read-only)" value={scopeText(envelope.draft)} readOnly />
        </div>
        <Field label="CSV content" value={fields.content} multiline readOnly={operation === 'delete'} onChange={value => setField('content', value)} />
        <div className={css.meta}>
          <span>Current file: {summaryText(envelope.draft.summary) || 'summary unavailable'}</span>
          <span>Fingerprint protected: {operation === 'write' ? 'not applicable' : 'yes'}</span>
        </div>
        {error && <div className={`${css.message} ${css.error}`} role="alert">{error}</div>}
        <div className={css.actions}>
          <button className={`${css.button} ${css.secondary}`} type="button" disabled={status === 'saving'} onClick={() => setStatus('discarded')}>Cancel</button>
          <button className={`${css.button} ${operation === 'delete' ? css.danger : css.primary}`} type="button" disabled={status === 'saving'} onClick={() => { void save() }}>
            {status === 'saving' ? (operation === 'delete' ? 'Deleting…' : 'Saving…') : status === 'failed' ? 'Retry' : operation === 'delete' ? 'Delete' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  )
}

export const splunkLookupToolview = {
  name: 'splunk-lookup-toolview',
  inject: ['slots', 'connection'],
  apply(ctx: Context): void {
    const connection = ctx.get('connection') as ConnectionHandle
    for (const key of [SPLUNK_WRITE_LOOKUP_TOOL_NAME, SPLUNK_UPDATE_LOOKUP_TOOL_NAME, SPLUNK_DELETE_LOOKUP_TOOL_NAME]) {
      ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
        name: 'tool.call.toolview',
        key,
        inject: () => ({ connection }),
      }, SplunkLookupToolview))
    }
  },
}

export function installSplunkLookupToolview(ctx: ClientContext): void {
  ctx.plugin(splunkLookupToolview)
}
