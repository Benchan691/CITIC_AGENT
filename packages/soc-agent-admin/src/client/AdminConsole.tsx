import type {
  ConfigurableProviderView,
  CredentialView,
  DiscoveredModelView,
  SettingsNamespaceView,
  SettingsPathOpView,
} from '@deepseek-ai/dsh-client-connection/client'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import type { SocActionMode, SocActionState, SocClientRuntime } from 'dsh-soc-agent-client/client'
import styles from './AdminConsole.module.css'
import { validCatalog, type SocAction } from './SocActionApprovalSettings.tsx'
import { errorText, rpc } from './rpc.ts'

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
  namespace?: SettingsNamespaceView | undefined
  profile: ProviderProfile
  credentialRef: string
  credential?: CredentialView | undefined
  configured: boolean
  writable: boolean
  modelCount: number
}

type ProviderData = {
  providers: ProviderRow[]
  piAiNamespace?: SettingsNamespaceView | undefined
  writable: boolean
}

type AgentContextData = {
  background: SettingsNamespaceView
  time: SettingsNamespaceView
  writable: boolean
}

type AccessApprovalData = {
  actionApproval: SettingsNamespaceView
  tools: SocAction[]
  writable: boolean
}

type StatusMessage = {
  kind: 'success' | 'error' | 'info'
  text: string
}

const CUSTOM_PROVIDER = '__custom__'
const BACKGROUND_SETTINGS_NAMESPACE = 'soc-background'
const TIME_SETTINGS_NAMESPACE = 'time-context'
const ACTION_APPROVAL_SETTINGS_NAMESPACE = 'soc-action-approval'
const MAX_INTERVAL_SECONDS = Math.floor(Number.MAX_SAFE_INTEGER / 1000)
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

async function describeSettings(connection: any) {
  const view = apiValue<{ namespaces: SettingsNamespaceView[]; writable: boolean }>(await connection.api.settings.describe({}))
  return { namespaces: new Map(view.namespaces.map((namespace) => [namespace.ns, namespace])), writable: view.writable }
}

function useStatus() {
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const [busy, setBusy] = useState(false)
  async function run(operation: () => Promise<void>) {
    setBusy(true)
    setMessage(null)
    try {
      await operation()
    } catch (error) {
      setMessage({ kind: 'error', text: errorText(error) })
    } finally {
      setBusy(false)
    }
  }
  return { message, setMessage, busy, run }
}

function StatusNotice({ message, onRetry }: { message: StatusMessage | null; onRetry?: () => Promise<void> }) {
  if (!message) return null
  return <>
    <p className={`${styles.message} ${styles[message.kind]}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>
    {message.kind === 'error' && onRetry ? <button className={styles.button} type="button" onClick={() => void onRetry()}>Retry</button> : null}
  </>
}

function serviceReady(service: ServiceStatus | undefined): boolean {
  return service?.status === 'ready' || service?.configured === true || service?.available === true
}

function nonNegativeInteger(value: string, label: string, maximum = Number.MAX_SAFE_INTEGER): number {
  const normalized = value.trim()
  const parsed = Number(normalized)
  if (!/^\d+$/u.test(normalized) || !Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new Error(`${label} must be a non-negative whole number.`)
  }
  return parsed
}

export function AdminConsole({ connection, socClient }: { connection: any; socClient: SocClientRuntime }) {
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

  return <AdminWorkspace connection={connection} socClient={socClient} email={auth.email || ''} onSignedOut={loadAuth} />
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
          Manage LLM provider credentials and review the health of connected services.
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
  { id: 'connections', name: 'Connections', icon: 'connections', copy: 'Review service setup and verify connections when needed.' },
  { id: 'agent-context', name: 'Agent context', icon: 'context', copy: 'Control workspace context and current-time injection.' },
  { id: 'access-approvals', name: 'Access & approvals', icon: 'access', copy: 'Choose the deployment access mode and action controls.' },
  { id: 'providers', name: 'AI providers', icon: 'providers', copy: 'Manage model access and credentials in one place.' },
] as const

function AdminIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    connections: 'M8 3v5 M16 3v5 M6 8h12v3a6 6 0 0 1-12 0z M12 17v4',
    context: 'M12 3a9 9 0 1 0 9 9 M12 7v5l3 2',
    access: 'M12 3l8 3v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6z M9 12l2 2 4-4',
    providers: 'M12 3l9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5',
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.connections} /></svg>
}

function currentPage() {
  const hash = window.location.hash.slice(1).split('/')[0]
  return ADMIN_PAGES.some((page) => page.id === hash) ? hash : 'connections'
}

function AdminWorkspace({ connection, socClient, email, onSignedOut }: { connection: any; socClient: SocClientRuntime; email: string; onSignedOut: () => Promise<void> }) {
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(currentPage)
  const [visited, setVisited] = useState(() => new Set([currentPage()]))

  useEffect(() => {
    const change = () => {
      const next = currentPage()
      setPage(next)
      setVisited((old) => new Set([...old, next]))
    }
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])

  const selected = ADMIN_PAGES.find((item) => item.id === page) || ADMIN_PAGES[0]

  async function signOut() {
    setSigningOut(true)
    setError('')
    try {
      const response = await fetch('/admin/auth/logout', { method: 'POST', credentials: 'same-origin' })
      if (!response.ok) throw new Error('Sign-out failed. Please try again.')
      await onSignedOut()
    } catch (signOutError) {
      setError(errorText(signOutError))
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#admin-content" onClick={(event) => { event.preventDefault(); document.getElementById('admin-content')?.focus() }}>Skip to content</a>
      <aside className={styles.sidebar}>
        <a href="/admin" className={styles.brand}><span className={styles.brandMark}>S</span><span>Sentinel<small>Administration</small></span></a>
        <p className={styles.navLabel}>WORKSPACE</p>
        <nav className={styles.navigation} aria-label="Administration">
          {ADMIN_PAGES.map((item) => (
            <a href={`#${item.id}`} key={item.id} className={page === item.id ? styles.navActive : ''} aria-current={page === item.id ? 'page' : undefined}>
              <AdminIcon name={item.icon} />
              {item.name}
            </a>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <a href="/" className={styles.backLink}>← Back to workspace</a>
          <div className={styles.identity}>
            <span className={styles.avatar}>{email.slice(0, 1).toUpperCase() || 'A'}</span>
            <div><strong>Administrator</strong><span className={styles.account} title={email}>{email}</span></div>
          </div>
          <button className={styles.signOut} type="button" onClick={() => void signOut()} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </aside>
      <main id="admin-content" className={styles.shell} tabIndex={-1}>
        <div className={styles.topbar}><span>Workspace / <strong>Administration</strong></span><span className={styles.adminBadge}>Admin access</span></div>
        <header className={styles.header}>
          <div><p className={styles.eyebrow}>CITICTEL-CPC · SOC AGENT</p><h1 className={styles.title}>{selected.name}</h1><p className={styles.subtitle}>{selected.copy}</p></div>
          <span className={styles.headerMark}><AdminIcon name={selected.icon} /></span>
        </header>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {visited.has('connections') ? <div hidden={page !== 'connections'}><ServiceStatusPanel socClient={socClient} /></div> : null}
        {visited.has('agent-context') ? <div hidden={page !== 'agent-context'}><AgentContextSettings connection={connection} /></div> : null}
        {visited.has('access-approvals') ? <div hidden={page !== 'access-approvals'}><AccessApprovalsSettings connection={connection} socClient={socClient} /></div> : null}
        {visited.has('providers') ? <div hidden={page !== 'providers'}><ProviderSettings connection={connection} /></div> : null}
        <footer className={styles.pageFoot}>Sentinel administration · CITICTEL-CPC</footer>
      </main>
    </div>
  )
}

function ServiceStatusPanel({ socClient }: { socClient: SocClientRuntime }) {
  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [error, setError] = useState('')
  const [checks, setChecks] = useState<Partial<Record<ServiceKey, StatusMessage>>>({})
  const [busy, setBusy] = useState<ServiceKey | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      setSettings((await rpc(socClient, 'get-settings')) as AdminSettings)
    } catch (loadError) {
      setError(errorText(loadError))
    }
  }, [socClient])

  useEffect(() => {
    void load()
  }, [load])

  async function check(service: 'splunk' | 'subscription_server') {
    setBusy(service)
    setChecks((current) => ({ ...current, [service]: { kind: 'info', text: 'Checking…' } }))
    try {
      const method = service === 'splunk' ? 'test-splunk' : 'test-subscription-server'
      await rpc(socClient, method)
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
        <span className={styles.sectionHint}>Configuration stays in the server .env file.</span>
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
                  : 'Not configured'
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
                  <button className={styles.textButton} type="button" onClick={() => void check(card.key as 'splunk' | 'subscription_server')} disabled={busy === card.key}>
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

function AgentContextSettings({ connection }: { connection: any }) {
  const [data, setData] = useState<AgentContextData | null>(null)
  const [backgroundEnabled, setBackgroundEnabled] = useState(true)
  const [backgroundPrompts, setBackgroundPrompts] = useState('5')
  const [timeEnabled, setTimeEnabled] = useState(true)
  const [timeSeconds, setTimeSeconds] = useState('0')
  const [validation, setValidation] = useState<{ background?: string; time?: string }>({})
  const [loading, setLoading] = useState(true)
  const { message, setMessage, busy, run } = useStatus()

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    setValidation({})
    try {
      const { namespaces, writable } = await describeSettings(connection)
      const background = namespaces.get(BACKGROUND_SETTINGS_NAMESPACE)
      const time = namespaces.get(TIME_SETTINGS_NAMESPACE)
      if (!background || !time) throw new Error('Agent context settings are unavailable.')
      const backgroundValue = objectValue(background.value)
      const timeValue = objectValue(time.value)
      setData({ background, time, writable })
      setBackgroundEnabled(backgroundValue.enabled !== false)
      setBackgroundPrompts(String(backgroundValue.repeatEveryUserPrompts ?? 5))
      setTimeEnabled(timeValue.enabled !== false)
      setTimeSeconds(String(Number(timeValue.refreshIntervalMs ?? 0) / 1000))
    } catch (loadError) {
      setMessage({ kind: 'error', text: errorText(loadError) })
    } finally {
      setLoading(false)
    }
  }, [connection])

  useEffect(() => {
    void load()
  }, [load])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data?.writable || loading) return
    setValidation({})
    return run(async () => {
      let repeatEveryUserPrompts: number | undefined
      let seconds: number | undefined
      const nextValidation: { background?: string; time?: string } = {}
      try {
        repeatEveryUserPrompts = nonNegativeInteger(backgroundPrompts, 'BACKGROUND prompt frequency')
      } catch (validationError) {
        nextValidation.background = errorText(validationError)
      }
      try {
        seconds = nonNegativeInteger(timeSeconds, 'Time interval', MAX_INTERVAL_SECONDS)
      } catch (validationError) {
        nextValidation.time = errorText(validationError)
      }
      if (nextValidation.background || nextValidation.time || repeatEveryUserPrompts === undefined || seconds === undefined) {
        setValidation(nextValidation)
        setMessage({ kind: 'error', text: 'Check the highlighted agent context fields.' })
        return
      }
      const backgroundResponse = await connection.api.settings.mutate({
        ns: data.background.ns,
        ops: [
          { op: 'set', path: ['enabled'], value: backgroundEnabled },
          { op: 'set', path: ['repeatEveryUserPrompts'], value: repeatEveryUserPrompts },
        ],
        expectedRevision: data.background.revision,
      })
      const timeResponse = await connection.api.settings.mutate({
        ns: data.time.ns,
        ops: [
          { op: 'set', path: ['enabled'], value: timeEnabled },
          { op: 'set', path: ['refreshIntervalMs'], value: seconds * 1000 },
        ],
        expectedRevision: data.time.revision,
      })
      const background = apiValue<SettingsNamespaceView>(backgroundResponse)
      const time = apiValue<SettingsNamespaceView>(timeResponse)
      setData({ ...data, background, time })
      setMessage({ kind: 'success', text: 'Agent context settings saved.' })
    })
  }

  return (
    <section className={styles.section} aria-labelledby="agent-context-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionKicker}>Model context</p>
          <h2 id="agent-context-title" className={styles.sectionTitle}>Agent context</h2>
        </div>
        <span className={styles.sectionHint}>Changes apply live to existing and new sessions.</span>
      </div>
      {loading ? <p className={styles.loadingInline}>{data ? 'Refreshing' : 'Loading'} agent context…</p> : null}
      {data ? (
        <form onSubmit={save}>
          <div className={styles.contextGrid}>
            <article className={styles.contextCard}>
              <div>
                <p className={styles.sectionKicker}>Workspace reference</p>
                <h3>BACKGROUND.md</h3>
                <p>Load this file at session startup and on configured refreshes.</p>
              </div>
              <label className={styles.toggleField}>
                <input type="checkbox" checked={backgroundEnabled} onChange={(event) => setBackgroundEnabled(event.target.checked)} disabled={!data.writable || busy || loading} />
                <span><strong>Inject BACKGROUND.md</strong><small>Disable to stop startup and periodic injections.</small></span>
              </label>
              <label className={styles.field}>
                <span>Repeat every user prompts</span>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={backgroundPrompts}
                  onChange={(event) => setBackgroundPrompts(event.target.value)}
                  aria-describedby="background-frequency-help"
                  aria-invalid={validation.background ? 'true' : undefined}
                  disabled={!data.writable || busy || loading}
                />
                <small id="background-frequency-help" className={styles.fieldHint}>Use 0 for startup only. The default is every 5 additional user prompts.</small>
                {validation.background ? <small className={styles.fieldError} role="alert">{validation.background}</small> : null}
              </label>
            </article>

            <article className={styles.contextCard}>
              <div>
                <p className={styles.sectionKicker}>Current clock</p>
                <h3>Time context</h3>
                <p>Supply the model with the current time and elapsed time.</p>
              </div>
              <label className={styles.toggleField}>
                <input type="checkbox" checked={timeEnabled} onChange={(event) => setTimeEnabled(event.target.checked)} disabled={!data.writable || busy || loading} />
                <span><strong>Inject current time</strong><small>Applies on the next eligible model step.</small></span>
              </label>
              <label className={styles.field}>
                <span>Minimum interval in seconds</span>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  max={MAX_INTERVAL_SECONDS}
                  step="1"
                  inputMode="numeric"
                  value={timeSeconds}
                  onChange={(event) => setTimeSeconds(event.target.value)}
                  aria-describedby="time-frequency-help"
                  aria-invalid={validation.time ? 'true' : undefined}
                  disabled={!data.writable || busy || loading || !timeEnabled}
                />
                <small id="time-frequency-help" className={styles.fieldHint}>Use 0 to inject on every eligible model step.</small>
                {validation.time ? <small className={styles.fieldError} role="alert">{validation.time}</small> : null}
              </label>
            </article>

          </div>
          <StatusNotice message={message} onRetry={load} />
          <div className={styles.actions}>
            <button className={`${styles.button} ${styles.primary}`} type="submit" disabled={!data.writable || busy || loading}>{busy ? 'Saving…' : 'Save agent context'}</button>
          </div>
        </form>
      ) : <StatusNotice message={message} onRetry={load} />}
    </section>
  )
}

function defaultToolState(tool: SocAction): SocActionState {
  return tool.kind === 'read' ? 'auto' : 'ask'
}

function isActionState(value: unknown): value is SocActionState {
  return value === 'ask' || value === 'auto' || value === 'disabled'
}

function AccessApprovalsSettings({ connection, socClient }: { connection: any; socClient: SocClientRuntime }) {
  const [data, setData] = useState<AccessApprovalData | null>(null)
  const [mode, setMode] = useState<SocActionMode>('soc')
  const [actionStates, setActionStates] = useState<Record<string, SocActionState>>({})
  const [loading, setLoading] = useState(true)
  const { message, setMessage, busy, run } = useStatus()

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [{ namespaces, writable }, catalogValue] = await Promise.all([
        describeSettings(connection),
        rpc(socClient, 'get-admin-action-catalog'),
      ])
      const actionApproval = namespaces.get(ACTION_APPROVAL_SETTINGS_NAMESPACE)
      const catalog = objectValue(catalogValue)
      const entries = Array.isArray(catalog.tools) ? catalog.tools : catalog.actions
      const tools = validCatalog(entries)
      if (!actionApproval || tools.length === 0) throw new Error('Access & approvals settings are unavailable.')

      const saved = objectValue(actionApproval.value)
      const savedStates = objectValue(saved.actionStates)
      const normalizedStates = Object.fromEntries(tools
        .filter((tool) => tool.kind !== 'ui-confirmed')
        .map((tool) => {
          const configured = savedStates[tool.name]
          const state = isActionState(configured) ? configured : defaultToolState(tool)
          return [tool.name, state]
        })) as Record<string, SocActionState>
      setData({ actionApproval, tools, writable })
      setMode(saved.mode === 'full' ? 'full' : 'soc')
      setActionStates(normalizedStates)
    } catch (loadError) {
      setMessage({ kind: 'error', text: errorText(loadError) })
    } finally {
      setLoading(false)
    }
  }, [connection, socClient])

  useEffect(() => {
    void load()
  }, [load])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data?.writable || loading) return
    return run(async () => {
      const response = await connection.api.settings.mutate({
        ns: data.actionApproval.ns,
        ops: [
          { op: 'set', path: ['mode'], value: mode },
          { op: 'set', path: ['actionStates'], value: actionStates },
        ],
        expectedRevision: data.actionApproval.revision,
      })
      const actionApproval = apiValue<SettingsNamespaceView>(response)
      setData({ ...data, actionApproval })
      setMessage({ kind: 'success', text: 'Access & approvals settings saved.' })
    })
  }

  const groups = data ? [...new Set(data.tools.map((tool) => tool.group))] : []
  const stateLabel: Record<SocActionState, string> = {
    ask: 'Ask',
    auto: 'Run automatically',
    disabled: 'Disabled',
  }

  return (
    <section className={styles.section} aria-labelledby="access-approvals-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionKicker}>Deployment policy</p>
          <h2 id="access-approvals-title" className={styles.sectionTitle}>Access &amp; approvals</h2>
        </div>
        <span className={styles.sectionHint}>Changes apply live to existing and new sessions.</span>
      </div>
      {loading ? <p className={styles.loadingInline}>{data ? 'Refreshing' : 'Loading'} access controls…</p> : null}
      {data ? (
        <form onSubmit={save}>
          <article className={styles.contextCard}>
            <p className={styles.sectionKicker}>Deployment mode</p>
            <h3>How permitted actions run</h3>
            <p>Full access runs non-disabled permitted actions directly. SOC mode follows the action checklist below.</p>
            <fieldset className={styles.modeChoices}>
              <legend className={styles.srOnly}>Deployment access mode</legend>
              <label className={styles.modeChoice}>
                <input type="radio" name="deployment-mode" value="full" checked={mode === 'full'} onChange={() => setMode('full')} disabled={!data.writable || busy || loading} />
                <span><strong>Full access</strong><small>Run every permitted tool directly.</small></span>
              </label>
              <label className={styles.modeChoice}>
                <input type="radio" name="deployment-mode" value="soc" checked={mode === 'soc'} onChange={() => setMode('soc')} disabled={!data.writable || busy || loading} />
                <span><strong>SOC mode</strong><small>Ask or run actions according to the checklist for this deployment.</small></span>
              </label>
            </fieldset>
            <p className={styles.fieldHint}>SOC mode controls only the per-tool ask, auto-run, and disabled states. Email delivery still requires the explicit Send confirmation in the draft view.</p>
          </article>

          <div className={styles.accessGroups}>
            {groups.map((group) => (
              <fieldset className={styles.actionGroup} key={group}>
                <legend>{group}</legend>
                {data.tools.filter((tool) => tool.group === group).map((tool) => {
                  if (tool.kind === 'ui-confirmed') {
                    return <div className={styles.actionRow} key={tool.name}>
                      <div className={styles.actionInfo}><strong>{tool.label}</strong><small className={styles.mono}>{tool.name}</small></div>
                      <span className={styles.protectedBadge}>Explicit confirmation</span>
                    </div>
                  }
                  const selected = actionStates[tool.name] ?? defaultToolState(tool)
                  return <div className={styles.actionRow} key={tool.name}>
                    <div className={styles.actionInfo}><strong>{tool.label}</strong><small className={styles.mono}>{tool.name}</small></div>
                    <div className={styles.actionControls}>
                      {selected === 'disabled' ? <span className={styles.unavailableBadge}>Unavailable</span> : null}
                      <div className={styles.stateChoices} role="group" aria-label={`Access for ${tool.label}`}>
                        {(['ask', 'auto', 'disabled'] as const).map((state) => <label className={styles.stateChoice} key={state}>
                          <input type="radio" name={`action-state-${tool.name}`} value={state} checked={selected === state} onChange={() => setActionStates((current) => ({ ...current, [tool.name]: state }))} disabled={!data.writable || busy || loading} />
                          <span>{stateLabel[state]}</span>
                        </label>)}
                      </div>
                    </div>
                  </div>
                })}
              </fieldset>
            ))}
          </div>

          <StatusNotice message={message} onRetry={load} />
          <div className={styles.actions}>
            <button className={`${styles.button} ${styles.primary}`} type="submit" disabled={!data.writable || busy || loading}>{busy ? 'Saving…' : 'Save access settings'}</button>
          </div>
        </form>
      ) : <StatusNotice message={message} onRetry={load} />}
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
      const [{ namespaces, writable }, providerResponse] = await Promise.all([
        describeSettings(connection),
        connection.api.llm.providers({}),
      ])
      const providerView = apiValue<{ providers: ConfigurableProviderView[] }>(providerResponse)
      const providers = providerView.providers

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
          writable: Boolean(namespace) && writable,
          modelCount: modelIds(profile).length,
        }
      })
      setData({ providers: rows, piAiNamespace: namespaces.get('llm-pi-ai'), writable })
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
        <span className={styles.sectionHint}>Keys are write-only and never displayed.</span>
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
            <div className={styles.providerList} role="listbox" aria-label="Choose a provider">
              {data.providers.map((row) => (
                <button
                  className={`${styles.providerOption} ${selected === row.provider.provider ? styles.providerOptionSelected : ''}`}
                  type="button"
                  role="option"
                  aria-selected={selected === row.provider.provider}
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
  const { message, setMessage, busy, run } = useStatus()
  const isCustomProvider = provider.declared === true
  const canEditProtocol = provider.settingsNs === 'llm-pi-ai' && isCustomProvider
  const canRemoveProvider = provider.declared === true && Boolean(namespace) && provider.settingsPath.length > 0

  function addDiscoveredModel(id: string) {
    const current = models.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    if (!current.includes(id)) setModels([...current, id].join('\n'))
  }

  async function save() {
    if (!namespace || !row.writable) return
    return run(async () => {
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
    })
  }

  async function removeCredential() {
    if (!row.credential?.configured || !row.credential.writable) return
    return run(async () => {
      apiValue(await connection.api.credentials.unset({ ref: row.credentialRef }))
      setMessage({ kind: 'success', text: 'Credential removed.' })
      await onChanged()
    })
  }

  async function discover() {
    return run(async () => {
      const result = apiValue<{ models: DiscoveredModelView[] }>(await connection.api.llm.discoverModels({
        settingsNs: provider.settingsNs,
        provider: provider.provider,
        baseURL: baseURL.trim() || undefined,
        api: canEditProtocol ? api.trim() || undefined : undefined,
        apiKey: secret.trim() || undefined,
      }))
      setDiscovered(result.models)
      setMessage({ kind: 'info', text: result.models.length ? 'Choose a model to add it to the provider.' : 'No models were discovered.' })
    })
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

      <StatusNotice message={message} />
      <div className={styles.actions}>
        <button className={`${styles.button} ${styles.primary}`} type="button" onClick={() => void save()} disabled={!row.writable || busy}>{busy ? 'Saving…' : 'Save provider'}</button>
        {row.credential?.configured ? <button className={styles.button} type="button" onClick={() => void removeCredential()} disabled={!row.credential.writable || busy}>Remove credential</button> : null}
        {canRemoveProvider ? <CustomProviderRemoval connection={connection} row={row} onChanged={onChanged} disabled={busy} /> : null}
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

function CustomProviderEditor({ connection, namespace, providers, writable, onChanged, onCreated }: { connection: any; namespace?: SettingsNamespaceView | undefined; providers: ProviderRow[]; writable: boolean; onChanged: () => Promise<void>; onCreated: (provider: string) => void }) {
  const [route, setRoute] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [api, setApi] = useState('openai-completions')
  const [model, setModel] = useState('')
  const [secret, setSecret] = useState('')
  const [savedRoute, setSavedRoute] = useState('')
  const { message, setMessage, busy, run } = useStatus()

  const normalizedRoute = route.trim().toLowerCase()
  const routeTaken = providers.some((row) => row.provider.provider === normalizedRoute)
  const routeValid = PROVIDER_ROUTE_PATTERN.test(normalizedRoute)
  const canSave = Boolean(namespace && writable && routeValid && !routeTaken && baseURL.trim() && model.trim())
  const credentialRef = `${normalizedRoute.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}_API_KEY`

  async function save() {
    if (!namespace || !canSave) return
    return run(async () => {
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
    })
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
      <StatusNotice message={message} />
      <div className={styles.actions}>
        <button className={`${styles.button} ${styles.primary}`} type="button" onClick={() => void save()} disabled={!canSave || busy}>{busy ? 'Saving…' : savedRoute ? 'Save credential' : 'Add provider'}</button>
      </div>
    </div>
  )
}
