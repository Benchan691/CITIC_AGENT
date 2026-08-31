import type {
  ConfigurableProviderView,
  CredentialView,
  DiscoveredModelView,
  SettingsNamespaceView,
  SettingsPathOpView,
} from '@deepseek-ai/dsh-client-connection/client'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import styles from './AdminConsole.module.css'
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

function AdminWorkspace({ connection, email, onSignedOut }: { connection: any; email: string; onSignedOut: () => Promise<void> }) {
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    try {
      await fetch('/admin/auth/logout', { method: 'POST', credentials: 'same-origin' })
      await onSignedOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>CITICTEL-CPC · SOC AGENT</p>
            <h1 className={styles.title}>Administration console</h1>
            <p className={styles.subtitle}>A clear view of service readiness and LLM provider access.</p>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.account}>{email}</span>
            <button className={styles.button} type="button" onClick={() => void signOut()} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </header>

        <ServiceStatusPanel connection={connection} />
        <ProviderSettings connection={connection} />
      </div>
    </main>
  )
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
