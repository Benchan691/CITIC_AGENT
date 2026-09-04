import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import React, { useEffect, useMemo, useState } from 'react'
import css from './SplunkDetectionToolview.module.css'
import { rpc } from './settings-common.ts'
import {
  actionFieldsFromDraft,
  detectionErrorMessage,
  detectionFromForm,
  formFromDraft,
  parseDetectionEnvelope,
  SPLUNK_UPDATE_DETECTION_TOOL_NAME,
  SPLUNK_WRITE_DETECTION_TOOL_NAME,
  type DetectionActionField,
  type DetectionDraftEnvelope,
  type DetectionFormFields,
  type DetectionOperation,
} from './splunkDetection.ts'

export {
  actionFieldsFromDraft,
  detectionErrorMessage,
  detectionFromForm,
  formFromDraft,
  isManagedActionField,
  parseDetectionEnvelope,
  SPLUNK_UPDATE_DETECTION_TOOL_NAME,
  SPLUNK_WRITE_DETECTION_TOOL_NAME,
} from './splunkDetection.ts'
export type { DetectionActionField, DetectionDraftEnvelope, DetectionFormFields, DetectionOperation } from './splunkDetection.ts'

type DetectionEditorProps = ToolCallViewProps & { connection: ConnectionHandle }
type EditorStatus = 'editing' | 'saving' | 'saved' | 'failed' | 'discarded'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isChecked(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase())
}

function valueText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  readOnly = false,
  className = '',
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  multiline?: boolean
  readOnly?: boolean
  className?: string
}) {
  const control = multiline
    ? <textarea className={`${css.textarea} ${className}`} aria-label={label} value={value} readOnly={readOnly} onChange={event => onChange?.(event.target.value)} />
    : <input className={`${css.input} ${className}`} aria-label={label} value={value} readOnly={readOnly} onChange={event => onChange?.(event.target.value)} />
  return <label className={css.field}><span className={css.label}>{label}</span>{control}</label>
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className={css.field}>
      <span className={css.label}>{label}</span>
      <select className={css.select} aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={css.toggle}>
      <input type="checkbox" aria-label={label} checked={checked} onChange={event => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function reviewText(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null
  const parts = [
    metadata.severity ? `Severity: ${valueText(metadata.severity)}` : '',
    Array.isArray(metadata.mitre_attack) && metadata.mitre_attack.length ? `MITRE: ${metadata.mitre_attack.join(', ')}` : '',
    metadata.risk_score !== undefined ? `Risk score: ${valueText(metadata.risk_score)}` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export function SplunkDetectionToolview({ block, connection, toolName }: DetectionEditorProps) {
  const envelope = useMemo(() => parseDetectionEnvelope(block), [block])
  const sourceKey = useMemo(() => JSON.stringify(envelope?.draft ?? null), [envelope])
  const operation: DetectionOperation = envelope?.operation ?? (
    toolName === SPLUNK_UPDATE_DETECTION_TOOL_NAME ? 'update' : 'write'
  )
  const [fields, setFields] = useState<DetectionFormFields>(() => formFromDraft(envelope?.draft ?? {}))
  const [actionFields, setActionFields] = useState<DetectionActionField[]>(() => actionFieldsFromDraft(envelope?.draft ?? {}))
  const [status, setStatus] = useState<EditorStatus>('editing')
  const [error, setError] = useState<string | null>(null)
  const [persisted, setPersisted] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (!envelope?.draft) return
    setFields(formFromDraft(envelope.draft))
    setActionFields(actionFieldsFromDraft(envelope.draft))
    setStatus('editing')
    setError(null)
    setPersisted(null)
  }, [sourceKey])

  if (!('kind' in block)) {
    return <div className={css.card} data-dshcf-preserve="true"><div className={css.message}>Preparing detection editor…</div></div>
  }

  const upstreamError = detectionErrorMessage(envelope)
  if (upstreamError || block.isError || !envelope?.draft || Object.keys(envelope.draft).length === 0) {
    return <div className={css.card} data-dshcf-preserve="true"><div className={`${css.message} ${css.error}`}>{upstreamError || 'Unable to prepare the Splunk detection editor.'}</div></div>
  }

  const setField = (key: string, value: string) => setFields(current => ({ ...current, [key]: value }))
  const toggleField = (key: string) => (checked: boolean) => setField(key, checked ? '1' : '0')
  const resetDraft = () => {
    setFields(formFromDraft(envelope.draft))
    setActionFields(actionFieldsFromDraft(envelope.draft))
    setStatus('editing')
    setError(null)
    setPersisted(null)
  }

  const save = async () => {
    const name = fields.name.trim()
    if (!name) {
      setError('Detection name cannot be empty.')
      return
    }
    if (!fields.spl.trim()) {
      setError('SPL cannot be empty.')
      return
    }
    const target = operation === 'update' ? envelope.target_id || name : name
    const expectedFingerprint = envelope.expected_fingerprint ?? envelope.current_fingerprint
    if (operation === 'update' && !expectedFingerprint) {
      setError('This update draft has no concurrency fingerprint. Reopen it from Splunk.')
      return
    }
    setStatus('saving')
    setError(null)
    try {
      const result = await rpc(connection, 'save-detection', {
        operation,
        name: target,
        detection: detectionFromForm(fields, actionFields, envelope.review_only_metadata),
        ...(operation === 'update' ? { expected_fingerprint: expectedFingerprint } : {}),
      })
      if (!isRecord(result) || result.saved !== true || !isRecord(result.detection)) {
        throw new Error('Splunk did not confirm that the detection was saved.')
      }
      setPersisted(result.detection)
      setStatus('saved')
    } catch (cause) {
      setStatus('failed')
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  if (status === 'discarded') {
    return (
      <div className={css.card} data-dshcf-preserve="true">
        <div className={css.header}><div><div className={css.title}>Detection draft discarded</div><div className={css.subtitle}>No Splunk change was made.</div></div></div>
        <div className={css.actions}><button className={`${css.button} ${css.secondary}`} type="button" onClick={resetDraft}>Reopen</button></div>
      </div>
    )
  }

  if (status === 'saved') {
    const savedName = valueText(persisted?.name) || fields.name
    const savedActions = valueText(persisted?.actions) || 'No alert actions'
    return (
      <div className={css.card} data-dshcf-preserve="true">
        <div className={css.header}><div><div className={css.title}>Detection saved successfully</div><div className={css.subtitle}>{savedName}</div></div></div>
        <div className={css.content}>
          <div className={`${css.message} ${css.success}`}>Saved disabled for review. Enablement remains outside the MCP editor.</div>
          <div className={css.savedSummary}>
            <div><span className={css.savedLabel}>Persisted status</span><span>Disabled</span></div>
            <div><span className={css.savedLabel}>Alert actions</span><span>{savedActions}</span></div>
            <div><span className={css.savedLabel}>Description</span><span>{valueText(persisted?.description) || '—'}</span></div>
          </div>
          <div className={css.savedSpl}>
            <div className={css.savedLabel}>Persisted SPL</div>
            <pre>{valueText(persisted?.spl)}</pre>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className={css.card} data-dshcf-preserve="true" aria-label="Editable Splunk detection draft">
      <div className={css.header}>
        <div>
          <div className={css.title}>{operation === 'update' ? 'Edit Detection' : 'New Detection'}</div>
          <div className={css.subtitle}>Review the alert settings, then Save to write it to Splunk.</div>
        </div>
      </div>
      <div className={css.content}>
        <div className={css.notice}>Saved alerts remain disabled. Cancel discards this draft without changing Splunk.</div>

        <details className={css.section} open>
          <summary>Settings</summary>
          <div className={css.sectionBody}>
            <Field label="Name" value={fields.name} readOnly={operation === 'update'} onChange={value => setField('name', value)} />
            <Field label="Description" value={fields.description} multiline onChange={value => setField('description', value)} />
            <Field label="Search / SPL" value={fields.spl} multiline className={css.spl} onChange={value => setField('spl', value)} />
          </div>
        </details>

        <details className={css.section} open>
          <summary>Scheduling and dispatch</summary>
          <div className={css.sectionBody}>
            <Toggle label="Scheduled alert" checked={isChecked(fields.is_scheduled)} onChange={toggleField('is_scheduled')} />
            <div className={css.grid}>
              <Field label="Cron schedule" value={fields.cron_schedule} onChange={value => setField('cron_schedule', value)} />
              <Field label="Earliest time" value={fields['dispatch.earliest_time']} onChange={value => setField('dispatch.earliest_time', value)} />
              <Field label="Latest time" value={fields['dispatch.latest_time']} onChange={value => setField('dispatch.latest_time', value)} />
              <Field label="Real-time maximum span" value={fields['dispatch.rt_maximum_span']} onChange={value => setField('dispatch.rt_maximum_span', value)} />
            </div>
            <div className={css.grid}>
              <Toggle label="Real-time backfill" checked={isChecked(fields['dispatch.rt_backfill'])} onChange={toggleField('dispatch.rt_backfill')} />
              <Toggle label="Indexed real-time" checked={isChecked(fields['dispatch.indexedRealtime'])} onChange={toggleField('dispatch.indexedRealtime')} />
            </div>
            <div className={css.grid}>
              <Field label="Indexed real-time offset" value={fields['dispatch.indexedRealtimeOffset']} onChange={value => setField('dispatch.indexedRealtimeOffset', value)} />
              <Field label="Indexed real-time minimum span" value={fields['dispatch.indexedRealtimeMinSpan']} onChange={value => setField('dispatch.indexedRealtimeMinSpan', value)} />
            </div>
          </div>
        </details>

        <details className={css.section} open>
          <summary>Alert trigger</summary>
          <div className={css.sectionBody}>
            <div className={css.grid}>
              <SelectField label="Alert type" value={fields.alert_type} onChange={value => setField('alert_type', value)} options={[
                { value: '', label: 'Not specified' },
                { value: 'always', label: 'Always' },
                { value: 'number of events', label: 'Number of events' },
                { value: 'number of hosts', label: 'Number of hosts' },
                { value: 'number of sources', label: 'Number of sources' },
                { value: 'custom', label: 'Custom condition' },
              ]} />
              <SelectField label="Comparator" value={fields.alert_comparator} onChange={value => setField('alert_comparator', value)} options={[
                { value: '', label: 'Not specified' },
                { value: 'greater than', label: 'Greater than' },
                { value: 'less than', label: 'Less than' },
                { value: 'equal to', label: 'Equal to' },
                { value: 'not equal to', label: 'Not equal to' },
                { value: 'rises by', label: 'Rises by' },
                { value: 'drops by', label: 'Drops by' },
                { value: 'rises by perc', label: 'Rises by %' },
                { value: 'drops by perc', label: 'Drops by %' },
              ]} />
            </div>
            <div className={css.grid}>
              <Field label="Threshold" value={fields.alert_threshold} onChange={value => setField('alert_threshold', value)} />
              <Field label="Expiration" value={fields['alert.expires']} onChange={value => setField('alert.expires', value)} />
            </div>
            <Field label="Custom alert condition" value={fields.alert_condition} multiline onChange={value => setField('alert_condition', value)} />
          </div>
        </details>

        <details className={css.section} open>
          <summary>Alert behavior</summary>
          <div className={css.sectionBody}>
            <div className={css.grid}>
              <Toggle label="Digest mode" checked={isChecked(fields['alert.digest_mode'])} onChange={toggleField('alert.digest_mode')} />
              <Toggle label="Throttle / suppress" checked={isChecked(fields['alert.suppress'])} onChange={toggleField('alert.suppress')} />
            </div>
            <div className={css.grid}>
              <Field label="Throttle period" value={fields['alert.suppress.period']} onChange={value => setField('alert.suppress.period', value)} />
              <Field label="Throttle fields" value={fields['alert.suppress.fields']} onChange={value => setField('alert.suppress.fields', value)} />
              <Field label="Throttle group name" value={fields['alert.suppress.group_name']} onChange={value => setField('alert.suppress.group_name', value)} />
              <SelectField label="Track alerts" value={fields['alert.track']} onChange={value => setField('alert.track', value)} options={[
                { value: '', label: 'Not specified' },
                { value: 'auto', label: 'Auto' },
                { value: '1', label: 'Enabled' },
                { value: '0', label: 'Disabled' },
              ]} />
            </div>
          </div>
        </details>

        <details className={css.section} open>
          <summary>Actions</summary>
          <div className={css.sectionBody}>
            <Field label="Enabled action names" value={fields.actions} onChange={value => setField('actions', value)} />
            <div className={css.actionRows}>
              {actionFields.map((field, index) => (
                <div className={css.actionRow} key={`${field.key}-${index}`}>
                  <input className={css.input} aria-label={`Action field ${index + 1} name`} value={field.key} placeholder="action.<name>.<parameter>" onChange={event => setActionFields(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item))} />
                  <input className={css.input} aria-label={`Action field ${index + 1} value`} value={field.value} placeholder="Value" onChange={event => setActionFields(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} />
                  <button className={css.button} type="button" onClick={() => setActionFields(current => current.filter((_item, itemIndex) => itemIndex !== index))}>Remove</button>
                </div>
              ))}
              <button className={css.button} type="button" onClick={() => setActionFields(current => [...current, { key: '', value: '' }])}>Add action field</button>
            </div>
            <div className={css.hint}>Use non-secret action.* fields only. Secret-like fields are rejected by the server.</div>
            <div className={css.managed}>The required company logevent action is managed automatically and is not editable here.</div>
          </div>
        </details>

        {reviewText(envelope.review_only_metadata) && <div className={css.managed}>Review-only metadata: {reviewText(envelope.review_only_metadata)}. It is not persisted as a Splunk alert setting.</div>}
        {error && <div className={`${css.message} ${css.error}`} role="alert">{error}</div>}
        <div className={css.actions}>
          <button className={`${css.button} ${css.secondary}`} type="button" disabled={status === 'saving'} onClick={() => setStatus('discarded')}>Cancel</button>
          <button className={`${css.button} ${css.primary}`} type="button" disabled={status === 'saving'} onClick={() => { void save() }}>
            {status === 'saving' ? 'Saving…' : status === 'failed' ? 'Retry' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  )
}

export const splunkDetectionToolview = {
  name: 'splunk-detection-toolview',
  inject: ['slots', 'connection'],
  apply(ctx: Context): void {
    const connection = ctx.get('connection') as ConnectionHandle
    for (const key of [SPLUNK_WRITE_DETECTION_TOOL_NAME, SPLUNK_UPDATE_DETECTION_TOOL_NAME]) {
      ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
        name: 'tool.call.toolview',
        key,
        inject: () => ({ connection }),
      }, SplunkDetectionToolview))
    }
  },
}

export function installSplunkDetectionToolview(ctx: ClientContext): void {
  ctx.plugin(splunkDetectionToolview)
}
