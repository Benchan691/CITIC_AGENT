import { useEffect, useId, useRef, useState } from 'react'
import type { SocActionMode, SocClientRuntime } from 'dsh-soc-agent-client/client'
import { readActionMode } from './actionPolicy.ts'
import css from './SocActionPolicyMenu.module.css'

export function SocActionPolicyMenu({ socClient }: { socClient: SocClientRuntime }) {
  const panelId = useId()
  const generation = useRef(0)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<SocActionMode>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    const request = ++generation.current
    setError(undefined)
    const timeout = window.setTimeout(() => {
      if (active && request === generation.current) setError('Action settings could not be loaded. Close and reopen this menu to retry.')
    }, 15_000)
    void readActionMode(socClient).then(next => {
      if (!active || request !== generation.current) return
      setMode(next)
      setError(undefined)
    }).catch(reason => {
      if (active && request === generation.current) setError(reason instanceof Error ? reason.message : 'Action settings are unavailable.')
    }).finally(() => window.clearTimeout(timeout))
    return () => { active = false; window.clearTimeout(timeout) }
  }, [socClient, open])

  const selectMode = async (next: SocActionMode) => {
    if (saving || next === mode) return
    ++generation.current
    setSaving(true)
    setError(undefined)
    try {
      setMode(await readActionMode(socClient, next))
      setOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The access mode could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return <div className={css.root}>
    <button className={css.trigger} type="button" disabled={saving} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      <span className={css.icon} aria-hidden="true">✓</span>
      <span>{mode === 'full' ? 'Full access' : mode === 'soc' ? 'SOC mode' : 'Access mode'}</span>
    </button>
    {open && <div className={css.panel} id={panelId} role="dialog" aria-label="SOC action modes">
      {!mode && !error && <p className={css.status}>Loading actions…</p>}
      {error && <p className={css.error} role="status">{error}</p>}
      {mode && <fieldset className={css.modes} disabled={saving}>
        <legend className={css.modeLegend}>Choose a mode</legend>
        {(['full', 'soc'] as const).map(option => <label className={css.mode} key={option}>
          <input className={css.modeRadio} type="radio" name={panelId} checked={mode === option} onChange={() => { void selectMode(option) }} />
          <span className={css.modeText}>
            <span className={css.modeLabel}>{option === 'full' ? 'Full access' : 'SOC mode'}</span>
            <span className={css.modeDescription}>{option === 'full' ? 'Run every permitted tool directly.' : 'Apply each tool’s ask, auto-run, or disabled setting.'}</span>
          </span>
        </label>)}
        <p className={css.status}>Applies to your current login session.</p>
      </fieldset>}
    </div>}
  </div>
}
