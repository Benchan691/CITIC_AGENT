import React, { useCallback, useEffect, useState } from 'react'
import css from './AuthGate.module.css'

interface AuthUser {
  zimbra_email: string
}

interface AuthState {
  authenticated: boolean
  user?: AuthUser
  notice?: string
  two_factor_required?: boolean
  masked_email?: string
  expires_at?: string
}

type AuthPayload = AuthState & { message?: unknown; error?: unknown; code?: unknown }

async function responsePayload(response: Response): Promise<AuthPayload> {
  try {
    const body: unknown = await response.json()
    if (body !== null && typeof body === 'object' && !Array.isArray(body)) return body as AuthPayload
  } catch {}
  return { authenticated: false }
}

async function readAuth(): Promise<AuthState> {
  const response = await fetch('/auth/me', { credentials: 'same-origin', cache: 'no-store' })
  const value = await responsePayload(response)
  if (!response.ok) {
    const challengeResponse = await fetch('/auth/2fa', { credentials: 'same-origin', cache: 'no-store' })
    const challenge = await responsePayload(challengeResponse)
    if (challengeResponse.ok && challenge.two_factor_required === true && typeof challenge.masked_email === 'string') {
      const resumed: AuthState = {
        authenticated: false,
        two_factor_required: true,
        masked_email: challenge.masked_email,
      }
      if (typeof challenge.expires_at === 'string') resumed.expires_at = challenge.expires_at
      return resumed
    }
    return typeof value.message === 'string'
      ? { authenticated: false, notice: value.message }
      : typeof challenge.error === 'string'
        ? { authenticated: false, notice: challenge.error }
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
  const [code, setCode] = useState('')
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
      const body = await responsePayload(response)
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Invalid email or password.')
      setPassword('')
      if (body.two_factor_required === true && typeof body.masked_email === 'string') {
        setCode('')
        const challengeState: AuthState = {
          authenticated: false,
          two_factor_required: true,
          masked_email: body.masked_email,
        }
        if (typeof body.expires_at === 'string') challengeState.expires_at = body.expires_at
        setState(challengeState)
        setBusy(false)
        return
      }
      window.location.reload()
    } catch (caught) {
      setPassword('')
      setError(caught instanceof Error ? caught.message : 'Login failed.')
      setBusy(false)
    }
  }

  const verifyTwoFactor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/auth/2fa', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const body = await responsePayload(response)
      if (!response.ok) {
        setCode('')
        const message = typeof body.error === 'string' ? body.error : 'The authenticator code could not be verified.'
        setError(message)
        if (body.two_factor_required !== true) {
          setState({ authenticated: false, notice: message })
        } else {
          setState(previous => {
            const challengeState: AuthState = {
              authenticated: false,
              two_factor_required: true,
            }
            const maskedEmail = typeof body.masked_email === 'string' ? body.masked_email : previous?.masked_email
            const expiresAt = typeof body.expires_at === 'string' ? body.expires_at : previous?.expires_at
            if (maskedEmail) challengeState.masked_email = maskedEmail
            if (expiresAt) challengeState.expires_at = expiresAt
            return challengeState
          })
        }
        setBusy(false)
        return
      }
      setCode('')
      window.location.reload()
    } catch (caught) {
      setCode('')
      setError(caught instanceof Error ? caught.message : 'The authenticator code could not be verified.')
      setBusy(false)
    }
  }

  const cancelTwoFactor = async () => {
    setBusy(true)
    setError('')
    try {
      await fetch('/auth/2fa/cancel', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
    } catch {}
    finally {
      setCode('')
      setState({ authenticated: false })
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }) } finally { window.location.reload() }
  }

  if (state === null) return <div className={css.layer}><div className={css.loading}>Loading…</div></div>
  if (!state.authenticated || !state.user) {
    if (state.two_factor_required) {
      return (
        <div className={css.layer} role="dialog" aria-label="Authenticator verification">
          <form className={css.card} onSubmit={verifyTwoFactor}>
            <h1 className={css.title}>Verify your identity</h1>
            <p className={css.description}>
              Enter the six-digit code from your authenticator app for <strong>{state.masked_email}</strong>.
            </p>
            <label className={css.field}>
              <span>Authenticator code</span>
              <input
                className={css.input}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={event => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                required
                autoFocus
              />
            </label>
            {error && <div className={css.error} role="alert">{error}</div>}
            <div className={css.actions}>
              <button className={css.button} type="submit" disabled={busy || code.length !== 6}>Verify</button>
              <button className={css.secondaryButton} type="button" onClick={() => { void cancelTwoFactor() }} disabled={busy}>Cancel</button>
            </div>
          </form>
        </div>
      )
    }
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
