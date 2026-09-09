import type {
  ConfigurableProviderView,
  CredentialView,
  DiscoveredModelView,
  SettingsNamespaceView,
  SettingsPathOpView,
} from '@deepseek-ai/dsh-client-connection/client'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import styles from './AdminConsole.module.css'
import { AlertEmailSettings, emailRequest, type EmailSettings } from './AlertEmailSettings'
import { CatalogManager, CUSTOMER_CATALOGS } from './CatalogManager'
import { errorText, rpc } from './settings-common'

type AdminAuth = {
  authenticated: boolean
  email?: string
}

type ServiceKey = 'splunk' | 'zimbra' | 'markitdown' | 'subscription_server'

type ServiceStatus = {
  status?: 'ready' | 'not_configured' | 'unavailable'
  configured?: boolean
  available?: boolean
}

type AdminSettings = {
  services?: Partial<Record<ServiceKey, ServiceStatus>>
}

type ProviderProfile = Record<string, unknown>

type ProviderRow = {
  provider: ConfigurableProviderView
  namespace?: SettingsNamespaceView
  profile: ProviderProfile
  credentialRef: string
  credential?: CredentialView
  configured: boolean
  writable: boolean
  modelCount: number
}

type ProviderData = {
  providers: ProviderRow[]
  piAiNamespace?: SettingsNamespaceView
  writable: boolean
}

type StatusMessage = {
  kind: 'success' | 'error' | 'info'
  text: string
}

const CUSTOM_PROVIDER = '__custom__'
const PROVIDER_ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const SUPPORTED_PROTOCOLS = [
  { value: 'openai-completions', label: 'OpenAI Chat Completions' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'anthropic-messages', label: 'Anthropic Messages' },
] as const

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function pathValue(value: unknown, path: readonly string[]): unknown {
  let current: unknown = value
  for (const segment of path) {
    current = objectValue(current)[segment]
  }
  return current
}

function providerProfile(namespace: SettingsNamespaceView | undefined, provider: ConfigurableProviderView): ProviderProfile {
  return objectValue(pathValue(namespace?.value, provider.settingsPath))
}

function modelEntries(profile: ProviderProfile): Record<string, unknown>[] {
  return Array.isArray(profile.models) ? profile.models.map(objectValue) : []
}

function modelIds(profile: ProviderProfile): string[] {
  return modelEntries(profile)
    .map((model) => stringValue(model.id).trim())
    .filter(Boolean)
}

function mergeModels(profile: ProviderProfile, ids: string[]): Record<string, unknown>[] {
  const existing = new Map(modelEntries(profile).map((model) => [stringValue(model.id), model]))
  return ids.map((id) => ({ ...(existing.get(id) ?? {}), id }))
}

function deriveCredentialRef(provider: ConfigurableProviderView, profile: ProviderProfile): string {
  const configuredRef = stringValue(profile.apiKeyEnv).trim()
  if (configuredRef) return configuredRef
  return `${provider.provider.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}_API_KEY`
}

function apiValue<T>(response: { result: { ok: boolean; value?: T; error?: { message?: string } } }): T {
  if (!response.result.ok) {
    throw new Error(response.result.error?.message || 'The request could not be completed.')
  }
  return response.result.value as T
}

function serviceReady(service: ServiceStatus | undefined): boolean {
  if (service?.status === 'unavailable' || service?.status === 'not_configured') return false
  return service?.status === 'ready' || service?.configured === true || service?.available === true
}

export function AdminConsole({ connection }: { connection: any }) {
  const [auth, setAuth] = useState<AdminAuth | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  const loadAuth = useCallback(async () => {
    setLoading(true)
    setAuthError('')
    try {
      const response = await fetch('/admin/auth/me', { credentials: 'same-origin' })
      const body = (await response.json()) as AdminAuth
      setAuth(body)
    } catch (error) {
      setAuthError(errorText(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAuth()
  }, [loadAuth])

  if (loading) {
    return <div className={styles.loading}>Loading administration…</div>
  }

  if (!auth?.authenticated) {
    return <AdminLogin onAuthenticated={loadAuth} error={authError} />
  }

  return <AdminWorkspace connection={connection} email={auth.email || ''} onSignedOut={loadAuth} />
}

function AdminLogin({ onAuthenticated, error: initialError }: { onAuthenticated: () => Promise<void>; error: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState(false)

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      })
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error || 'Sign-in failed.')
      setPassword('')
      await onAuthenticated()
    } catch (loginError) {
      setError(errorText(loginError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginPanel} aria-labelledby="admin-login-title">
        <div className={styles.loginMark}>C</div>
        <p className={styles.eyebrow}>CITICTEL-CPC · SOC AGENT</p>
        <h1 id="admin-login-title" className={styles.loginTitle}>Administration console</h1>
        <p className={styles.loginCopy}>
          Manage your SOC workspace, connected services, and alert delivery.
        </p>
        <form className={styles.form} onSubmit={signIn}>
          <label className={styles.field}>
            <span>Email</span>
            <input className={styles.input} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
          </label>
          <label className={styles.field}>
            <span>Password</span>
            <input className={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <button className={`${styles.button} ${styles.primary} ${styles.fullButton}`} type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className={styles.loginFootnote}>Service configuration is managed by the server environment.</p>
      </section>
    </main>
  )
}

const ADMIN_PAGES = [
  { id: 'overview', name: 'Overview', icon: 'overview', copy: 'Your workspace, at a glance.' },
  { id: 'connections', name: 'Connections', icon: 'connections', copy: 'Review service setup and verify connections when needed.' },
  { id: 'providers', name: 'AI providers', icon: 'providers', copy: 'Manage model access and credentials in one place.' },
  { id: 'customers', name: 'Customers', icon: 'customers', copy: 'Create and maintain customer catalog records.' },
  { id: 'notifications', name: 'Alert email', icon: 'notifications', copy: 'Manage recipients, routing, and delivery for new security alerts.' },
] as const
function AdminIcon({ name }: { name: string }) {
  const paths: Record<string, string> = { overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z', connections: 'M8 3v5 M16 3v5 M6 8h12v3a6 6 0 0 1-12 0z M12 17v4', providers: 'M12 3l9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5', customers: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75', notifications: 'M3 5h18v14H3z M3 5l9 8 9-8' }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.overview} /></svg>
}
function currentPage() {
  const hash = window.location.hash.slice(1).split('/')[0]
  return ADMIN_PAGES.some(p => p.id === hash) ? hash : window.location.pathname.includes('/alert-email') ? 'notifications' : 'overview'
}
function AdminWorkspace({ connection, email, onSignedOut }: { connection: any; email: string; onSignedOut: () => Promise<void> }) {
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(currentPage)
  const [visited, setVisited] = useState(() => new Set([currentPage()]))
  useEffect(() => {
    const change = () => { const next = currentPage(); setPage(next); setVisited(old => new Set([...old,next])) }
    window.addEventListener('hashchange',change)
    return () => window.removeEventListener('hashchange',change)
  }, [])
  const selected = ADMIN_PAGES.find(p => p.id === page) || ADMIN_PAGES[0]
  async function signOut() {
    setSigningOut(true); setError('')
    try {
      const response = await fetch('/admin/auth/logout', { method: 'POST', credentials: 'same-origin' })
      if (!response.ok) throw new Error('Sign-out failed. Please try again.')
      await onSignedOut()
    } catch (e) { setError(errorText(e)) } finally { setSigningOut(false) }
  }
  return <div className={styles.page}>
    <a className={styles.skipLink} href="#admin-content" onClick={event => { event.preventDefault(); document.getElementById('admin-content')?.focus() }}>Skip to content</a>
    <aside className={styles.sidebar}>
      <a href="/admin" className={styles.brand}><span className={styles.brandMark}>S</span><span>Sentinel<small>Administration</small></span></a>
      <p className={styles.navLabel}>WORKSPACE</p>
      <nav className={styles.navigation} aria-label="Administration">{ADMIN_PAGES.map(item => <a href={'#' + item.id} key={item.id} className={page === item.id ? styles.navActive : ''} aria-current={page === item.id ? 'page' : undefined}><AdminIcon name={item.icon} />{item.name}</a>)}</nav>
      <div className={styles.sidebarFoot}><a href="/" className={styles.backLink}>← Back to workspace</a><div className={styles.identity}><span className={styles.avatar}>{email.slice(0,1).toUpperCase() || 'A'}</span><div><strong>Administrator</strong><span className={styles.account} title={email}>{email}</span></div></div><button className={styles.signOut} onClick={() => void signOut()} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
    </aside>
    <main id="admin-content" className={styles.shell} tabIndex={-1}>
      <div className={styles.topbar}><span>Workspace / <strong>Administration</strong></span><span className={styles.adminBadge}>Admin access</span></div>
      <header className={styles.header}><div><p className={styles.eyebrow}>CITICTEL-CPC · SOC AGENT</p><h1 className={styles.title}>{selected.name}</h1><p className={styles.subtitle}>{selected.copy}</p></div><span className={styles.headerMark}><AdminIcon name={selected.icon} /></span></header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {visited.has('overview') && <div hidden={page !== 'overview'}><AdminOverview connection={connection} /></div>}
      {visited.has('connections') && <div hidden={page !== 'connections'}><ServiceStatusPanel connection={connection} /></div>}
      {visited.has('providers') && <div hidden={page !== 'providers'}><ProviderSettings connection={connection} /></div>}
      {visited.has('customers') && <div hidden={page !== 'customers'}><CatalogManager connection={connection} catalogs={CUSTOMER_CATALOGS} title="Customer Information" showPublication={false} /></div>}
      {visited.has('notifications') && <div hidden={page !== 'notifications'}><AlertEmailSettings /></div>}
      <footer className={styles.pageFoot}>Sentinel administration · CITICTEL-CPC</footer>
    </main>
  </div>
}
function AdminOverview({ connection }: { connection: any }) {
  const [services,setServices] = useState<AdminSettings | null>(null)
  const [email,setEmail] = useState<EmailSettings | null>(null)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [updated,setUpdated] = useState('')
  const load = useCallback(async () => {
    setBusy(true); setError('')
    const results = await Promise.allSettled([rpc(connection,'get-settings'), emailRequest<EmailSettings>()])
    setServices(results[0].status === 'fulfilled' ? results[0].value as AdminSettings : null)
    setEmail(results[1].status === 'fulfilled' ? results[1].value : null)
    if (results.some(r => r.status === 'rejected')) setError('Some status information is unavailable. Refresh to try again.')
    setUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); setBusy(false)
  },[connection])
  useEffect(() => { void load() },[load])
  const configured = services ? ['splunk','zimbra','markitdown','subscription_server'].filter(key => serviceReady(services.services?.[key as ServiceKey])).length : null
  const needsReview = email ? Number(email.delivery.failed || 0) + Number(email.delivery.uncertain || 0) : null
  return <section className={styles.section} aria-label="Workspace overview">
    <div className={styles.sectionHeading}><div><p className={styles.sectionKicker}>WORKSPACE SNAPSHOT</p><h2 className={styles.sectionTitle}>Everything in view.</h2></div><div className={styles.headerActions}><span className={styles.fieldHint}>{updated ? `Updated ${updated}` : 'Loading status…'}</span><button className={styles.button} disabled={busy} onClick={() => void load()}>{busy ? 'Refreshing…' : 'Refresh status'}</button></div></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.metrics}><a href="#connections" className={styles.metric}><span className={styles.metricLabel}>Services configured <AdminIcon name="connections" /></span><strong>{configured === null ? '—' : configured + ' / 4'}</strong><small>Connection checks are available on demand <span>↗</span></small></a><a href="#notifications" className={styles.metric}><span className={styles.metricLabel}>Alert email <AdminIcon name="notifications" /></span><strong>{!email ? '—' : email.runtime.enabled && email.runtime.configured ? 'Enabled' : email.runtime.enabled ? 'Setup needed' : 'Paused'}</strong><small>{email ? `${email.rules.filter(r => r.enabled).length} enabled notification rule${email.rules.filter(r => r.enabled).length === 1 ? '' : 's'}` : 'Status unavailable'} <span>↗</span></small></a><a href="#notifications/history" className={`${styles.metric} ${needsReview ? styles.metricAttention : ''}`}><span className={styles.metricLabel}>Delivery needs attention <AdminIcon name="overview" /></span><strong>{needsReview ?? '—'}</strong><small>Failed or uncertain deliveries <span>↗</span></small></a></div>
    <div className={styles.contentGrid}><article className={styles.card}><p className={styles.sectionKicker}>ADMINISTRATION</p><h3 className={styles.editorTitle}>Where would you like to start?</h3><div className={styles.quickLinks}>{ADMIN_PAGES.slice(1).map(item => <a key={item.id} href={'#' + item.id}><span className={styles.quickIcon}><AdminIcon name={item.icon} /></span><span><strong>{item.name}</strong><small>{item.copy}</small></span><span aria-hidden="true">→</span></a>)}</div></article><aside className={styles.helpCard}><p className={styles.sectionKicker}>ALERT DELIVERY</p><h3>Ready when you are.</h3><p>Set customer recipients, choose the alerts that matter, and preview the email before enabling a rule.</p><ol className={styles.steps}><li>Set customer defaults</li><li>Choose severity and routing</li><li>Preview and review delivery</li></ol><a className={styles.textButton} href="#notifications">Manage alert email →</a></aside></div>
  </section>
}

function ServiceStatusPanel({ connection }: { connection: any }) {
  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [error, setError] = useState('')
  const [checks, setChecks] = useState<Partial<Record<ServiceKey, StatusMessage>>>({})
  const [busy, setBusy] = useState<ServiceKey | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      setSettings((await rpc(connection, 'get-settings')) as AdminSettings)
    } catch (loadError) {
      setError(errorText(loadError))
    }
  }, [connection])

  useEffect(() => {
    void load()
  }, [load])

  async function check(service: 'splunk' | 'subscription_server') {
    setBusy(service)
    setChecks((current) => ({ ...current, [service]: { kind: 'info', text: 'Checking…' } }))
    try {
      const method = service === 'splunk' ? 'test-splunk' : 'test-subscription-server'
      await rpc(connection, method)
      setChecks((current) => ({ ...current, [service]: { kind: 'success', text: 'Connection verified' } }))
      await load()
    } catch (checkError) {
      setChecks((current) => ({ ...current, [service]: { kind: 'error', text: errorText(checkError) } }))
    } finally {
      setBusy(null)
    }
  }

  const services = settings?.services || {}
  const cards: Array<{ key: ServiceKey; name: string; description: string; mark: string; checkable?: boolean }> = [
    { key: 'splunk', name: 'Splunk', description: 'Security event search and investigation', mark: 'S', checkable: true },
    { key: 'zimbra', name: 'Zimbra', description: 'Mail and identity operations', mark: 'Z' },
    { key: 'markitdown', name: 'MarkItDown', description: 'Attachment and document conversion', mark: 'M' },
    { key: 'subscription_server', name: 'Subscription server', description: 'Subscription and entitlement checks', mark: '↗', checkable: true },
  ]

  return (
    <section className={styles.section} aria-labelledby="service-status-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionKicker}>Environment services</p>
          <h2 id="service-status-title" className={styles.sectionTitle}>Connection status</h2>
        </div>
        <div className={styles.headerActions}><span className={styles.sectionHint}>Credentials and endpoints are managed on the server.</span><button className={styles.button} onClick={() => void load()}>Refresh status</button></div>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <div className={styles.statusGrid}>
        {cards.map((card) => {
          const state = checks[card.key]
          const ready = serviceReady(services[card.key])
          const connectionLabel = state?.kind === 'info'
            ? 'Checking…'
            : state?.kind === 'success'
              ? 'Connected'
              : state?.kind === 'error'
                ? 'Unavailable'
                : ready
                  ? 'Configured'
                  : !settings ? 'Unknown' : services[card.key]?.status === 'unavailable' ? 'Unavailable' : 'Not configured'
          const connectionClass = state?.kind === 'info'
            ? styles.statusInfo
            : state?.kind === 'success'
              ? styles.statusReady
              : state?.kind === 'error'
                ? styles.statusError
                : ready
                  ? styles.statusConfigured
                  : styles.statusMuted
          return (
            <article className={styles.statusCard} key={card.key}>
              <div className={styles.statusIcon} aria-hidden="true">{card.mark}</div>
              <div className={styles.statusBody}>
                <div className={styles.statusTopline}>
                  <h3>{card.name}</h3>
                  <span className={`${styles.statusPill} ${connectionClass}`}>
                    <span className={styles.statusDot} aria-hidden="true" />
                    {connectionLabel}
                  </span>
                </div>
                <p>{card.description}</p>
                {state ? <p className={`${styles.checkMessage} ${styles[state.kind]}`}>{state.text}</p> : null}
                {card.checkable ? (
                  <button className={styles.textButton} type="button" onClick={() => void check(card.key as 'splunk' | 'subscription_server')} disabled={busy !== null}>
                    {busy === card.key ? 'Checking…' : 'Check connection'}
                  </button>
                ) : <span className={styles.envManaged}>Environment managed</span>}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ProviderSettings({ connection }: { connection: any }) {
  const [data, setData] = useState<ProviderData | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [described, providerResponse] = await Promise.all([
        connection.api.settings.describe({}),
        connection.api.llm.providers({}),
      ])
      const settingsView = apiValue<{ namespaces: SettingsNamespaceView[]; writable: boolean }>(described)
      const providerView = apiValue<{ providers: ConfigurableProviderView[] }>(providerResponse)
      const settings = settingsView.namespaces
      const providers = providerView.providers

      const namespaces = new Map(settings.map((namespace) => [namespace.ns, namespace]))
      const refs = [...new Set(providers.map((provider) => {
        const profile = providerProfile(namespaces.get(provider.settingsNs), provider)
        return deriveCredentialRef(provider, profile)
      }))]
      const credentialsView = apiValue<{ credentials: Record<string, CredentialView> }>(await connection.api.credentials.describe({ refs }))
      const credentialMap = new Map(Object.entries(credentialsView.credentials))
      const rows = providers.map((provider) => {
        const namespace = namespaces.get(provider.settingsNs)
        const profile = providerProfile(namespace, provider)
        const credentialRef = deriveCredentialRef(provider, profile)
        const credential = credentialMap.get(credentialRef)
        const configured = Boolean(namespace) && (provider.settingsPath.length === 0 || pathValue(namespace?.value, provider.settingsPath) !== undefined)
        return {
          provider,
          namespace,
          profile,
          credentialRef,
          credential,
          configured,
          writable: Boolean(namespace) && settingsView.writable,
          modelCount: modelIds(profile).length,
        }
      })
      setData({ providers: rows, piAiNamespace: namespaces.get('llm-pi-ai'), writable: settingsView.writable })
    } catch (loadError) {
      setError(errorText(loadError))
    } finally {
      setLoading(false)
    }
  }, [connection])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!data) return
    if (selected === CUSTOM_PROVIDER || data.providers.some((row) => row.provider.provider === selected)) return
    setSelected(data.providers[0]?.provider.provider || CUSTOM_PROVIDER)
  }, [data, selected])

  const current = useMemo(() => data?.providers.find((row) => row.provider.provider === selected), [data, selected])
  const providerKey = current ? `${current.provider.provider}-${current.namespace?.revision ?? 0}` : CUSTOM_PROVIDER

  return (
    <section className={styles.section} aria-labelledby="provider-settings-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionKicker}>LLM access</p>
          <h2 id="provider-settings-title" className={styles.sectionTitle}>Providers and credentials</h2>
        </div>
        <div className={styles.headerActions}><span className={styles.sectionHint}>Keys are write-only and never displayed.</span><button className={styles.button} disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {loading && !data ? <p className={styles.loadingInline}>Loading providers…</p> : null}
      {data ? (
        <div className={styles.providerLayout}>
          <aside className={styles.providerPicker} aria-label="LLM providers">
            <div className={styles.pickerHeader}>
              <span>Available providers</span>
              <span className={styles.countBadge}>{data.providers.length}</span>
            </div>
            <div className={styles.providerList} aria-label="Choose a provider">
              {data.providers.map((row) => (
                <button
                  className={`${styles.providerOption} ${selected === row.provider.provider ? styles.providerOptionSelected : ''}`}
                  type="button"
                  aria-pressed={selected === row.provider.provider}
                  key={row.provider.provider}
                  onClick={() => setSelected(row.provider.provider)}
                >
                  <span className={`${styles.providerDot} ${row.credential?.configured ? styles.providerDotReady : ''}`} aria-hidden="true" />
                  <span className={styles.providerOptionText}>
                    <strong>{row.provider.displayName || row.provider.provider}</strong>
                    <small>{row.credential?.configured ? 'Credential configured' : row.modelCount ? `${row.modelCount} model${row.modelCount === 1 ? '' : 's'}` : 'Setup required'}</small>
                  </span>
                  {row.provider.declared === true ? <span className={styles.customTag}>Custom</span> : null}
                </button>
              ))}
            </div>
            <button className={`${styles.customOption} ${selected === CUSTOM_PROVIDER ? styles.customOptionSelected : ''}`} type="button" onClick={() => setSelected(CUSTOM_PROVIDER)}>
              <span className={styles.addIcon} aria-hidden="true">+</span>
              <span><strong>Custom provider</strong><small>OpenAI-compatible or Anthropic</small></span>
            </button>
          </aside>
          <div className={styles.providerEditor} key={providerKey}>
            {current ? (
              <ProviderEditor connection={connection} row={current} onChanged={load} />
            ) : (
              <CustomProviderEditor connection={connection} namespace={data.piAiNamespace} providers={data.providers} writable={data.writable} onChanged={load} onCreated={setSelected} />
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ProviderEditor({ connection, row, onChanged }: { connection: any; row: ProviderRow; onChanged: () => Promise<void> }) {
  const { provider, namespace, profile } = row
  const initialModels = modelIds(profile)
  const [displayName, setDisplayName] = useState(stringValue(profile.displayName))
  const [baseURL, setBaseURL] = useState(stringValue(profile.baseURL))
  const [api, setApi] = useState(stringValue(profile.api))
  const [models, setModels] = useState(initialModels.join('\n'))
  const [secret, setSecret] = useState('')
  const [discovered, setDiscovered] = useState<DiscoveredModelView[]>([])
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const [busy, setBusy] = useState(false)
  const isCustomProvider = provider.declared === true
  const canEditProtocol = provider.settingsNs === 'llm-pi-ai' && isCustomProvider
  const canRemoveProvider = provider.declared === true && Boolean(namespace) && provider.settingsPath.length > 0

  function addDiscoveredModel(id: string) {
    const current = models.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    if (!current.includes(id)) setModels([...current, id].join('\n'))
  }

  async function save() {
    if (!namespace || !row.writable) return
    setBusy(true)
    setMessage(null)
    try {
      const ops: SettingsPathOpView[] = []
      if (canEditProtocol && displayName.trim() !== stringValue(profile.displayName)) {
        ops.push(displayName.trim() ? { op: 'set', path: [...provider.settingsPath, 'displayName'], value: displayName.trim() } : { op: 'unset', path: [...provider.settingsPath, 'displayName'] })
      }
      const originalBaseURL = stringValue(profile.baseURL)
      if (baseURL.trim() !== originalBaseURL) {
        ops.push(baseURL.trim() ? { op: 'set', path: [...provider.settingsPath, 'baseURL'], value: baseURL.trim() } : { op: 'unset', path: [...provider.settingsPath, 'baseURL'] })
      }
      if (canEditProtocol && api.trim() !== stringValue(profile.api)) {
        ops.push(api.trim() ? { op: 'set', path: [...provider.settingsPath, 'api'], value: api.trim() } : { op: 'unset', path: [...provider.settingsPath, 'api'] })
      }
      const nextModels = models.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
      if (JSON.stringify(nextModels) !== JSON.stringify(initialModels)) {
        ops.push(nextModels.length
          ? { op: 'set', path: [...provider.settingsPath, 'models'], value: mergeModels(profile, nextModels) }
          : { op: 'unset', path: [...provider.settingsPath, 'models'] })
      }
      if (secret.trim() && !stringValue(profile.apiKeyEnv)) {
        ops.push({ op: 'set', path: [...provider.settingsPath, 'apiKeyEnv'], value: row.credentialRef })
      }
      if (ops.length) apiValue(await connection.api.settings.mutate({ ns: namespace.ns, ops, expectedRevision: namespace.revision }))
      if (secret.trim()) apiValue(await connection.api.credentials.set({ ref: row.credentialRef, value: secret.trim() }))
      setSecret('')
      setMessage({ kind: 'success', text: 'Provider settings saved.' })
      await onChanged()
    } catch (saveError) {
      setMessage({ kind: 'error', text: errorText(saveError) })
    } finally {
      setBusy(false)
    }
  }

  async function removeCredential() {
    if (!row.credential?.configured || !row.credential.writable) return
    setBusy(true)
    setMessage(null)
    try {
      apiValue(await connection.api.credentials.unset({ ref: row.credentialRef }))
      setMessage({ kind: 'success', text: 'Credential removed.' })
      await onChanged()
    } catch (removeError) {
      setMessage({ kind: 'error', text: errorText(removeError) })
    } finally {
      setBusy(false)
    }
  }

  async function discover() {
    setBusy(true)
    setMessage(null)
    try {
      const result = apiValue<{ models: DiscoveredModelView[] }>(await connection.api.llm.discoverModels({
        settingsNs: provider.settingsNs,
        provider: provider.provider,
        baseURL: baseURL.trim() || undefined,
        api: canEditProtocol ? api.trim() || undefined : undefined,
        apiKey: secret.trim() || undefined,
      }))
      setDiscovered(result.models)
      setMessage({ kind: 'info', text: result.models.length ? 'Choose a model to add it to the provider.' : 'No models were discovered.' })
    } catch (discoverError) {
      setMessage({ kind: 'error', text: errorText(discoverError) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className={styles.editorHeading}>
        <div>
          <p className={styles.sectionKicker}>Provider configuration</p>
          <h3 className={styles.editorTitle}>{provider.displayName || provider.provider}</h3>
          <p className={styles.editorCopy}>{isCustomProvider ? 'Configure the provider connection and credential.' : 'Manage the credential for this provider.'}</p>
        </div>
        <span className={`${styles.statusPill} ${row.credential?.configured ? styles.statusReady : styles.statusMuted}`}>
          <span className={styles.statusDot} aria-hidden="true" />
          {row.credential?.configured ? 'Credential set' : 'Credential needed'}
        </span>
      </div>

      <div className={styles.editorForm}>
        <label className={styles.field}>
          <span>API key</span>
          <input className={styles.input} type="password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder={row.credential?.configured ? 'Stored securely · enter a new key to replace it' : 'Enter the provider API key'} autoComplete="new-password" disabled={!row.writable || row.credential?.writable === false || busy} />
          <small className={styles.fieldHint}>The key is stored securely and is never returned to this page.</small>
        </label>

        {isCustomProvider ? (
          <details className={styles.advanced} open={Boolean(baseURL || api || initialModels.length)}>
            <summary>Advanced provider settings</summary>
            <div className={styles.advancedBody}>
              {canEditProtocol ? (
                <label className={styles.field}>
                  <span>Display name <em>optional</em></span>
                  <input className={styles.input} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={provider.provider} disabled={!row.writable || busy} />
                </label>
              ) : null}
              <label className={styles.field}>
                <span>Base URL <em>optional</em></span>
                <input className={styles.input} type="url" value={baseURL} onChange={(event) => setBaseURL(event.target.value)} placeholder="https://api.example.com" disabled={!row.writable || busy} />
              </label>
              {canEditProtocol ? (
                <label className={styles.field}>
                  <span>API protocol</span>
                  <select className={styles.input} value={api} onChange={(event) => setApi(event.target.value)} disabled={!row.writable || busy}>
                    <option value="">Provider default</option>
                    {SUPPORTED_PROTOCOLS.map((protocol) => <option value={protocol.value} key={protocol.value}>{protocol.label}</option>)}
                  </select>
                </label>
              ) : null}
              <label className={styles.field}>
                <span>Model IDs <em>one per line</em></span>
                <textarea className={`${styles.input} ${styles.textarea}`} value={models} onChange={(event) => setModels(event.target.value)} placeholder="deepseek-chat" rows={4} disabled={!row.writable || busy} />
              </label>
              <div className={styles.discoveryRow}>
                <button className={styles.button} type="button" onClick={() => void discover()} disabled={busy || !provider.settingsNs}>
                  {busy ? 'Working…' : 'Discover models'}
                </button>
                <span className={styles.fieldHint}>Uses the draft URL and key when provided.</span>
              </div>
              {discovered.length ? (
                <div className={styles.discovered} aria-label="Discovered models">
                  {discovered.map((model) => <button className={styles.modelChip} type="button" key={model.id} onClick={() => addDiscoveredModel(model.id)}>{model.id} <span aria-hidden="true">+</span></button>)}
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>

      {message ? <p className={`${styles.message} ${styles[message.kind]}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      <div className={styles.actions}>
        <button className={`${styles.button} ${styles.primary}`} type="button" onClick={() => void save()} disabled={!row.writable || busy}>{busy ? 'Saving…' : 'Save provider'}</button>
        {row.credential?.configured ? <button className={styles.button} type="button" onClick={() => void removeCredential()} disabled={!row.credential.writable || busy}>Remove credential</button> : null}
        {canRemoveProvider ? <CustomProviderRemoval connection={connection} row={row} onChanged={onChanged} disabled={busy || !row.writable || (row.credential?.configured === true && !row.credential.writable)} /> : null}
      </div>
    </div>
  )
}

function CustomProviderRemoval({ connection, row, onChanged, disabled }: { connection: any; row: ProviderRow; onChanged: () => Promise<void>; disabled: boolean }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    if (!row.namespace) return
    setError('')
    try {
      if (row.credential?.configured) apiValue(await connection.api.credentials.unset({ ref: row.credentialRef }))
      apiValue(await connection.api.settings.mutate({
        ns: row.namespace.ns,
        ops: [{ op: 'unset', path: row.provider.settingsPath }],
        expectedRevision: row.namespace.revision,
      }))
      await onChanged()
    } catch (removeError) {
      setError(errorText(removeError))
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <span className={styles.confirmGroup}>
        <span>Remove {row.provider.displayName || row.provider.provider}?</span>
        <button className={styles.dangerButton} type="button" onClick={() => void remove()} disabled={disabled}>Remove</button>
        <button className={styles.button} type="button" onClick={() => setConfirming(false)} disabled={disabled}>Cancel</button>
        {error ? <small className={styles.error}>{error}</small> : null}
      </span>
    )
  }
  return <button className={styles.dangerButton} type="button" onClick={() => setConfirming(true)} disabled={disabled}>Remove provider</button>
}

function CustomProviderEditor({ connection, namespace, providers, writable, onChanged, onCreated }: { connection: any; namespace?: SettingsNamespaceView; providers: ProviderRow[]; writable: boolean; onChanged: () => Promise<void>; onCreated: (provider: string) => void }) {
  const [route, setRoute] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [api, setApi] = useState('openai-completions')
  const [model, setModel] = useState('')
  const [secret, setSecret] = useState('')
  const [savedRoute, setSavedRoute] = useState('')
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const [busy, setBusy] = useState(false)

  const normalizedRoute = route.trim().toLowerCase()
  const routeTaken = providers.some((row) => row.provider.provider === normalizedRoute)
  const routeValid = PROVIDER_ROUTE_PATTERN.test(normalizedRoute)
  const canSave = Boolean(namespace && writable && routeValid && !routeTaken && baseURL.trim() && model.trim())
  const credentialRef = `${normalizedRoute.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}_API_KEY`

  async function save() {
    if (!namespace || !canSave) return
    setBusy(true)
    setMessage(null)
    try {
      if (savedRoute && savedRoute !== normalizedRoute) throw new Error('The route cannot be changed after saving.')
      if (!savedRoute) {
        apiValue(await connection.api.settings.mutate({
          ns: namespace.ns,
          ops: [{
            op: 'set',
            path: ['providers', normalizedRoute],
            value: {
              ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
              ...(secret.trim() ? { apiKeyEnv: credentialRef } : {}),
              api,
              baseURL: baseURL.trim(),
              models: [{ id: model.trim() }],
            },
          }],
          expectedRevision: namespace.revision,
        }))
        setSavedRoute(normalizedRoute)
      }
      if (secret.trim()) apiValue(await connection.api.credentials.set({ ref: credentialRef, value: secret.trim() }))
      setSecret('')
      setMessage({ kind: 'success', text: 'Custom provider saved.' })
      await onChanged()
      onCreated(normalizedRoute)
    } catch (saveError) {
      setMessage({ kind: 'error', text: errorText(saveError) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className={styles.editorHeading}>
        <div>
          <p className={styles.sectionKicker}>Add provider</p>
          <h3 className={styles.editorTitle}>Custom provider</h3>
          <p className={styles.editorCopy}>Connect an OpenAI-compatible or Anthropic endpoint with its own model name.</p>
        </div>
        <span className={styles.customBadge}>Custom</span>
      </div>
      <div className={styles.editorForm}>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Provider route</span>
            <input className={styles.input} value={route} onChange={(event) => setRoute(event.target.value)} placeholder="my-provider" disabled={Boolean(savedRoute) || busy} autoComplete="off" />
            <small className={styles.fieldHint}>{route && !routeValid ? 'Use lowercase letters, numbers, and hyphens.' : routeTaken ? 'That provider already exists.' : 'This becomes the provider identifier.'}</small>
          </label>
          <label className={styles.field}>
            <span>Display name <em>optional</em></span>
            <input className={styles.input} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="My AI provider" disabled={busy} />
          </label>
        </div>
        <label className={styles.field}>
          <span>Base URL</span>
          <input className={styles.input} type="url" value={baseURL} onChange={(event) => setBaseURL(event.target.value)} placeholder="https://api.example.com/v1" disabled={busy} required />
        </label>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>API protocol</span>
            <select className={styles.input} value={api} onChange={(event) => setApi(event.target.value)} disabled={busy}>
              {SUPPORTED_PROTOCOLS.map((protocol) => <option value={protocol.value} key={protocol.value}>{protocol.label}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span>Model ID</span>
            <input className={styles.input} value={model} onChange={(event) => setModel(event.target.value)} placeholder="model-name" disabled={busy} required />
          </label>
        </div>
        <label className={styles.field}>
          <span>API key <em>optional for provider-native auth</em></span>
          <input className={styles.input} type="password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="Enter the provider API key" autoComplete="new-password" disabled={busy} />
          <small className={styles.fieldHint}>Stored securely under a provider-derived credential name.</small>
        </label>
      </div>
      {message ? <p className={`${styles.message} ${styles[message.kind]}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      <div className={styles.actions}>
        <button className={`${styles.button} ${styles.primary}`} type="button" onClick={() => void save()} disabled={!canSave || busy}>{busy ? 'Saving…' : savedRoute ? 'Save credential' : 'Add provider'}</button>
      </div>
    </div>
  )
}
