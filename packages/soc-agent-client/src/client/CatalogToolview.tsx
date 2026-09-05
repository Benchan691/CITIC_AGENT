import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import React, { useEffect, useMemo, useState } from 'react'
import css from './CatalogToolview.module.css'
import { rpc } from './settings-common.ts'
import {
  CATALOG_DRAFT_TOOL_NAMES,
  CATALOG_FIELDS,
  CATALOG_LABELS,
  SELECT_FIELDS,
  catalogErrorMessage,
  catalogFieldErrors,
  catalogTitle,
  formFromRecord,
  parseCatalogEnvelope,
  recordFromForm,
  validateCatalogForm,
  type CatalogDraftEnvelope,
  type CatalogFormFields,
  type CatalogName,
  type CatalogOperation,
} from './catalog.ts'

type CatalogEditorProps = ToolCallViewProps & { connection: ConnectionHandle }
type EditorStatus = 'editing' | 'saving' | 'saved' | 'failed'

function valueText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  readOnly = false,
  error = '',
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  multiline?: boolean
  readOnly?: boolean
  error?: string
}) {
  const control = multiline
    ? <textarea className={css.textarea} aria-label={label} value={value} readOnly={readOnly} onChange={event => onChange?.(event.target.value)} />
    : <input className={css.input} aria-label={label} value={value} readOnly={readOnly} onChange={event => onChange?.(event.target.value)} />
  return (
    <label className={`${css.field} ${error ? css.fieldInvalid : ''}`}>
      <span className={css.label}>{label}</span>
      {control}
      {error && <span className={css.fieldError} role="alert">{error}</span>}
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
  error = '',
}: {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <label className={`${css.field} ${error ? css.fieldInvalid : ''}`}>
      <span className={css.label}>{label}</span>
      <select className={css.select} aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {error && <span className={css.fieldError} role="alert">{error}</span>}
    </label>
  )
}

export function CatalogToolview({ block, connection, toolName }: CatalogEditorProps) {
  const envelope = useMemo(() => parseCatalogEnvelope(block), [block])
  const sourceKey = useMemo(() => JSON.stringify(envelope?.record ?? null), [envelope])
  const catalog: CatalogName = envelope?.catalog ?? 'rule'
  const operation: CatalogOperation = envelope?.operation ?? (
    toolName.includes('update') ? 'update' : 'write'
  )
  const [fields, setFields] = useState<CatalogFormFields>(() => formFromRecord(envelope?.record ?? {}))
  const [status, setStatus] = useState<EditorStatus>('editing')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [persisted, setPersisted] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (!envelope?.record) return
    setFields(formFromRecord(envelope.record))
    setStatus('editing')
    setError(null)
    setFieldErrors({})
    setPersisted(null)
  }, [sourceKey])

  if (!('kind' in block)) {
    return <div className={css.card} data-dshcf-preserve="true"><div className={css.message}>Preparing catalog editor…</div></div>
  }

  const upstreamError = catalogErrorMessage(envelope)
  if (upstreamError || block.isError || !envelope?.record || Object.keys(envelope.record).length === 0) {
    return <div className={css.card} data-dshcf-preserve="true"><div className={`${css.message} ${css.error}`}>{upstreamError || 'Unable to prepare the catalog editor.'}</div></div>
  }

  const label = CATALOG_LABELS[catalog]
  const setField = (key: string, value: string) => setFields(current => ({ ...current, [key]: value }))
  const resetDraft = () => {
    setFields(formFromRecord(envelope.record))
    setStatus('editing')
    setError(null)
    setFieldErrors({})
    setPersisted(null)
  }

  const save = async () => {
    const localErrors = validateCatalogForm(catalog, fields)
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors)
      setError('Correct the highlighted fields before saving.')
      setStatus('failed')
      return
    }
    const target = operation === 'update' ? envelope.target_id || envelope.record.record_id : undefined
    const expectedRevision = envelope.expected_revision ?? envelope.current_revision
    if (operation === 'update' && !expectedRevision) {
      setError('This edit draft has no revision. Reopen the record from the catalog.')
      setStatus('failed')
      return
    }
    setStatus('saving')
    setError(null)
    setFieldErrors({})
    try {
      const result = await rpc(connection, 'save-catalog-record', {
        catalog,
        operation,
        record: recordFromForm(catalog, fields),
        ...(target ? { record_id: target } : {}),
        ...(operation === 'update' ? { expected_revision: expectedRevision } : {}),
      })
      if (!result || result.saved !== true || !result.record) {
        throw new Error('The catalog did not confirm that the record was saved.')
      }
      setPersisted(result.record)
      setStatus('saved')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      const details = (cause as { details?: unknown })?.details
      setFieldErrors(catalogFieldErrors({ details }))
      setStatus('failed')
      setError(message)
    }
  }

  if (status === 'saved' && persisted) {
    return (
      <div className={css.card} data-dshcf-preserve="true">
        <div className={css.header}><div><div className={css.title}>{label} record saved</div><div className={css.subtitle}>{catalogTitle(persisted, catalog)} · revision {valueText(persisted.revision)}</div></div></div>
        <div className={css.content}>
          <div className={`${css.message} ${css.success}`}>Saved to the catalog with a full history entry. Publish to Splunk separately from the catalogs page.</div>
        </div>
      </div>
    )
  }

  const renderField = (key: string) => {
    const options = SELECT_FIELDS[key]
    const common = { key, label: key.replace(/_/g, ' '), value: fields[key] ?? '', error: fieldErrors[key] ?? '' }
    if (options) {
      return <SelectField {...common} options={options} onChange={value => setField(key, value)} />
    }
    const multiline = key.startsWith('description') || key === 'notes' || key.startsWith('remediation')
    return <Field {...common} multiline={multiline} onChange={value => setField(key, value)} />
  }

  return (
    <section className={css.card} data-dshcf-preserve="true" aria-label={`Editable ${label} draft`}>
      <div className={css.header}>
        <div>
          <div className={css.title}>{operation === 'update' ? `Edit ${label} Record` : `New ${label} Record`}</div>
          <div className={css.subtitle}>Review the fields, then Save to write it to the catalog. Publication to Splunk is separate.</div>
        </div>
      </div>
      <div className={css.content}>
        {error && <div className={`${css.message} ${css.error}`} role="alert">{error}</div>}
        <div className={css.grid}>
          {CATALOG_FIELDS[catalog].map(key => renderField(key))}
        </div>
        <div className={css.actions}>
          <button className={`${css.button} ${css.secondary}`} type="button" disabled={status === 'saving'} onClick={resetDraft}>Reset</button>
          <button className={`${css.button} ${css.primary}`} type="button" disabled={status === 'saving'} onClick={() => { void save() }}>
            {status === 'saving' ? 'Saving…' : status === 'failed' ? 'Retry' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  )
}

export const catalogToolview = {
  name: 'catalog-toolview',
  inject: ['slots', 'connection'],
  apply(ctx: Context): void {
    const connection = ctx.get('connection') as ConnectionHandle
    for (const key of CATALOG_DRAFT_TOOL_NAMES) {
      ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
        name: 'tool.call.toolview',
        key,
        inject: () => ({ connection }),
      }, CatalogToolview))
    }
  },
}

export function installCatalogToolview(ctx: ClientContext): void {
  ctx.plugin(catalogToolview)
}
