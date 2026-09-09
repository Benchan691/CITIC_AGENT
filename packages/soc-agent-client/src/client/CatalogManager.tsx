import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import css from './CatalogManager.module.css'
import { rpcObject as rpc } from './settings-common.ts'
import {
  CATALOG_FIELDS,
  CUSTOMER_FIELD_MAPPING_KEYS,
  CATALOG_LABELS,
  SELECT_FIELDS,
  catalogSubtitle,
  catalogTitle,
  formFromRecord,
  catalogSavePayload,
  emptyCatalogForm,
  requireCatalogRecord,
  isRecord,
  validateCatalogForm,
  type CatalogName,
} from './catalog.ts'

type ViewMode = 'view' | 'edit' | 'create'
type PageStatus = 'idle' | 'busy' | 'saved' | 'failed'

const CATALOGS: CatalogName[] = ['rule', 'customer', 'fix_source_type']
export const CUSTOMER_CATALOGS: readonly CatalogName[] = ['customer']
const FIELD_LABELS: Record<string, string> = { gid: 'GID' }

function valueText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function StatusPill({ status }: { status: string }) {
  const kind = status === 'active' || status === 'published'
    ? css.pillOk
    : status === 'failed'
      ? css.pillFail
      : css.pillNeutral
  return <span className={`${css.pill} ${kind}`}>{status}</span>
}

function FieldRow({
  fieldKey,
  value,
  error,
  disabled,
  onChange,
}: {
  fieldKey: string
  value: string
  error?: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const options = SELECT_FIELDS[fieldKey]
  const label = FIELD_LABELS[fieldKey] ?? fieldKey.replace(/_/g, ' ')
  const multiline = fieldKey.startsWith('description') || fieldKey === 'notes' || fieldKey.startsWith('remediation')
  return (
    <label className={`${css.field} ${error ? css.fieldInvalid : ''}`}>
      <span className={css.label}>{label}</span>
      {options ? (
        <select className={css.control} aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : multiline ? (
        <textarea className={css.control} aria-label={label} value={value} disabled={disabled} rows={3} onChange={event => onChange(event.target.value)} />
      ) : (
        <input className={css.control} aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} />
      )}
      {error && <span className={css.fieldError} role="alert">{error}</span>}
    </label>
  )
}

type CustomerOptions = { source_types: { id: string; name: string }[]; staff: { id: string; name: string; email?: string; role?: string }[] }

function CustomerEditorFields({
  fields,
  errors,
  disabled,
  options,
  onChange,
}: {
  fields: Record<string, any>
  errors: Record<string, string>
  disabled: boolean
  options: CustomerOptions
  onChange: (key: string, value: any) => void
}) {
  const indexes = Array.isArray(fields.splunk_indexes) ? fields.splunk_indexes : []
  const mapping = fields.field_mapping && typeof fields.field_mapping === 'object' && !Array.isArray(fields.field_mapping) ? fields.field_mapping : {}
  const email = fields.email_config && typeof fields.email_config === 'object' && !Array.isArray(fields.email_config) ? fields.email_config : {}
  const custom = Object.entries(mapping).filter(([key]) => !(CUSTOMER_FIELD_MAPPING_KEYS as readonly string[]).includes(key))
  const addressList = (key: string) => Array.isArray(email[key]) ? email[key] : []
  const updateMapping = (key: string, value: string) => onChange('field_mapping', { ...mapping, [key]: value })
  const updateEmail = (key: string, value: any) => onChange('email_config', { recipients: [], cc: [], bcc: [], language: 'EN', brand: 'CPC', ...email, [key]: value })
  const identity = ['customer_code', 'display_name', 'short_name', 'gid', 'lifecycle_status', 'notes']
  return <div className={css.customerFields}>
    <section className={css.section}><h3>Identity</h3><div className={css.fieldGrid}>{identity.map(key => <FieldRow key={key} fieldKey={key} value={String(fields[key] ?? '')} error={errors[key]} disabled={disabled} onChange={value => onChange(key, value)} />)}</div></section>
    <section className={css.section}><h3>Relationships</h3><div className={css.fieldGrid}>
      <label className={css.field}><span className={css.label}>Source type</span><select className={css.control} value={String(fields.source_type_id ?? '')} disabled={disabled} onChange={event => onChange('source_type_id', event.target.value)}><option value="">Not assigned</option>{options.source_types.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.source_type_id && <span className={css.fieldError}>{errors.source_type_id}</span>}</label>
      <label className={css.field}><span className={css.label}>Related staff</span><select className={css.control} value={String(fields.related_staff_id ?? '')} disabled={disabled} onChange={event => onChange('related_staff_id', event.target.value)}><option value="">Not assigned</option>{options.staff.map(item => <option key={item.id} value={item.id}>{item.name}{item.email ? ` · ${item.email}` : ''}</option>)}</select>{errors.related_staff_id && <span className={css.fieldError}>{errors.related_staff_id}</span>}</label>
    </div></section>
    <section className={css.section}><h3>Legacy index hints</h3><p className={css.hint}>These catalog values are retained for compatibility and are not used to route alerts. Configure verified deployment/index ownership in Alert Email Settings before enabling delivery.</p>{indexes.length ? indexes.map((value: any, index: number) => <div className={css.row} key={`${index}-${String(value)}`}><input className={css.control} aria-label={`Legacy Splunk index hint ${index + 1}`} value={String(value ?? '')} disabled /></div>) : <span className={css.hint}>No legacy hints recorded.</span>}</section>
    <section className={css.section}><h3>Field mapping</h3><p className={css.hint}>Map normalized event fields to customer log fields. Custom keys are optional.</p><div className={css.fieldGrid}>{CUSTOMER_FIELD_MAPPING_KEYS.map(key => <label className={css.field} key={key}><span className={css.label}>{key.replace(/_/g, ' ')}</span><input className={css.control} value={String(mapping[key] ?? '')} disabled={disabled} onChange={event => updateMapping(key, event.target.value)} /></label>)}</div>{custom.map(([key, value]) => <div className={css.row} key={key}><input className={css.control} aria-label={`Custom mapping key ${key}`} value={key} disabled={disabled} onChange={event => { const next = { ...mapping }; delete next[key]; next[event.target.value] = value; onChange('field_mapping', next) }} /><input className={css.control} aria-label={`Custom mapping value ${key}`} value={String(value ?? '')} disabled={disabled} onChange={event => updateMapping(key, event.target.value)} /><button className={css.button} type="button" disabled={disabled} onClick={() => { const next = { ...mapping }; delete next[key]; onChange('field_mapping', next) }}>Remove</button></div>)}<button className={css.button} type="button" disabled={disabled} onClick={() => onChange('field_mapping', { ...mapping, custom_field: '' })}>Add custom field</button>{errors.field_mapping && <span className={css.fieldError}>{errors.field_mapping}</span>}</section>
    <section className={css.section}><h3>Email</h3><p className={css.hint}>Leave To empty while provisioning. Alert delivery stays skipped until recipients are configured.</p><div className={css.fieldGrid}>{(['recipients', 'cc', 'bcc'] as const).map(key => <label className={css.field} key={key}><span className={css.label}>{key === 'recipients' ? 'To recipients' : key.toUpperCase()}</span><textarea className={css.control} rows={3} value={addressList(key).join('\n')} disabled={disabled} onChange={event => updateEmail(key, event.target.value.split(/[\n,;]/).map(item => item.trim()).filter(Boolean))} placeholder="One address per line" />{errors[`email_config.${key}`] && <span className={css.fieldError}>{errors[`email_config.${key}`]}</span>}</label>)}</div><div className={css.fieldGrid}><label className={css.field}><span className={css.label}>Language</span><select className={css.control} value={String(email.language || 'EN')} disabled={disabled} onChange={event => updateEmail('language', event.target.value)}><option value="EN">English</option><option value="CN">简体中文</option><option value="ZH">繁體中文</option></select></label><label className={css.field}><span className={css.label}>Brand</span><select className={css.control} value={String(email.brand || 'CPC')} disabled={disabled} onChange={event => updateEmail('brand', event.target.value)}><option value="CPC">CPC</option><option value="CEC">CEC</option></select></label></div><label className={css.checkLabel}><input type="checkbox" checked={Boolean(fields.alert_delivery_enabled)} disabled={disabled} onChange={event => onChange('alert_delivery_enabled', event.target.checked)} />Allow future registered alert runs to enter the email queue</label></section>
  </div>
}

function HistoryView({ history }: { history: Record<string, unknown>[] }) {
  if (!history.length) return <div className={css.hint}>No recorded changes yet.</div>
  return (
    <div className={css.history}>
      {history.map(entry => {
        const before = entry.before ? JSON.stringify(entry.before, null, 1) : ''
        const after = entry.after ? JSON.stringify(entry.after, null, 1) : ''
        return (
          <details key={String(entry.history_id)} className={css.historyItem}>
            <summary>
              <span className={css.historyAction}>{valueText(entry.action)}</span>
              {' '}revision {valueText(entry.revision)} · {valueText(entry.actor)} · {valueText(entry.changed_at)}
              {entry.reason ? <span className={css.historyReason}> — {valueText(entry.reason)}</span> : null}
            </summary>
            {before && <div className={css.diffBlock}><div className={css.diffTitle}>Before</div><pre>{before}</pre></div>}
            {after && <div className={css.diffBlock}><div className={css.diffTitle}>After</div><pre>{after}</pre></div>}
          </details>
        )
      })}
    </div>
  )
}

export function CatalogManager({
  connection,
  catalogs = CATALOGS,
  title = 'SOC Catalogs',
  showPublication = true,
}: {
  connection: ConnectionHandle
  catalogs?: readonly CatalogName[]
  title?: string
  showPublication?: boolean
}) {
  const availableCatalogs = catalogs.length > 0 ? catalogs : CATALOGS
  const [catalog, setCatalog] = useState<CatalogName>(availableCatalogs[0])
  const [search, setSearch] = useState('')
  const [list, setList] = useState<{ items: Record<string, unknown>[]; total: number } | null>(null)
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [mode, setMode] = useState<ViewMode>('view')
  const [fields, setFields] = useState<Record<string, any>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<PageStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Record<string, unknown>[]>([])
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [publications, setPublications] = useState<Record<string, unknown>[]>([])
  const [customerOptions, setCustomerOptions] = useState<CustomerOptions>({ source_types: [], staff: [] })
  const listRequest = useRef(0)
  const selectionRequest = useRef(0)

  const authError = error === 'authentication required' || error?.includes('authentication')

  const loadList = useCallback(async () => {
    const request = ++listRequest.current
    setStatus('busy')
    setError(null)
    try {
      const result = await rpc(connection, 'catalog-list', {
        catalog,
        search,
        limit: 200,
        include_archived: true,
      })
      if (request !== listRequest.current) return
      setList({ items: Array.isArray(result.items) ? result.items.filter(isRecord) : [], total: Number(result.total ?? 0) })
      setStatus('idle')
    } catch (cause) {
      if (request !== listRequest.current) return
      setError(cause instanceof Error ? cause.message : String(cause))
      setStatus('failed')
    }
  }, [connection, catalog, search])

  const loadSideData = useCallback(async (recordId: string | null) => {
    const request = selectionRequest.current
    setHistory([])
    setPublications([])
    try {
      const [historyResult, publicationsResult] = await Promise.all([
        recordId ? rpc(connection, 'catalog-history', { catalog, record_id: recordId }) : Promise.resolve(null),
        showPublication ? rpc(connection, 'catalog-publications', { catalog }) : Promise.resolve(null),
      ])
      if (request !== selectionRequest.current) return
      setHistory(Array.isArray(historyResult?.history) ? historyResult.history.filter(isRecord) : [])
      setPublications(Array.isArray(publicationsResult?.publications) ? publicationsResult.publications.filter(isRecord) : [])
    } catch (cause) {
      if (request !== selectionRequest.current) return
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [connection, catalog, showPublication])

  useEffect(() => {
    if (!availableCatalogs.includes(catalog)) setCatalog(availableCatalogs[0])
  }, [availableCatalogs, catalog])

  useEffect(() => {
    ++listRequest.current
    ++selectionRequest.current
    setSelected(null)
    setMode('view')
    setPreview(null)
    const timer = setTimeout(() => { void loadList() }, search ? 250 : 0)
    return () => { clearTimeout(timer); ++listRequest.current; ++selectionRequest.current }
  }, [loadList])

  useEffect(() => {
    if (catalog !== 'customer') return
    void rpc(connection, 'catalog-customer-options', {}).then(result => {
      setCustomerOptions({
        source_types: Array.isArray(result.source_types) ? result.source_types.filter(isRecord).map(item => ({ id: valueText(item.id), name: valueText(item.name) })) : [],
        staff: Array.isArray(result.staff) ? result.staff.filter(isRecord).map(item => ({ id: valueText(item.id), name: valueText(item.name), email: valueText(item.email), role: valueText(item.role) })) : [],
      })
    }).catch(cause => setError(cause instanceof Error ? cause.message : String(cause)))
  }, [connection, catalog])

  const selectRecord = async (recordId: string) => {
    const request = ++selectionRequest.current
    setStatus('busy')
    setError(null)
    try {
      const result = await rpc(connection, 'catalog-get', { catalog, record_id: recordId })
      if (request !== selectionRequest.current) return
      const record = requireCatalogRecord(result.record)
      setSelected(record)
      setFields(formFromRecord(record))
      setMode('view')
      setFieldErrors({})
      setStatus('idle')
      await loadSideData(recordId)
    } catch (cause) {
      if (request !== selectionRequest.current) return
      setError(cause instanceof Error ? cause.message : String(cause))
      setStatus('failed')
    }
  }

  const routedRecord = useRef('')
  useEffect(() => {
    if (catalog !== 'customer' || !list) return
    const route = window.location.hash.match(/^#customers\/([^/]+)$/)?.[1]
    if (!route || routedRecord.current === route || !list.items.some(item => valueText(item.record_id) === route)) return
    routedRecord.current = route
    void selectRecord(route)
  }, [catalog, list])

  const startCreate = () => {
    ++selectionRequest.current
    setFields(emptyCatalogForm(catalog))
    setSelected(null)
    setMode('create')
    setFieldErrors({})
    setError(null)
  }

  const startEdit = () => {
    if (!selected) return
    setFields(formFromRecord(selected))
    setMode('edit')
    setFieldErrors({})
    setError(null)
  }

  const save = async () => {
    if (mode === 'view' || (mode === 'edit' && !selected)) return
    const localErrors = validateCatalogForm(catalog, fields)
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors)
      setError('Correct the highlighted fields before saving.')
      return
    }
    setStatus('busy')
    setError(null)
    setFieldErrors({})
    try {
      const result = await rpc(connection, 'save-catalog-record', catalogSavePayload(catalog, fields, mode === 'create' ? null : selected))
      if (result.saved !== true) throw new Error('The catalog did not confirm that the record was saved.')
      const record = requireCatalogRecord(result.record)
      setSelected(record)
      setFields(formFromRecord(record))
      setMode('view')
      setStatus('saved')
      await Promise.all([loadList(), loadSideData(valueText(record.record_id))])
      setStatus('saved')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message)
      setStatus('failed')
    }
  }

  const setArchived = async (archived: boolean) => {
    if (!selected) return
    const verb = archived ? 'Archive' : 'Restore'
    if (!window.confirm(`${verb} this ${CATALOG_LABELS[catalog]} record?`)) return
    setStatus('busy')
    setError(null)
    try {
      const result = await rpc(connection, 'archive-catalog-record', {
        catalog,
        record_id: valueText(selected.record_id),
        expected_revision: Number(selected.revision),
        restore: !archived,
      })
      const record = requireCatalogRecord(result.record)
      setSelected(record)
      setFields(formFromRecord(record))
      setMode('view')
      setStatus('saved')
      await Promise.all([loadList(), loadSideData(valueText(record.record_id))])
      setStatus('saved')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setStatus('failed')
    }
  }

  const loadPreview = async () => {
    setStatus('busy')
    setError(null)
    try {
      const result = await rpc(connection, 'catalog-preview-publish', { catalog })
      setPreview(result)
      await loadSideData(selected ? valueText(selected.record_id) : null)
      setStatus('idle')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setStatus('failed')
    }
  }

  const publish = async () => {
    if (!window.confirm(`Publish the ${CATALOG_LABELS[catalog]} catalog to Splunk as ${valueText(preview?.lookup_name)}?`)) return
    setStatus('busy')
    setError(null)
    try {
      await rpc(connection, 'publish-catalog', { catalog })
      const result = await rpc(connection, 'catalog-preview-publish', { catalog })
      setPreview(result)
      await loadSideData(selected ? valueText(selected.record_id) : null)
      setStatus('saved')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setStatus('failed')
    }
  }

  const rollback = async (publicationId: string) => {
    if (!window.confirm('Restore this previously published revision to Splunk?')) return
    setStatus('busy')
    setError(null)
    try {
      await rpc(connection, 'rollback-publication', { publication_id: publicationId })
      const result = await rpc(connection, 'catalog-preview-publish', { catalog })
      setPreview(result)
      await loadSideData(selected ? valueText(selected.record_id) : null)
      setStatus('saved')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setStatus('failed')
    }
  }

  if (authError) {
    return (
      <div className={css.page}>
        <div className={css.card}>
          <div className={css.title}>Catalog management requires login</div>
          <div className={css.hint}>Log in from the <a href="/admin">admin console</a>, then reload this page.</div>
        </div>
      </div>
    )
  }

  return (
    <div className={css.page}>
      <header className={css.header}>
        <h1 className={css.title}>{title}</h1>
        {availableCatalogs.length > 1 && <div className={css.tabs} role="tablist">
          {availableCatalogs.map(name => (
            <button
              key={name}
              role="tab"
              aria-selected={catalog === name}
              className={`${css.tab} ${catalog === name ? css.tabActive : ''}`}
              onClick={() => { setCatalog(name); setSearch('') }}
            >
              {CATALOG_LABELS[name]}
            </button>
          ))}
        </div>}
      </header>

      {error && <div className={`${css.message} ${css.error}`} role="alert">{error}</div>}
      {status === 'saved' && <div className={`${css.message} ${css.success}`} role="status">Saved. Every change is recorded in the history.</div>}

      <div className={css.layout}>
        <section className={css.listPane}>
          <div className={css.listToolbar}>
            <input
              className={css.control}
              aria-label="Search catalog"
              placeholder="Search…"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <button className={css.button} type="button" onClick={startCreate}>New record</button>
          </div>
          <div className={css.listMeta}>{list ? `${list.total} record(s)` : 'Loading…'}</div>
          <ul className={css.recordList} role="listbox" aria-label={`${CATALOG_LABELS[catalog]} records`}>
            {(list?.items ?? []).map(record => {
              const id = valueText(record.record_id)
              const active = !!selected && valueText(selected.record_id) === id
              return (
                <li key={id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`${css.recordItem} ${active ? css.recordActive : ''}`}
                    onClick={() => { void selectRecord(id) }}
                  >
                    <span className={css.recordTitle}>{catalogTitle(record, catalog)}</span>
                    <span className={css.recordMeta}>
                      {catalogSubtitle(record, catalog)}
                      {record.archived ? ' · archived' : ''} · rev {valueText(record.revision)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className={css.editorPane}>
          {selected || mode === 'create' ? (
            <>
              <div className={css.editorHeader}>
                <div className={css.editorTitle}>
                  {mode === 'create' ? `New ${CATALOG_LABELS[catalog]} record` : `${CATALOG_LABELS[catalog]}: ${selected ? catalogTitle(selected, catalog) : ''}`}
                  {selected ? <span className={css.editorMeta}> revision {valueText(selected.revision)}{selected.archived ? ' · archived' : ''}</span> : null}
                </div>
                <div className={css.editorActions}>
                  {mode === 'view' && selected && (
                    <>
                      <button className={css.button} type="button" onClick={startEdit} disabled={Boolean(selected.archived)}>Edit</button>
                      {selected.archived
                        ? <button className={css.button} type="button" onClick={() => { void setArchived(false) }}>Restore</button>
                        : <button className={css.button} type="button" onClick={() => { void setArchived(true) }}>Archive</button>}
                    </>
                  )}
                  {mode !== 'view' && (
                    <>
                      <button className={css.button} type="button" disabled={status === 'busy'} onClick={() => { setMode(selected ? 'view' : 'view'); setFieldErrors({}); void (selected ? setFields(formFromRecord(selected)) : startCreate()) }}>Cancel</button>
                      <button className={`${css.button} ${css.primary}`} type="button" disabled={status === 'busy'} onClick={() => { void save() }}>
                        {status === 'busy' ? 'Saving…' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {catalog === 'customer' ? <CustomerEditorFields fields={fields} errors={fieldErrors} disabled={mode === 'view'} options={customerOptions} onChange={(key, value) => setFields(current => ({ ...current, [key]: value }))} /> : <div className={css.fieldGrid}>
                {CATALOG_FIELDS[catalog].map(key => <FieldRow key={key} fieldKey={key} value={String(fields[key] ?? '')} error={fieldErrors[key] ?? ''} disabled={mode === 'view'} onChange={value => setFields(current => ({ ...current, [key]: value }))} />)}
              </div>}

              <details className={css.section} open>
                <summary>Revision history</summary>
                <HistoryView history={history} />
              </details>
            </>
          ) : (
            <div className={css.hint}>Select a record from the list, or create a new one.</div>
          )}

          {showPublication && <details className={css.section} open>
            <summary>Publication to Splunk</summary>
            <div className={css.publishBar}>
              <button className={css.button} type="button" disabled={status === 'busy'} onClick={() => { void loadPreview() }}>Preview snapshot</button>
              {preview && (
                <button className={`${css.button} ${css.primary}`} type="button" disabled={status === 'busy'} onClick={() => { void publish() }}>Publish…</button>
              )}
            </div>
            {preview && (
              <div className={css.preview}>
                <div>Lookup: <strong>{valueText(preview.lookup_name)}</strong> · {valueText(preview.record_count)} record(s)</div>
                <div>Checksum: <code>{valueText(preview.content_checksum)}</code></div>
                <div className={(preview.validation as Record<string, unknown>)?.valid ? css.success : css.error}>
                  {(preview.validation as Record<string, unknown>)?.valid
                    ? 'Validation passed; ready to publish.'
                    : JSON.stringify((preview.validation as Record<string, unknown>)?.errors)}
                </div>
                {Array.isArray((preview.validation as Record<string, unknown>)?.warnings) && ((preview.validation as Record<string, unknown>).warnings as string[]).length > 0 && (
                  <div className={css.hint}>Warnings: {((preview.validation as Record<string, unknown>).warnings as string[]).slice(0, 10).join(' · ')}</div>
                )}
              </div>
            )}
            {publications.length > 0 && (
              <table className={css.publicationTable}>
                <thead>
                  <tr><th>When</th><th>Outcome</th><th>Checksum</th><th>Actor</th><th /></tr>
                </thead>
                <tbody>
                  {publications.map(publication => (
                    <tr key={valueText(publication.publication_id)}>
                      <td>{valueText(publication.published_at)}</td>
                      <td><StatusPill status={valueText(publication.outcome)} /></td>
                      <td><code>{valueText(publication.content_checksum).slice(0, 12)}</code></td>
                      <td>{valueText(publication.actor)}</td>
                      <td>
                        {publication.outcome === 'published' && (
                          <button className={css.button} type="button" onClick={() => { void rollback(valueText(publication.publication_id)) }}>Restore</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </details>}
        </section>
      </div>
    </div>
  )
}
