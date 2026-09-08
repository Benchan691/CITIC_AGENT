import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import styles from './AdminConsole.module.css'

type Recipients = { recipients?: string[]; cc?: string[]; bcc?: string[]; language?: string; brand?: string }
type Customer = { id: string; gid: string; name: string; email_config: Recipients }
type Routing = { source_type_ids?: string[]; ips?: string[]; hostnames?: string[]; recipients?: Recipients }
type Rule = { id?: string; name: string; customer_id?: string | null; ruleset_id?: string | null; severities: string[]; enabled: boolean; routing?: Routing }
type Delivery = { event_id: string; customer: string; status: string; created: string; smtp_accepted?: string; accepted: string[]; rejected: Record<string, number>; error?: string }
export type EmailSettings = {
  runtime: { enabled?: boolean; configured?: boolean; host?: string; interval_seconds?: number }
  customers: Customer[]; rules: Rule[]; source_types: { id: string; name: string }[]; history: Delivery[]
  delivery: Record<string, unknown>
}
type Preview = { subject: string; html: string; text: string; recipients: Recipients; matched_rules: string[] }
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
  const emailTab = () => ['routes','customers','preview','history','import'].includes(window.location.hash.split('/')[1]) ? window.location.hash.split('/')[1] : 'routes'
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
      <nav className={styles.tabs} aria-label="Email sections">{[['routes','Notification rules'],['customers','Customer defaults'],['preview','Preview email'],['history','Delivery history'],['import','Import routes']].map(([id,label]) => <button key={id} className={tab === id ? styles.activeTab : ''} onClick={() => { setTab(id); setMessage(''); window.history.replaceState(null,'','#notifications/' + id) }} aria-current={tab === id ? 'page' : undefined}>{label}</button>)}</nav>
      <div hidden={tab !== 'routes'}><RulesPanel data={data} onSaved={saved} /></div>
      <div hidden={tab !== 'customers'}><CustomerPanel data={data} onSaved={saved} /></div>
      <div hidden={tab !== 'preview'}><PreviewPanel data={data} /></div>
      <div hidden={tab !== 'history'}><HistoryPanel data={data} /></div>
      <div hidden={tab !== 'import'}><ImportPanel data={data} onSaved={saved} /></div>
    </>}
  </section>
}
function CustomerOptions({ data }: { data: EmailSettings }) {
  return <>{data.customers.map(c => <option key={c.id} value={c.id}>{c.gid} · {c.name}</option>)}</>
}
function CustomerPanel({ data, onSaved }: { data: EmailSettings; onSaved: (message: string) => Promise<void> }) {
  const [customerId, setCustomerId] = useState(data.customers[0]?.id || '')
  const [config, setConfig] = useState<Recipients>(data.customers[0]?.email_config || {})
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!dirty) setConfig(data.customers.find(c => c.id === customerId)?.email_config || {})
  }, [data.customers, customerId, dirty])
  const change = (value: Recipients) => { setConfig(value); setDirty(true) }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { await emailRequest('customer', { customer_id: customerId, email_config: cleanRecipients(config) }); setDirty(false); await onSaved('Customer defaults saved.') } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <div className={styles.contentGrid}><form className={styles.card} onSubmit={save}><h3 className={styles.editorTitle}>Customer defaults</h3><p className={styles.editorCopy}>Used when a matching rule has no recipient override.</p><fieldset className={styles.formFields} disabled={busy || !data.customers.length}>
    <label className={styles.field}><span>Customer</span><select className={styles.input} value={customerId} onChange={e => { if (dirty && !window.confirm('Discard unsaved customer changes?')) return; setCustomerId(e.target.value); setConfig(data.customers.find(c => c.id === e.target.value)?.email_config || {}); setDirty(false); setError('') }}><CustomerOptions data={data} /></select></label>
    <AddressFields value={config} onChange={change} />
    <div className={styles.fieldGrid}><label className={styles.field}><span>Email language</span><select className={styles.input} value={config.language || 'EN'} onChange={e => change({ ...config, language: e.target.value })}><option value="EN">English</option><option value="CN">简体中文</option><option value="ZH">繁體中文</option></select></label><label className={styles.field}><span>Brand template</span><select className={styles.input} value={config.brand || 'CPC'} onChange={e => change({ ...config, brand: e.target.value })}><option>CPC</option><option>CEC</option></select></label></div>
    {error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.actions}><button className={`${styles.button} ${styles.primary}`} disabled={!dirty} type="submit">{busy ? 'Saving…' : 'Save defaults'}</button>{dirty && <span className={styles.fieldHint}>Unsaved changes</span>}</div>
  </fieldset>{!data.customers.length && <p className={styles.empty}>No customers available. Add a customer to the catalog first.</p>}</form><aside className={styles.helpCard}><p className={styles.sectionKicker}>How defaults work</p><h3>One customer. One destination.</h3><p>Routes only use the event’s own customer. A rule can replace the default recipients for a specific team.</p><p>BCC recipients remain hidden in the message. Language and brand apply to every alert for this customer.</p><p>Saving defaults does not replay earlier events.</p></aside></div>
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
  return <div className={styles.card}><h3 className={styles.editorTitle}>Preview before delivery</h3><p className={styles.editorCopy}>Uses saved customer defaults and enabled rules. This preview does not send an email.</p><form className={styles.formFields} onSubmit={load}><div className={styles.fieldGrid}><label className={styles.field}><span>Customer</span><select className={styles.input} value={customer} disabled={busy} onChange={e => { setCustomer(e.target.value); setPreview(null) }} required><CustomerOptions data={data} /></select></label><label className={styles.field}><span>Event ID</span><input className={styles.input} value={event} disabled={busy} onChange={e => { setEvent(e.target.value); setPreview(null) }} required placeholder="Paste an event ID from delivery history" /></label></div><div><button className={`${styles.button} ${styles.primary}`} disabled={busy || !customer}>{busy ? 'Preparing preview…' : 'Preview email'}</button></div></form>{error && <p className={styles.error} role="alert">{error}</p>}{preview && <><div className={styles.previewEnvelope}><strong>{preview.subject}</strong><p>Matching rules: {preview.matched_rules.join(', ') || 'None — this event would not send'}</p><p>To: {preview.recipients.recipients?.join(', ') || 'No recipients'}{preview.recipients.cc?.length ? ` · CC: ${preview.recipients.cc.join(', ')}` : ''}</p>{Boolean(preview.recipients.bcc?.length) && <p>BCC: {preview.recipients.bcc?.join(', ')} <small>(visible here to administrators only)</small></p>}</div><iframe className={styles.previewFrame} title="Alert email preview" sandbox="" srcDoc={preview.html} /><details className={styles.advanced}><summary>Plain-text version</summary><pre className={styles.plainText}>{preview.text}</pre></details></>}</div>
}
function HistoryPanel({ data }: { data: EmailSettings }) {
  const [status,setStatus] = useState('')
  const [query,setQuery] = useState('')
  const history = data.history.filter(row => (!status || row.status === status) && `${row.customer} ${row.event_id}`.toLowerCase().includes(query.toLowerCase()))
  return <><div className={styles.toolbar}><input className={styles.input} type="search" aria-label="Search delivery history" placeholder="Search customer or event ID…" value={query} onChange={e => setQuery(e.target.value)} /><select className={styles.input} aria-label="Delivery status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All delivery states</option>{['uncertain','failed','accepted','pending','processing','disabled','sent'].map(s => <option key={s} value={s}>{deliveryLabel(s)}</option>)}</select></div><p className={styles.fieldHint}>Latest 100 deliveries. Relay acceptance does not confirm mailbox delivery. Uncertain sends need operator review.</p><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Time / customer</th><th>Event</th><th>Delivery state</th><th>Details</th></tr></thead><tbody>{history.map(row => <tr key={row.event_id}><td>{new Date(row.created).toLocaleString()}<small>{row.customer}</small></td><td className={styles.mono}>{row.event_id}</td><td><StatusBadge status={row.status} /></td><td><details><summary>{row.accepted.length} accepted · {Object.keys(row.rejected).length} rejected</summary><div className={styles.deliveryDetails}>{row.accepted.length > 0 && <p>Accepted: {row.accepted.join(', ')}</p>}{Object.entries(row.rejected).map(([address,code]) => <p key={address}>{address} — {code} ({code >= 400 && code < 500 ? 'temporary refusal' : 'permanent refusal'})</p>)}{row.error && <p>{row.error}</p>}{row.smtp_accepted && <p>Relay accepted: {new Date(row.smtp_accepted).toLocaleString()}</p>}</div></details></td></tr>)}</tbody></table>{!history.length && <p className={styles.empty}>{data.history.length ? 'No deliveries match these filters.' : 'No delivery history yet. New matching alerts will appear here.'}</p>}</div></>
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
