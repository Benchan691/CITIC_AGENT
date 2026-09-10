import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import styles from './AdminConsole.module.css'

type Recipients = { recipients?: string[]; cc?: string[]; bcc?: string[]; language?: string; brand?: string }
type Customer = { id: string; record_id?: string; revision?: number; cid?: string; gid: string; name: string; display_name?: string; lifecycle_status?: string; alert_delivery_enabled?: boolean; email_config: Recipients }
type Routing = { source_type_ids?: string[]; ips?: string[]; hostnames?: string[]; recipients?: Recipients }
type Rule = { id?: string; name: string; customer_id?: string | null; ruleset_id?: string | null; severities: string[]; enabled: boolean; routing?: Routing }
type Delivery = { event_id: string; eid?: string; event_eid?: string; customer_id?: string; cid?: string; aid?: string; customer: string; status: string; created: string; smtp_accepted?: string; accepted: string[]; rejected: Record<string, number>; error?: string }
type AlertPolicy = { detail_columns?: string[]; required_columns?: string[]; optional_columns?: string[]; field_mappings?: { source: string; label?: string; required?: boolean }[]; row_filters?: Record<string, unknown>[]; max_display_rows?: number; max_stored_rows?: number; severity_source?: string; severity_mapping?: Record<string, string>; severity_fallback?: string }
type PolicyRecord = { id?: string; customer_id: string; registration_id?: string | null; revision?: number; policy: AlertPolicy; invalid_reason?: string | null; inherited_from_customer?: boolean }
type Registration = { id: string; customer_id: string; cid?: string; aid?: string; saved_search_name?: string; deployment?: string; app?: string; owner?: string; source_indexes?: string[]; registration_state?: string; delivery_state?: string; delivery_enabled?: boolean; presence_state?: string; publication_state?: string; definition_revision?: number; action_configured?: boolean; last_error?: string | null }
type Ownership = { id?: string; deployment: string; index_name: string; customer_id: string; cid?: string; status: string; verified_at?: string | null; verified_by?: string; naming_compliant?: boolean }
type Review = { id: string; deployment?: string; app?: string; owner?: string; saved_search_name?: string; source_indexes?: string[]; reason?: string; attempt_count?: number }
export type EmailSettings = {
  runtime: { enabled?: boolean; configured?: boolean; host?: string; interval_seconds?: number }
  customers: Customer[]; rules: Rule[]; source_types: { id: string; name: string }[]; history: Delivery[]
  delivery: Record<string, unknown>; metrics?: Record<string, number>; alert_registrations?: Registration[]; alert_registration_review?: Review[]; alert_index_ownership?: Ownership[]; alert_policies?: PolicyRecord[]; alert_quarantine?: Record<string, unknown>[]; alert_run_quarantine?: Record<string, unknown>[]; migration_report?: Record<string, unknown>
}
type Preview = { subject: string; html: string; text: string; recipients: Recipients; matched_rules: string[]; delivery_mode?: string; held?: boolean; eligible?: boolean; eligibility_reason?: string }
type ImportRow = { row: number; status: string; error?: string; rules?: Rule[] }
export async function emailRequest<T>(path = 'settings', payload?: unknown): Promise<T> {
  const response = await fetch(`/admin/alert-email/${path}`, {
    credentials: 'same-origin', ...(payload === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }),
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(response.status === 401 ? 'Your admin session has expired. Sign in again to continue.' : value.error || 'The request failed. Please try again.')
  return value as T
}
const addresses = (value: string) => value.split(/[\n,;]/).map(v => v.trim()).filter(Boolean)
const joined = (value?: string[]) => (value || []).join('\n')
const lines = (value?: string[] | null) => (value || []).join('\n')
const parseLines = (value: string) => [...new Set(value.split(/[\n,]+/).map(item => item.trim()).filter(Boolean))]
function cleanOptionalRecipients(value: Recipients): Recipients {
  const result = { ...value, recipients: addresses(joined(value.recipients)), cc: addresses(joined(value.cc)), bcc: addresses(joined(value.bcc)) }
  for (const key of ['recipients','cc','bcc'] as const) {
    if (result[key].length > 50 || result[key].some(address => address.length > 320 || !/^[^\s@<>]+@[^\s@<>]+$/.test(address))) throw new Error('Use plain email addresses, one per line, with no more than 50 per field.')
  }
  return result
}
export function deliveryLabel(status: string): string {
  return ({ accepted: 'Relay accepted', sent: 'Legacy send recorded', failed: 'Failed / rejected', uncertain: 'Needs review', pending: 'Queued', processing: 'Sending', disabled: 'Skipped' } as Record<string,string>)[status] || status
}
export function StatusBadge({ status }: { status: string }) {
  const color = ['accepted','enabled'].includes(status) ? styles.statusReady : ['failed','uncertain'].includes(status) ? styles.statusError : styles.statusMuted
  return <span className={`${styles.statusPill} ${color}`}>{status === 'enabled' ? 'Enabled' : status === 'disabled-rule' ? 'Disabled' : deliveryLabel(status)}</span>
}
function AddressFields({ value, onChange }: { value: Recipients; onChange: (value: Recipients) => void }) {
  return <><label className={styles.field}><span>To recipients</span><textarea className={styles.input} rows={2} value={joined(value.recipients)} onChange={e => onChange({ ...value, recipients: e.target.value.split('\n') })} placeholder="soc@example.com" required /><small className={styles.fieldHint}>One address per line. CC and BCC are optional.</small></label>
    <div className={styles.fieldGrid}>{(['cc','bcc'] as const).map(key => <label className={styles.field} key={key}><span>{key.toUpperCase()}</span><textarea className={styles.input} rows={2} value={joined(value[key])} onChange={e => onChange({ ...value, [key]: e.target.value.split('\n') })} /></label>)}</div></>
}
function cleanRecipients(value: Recipients): Recipients {
  const result = { ...value, recipients: addresses(joined(value.recipients)), cc: addresses(joined(value.cc)), bcc: addresses(joined(value.bcc)) }
  if (!result.recipients.length) throw new Error('Add at least one To recipient.')
  for (const key of ['recipients','cc','bcc'] as const) {
    if (result[key].length > 50) throw new Error('Use no more than 50 addresses in each recipient list.')
    if (result[key].some(address => address.length > 320 || !/^[^\s@<>]+@[^\s@<>]+$/.test(address))) throw new Error('Use plain email addresses, one per line, without display names.')
  }
  return result
}
export function AlertEmailSettings() {
  const [data, setData] = useState<EmailSettings | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const emailTab = () => ['routes','customers','governance','preview','history','import'].includes(window.location.hash.split('/')[1]) ? window.location.hash.split('/')[1] : 'routes'
  const [tab, setTab] = useState(emailTab)
  useEffect(() => {
    const change = () => { if (window.location.hash.startsWith('#notifications')) setTab(emailTab()) }
    window.addEventListener('hashchange',change)
    return () => window.removeEventListener('hashchange',change)
  }, [])
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await emailRequest<EmailSettings>()) } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const saved = async (text: string) => { setMessage(text); await load() }
  return <section className={styles.section} aria-label="Alert email settings">
    <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>Delivery controls</p><h2 className={styles.sectionTitle}>The right alert, to the right people.</h2></div><button className={styles.button} onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={`${styles.message} ${styles.success}`} role="status">{message}</p>}
    {!data && loading && <p className={styles.empty}>Loading email configuration…</p>}
    {data && <>
      <div className={styles.notice}><span className={`${styles.statusPill} ${data.runtime.enabled && data.runtime.configured ? styles.statusReady : styles.statusMuted}`}>{data.runtime.enabled && data.runtime.configured ? 'Sending enabled' : data.runtime.enabled ? 'Setup incomplete' : 'Sending paused'}</span><span>{data.runtime.enabled && data.runtime.configured ? 'New matching events enter the delivery queue.' : 'You can prepare recipients and rules while sending is paused.'} SMTP relay settings are managed on the server.</span></div>
      <nav className={styles.tabs} aria-label="Email sections">{[['routes','Notification rules'],['customers','Customer defaults'],['governance','Identity & policies'],['preview','Preview email'],['history','Delivery history'],['import','Import routes']].map(([id,label]) => <button key={id} className={tab === id ? styles.activeTab : ''} onClick={() => { setTab(id); setMessage(''); window.history.replaceState(null,'','#notifications/' + id) }} aria-current={tab === id ? 'page' : undefined}>{label}</button>)}</nav>
      <div hidden={tab !== 'routes'}><RulesPanel data={data} onSaved={saved} /></div>
      <div hidden={tab !== 'customers'}><CustomerPanel data={data} onSaved={saved} /></div>
      <div hidden={tab !== 'governance'}><GovernancePanel data={data} onSaved={saved} /></div>
      <div hidden={tab !== 'preview'}><PreviewPanel data={data} /></div>
      <div hidden={tab !== 'history'}><HistoryPanel data={data} /></div>
      <div hidden={tab !== 'import'}><ImportPanel data={data} onSaved={saved} /></div>
    </>}
  </section>
}
function CustomerOptions({ data }: { data: EmailSettings }) {
  return <>{data.customers.map(c => <option key={c.id} value={c.id}>{c.cid || c.gid} · {c.name}</option>)}</>
}
function CustomerConfigEditor({ customer, onSaved }: { customer: Customer; onSaved: (message: string) => Promise<void> }) {
  const [config, setConfig] = useState<Recipients>(() => ({ recipients: [], cc: [], bcc: [], ...customer.email_config }))
  const [enabled, setEnabled] = useState(Boolean(customer.alert_delivery_enabled))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const email_config = cleanOptionalRecipients(config)
      await emailRequest('customer', { customer_id: customer.id, email_config, alert_delivery_enabled: enabled })
      await onSaved(`Customer ${customer.cid || customer.gid || customer.name} defaults saved.`)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  const update = (key: 'recipients' | 'cc' | 'bcc', value: string) => setConfig(current => ({ ...current, [key]: value.split(/[\n,;]/).map(item => item.trim()).filter(Boolean) }))
  return <form className={styles.card} onSubmit={save} aria-label={`Email defaults for ${customer.name}`}>
    <div className={styles.sectionHeading}><div><h3 className={styles.editorTitle}>{customer.display_name || customer.name}</h3><p className={styles.fieldHint}>{customer.cid || 'No CID'} · {customer.gid || 'No legacy GID'} · {customer.lifecycle_status || 'unknown'}{customer.revision ? ` · revision ${customer.revision}` : ''}</p></div><span className={`${styles.statusPill} ${enabled ? styles.statusReady : styles.statusMuted}`}>{enabled ? 'Future delivery enabled' : 'Future delivery disabled'}</span></div>
    <div className={styles.fieldGrid}>{(['recipients','cc','bcc'] as const).map(key => <label className={styles.field} key={key}><span>{key === 'recipients' ? 'To recipients' : key.toUpperCase()}</span><textarea className={styles.input} rows={2} value={lines(config[key])} onChange={event => update(key, event.target.value)} placeholder={key === 'recipients' ? 'One address per line' : 'Optional'} /></label>)}</div>
    <div className={styles.fieldGrid}><label className={styles.field}><span>Language</span><select className={styles.input} value={config.language || 'EN'} onChange={event => setConfig(current => ({ ...current, language: event.target.value }))}><option value="EN">English</option><option value="CN">简体中文</option><option value="ZH">繁體中文</option></select></label><label className={styles.field}><span>Brand</span><select className={styles.input} value={config.brand || 'CPC'} onChange={event => setConfig(current => ({ ...current, brand: event.target.value }))}><option value="CPC">CPC</option><option value="CEC">CEC</option></select></label></div>
    <label className={styles.checkLabel}><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />Allow new registered runs to enter the customer email queue</label>
    {error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.actions}><button className={`${styles.button} ${styles.primary}`} disabled={busy}>{busy ? 'Saving…' : 'Save customer defaults'}</button><button className={styles.button} type="button" onClick={() => { window.location.hash = `#customers/${customer.record_id || ''}` }}>Open customer catalog</button></div>
  </form>
}
function CustomerPanel({ data, onSaved }: { data: EmailSettings; onSaved: (message: string) => Promise<void> }) {
  return <div className={styles.contentGrid}><div>{data.customers.length ? data.customers.map(customer => <CustomerConfigEditor key={customer.id} customer={customer} onSaved={onSaved} />) : <div className={styles.card}><p className={styles.empty}>No customers available. Add a customer to the catalog first.</p></div>}</div><aside className={styles.helpCard}><p className={styles.sectionKicker}>Customer delivery gate</p><h3>Identity first, delivery second.</h3><p>The CID is the public customer identity. Administrators assign recipients and explicitly enable future registered alert runs.</p><p>Changing recipients or policy does not replay historical events. Held events need a separate review release.</p><p>Customer and index ownership changes can hold queued events automatically.</p></aside></div>
}

function jsonText(value: unknown, fallback: unknown = []) {
  return JSON.stringify(value ?? fallback, null, 2)
}
function PolicyEditor({ record, customer, onSaved }: { record: PolicyRecord; customer: Customer; onSaved: (message: string) => Promise<void> }) {
  const initial = record.policy || {}
  const [detail, setDetail] = useState(lines(initial.detail_columns))
  const [required, setRequired] = useState(lines(initial.required_columns))
  const [optional, setOptional] = useState(lines(initial.optional_columns))
  const [mappings, setMappings] = useState((initial.field_mappings || []).map(item => `${item.source} | ${item.label || item.source} | ${item.required ? 'required' : 'optional'}`).join('\n'))
  const [filters, setFilters] = useState(jsonText(initial.row_filters, []))
  const [severityMapping, setSeverityMapping] = useState(jsonText(initial.severity_mapping, {}))
  const [severitySource, setSeveritySource] = useState(initial.severity_source || '')
  const [fallback, setFallback] = useState(initial.severity_fallback || 'unknown')
  const [displayRows, setDisplayRows] = useState(String(initial.max_display_rows || 50))
  const [storedRows, setStoredRows] = useState(String(initial.max_stored_rows || 1000))
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const field_mappings = mappings.split('\n').map(item => item.trim()).filter(Boolean).map(item => { const [source, label, requiredFlag] = item.split('|').map(value => value.trim()); if (!source) throw new Error('Every field mapping needs a source field.'); return { source, label: label || source, required: requiredFlag?.toLowerCase() === 'required' } })
      const policy: AlertPolicy = { detail_columns: parseLines(detail), required_columns: parseLines(required), optional_columns: parseLines(optional), field_mappings, row_filters: JSON.parse(filters || '[]'), severity_source: severitySource.trim(), severity_mapping: JSON.parse(severityMapping || '{}'), severity_fallback: fallback, max_display_rows: Number(displayRows), max_stored_rows: Number(storedRows) }
      await emailRequest('policy', { customer_id: customer.id, ...(record.registration_id ? { registration_id: record.registration_id } : {}), policy })
      await onSaved(`Email policy for ${customer.cid || customer.gid || customer.name} saved.`)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  async function removeOverride() {
    if (!record.registration_id || !record.id) return
    setBusy(true); setError('')
    try {
      await emailRequest('policy/remove', { customer_id: customer.id, registration_id: record.registration_id })
      await onSaved(`Per-alert policy override removed; ${customer.cid || customer.gid || customer.name} defaults now apply.`)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  return <form className={styles.card} onSubmit={save} aria-label={`Alert email policy for ${customer.name}`}>
    <div className={styles.sectionHeading}><div><h3 className={styles.editorTitle}>{record.registration_id ? record.inherited_from_customer ? 'Inherited alert policy' : 'Per-alert override' : 'Customer default policy'}</h3><p className={styles.fieldHint}>{customer.cid || customer.gid} · {record.id ? `policy ${record.id} · revision ${record.revision || 0}` : record.inherited_from_customer ? 'uses customer default until saved' : 'new policy'}</p></div><span className={`${styles.statusPill} ${record.invalid_reason ? styles.statusError : styles.statusInfo}`}>{record.invalid_reason || (record.inherited_from_customer ? 'Inherited' : 'Administrator controlled')}</span></div>
    <div className={styles.fieldGrid}><label className={styles.field}><span>Detail columns <em>one per line, order is preserved</em></span><textarea className={styles.input} rows={4} value={detail} onChange={event => setDetail(event.target.value)} placeholder="device\nsource_ip\nhostname" /></label><label className={styles.field}><span>Required columns</span><textarea className={styles.input} rows={4} value={required} onChange={event => setRequired(event.target.value)} placeholder="device" /></label></div>
    <div className={styles.fieldGrid}><label className={styles.field}><span>Optional columns</span><textarea className={styles.input} rows={3} value={optional} onChange={event => setOptional(event.target.value)} /></label><label className={styles.field}><span>Field mappings <em>source | display label | required</em></span><textarea className={styles.input} rows={3} value={mappings} onChange={event => setMappings(event.target.value)} placeholder="device | Device | required" /></label></div>
    <div className={styles.fieldGrid}><label className={styles.field}><span>Row filters <em>JSON only; no SPL</em></span><textarea className={`${styles.input} ${styles.mono}`} rows={4} value={filters} onChange={event => setFilters(event.target.value)} /></label><label className={styles.field}><span>Severity mapping <em>JSON source value to severity</em></span><textarea className={`${styles.input} ${styles.mono}`} rows={4} value={severityMapping} onChange={event => setSeverityMapping(event.target.value)} /></label></div>
    <div className={styles.fieldGrid}><label className={styles.field}><span>Severity source</span><input className={styles.input} value={severitySource} onChange={event => setSeveritySource(event.target.value)} placeholder="severity" /></label><label className={styles.field}><span>Fallback severity</span><select className={styles.input} value={fallback} onChange={event => setFallback(event.target.value)}>{['unknown','info','low','medium','high','critical'].map(value => <option key={value}>{value}</option>)}</select></label></div>
    <div className={styles.fieldGrid}><label className={styles.field}><span>Maximum displayed rows</span><input className={styles.input} type="number" min={1} max={1000} value={displayRows} onChange={event => setDisplayRows(event.target.value)} /></label><label className={styles.field}><span>Maximum stored rows</span><input className={styles.input} type="number" min={1} max={1000} value={storedRows} onChange={event => setStoredRows(event.target.value)} /></label></div>
    {error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.actions}><button className={`${styles.button} ${styles.primary}`} disabled={busy}>{busy ? 'Saving…' : record.inherited_from_customer ? 'Create alert override' : 'Save policy'}</button>{record.registration_id && record.id && <button className={styles.button} type="button" disabled={busy} onClick={() => void removeOverride()}>Use customer default</button>}</div>
  </form>
}

function ReviewResolution({ review, data, onSaved }: { review: Review; data: EmailSettings; onSaved: (message: string) => Promise<void> }) {
  const [customer, setCustomer] = useState(data.customers[0]?.id || '')
  const [indexes, setIndexes] = useState((review.source_indexes || []).join('\n'))
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function resolve(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const source_indexes = parseLines(indexes)
      if (!source_indexes.length) throw new Error('Add at least one exact, verified source index.')
      await emailRequest('review/resolve', { review_id: review.id, customer_id: customer, source_indexes })
      await onSaved(`Review for ${review.saved_search_name || 'alert'} resolved and its AID allocated.`)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  return <article className={styles.importRow}><div><strong>{review.saved_search_name || 'Unnamed alert'}</strong><p className={styles.fieldHint}>{review.deployment} · {review.app || '—'} / {review.owner || '—'}</p><p>{review.reason || 'Needs administrator review'}</p><form className={styles.formFields} onSubmit={resolve}><select className={styles.input} value={customer} disabled={busy} onChange={event => setCustomer(event.target.value)} required><CustomerOptions data={data} /></select><textarea className={styles.input} rows={2} value={indexes} disabled={busy} onChange={event => setIndexes(event.target.value)} placeholder="one verified index per line" required /><button className={styles.button} disabled={busy}>{busy ? 'Resolving…' : 'Approve scope and allocate AID'}</button>{error && <p className={styles.error} role="alert">{error}</p>}</form></div></article>
}

function RegistrationRow({ registration, data, onSaved }: { registration: Registration; data: EmailSettings; onSaved: (message: string) => Promise<void> }) {
  const [indexes, setIndexes] = useState((registration.source_indexes || []).join('\n'))
  const [customer, setCustomer] = useState(registration.customer_id)
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function toggle() {
    setBusy(true); setError('')
    try { await emailRequest('registration', { registration_id: registration.id, enabled: !registration.delivery_enabled }); await onSaved(`Delivery ${registration.delivery_enabled ? 'disabled' : 'enabled'} for ${registration.aid || registration.saved_search_name}.`) } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  async function relink(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { const source_indexes = parseLines(indexes); if (!source_indexes.length) throw new Error('Add at least one exact source index.'); await emailRequest('relink', { registration_id: registration.id, customer_id: customer, source_indexes }); await onSaved(`Registration ${registration.aid || registration.saved_search_name} relinked for review.`) } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  return <tr><td><strong>{registration.aid || 'No AID'}</strong><small>{registration.cid || registration.customer_id}<br />{registration.saved_search_name}</small></td><td><span className={styles.mono}>{registration.deployment}</span><small>{registration.app || '—'} / {registration.owner || '—'}</small></td><td>{registration.registration_state || 'unknown'}<small>{registration.delivery_state || '—'} · {registration.presence_state || '—'} · {registration.publication_state || '—'}</small></td><td>{registration.source_indexes?.join(', ') || 'No verified indexes'}<small>definition revision {registration.definition_revision || 0}</small></td><td><label className={styles.checkLabel}><input type="checkbox" checked={Boolean(registration.delivery_enabled)} disabled={busy} onChange={() => void toggle()} />Allow future delivery</label><form className={styles.formFields} onSubmit={relink}><select className={styles.input} value={customer} disabled={busy} onChange={event => setCustomer(event.target.value)}>{data.customers.map(item => <option key={item.id} value={item.id}>{item.cid || item.gid} · {item.name}</option>)}</select><textarea className={styles.input} rows={2} value={indexes} disabled={busy} onChange={event => setIndexes(event.target.value)} placeholder="exact-index-name" /><button className={styles.button} disabled={busy}>Review/relink scope</button></form>{registration.last_error && <p className={styles.fieldHint}>{registration.last_error}</p>}{error && <p className={styles.error} role="alert">{error}</p>}</td></tr>
}

function GovernancePanel({ data, onSaved }: { data: EmailSettings; onSaved: (message: string) => Promise<void> }) {
  const [ownership, setOwnership] = useState({ deployment: data.alert_index_ownership?.[0]?.deployment || '', index_name: '', customer_id: data.customers[0]?.id || '', status: 'active' })
  const [migrationBusy, setMigrationBusy] = useState(false); const [migrationError, setMigrationError] = useState('')
  const [previewRunId, setPreviewRunId] = useState('')
  const [ownershipBusy, setOwnershipBusy] = useState(false); const [ownershipError, setOwnershipError] = useState('')
  const policies = data.alert_policies || []
  const registrations = data.alert_registrations || []
  const reviews = data.alert_registration_review || []
  const quarantine = [...(data.alert_run_quarantine || []), ...(data.alert_quarantine || [])]
  const migrationReport = data.migration_report || {}
  const metrics = data.metrics || {}
  const recordsFor = (customer: Customer): PolicyRecord[] => {
    const records = policies.filter(record => record.customer_id === customer.id)
    const empty: AlertPolicy = { detail_columns: [], required_columns: [], optional_columns: [], field_mappings: [], row_filters: [], severity_mapping: {}, severity_fallback: 'unknown', max_display_rows: 50, max_stored_rows: 1000 }
    const customerDefault = records.find(record => !record.registration_id) || { customer_id: customer.id, policy: empty }
    const alertRecords = registrations.filter(registration => registration.customer_id === customer.id).map(registration => {
      const override = records.find(record => record.registration_id === registration.id)
      return override || { customer_id: customer.id, registration_id: registration.id, policy: customerDefault.policy, inherited_from_customer: true }
    })
    return [customerDefault, ...alertRecords]
  }
  async function saveOwnership(event: FormEvent) {
    event.preventDefault(); setOwnershipBusy(true); setOwnershipError('')
    try { if (!ownership.deployment.trim() || !ownership.index_name.trim()) throw new Error('Deployment and exact index name are required.'); await emailRequest('ownership', ownership); await onSaved(`Index ${ownership.index_name} ownership saved.`); setOwnership(current => ({ ...current, index_name: '' })) } catch (cause) { setOwnershipError((cause as Error).message) } finally { setOwnershipBusy(false) }
  }
  async function migration(path: 'preview' | 'backfill') {
    setMigrationBusy(true); setMigrationError('')
    try { const result = await emailRequest<{ run_id: string }>(`migration/${path}`, path === 'preview' ? { limit: 1000 } : { preview_run_id: previewRunId }); if (path === 'preview') setPreviewRunId(result.run_id); await onSaved(path === 'preview' ? `Migration preview ${result.run_id} generated. Review it before applying.` : 'Migration backfill completed with historical email replay suppressed.') } catch (cause) { setMigrationError((cause as Error).message) } finally { setMigrationBusy(false) }
  }
  return <>
    <div className={styles.metrics}>{[['Open reviews', metrics.registration_reviews || reviews.length], ['Quarantined runs', metrics.quarantined_runs || data.alert_run_quarantine?.length || 0], ['Held events', metrics.held_events || data.history.filter(row => row.status === 'held').length], ['Missing deliveries', metrics.missing_deliveries || 0], ['Queue age', `${metrics.queue_age_seconds || 0}s`], ['Discovery incomplete', metrics.discovery_incomplete_24h || 0], ['Publication failures', metrics.publication_failures || 0]].map(([label,value]) => <div className={styles.metric} key={String(label)}><span className={styles.metricLabel}>{label}</span><strong>{value}</strong><small><span>Administrator review signal</span></small></div>)}</div>
    <div className={styles.card}><div className={styles.sectionHeading}><div><h3 className={styles.editorTitle}>Migration and operations</h3><p className={styles.editorCopy}>Preview mappings before backfill. Apply is bound to the exact reviewed preview and refuses stale data. Historical email remains suppressed.</p>{previewRunId && <p className={styles.fieldHint}>Reviewed preview candidate: <span className={styles.mono}>{previewRunId}</span></p>}</div><div className={styles.actions}><button className={styles.button} disabled={migrationBusy} onClick={() => void migration('preview')}>Preview migration</button><button className={`${styles.button} ${styles.primary}`} disabled={migrationBusy || !previewRunId} onClick={() => { if (window.confirm(`Apply reviewed preview ${previewRunId}? Historical email replay remains suppressed.`)) void migration('backfill') }}>Apply reviewed preview</button></div></div>{migrationError && <p className={styles.error} role="alert">{migrationError}</p>}<pre className={styles.plainText}>{jsonText(migrationReport, {})}</pre></div>
    <div className={styles.card}><h3 className={styles.editorTitle}>Verified deployment/index ownership</h3><p className={styles.editorCopy}>Names are only hints. Activating ownership verifies the exact index against this server's approved Splunk deployment.</p><form className={styles.formFields} onSubmit={saveOwnership}><div className={styles.fieldGrid}><label className={styles.field}><span>Splunk deployment</span><input className={styles.input} value={ownership.deployment} onChange={event => setOwnership(current => ({ ...current, deployment: event.target.value }))} placeholder="splunk-prod" required /></label><label className={styles.field}><span>Exact index name</span><input className={styles.input} value={ownership.index_name} onChange={event => setOwnership(current => ({ ...current, index_name: event.target.value }))} placeholder="CPC_security" required /></label></div><div className={styles.fieldGrid}><label className={styles.field}><span>Customer</span><select className={styles.input} value={ownership.customer_id} onChange={event => setOwnership(current => ({ ...current, customer_id: event.target.value }))} required><CustomerOptions data={data} /></select></label><label className={styles.field}><span>Ownership state</span><select className={styles.input} value={ownership.status} onChange={event => setOwnership(current => ({ ...current, status: event.target.value }))}><option value="active">Active after live verification</option><option value="review">Needs review</option><option value="retired">Retired</option></select></label></div>{ownershipError && <p className={styles.error} role="alert">{ownershipError}</p>}<button className={`${styles.button} ${styles.primary}`} disabled={ownershipBusy}>{ownershipBusy ? 'Verifying and saving…' : 'Verify and save ownership'}</button></form><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Deployment</th><th>Index</th><th>Customer</th><th>Status</th></tr></thead><tbody>{(data.alert_index_ownership || []).map(item => <tr key={item.id || `${item.deployment}:${item.index_name}`}><td>{item.deployment}</td><td className={styles.mono}>{item.index_name}<small>{item.naming_compliant === false ? 'Existing name retained; does not follow the new CID prefix convention' : 'CID naming convention'}</small></td><td>{item.cid || item.customer_id}</td><td><StatusBadge status={item.status} />{item.verified_at && <small>verified {new Date(item.verified_at).toLocaleString()}</small>}</td></tr>)}</tbody></table>{!data.alert_index_ownership?.length && <p className={styles.empty}>No explicit index ownership has been approved.</p>}</div></div>
    <div className={styles.card}><h3 className={styles.editorTitle}>Alert registrations</h3><p className={styles.editorCopy}>AIDs are allocated by PostgreSQL. Delivery enablement is independent from Splunk activation and publication.</p><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>CID / AID</th><th>Splunk identity</th><th>Lifecycle</th><th>Source scope</th><th>Administrator controls</th></tr></thead><tbody>{registrations.map(registration => <RegistrationRow key={registration.id} registration={registration} data={data} onSaved={onSaved} />)}</tbody></table>{!registrations.length && <p className={styles.empty}>No registered alerts yet.</p>}</div></div>
    <div className={styles.card}><h3 className={styles.editorTitle}>Customer and per-alert policies</h3><p className={styles.editorCopy}>The sender cannot choose fields. Empty detail columns intentionally store and send no result details; CID, AID, EID, severity, trigger time, and counts remain backend-owned.</p>{data.customers.map(customer => recordsFor(customer).map(record => <PolicyEditor key={`${customer.id}:${record.registration_id || 'default'}:${record.id || 'inherited'}:${record.revision || 0}`} record={record} customer={customer} onSaved={onSaved} />))}</div>
    <div className={styles.contentGrid}><div className={styles.card}><h3 className={styles.editorTitle}>Registration review</h3>{reviews.length ? reviews.map(review => <ReviewResolution key={review.id} review={review} data={data} onSaved={onSaved} />) : <p className={styles.empty}>No unresolved registration reviews.</p>}</div><div className={styles.card}><h3 className={styles.editorTitle}>Quarantine and held delivery</h3>{quarantine.length ? quarantine.map(item => <article className={styles.importRow} key={String(item.id)}><div><strong>{String(item.alert_name || item.splunk_sid || item.id)}</strong><p>{String(item.reason || 'Quarantined payload')}</p></div></article>) : <p className={styles.empty}>No unresolved quarantine records.</p>}{data.history.filter(row => row.status === 'held').map(row => <article className={styles.importRow} key={`held-${row.event_id}`}><div><strong className={styles.mono}>{row.eid || row.event_id}</strong><p>{row.cid || row.customer} · {row.aid || 'No AID'}</p><p className={styles.fieldHint}>{row.error || 'Held for review'}</p></div><button className={styles.button} disabled={!row.customer_id} onClick={async () => { try { await emailRequest('release', { event_id: row.event_id, customer_id: row.customer_id }); await onSaved(`Held event ${row.eid || row.event_id} released for future delivery.`) } catch (cause) { setMigrationError((cause as Error).message) } }}>{'Release held run'}</button></article>)}</div></div>
  </>
}

const newRule = (): Rule => ({ name: '', customer_id: '', ruleset_id: '', severities: ['high','critical'], enabled: false, routing: {} })
function RulesPanel({ data, onSaved }: { data: EmailSettings; onSaved: (message: string) => Promise<void> }) {
  const [draft, setDraft] = useState<Rule | null>(null)
  const editor = useRef<HTMLFormElement>(null)
  const editing = draft !== null
  useEffect(() => {
    if (editing) { editor.current?.scrollIntoView({ block: 'start' }); editor.current?.querySelector('input')?.focus({ preventScroll: true }) }
  }, [editing, draft?.id])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const edit = (rule: Rule | null) => { if (dirty && !window.confirm('Discard unsaved rule changes?')) return; setDraft(rule ? structuredClone(rule) : null); setDirty(false); setError('') }
  const update = (value: Partial<Rule>) => { setDraft(d => d && ({ ...d, ...value })); setDirty(true) }
  const route = draft?.routing || {}
  const routing = (value: Partial<Routing>) => update({ routing: { ...route, ...value } })
  async function save(e: FormEvent) {
    e.preventDefault(); if (!draft) return; setBusy(true); setError('')
    try {
      if (!draft.id && data.rules.some(r => r.name === draft.name.trim())) throw new Error('A rule with this name already exists. Edit that rule or choose another name.')
      await emailRequest('rule', { ...draft, customer_id: draft.customer_id || null, ruleset_id: draft.ruleset_id || null, routing: { ...route, ips: addresses(joined(route.ips)), hostnames: addresses(joined(route.hostnames)), ...(route.recipients ? { recipients: cleanRecipients(route.recipients) } : {}) } })
      setDirty(false); setDraft(null); await onSaved('Notification rule saved.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const customerName = (id?: string | null) => data.customers.find(c => c.id === id)?.name || (id ? 'Unknown customer' : 'All customers · own defaults')
  const filtered = data.rules.filter(r => `${r.name} ${customerName(r.customer_id)}`.toLowerCase().includes(query.toLowerCase()))
  return <><div className={styles.toolbar}><label className={styles.search}><span className={styles.srOnly}>Search rules</span><input className={styles.input} type="search" placeholder="Search rules or customers…" value={query} onChange={e => setQuery(e.target.value)} /></label><span className={styles.fieldHint}>{data.rules.length} rules · {data.rules.filter(r => r.enabled).length} enabled</span><button className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => edit(newRule())}>+ New rule</button></div>
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Rule / customer</th><th>Severity</th><th>Recipients</th><th>Status</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead><tbody>{filtered.map(r => <tr key={r.id || r.name}><td><strong>{r.name}</strong><small>{customerName(r.customer_id)}</small></td><td>{r.severities.join(', ')}</td><td>{r.routing?.recipients ? 'Custom recipients' : 'Customer defaults'}</td><td><StatusBadge status={r.enabled ? 'enabled' : 'disabled-rule'} /></td><td><button className={styles.button} disabled={busy} onClick={() => edit(r)} aria-label={`Edit ${r.name}`}>Edit</button></td></tr>)}</tbody></table>{!filtered.length && <p className={styles.empty}>{query ? 'No rules match your search.' : 'No notification rules yet. Create a rule to choose which alerts should send email.'}</p>}</div>
    {draft && <form ref={editor} className={styles.card} onSubmit={save} aria-label="Rule editor"><div className={styles.sectionHeading}><h3 className={styles.editorTitle}>{draft.id ? 'Edit notification rule' : 'New notification rule'}</h3><button className={styles.button} type="button" onClick={() => edit(null)} disabled={busy}>Close</button></div><fieldset className={styles.formFields} disabled={busy}>
      <div className={styles.fieldGrid}><label className={styles.field}><span>Rule name</span><input className={styles.input} value={draft.name} onChange={e => update({ name: e.target.value })} maxLength={160} required /></label><label className={styles.field}><span>Customer</span><select className={styles.input} value={draft.customer_id || ''} onChange={e => update({ customer_id: e.target.value, ruleset_id: '', routing: { ...route, recipients: undefined } })}><option value="">All customers · own defaults</option><CustomerOptions data={data} /></select></label></div>
      <fieldset className={styles.checkboxGroup}><legend>Send for these severities</legend>{['info','low','medium','high','critical'].map(severity => <label key={severity}><input type="checkbox" checked={draft.severities.includes(severity)} onChange={e => update({ severities: e.target.checked ? [...draft.severities,severity] : draft.severities.filter(s => s !== severity) })} />{severity}</label>)}</fieldset>
      <details className={styles.advanced} open={Boolean(route.source_type_ids?.length || route.ips?.length || route.hostnames?.length || draft.ruleset_id)}><summary>Additional filters <span className={styles.fieldHint}>Optional</span></summary><div className={styles.advancedBody}><p className={styles.fieldHint}>All filter categories must match. Within a category, any value may match. Missing event information does not match.</p><fieldset className={styles.checkboxGroup}><legend>Source types</legend>{data.source_types.map(s => <label key={s.id}><input type="checkbox" checked={route.source_type_ids?.includes(s.id) || false} onChange={e => routing({ source_type_ids: e.target.checked ? [...(route.source_type_ids || []),s.id] : route.source_type_ids?.filter(id => id !== s.id) })} />{s.name}</label>)}{!data.source_types.length && <span className={styles.fieldHint}>No source types available.</span>}</fieldset>
        <div className={styles.fieldGrid}><label className={styles.field}><span>IPs, subnets or ranges</span><textarea className={styles.input} rows={2} placeholder="10.0.0.0/24" value={joined(route.ips)} onChange={e => routing({ ips: e.target.value.split('\n') })} /><small className={styles.fieldHint}>One per line. Matches source or destination IP.</small></label><label className={styles.field}><span>Hostnames</span><textarea className={styles.input} rows={2} placeholder="web-*" value={joined(route.hostnames)} onChange={e => routing({ hostnames: e.target.value.split('\n') })} /><small className={styles.fieldHint}>One per line. Use * for a wildcard.</small></label></div>
        <label className={styles.field}><span>Ruleset ID <em>optional</em></span><input className={styles.input} value={draft.ruleset_id || ''} disabled={!draft.customer_id} onChange={e => update({ ruleset_id: e.target.value })} /><small className={styles.fieldHint}>Must belong to the selected customer. Leave blank to include all their rulesets.</small></label></div></details>
      <label className={styles.checkLabel}><input type="checkbox" checked={Boolean(route.recipients)} disabled={!draft.customer_id} onChange={e => routing({ recipients: e.target.checked ? { recipients: [] } : undefined })} />Use custom recipients for this rule</label>{!draft.customer_id && <small className={styles.fieldHint}>Choose one customer to set recipient overrides.</small>}{route.recipients && <AddressFields value={route.recipients} onChange={recipients => routing({ recipients })} />}
      <label className={styles.checkLabel}><input type="checkbox" checked={draft.enabled} onChange={e => update({ enabled: e.target.checked })} />Enable this rule for new alerts</label>
      {error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.actions}><button className={`${styles.button} ${styles.primary}`} type="submit" disabled={!draft.severities.length}>{busy ? 'Saving…' : 'Save rule'}</button><button className={styles.button} type="button" onClick={() => edit(null)}>Cancel</button>{dirty && <span className={styles.fieldHint}>Unsaved changes</span>}</div>
    </fieldset></form>}
  </>
}
function PreviewPanel({ data }: { data: EmailSettings }) {
  const [customer, setCustomer] = useState(data.customers[0]?.id || '')
  const [event, setEvent] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function load(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); setPreview(null); try { setPreview(await emailRequest<Preview>('preview', { customer_id: customer, event_id: event.trim() })) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  return <div className={styles.card}><h3 className={styles.editorTitle}>Preview before delivery</h3><p className={styles.editorCopy}>Uses the same stored snapshot, eligibility check, and renderer as actual delivery. This preview does not send an email.</p><form className={styles.formFields} onSubmit={load}><div className={styles.fieldGrid}><label className={styles.field}><span>Customer</span><select className={styles.input} value={customer} disabled={busy} onChange={e => { setCustomer(e.target.value); setPreview(null) }} required><CustomerOptions data={data} /></select></label><label className={styles.field}><span>Event UUID</span><input className={styles.input} value={event} disabled={busy} onChange={e => { setEvent(e.target.value); setPreview(null) }} required placeholder="Paste the internal event UUID from delivery history" /></label></div><div><button className={`${styles.button} ${styles.primary}`} disabled={busy || !customer}>{busy ? 'Preparing preview…' : 'Preview email'}</button></div></form>{error && <p className={styles.error} role="alert">{error}</p>}{preview && <><div className={styles.previewEnvelope}><strong>{preview.subject}</strong><p>{preview.delivery_mode === 'registered_snapshot' ? `Registered delivery: ${preview.eligible ? 'eligible now' : `held — ${preview.eligibility_reason || 'not eligible'}`}` : `Matching legacy rules: ${preview.matched_rules.join(', ') || 'none'}`}</p><p>To: {preview.recipients.recipients?.join(', ') || 'No recipients'}{preview.recipients.cc?.length ? ` · CC: ${preview.recipients.cc.join(', ')}` : ''}</p>{Boolean(preview.recipients.bcc?.length) && <p>BCC: {preview.recipients.bcc?.join(', ')} <small>(visible here to administrators only)</small></p>}</div><iframe className={styles.previewFrame} title="Alert email preview" sandbox="" srcDoc={preview.html} /><details className={styles.advanced}><summary>Plain-text version</summary><pre className={styles.plainText}>{preview.text}</pre></details></>}</div>
}
function HistoryPanel({ data }: { data: EmailSettings }) {
  const [status,setStatus] = useState('')
  const [query,setQuery] = useState('')
  const history = data.history.filter(row => (!status || row.status === status) && `${row.customer} ${row.eid || row.event_id} ${row.cid || ''} ${row.aid || ''}`.toLowerCase().includes(query.toLowerCase()))
  return <><div className={styles.toolbar}><input className={styles.input} type="search" aria-label="Search delivery history" placeholder="Search customer, CID, AID, or EID…" value={query} onChange={e => setQuery(e.target.value)} /><select className={styles.input} aria-label="Delivery status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All delivery states</option>{['uncertain','failed','accepted','pending','processing','held','disabled','sent'].map(s => <option key={s} value={s}>{deliveryLabel(s)}</option>)}</select></div><p className={styles.fieldHint}>Latest 100 deliveries. Relay acceptance does not confirm mailbox delivery. Uncertain sends need operator review.</p><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Time / customer</th><th>CID / AID / EID</th><th>Delivery state</th><th>Details</th></tr></thead><tbody>{history.map(row => <tr key={row.event_id}><td>{new Date(row.created).toLocaleString()}<small>{row.customer}</small></td><td className={styles.mono}>{row.eid || row.event_id}<small>{row.cid || 'Legacy CID'} · {row.aid || 'Legacy event'}</small></td><td><StatusBadge status={row.status} /></td><td><details><summary>{row.accepted.length} accepted · {Object.keys(row.rejected).length} rejected</summary><div className={styles.deliveryDetails}>{row.accepted.length > 0 && <p>Accepted: {row.accepted.join(', ')}</p>}{Object.entries(row.rejected).map(([address,code]) => <p key={address}>{address} — {code} ({code >= 400 && code < 500 ? 'temporary refusal' : 'permanent refusal'})</p>)}{row.error && <p>{row.error}</p>}{row.smtp_accepted && <p>Relay accepted: {new Date(row.smtp_accepted).toLocaleString()}</p>}<p>Internal event UUID: <span className={styles.mono}>{row.event_id}</span></p></div></details></td></tr>)}</tbody></table>{!history.length && <p className={styles.empty}>{data.history.length ? 'No deliveries match these filters.' : 'No delivery history yet. New matching alerts will appear here.'}</p>}</div></>
}
function ImportPanel({ data, onSaved }: { data: EmailSettings; onSaved: (message: string) => Promise<void> }) {
  const [customer,setCustomer] = useState(data.customers[0]?.id || '')
  const [csv,setCsv] = useState('')
  const [rows,setRows] = useState<ImportRow[]>([])
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [applied,setApplied] = useState<number[]>([])
  async function preview(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); setRows([]); setApplied([]); try { setRows((await emailRequest<{ rows: ImportRow[] }>('preview',{ customer_id: customer, csv })).rows) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  async function apply(row: ImportRow) { setBusy(true); setError(''); try { for (const rule of row.rules || []) await emailRequest('rule',rule); setApplied(old => [...old,row.row]); await onSaved(`Row ${row.row} saved. Imported rules remain disabled.`) } catch (e) { setError(`Row ${row.row}: ${(e as Error).message} Some routes may have saved; refresh the rules before retrying.`) } finally { setBusy(false) } }
  return <div className={styles.card}><h3 className={styles.editorTitle}>Bring your existing routes</h3><p className={styles.editorCopy}>Preview exact customer and source-type mappings first. Unmatched rows stay unapplied; saved rules start disabled.</p><form className={styles.formFields} onSubmit={preview}><label className={styles.field}><span>Customer for this import</span><select className={styles.input} required value={customer} onChange={e => { setCustomer(e.target.value); setRows([]) }} disabled={busy}><CustomerOptions data={data} /></select></label><label className={styles.field}><span>CSV content</span><textarea className={`${styles.input} ${styles.mono}`} rows={6} value={csv} onChange={e => { setCsv(e.target.value); setRows([]) }} disabled={busy} required maxLength={50000} placeholder="source_type,severity,recipients" /><small className={styles.fieldHint}>Up to 100 rows. Headers: gid, source_type, severity, ip1, ip2, hostname, recipients, cc, bcc. Source-type names must match the catalog exactly.</small></label><div><button className={`${styles.button} ${styles.primary}`} disabled={busy || !customer}>{busy ? 'Working…' : 'Preview import'}</button></div></form>{error && <p className={styles.error} role="alert">{error}</p>}{rows.map(row => <div className={styles.importRow} key={row.row}><div><strong>Row {row.row} · {row.status === 'ready' ? 'Ready to save' : 'Needs mapping'}</strong>{row.error && <p>{row.error}</p>}{row.rules?.map(rule => <p key={rule.name}>{rule.name} · {rule.severities.join(', ')} · Source types: {rule.routing?.source_type_ids?.map(id => data.source_types.find(source => source.id === id)?.name || id).join(', ')} · To: {rule.routing?.recipients?.recipients?.join(', ')}{rule.routing?.ips?.length ? ` · IP: ${rule.routing.ips.join(', ')}` : ''}{rule.routing?.hostnames?.length ? ` · Host: ${rule.routing.hostnames.join(', ')}` : ''}{rule.routing?.recipients?.cc?.length ? ` · CC: ${rule.routing.recipients.cc.join(', ')}` : ''}{rule.routing?.recipients?.bcc?.length ? ` · BCC: ${rule.routing.recipients.bcc.join(', ')}` : ''}{data.rules.some(existing => existing.name === rule.name) ? ' · Replaces the existing rule with this name' : ''}</p>)}</div>{row.status === 'ready' && <button className={styles.button} disabled={busy || applied.includes(row.row)} onClick={() => void apply(row)}>{applied.includes(row.row) ? 'Saved disabled' : 'Save disabled routes'}</button>}</div>)}</div>
}
