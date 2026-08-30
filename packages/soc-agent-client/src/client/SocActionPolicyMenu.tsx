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

type ActionMode = 'ask' | 'soc'

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

function modeOf(policy: Policy): ActionMode {
  // The saved checklist is the SOC mode even when its current selection happens
  // to be all checked or all unchecked. Session overrides select the shortcuts.
  if (policy.source === 'defaults') return 'soc'
  return policy.autoApproveActions.length === 0 ? 'ask' : 'soc'
}

type MenuProps = PropsRuntime<'conversation.input.left'> & { connection: ConnectionHandle }

export function SocActionPolicyMenu({ connection, sessionId }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [policy, setPolicy] = useState<Policy | undefined>()
  const [draftMode, setDraftMode] = useState<ActionMode | undefined>()
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
      setDraftMode(modeOf(next))
    }).catch(reason => {
      if (live) setError(reason instanceof Error ? reason.message : 'The session action policy is unavailable.')
    }).finally(() => {
      if (live) setLoading(false)
    })
    return () => { live = false }
  }, [connection, sessionId])

  const currentMode = policy === undefined ? undefined : modeOf(policy)
  const selectedMode = draftMode ?? currentMode
  const selectMode = async (mode: ActionMode) => {
    if (policy === undefined || saving) return
    if (mode === currentMode && !(mode === 'soc' && policy.source === 'session')) {
      setOpen(false)
      return
    }
    setDraftMode(mode)
    setSaving(true)
    setError(undefined)
    try {
      const response = mode === 'soc'
        ? await connection.rpc.call(CHANNEL, 'reset-session-action-policy', { session_id: String(sessionId) })
        : await connection.rpc.call(CHANNEL, 'set-session-action-policy', {
          session_id: String(sessionId),
          auto_approve_actions: [],
        })
      if (!response?.ok) throw new Error(response?.error?.message || 'The session action policy could not be saved.')
      const next = parsePolicy(response.value)
      if (next === undefined) throw new Error('The session action policy could not be saved.')
      setPolicy(next)
      setDraftMode(modeOf(next))
      setOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The session action policy could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  const modeLabel = selectedMode === 'ask' ? 'Ask for approval' : 'SOC mode'

  return <div className={css.root}>
    <button className={css.trigger} type="button" aria-expanded={open} aria-controls={`soc-action-policy-${String(sessionId)}`} onClick={() => setOpen(value => !value)}>
      <span className={css.icon} aria-hidden="true">✓</span>
      <span>{modeLabel}</span>
    </button>
    {open && <div className={css.panel} id={`soc-action-policy-${String(sessionId)}`} role="dialog" aria-label="SOC action modes">
      {loading && <p className={css.status}>Loading actions…</p>}
      {error && <p className={css.error} role="status">{error}</p>}
      {policy !== undefined && !loading && <fieldset className={css.modes}>
        <legend className={css.modeLegend}>Choose a mode</legend>
        <label className={css.mode}>
          <input className={css.modeRadio} type="radio" name={`soc-action-mode-${String(sessionId)}`} checked={selectedMode === 'ask'} readOnly disabled={saving} onClick={() => { void selectMode('ask') }} />
          <span className={css.modeText}><span className={css.modeLabel}>Ask for approval</span><span className={css.modeDescription}>Ask before every known SOC action.</span></span>
        </label>
        <label className={css.mode}>
          <input className={css.modeRadio} type="radio" name={`soc-action-mode-${String(sessionId)}`} checked={selectedMode === 'soc'} readOnly disabled={saving} onClick={() => { void selectMode('soc') }} />
          <span className={css.modeText}><span className={css.modeLabel}>SOC mode</span><span className={css.modeDescription}>Use the approval checklist from Settings → Plugins.</span></span>
        </label>
      </fieldset>}
    </div>}
  </div>
}
