import React, { useCallback, useEffect, useState } from 'react'
import css from './AuthGate.module.css'

interface AuthUser {
  zimbra_email: string
}

interface AuthState {
  authenticated: boolean
  user?: AuthUser
  notice?: string
}

async function readAuth(): Promise<AuthState> {
  const response = await fetch('/auth/me', { credentials: 'same-origin', cache: 'no-store' })
  let value: AuthState & { message?: unknown } = { authenticated: false }
  try {
    const body: unknown = await response.json()
    if (body !== null && typeof body === 'object') value = body as AuthState & { message?: unknown }
  } catch {}
  if (!response.ok) {
    return typeof value.message === 'string'
      ? { authenticated: false, notice: value.message }
      : { authenticated: false }
  }
  return value.authenticated === true && typeof value.user?.zimbra_email === 'string'
    ? value
    : { authenticated: false }
}

export function AuthGate() {
  const [state, setState] = useState<AuthState | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const next = await readAuth()
      setState(previous => !next.authenticated && !next.notice && previous?.notice
        ? { ...next, notice: previous.notice }
        : next)
    } catch { setState(previous => previous?.notice ? { authenticated: false, notice: previous.notice } : { authenticated: false }) }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 30_000)
    const onFocus = () => { void refresh() }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refresh])

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) throw new Error('Invalid email or password.')
      setPassword('')
      window.location.reload()
    } catch (caught) {
      setPassword('')
      setError(caught instanceof Error ? caught.message : 'Login failed.')
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }) } finally { window.location.reload() }
  }

  if (state === null) return <div className={css.layer}><div className={css.loading}>Loading…</div></div>
  if (!state.authenticated || !state.user) {
    return (
      <div className={css.layer} role="dialog" aria-label="Sentinel login">
        <form className={css.card} onSubmit={login}>
          <h1 className={css.title}>Sentinel</h1>
          <label className={css.field}>
            <span>Email</span>
            <input className={css.input} type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required />
          </label>
          <label className={css.field}>
            <span>Password</span>
            <input className={css.input} type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
          </label>
          {state.notice && <div className={css.notice} role="status">{state.notice}</div>}
          {error && <div className={css.error} role="alert">{error}</div>}
          <button className={css.button} type="submit" disabled={busy}>Login</button>
        </form>
      </div>
    )
  }
  return (
    <div className={css.badge} aria-label={`Signed in as ${state.user.zimbra_email}`}>
      <span>{state.user.zimbra_email}</span>
      <button className={css.logout} type="button" onClick={() => { void logout() }} disabled={busy}>Logout</button>
    </div>
  )
}
