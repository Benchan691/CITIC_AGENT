import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import React, { useCallback, useEffect, useState } from 'react'
import css from './CatalogManager.module.css'
import { rpc } from './settings-common.ts'
import {
  CATALOG_FIELDS,
  CATALOG_LABELS,
  SELECT_FIELDS,
  catalogSubtitle,
  catalogTitle,
  formFromRecord,
  recordFromForm,
  validateCatalogForm,
  type CatalogName,
} from './catalog.ts'

type ViewMode = 'view' | 'edit' | 'create'
type PageStatus = 'idle' | 'busy' | 'saved' | 'failed'

const CATALOGS: CatalogName[] = ['rule', 'customer', 'fix_source_type']

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
  const label = fieldKey.replace(/_/g, ' ')
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

export function CatalogManager({ connection }: { connection: ConnectionHandle }) {
  const [catalog, setCatalog] = useState<CatalogName>('rule')
  const [search, setSearch] = useState('')
  const [list, setList] = useState<{ items: Record<string, unknown>[]; total: number } | null>(null)
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [mode, setMode] = useState<ViewMode>('view')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<PageStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Record<string, unknown>[]>([])
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [publications, setPublications] = useState<Record<string, unknown>[]>([])

  const authError = error === 'authentication required' || error?.includes('authentication')

  const loadList = useCallback(async () => {
    setStatus('busy')
    setError(null)
    try {
      const result = await rpc(connection, 'catalog-list', {
        catalog,
        search,
        limit: 200,
        include_archived: true,
      })
      setList({ items: Array.isArray(result.items) ? result.items : [], total: Number(result.total ?? 0) })
      setStatus('idle')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setStatus('failed')
    }
  }, [connection, catalog, search])

  const loadSideData = useCallback(async (recordId: string | null) => {
    setHistory([])
    setPublications([])
    setPreview(null)
    try {
      if (recordId) {
        const result = await rpc(connection, 'catalog-history', { catalog, record_id: recordId })
        setHistory(Array.isArray(result.history) ? result.history : [])
      }
      const publicationsResult = await rpc(connection, 'catalog-publications', { catalog })
      setPublications(Array.isArray(publicationsResult.publications) ? publicationsResult.publications : [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [connection, catalog])

  useEffect(() => {
    setSelected(null)
    setMode('view')
    void loadList()
  }, [loadList])

  const selectRecord = async (recordId: string) => {
    setStatus('busy')
    setError(null)
    try {
      const result = await rpc(connection, 'catalog-get', { catalog, record_id: recordId })
      setSelected(result.record)
      setFields(formFromRecord(result.record))
      setMode('view')
      setFieldErrors({})
      setStatus('idle')
      await loadSideData(recordId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setStatus('failed')
    }
  }

  const startCreate = () => {
    const empty: Record<string, string> = {}
    for (const key of CATALOG_FIELDS[catalog]) empty[key] = ''
    setFields(empty)
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
    if (!mode) return
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
      const recordId = selected ? valueText(selected.record_id) : undefined
      const result = await rpc(connection, 'save-catalog-record', {
        catalog,
        operation: mode === 'create' ? 'write' : 'update',
        record: recordFromForm(catalog, fields),
        ...(mode === 'update' && recordId ? { record_id: recordId } : {}),
        ...(mode === 'update' && selected ? { expected_revision: Number(selected.revision) } : {}),
      })
      setSelected(result.record)
      setFields(formFromRecord(result.record))
      setMode('view')
      setStatus('saved')
      await loadList()
      await loadSideData(valueText(result.record.record_id))
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
      setSelected(result.record)
      setFields(formFromRecord(result.record))
      setMode('view')
      setStatus('saved')
      await loadList()
      await loadSideData(valueText(result.record.record_id))
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
        <h1 className={css.title}>SOC Catalogs</h1>
        <div className={css.tabs} role="tablist">
          {CATALOGS.map(name => (
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
        </div>
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
              const active = selected && valueText(selected.record_id) === id
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
              <div className={css.fieldGrid}>
                {CATALOG_FIELDS[catalog].map(key => (
                  <FieldRow
                    key={key}
                    fieldKey={key}
                    value={fields[key] ?? ''}
                    error={fieldErrors[key] ?? ''}
                    disabled={mode === 'view'}
                    onChange={value => setFields(current => ({ ...current, [key]: value }))}
                  />
                ))}
              </div>

              <details className={css.section} open>
                <summary>Revision history</summary>
                <HistoryView history={history} />
              </details>
            </>
          ) : (
            <div className={css.hint}>Select a record from the list, or create a new one.</div>
          )}

          <details className={css.section} open>
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
          </details>
        </section>
      </div>
    </div>
  )
}
