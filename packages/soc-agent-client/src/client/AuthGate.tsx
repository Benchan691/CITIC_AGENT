import React, { useCallback, useEffect, useState } from 'react'
import css from './AuthGate.module.css'

interface AuthUser {
  zimbra_email: string
}

interface AuthState {
  authenticated: boolean
  user?: AuthUser
}

async function readAuth(): Promise<AuthState> {
  const response = await fetch('/auth/me', { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) return { authenticated: false }
  const value = await response.json() as AuthState
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
    try { setState(await readAuth()) } catch { setState({ authenticated: false }) }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 30_000)
    return () => window.clearInterval(timer)
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
      <div className={css.layer} role="dialog" aria-label="SOC Agent login">
        <form className={css.card} onSubmit={login}>
          <h1 className={css.title}>SOC Agent</h1>
          <label className={css.field}>
            <span>Email</span>
            <input className={css.input} type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required />
          </label>
          <label className={css.field}>
            <span>Password</span>
            <input className={css.input} type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
          </label>
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
