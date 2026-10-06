import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { useEffect, useState } from 'react'
import { REPORT_CHANNEL, emptyCustomerProfile, validateCustomerProfiles, type CustomerReportProfile, type CustomerReportSettings } from '../report-contract.ts'
import css from './Reports.module.css'

interface Props { connection: ConnectionHandle }
interface TextFieldProps { label: string; value: string; onChange(value: string): void; multiline?: boolean }
function TextField({ label, value, onChange, multiline = false }: TextFieldProps) {
  return <label className={css.field}><span>{label}</span>{multiline
    ? <textarea value={value} onChange={event => onChange(event.target.value)} rows={4} />
    : <input value={value} onChange={event => onChange(event.target.value)} />}</label>
}
function list(value: string): string[] { return value.split(/[\n,;]/u).map(item => item.trim()).filter(Boolean) }
function ListField({ label, values, onChange, multiline = false }: { label: string; values: string[]; onChange(values: string[]): void; multiline?: boolean }) {
  const [text, setText] = useState(values.join(multiline ? '\n' : ', '))
  return <TextField label={label} value={text} multiline={multiline} onChange={value => { setText(value); onChange(list(value)) }} />
}

async function rpc(connection: ConnectionHandle, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<CustomerReportSettings> {
  const result = await connection.rpc.call(REPORT_CHANNEL, endpoint, payload, signal)
  if (!result.ok) throw new Error(result.error.message)
  const settings = result.value as CustomerReportSettings
  if (!settings || !Array.isArray(settings.customers) || typeof settings.account !== 'string') throw new Error('The customer settings response is invalid.')
  return settings
}

/** User-scoped report profiles use their own authenticated settings channel. */
export function CustomerReportSettingsCard({ connection }: Props) {
  const [customers, setCustomers] = useState<CustomerReportProfile[]>([])
  const [account, setAccount] = useState('')
  const [selected, setSelected] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'failed'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [extensions, setExtensions] = useState('{}')
  const [extensionsError, setExtensionsError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError(null)
    void rpc(connection, 'get-customer-settings', {}, controller.signal).then(settings => {
      setCustomers(settings.customers)
      setAccount(settings.account)
      setSelected(0)
      setExtensions(JSON.stringify(settings.customers[0]?.extensions ?? {}, null, 2))
      setExtensionsError(null)
      setStatus('ready')
    }).catch(reason => {
      if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : 'Could not load customer settings.'); setStatus('failed') }
    })
    return () => controller.abort()
  }, [connection, reload])

  const customer = customers[selected]
  useEffect(() => {
    setExtensions(JSON.stringify(customer?.extensions ?? {}, null, 2))
    setExtensionsError(null)
  }, [selected, customer?.customer_id, reload])

  function edit(update: (value: CustomerReportProfile) => CustomerReportProfile) {
    setCustomers(values => values.map((value, index) => index === selected ? update(value) : value))
    setNotice('')
    setError(null)
  }
  function core(field: 'customer_id' | 'display_name' | 'report_id' | 'company_name', value: string) { edit(current => ({ ...current, [field]: value })) }
  function reportText(field: 'executive_summary_html' | 'security_analysis_html', value: string) {
    edit(current => {
      const report = { ...current.report }
      if (value) report[field] = value
      else delete report[field]
      return { ...current, report }
    })
  }
  function changeExtensions(text: string) {
    setExtensions(text)
    try {
      const value: unknown = JSON.parse(text)
      if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Enter a JSON object for additional settings.')
      edit(current => ({ ...current, extensions: value as Record<string, unknown> }))
      setExtensionsError(null)
    } catch { setExtensionsError('Additional settings must be a valid JSON object.') }
  }
  async function save() {
    const invalid = extensionsError ?? validateCustomerProfiles(customers, account)
    if (invalid) { setError(invalid); return }
    setStatus('saving')
    setError(null)
    setNotice('')
    try {
      const settings = await rpc(connection, 'save-customer-settings', { customers })
      setCustomers(settings.customers)
      setAccount(settings.account)
      setExtensions(JSON.stringify(settings.customers[selected]?.extensions ?? {}, null, 2))
      setStatus('ready')
      setNotice('Customer report settings saved.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save customer settings.')
      setStatus('ready')
    }
  }

  const busy = status === 'loading' || status === 'saving'
  return <section className={css.settings} aria-label="Customer report settings">
    <h2>Customer reports</h2>
    <p>Choose the email folder or label and report settings for each customer. Reports use your signed-in email account.</p>
    {status === 'loading' && <p role="status">Loading your customer settings…</p>}
    {error && <p className={css.error} role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {status === 'failed' && <button type="button" onClick={() => setReload(value => value + 1)}>Retry</button>}
    {status !== 'loading' && status !== 'failed' && <>
      <div className={css.customerBar}>
        <label className={css.field}><span>Customer</span><select value={selected} disabled={busy || !customers.length} onChange={event => setSelected(Number(event.target.value))}>
          {customers.map((value, index) => <option value={index} key={index}>{value.display_name || `Customer ${index + 1}`}</option>)}
        </select></label>
        <button type="button" disabled={busy} onClick={() => { setCustomers(values => [...values, emptyCustomerProfile(account)]); setSelected(customers.length); setExtensions('{}'); setNotice('') }}>Add customer</button>
        {customer && <button type="button" disabled={busy} onClick={() => { setCustomers(values => values.filter((_value, index) => index !== selected)); setSelected(0); setNotice('') }}>Remove customer</button>}
      </div>
      {customer ? <fieldset disabled={busy} className={css.form}>
        <legend>Customer configuration</legend>
        <div className={css.grid}>
          <TextField label="Customer ID" value={customer.customer_id} onChange={value => core('customer_id', value)} />
          <TextField label="Display name" value={customer.display_name} onChange={value => core('display_name', value)} />
          <TextField label="Report ID" value={customer.report_id} onChange={value => core('report_id', value)} />
          <TextField label="Company name" value={customer.company_name} onChange={value => core('company_name', value)} />
        </div>
        <h3>Report emails</h3>
        <TextField label="Email account" value={customer.email.account} onChange={value => edit(current => ({ ...current, email: { ...current.email, account: value } }))} />
        <div className={css.grid}>
          <label className={css.field}><span>Folder or label</span><select value={customer.email.scope_type} onChange={event => edit(current => ({ ...current, email: { ...current.email, scope_type: event.target.value as 'folder' | 'label' } }))}><option value="folder">Folder</option><option value="label">Label</option></select></label>
          <TextField label="Folder path or label" value={customer.email.scope} onChange={value => edit(current => ({ ...current, email: { ...current.email, scope: value } }))} />
        </div>
        <label className={css.checkbox}><input type="checkbox" checked={customer.email.include_subfolders} onChange={event => edit(current => ({ ...current, email: { ...current.email, include_subfolders: event.target.checked } }))} />Include subfolders</label>
        <ListField key={`senders-${customer.customer_id}-${selected}-${reload}`} label="Customer sender addresses (one per line)" values={customer.customer_senders} multiline onChange={values => edit(current => ({ ...current, customer_senders: values }))} />
        <h3>Splunk dashboard</h3>
        <div className={css.grid}>
          {(['owner', 'app', 'view'] as const).map(field => <TextField key={field} label={field === 'view' ? 'Dashboard view' : field === 'app' ? 'App' : 'Owner'} value={customer.report.template[field]} onChange={value => edit(current => ({ ...current, report: { ...current.report, template: { ...current.report.template, [field]: value } } }))} />)}
          <TextField label="Output filename stem (optional)" value={customer.report.output_stem ?? ''} onChange={value => edit(current => ({ ...current, report: { ...current.report, output_stem: value } }))} />
        </div>
        <h3>Security news</h3>
        <div className={css.grid}>
          <label className={css.field}><span>News folder or label</span><select value={customer.news.scope_type} onChange={event => edit(current => ({ ...current, news: { ...current.news, scope_type: event.target.value as 'folder' | 'label' } }))}><option value="folder">Folder</option><option value="label">Label</option></select></label>
          <TextField label="News folder path or label" value={customer.news.scope} onChange={value => edit(current => ({ ...current, news: { ...current.news, scope: value } }))} />
          <ListField key={`terms-${customer.customer_id}-${selected}-${reload}`} label="News source terms" values={customer.news.source_terms} onChange={values => edit(current => ({ ...current, news: { ...current.news, source_terms: values } }))} />
          <ListField key={`labels-${customer.customer_id}-${selected}-${reload}`} label="News source labels" values={customer.news.source_labels} onChange={values => edit(current => ({ ...current, news: { ...current.news, source_labels: values } }))} />
          <label className={css.field}><span>Maximum news messages</span><input type="number" min={1} max={2000} value={customer.news.scan_limit} onChange={event => edit(current => ({ ...current, news: { ...current.news, scan_limit: Number(event.target.value) } }))} /></label>
        </div>
        <details><summary>Report text and additional settings</summary>
          <TextField label="Executive summary HTML (optional)" value={customer.report.executive_summary_html ?? ''} multiline onChange={value => reportText('executive_summary_html', value)} />
          <TextField label="Security analysis HTML (optional)" value={customer.report.security_analysis_html ?? ''} multiline onChange={value => reportText('security_analysis_html', value)} />
          <TextField label="Additional customer settings (JSON)" value={extensions} multiline onChange={changeExtensions} />
          {extensionsError && <p className={css.error} role="alert">{extensionsError}</p>}
        </details>
      </fieldset> : <p>Add a customer to configure a report.</p>}
      <div className={css.actions}>
        <button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>Reload saved settings</button>
        <button type="button" disabled={busy || Boolean(extensionsError)} onClick={() => { void save() }}>{status === 'saving' ? 'Saving…' : 'Save customer settings'}</button>
      </div>
    </>}
  </section>
}
