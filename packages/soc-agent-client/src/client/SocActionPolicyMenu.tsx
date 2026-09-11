import { useEffect, useId, useState } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SocActionApprovalSettings, SocActionMode } from '../action-approval-settings.ts'
import css from './SocActionPolicyMenu.module.css'

type MenuProps = PropsRuntime<'conversation.input.left'> & {
  scope: SettingsScope<SocActionApprovalSettings>
}

export function SocActionPolicyMenu({ scope }: MenuProps) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [snapshot, setSnapshot] = useState(() => scope.getSnapshot())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => scope.subscribe(() => setSnapshot(scope.getSnapshot())), [scope])

  const mode: SocActionMode = snapshot.value?.mode === 'full' ? 'full' : 'soc'
  const selectMode = async (next: SocActionMode) => {
    if (saving || !snapshot.writable || next === mode) {
      setOpen(false)
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      await scope.set('mode', next)
      setOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The access mode could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return <div className={css.root}>
    <button className={css.trigger} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      <span className={css.icon} aria-hidden="true">✓</span>
      <span>{mode === 'full' ? 'Full access' : 'SOC mode'}</span>
    </button>
    {open && <div className={css.panel} id={panelId} role="dialog" aria-label="SOC action modes">
      {snapshot.status === 'loading' && <p className={css.status}>Loading actions…</p>}
      {snapshot.status === 'unavailable' && <p className={css.error} role="status">Action settings are unavailable.</p>}
      {error && <p className={css.error} role="status">{error}</p>}
      {snapshot.status === 'ready' && <fieldset className={css.modes}>
        <legend className={css.modeLegend}>Choose a mode</legend>
        <label className={css.mode}>
          <input className={css.modeRadio} type="radio" name={panelId} checked={mode === 'full'} disabled={saving || !snapshot.writable} onChange={() => { void selectMode('full') }} />
          <span className={css.modeText}><span className={css.modeLabel}>Full access</span><span className={css.modeDescription}>Run every permitted, non-disabled tool directly.</span></span>
        </label>
        <label className={css.mode}>
          <input className={css.modeRadio} type="radio" name={panelId} checked={mode === 'soc'} disabled={saving || !snapshot.writable} onChange={() => { void selectMode('soc') }} />
          <span className={css.modeText}><span className={css.modeLabel}>SOC mode</span><span className={css.modeDescription}>Apply each tool’s ask, auto-run, or disabled setting.</span></span>
        </label>
      </fieldset>}
    </div>}
  </div>
}
