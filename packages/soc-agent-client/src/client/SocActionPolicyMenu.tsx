import { useEffect, useState } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { validCatalog, type SocAction } from './SocActionApprovalSettings.tsx'
import css from './SocActionPolicyMenu.module.css'

const CHANNEL = '/soc-agent-config'

type Policy = {
  actions: SocAction[]
  autoApproveActions: string[]
  source: 'defaults' | 'session'
}

function parsePolicy(value: unknown): Policy | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  const actions = validCatalog(candidate.actions)
  const autoApproveActions = Array.isArray(candidate.autoApproveActions)
    ? candidate.autoApproveActions.filter((name): name is string => typeof name === 'string' && actions.some(action => action.name === name))
    : []
  const source = candidate.source === 'session' ? 'session' : 'defaults'
  return actions.length === 0 ? undefined : { actions, autoApproveActions, source }
}

function groupsOf(actions: readonly SocAction[]): string[] {
  return [...new Set(actions.map(action => action.group))]
}

type MenuProps = PropsRuntime<'conversation.input.left'> & { connection: ConnectionHandle }

export function SocActionPolicyMenu({ connection, sessionId }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [policy, setPolicy] = useState<Policy | undefined>()
  const [draft, setDraft] = useState<Set<string> | undefined>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(undefined)
    void connection.rpc.call(CHANNEL, 'get-action-policy', { session_id: String(sessionId) }).then(response => {
      if (!live) return
      if (!response?.ok) throw new Error(response?.error?.message || 'The session action policy is unavailable.')
      const next = parsePolicy(response.value)
      if (next === undefined) throw new Error('The session action policy is unavailable.')
      setPolicy(next)
      setDraft(new Set(next.autoApproveActions))
    }).catch(reason => {
      if (live) setError(reason instanceof Error ? reason.message : 'The session action policy is unavailable.')
    }).finally(() => {
      if (live) setLoading(false)
    })
    return () => { live = false }
  }, [connection, sessionId])

  const auto = draft ?? new Set(policy?.autoApproveActions ?? [])
  const toggle = (name: string, ask: boolean) => {
    const next = new Set(auto)
    if (ask) next.delete(name)
    else next.add(name)
    setDraft(next)
  }
  const apply = async () => {
    if (draft === undefined) return
    setSaving(true)
    setError(undefined)
    try {
      const response = await connection.rpc.call(CHANNEL, 'set-session-action-policy', {
        session_id: String(sessionId),
        auto_approve_actions: [...draft],
      })
      if (!response?.ok) throw new Error(response?.error?.message || 'The session action policy could not be saved.')
      const next = parsePolicy(response.value)
      if (next === undefined) throw new Error('The session action policy could not be saved.')
      setPolicy(next)
      setDraft(new Set(next.autoApproveActions))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The session action policy could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  const reset = async () => {
    setSaving(true)
    setError(undefined)
    try {
      const response = await connection.rpc.call(CHANNEL, 'reset-session-action-policy', { session_id: String(sessionId) })
      if (!response?.ok) throw new Error(response?.error?.message || 'The session action policy could not be reset.')
      const next = parsePolicy(response.value)
      if (next === undefined) throw new Error('The session action policy could not be reset.')
      setPolicy(next)
      setDraft(new Set(next.autoApproveActions))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The session action policy could not be reset.')
    } finally {
      setSaving(false)
    }
  }

  return <div className={css.root}>
    <button className={css.trigger} type="button" aria-expanded={open} aria-controls={`soc-action-policy-${String(sessionId)}`} onClick={() => setOpen(value => !value)}>
      <span className={css.icon} aria-hidden="true">✓</span>
      <span>Actions</span>
    </button>
    {open && <div className={css.panel} id={`soc-action-policy-${String(sessionId)}`} role="dialog" aria-label="SOC action approvals">
      <p className={css.title}>SOC action approvals</p>
      <p className={css.description}>Checked actions ask before running. This session override does not change saved defaults.</p>
      {policy?.source === 'session' && <p className={css.status}>Using a session-only override.</p>}
      {loading && <p className={css.status}>Loading actions…</p>}
      {error && <p className={css.error} role="status">{error}</p>}
      {policy !== undefined && !loading && <div className={css.groups}>
        {groupsOf(policy.actions).map(group => <fieldset className={css.group} key={group}>
          <legend className={css.groupTitle}>{group}</legend>
          {policy.actions.filter(action => action.group === group).map(action => <label className={css.action} key={action.name}>
            <input className={css.checkbox} type="checkbox" checked={!auto.has(action.name)} disabled={saving} onChange={event => toggle(action.name, event.currentTarget.checked)} />
            <span>{action.label}</span>
          </label>)}
        </fieldset>)}
      </div>}
      <div className={css.footer}>
        <button className={css.resetButton} type="button" disabled={saving || loading} onClick={() => { void reset() }}>Use saved defaults</button>
        <button className={css.actionButton} type="button" disabled={saving || loading || draft === undefined} onClick={() => { void apply() }}>{saving ? 'Saving…' : 'Apply to session'}</button>
      </div>
    </div>}
  </div>
}
